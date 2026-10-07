/* Módulo: gerador de lotes. */

/* Lotes */

function getLastLotSequence() {
    const stored = Number(localStorage.getItem(LOT_SEQUENCE_KEY));
    return Number.isInteger(stored) && stored >= 0 ? stored : 0;
}

function formatLotPart(value, size, pad=true) {
    const d=onlyDigits(value).slice(0,size);
    return pad?d.padStart(size,"0"):d;
}

function getLotFormValues() {
    const sector = formatLotPart($("#loteSetor").value, 3, false);
    const block = formatLotPart($("#loteQuadra").value, 3);
    const quantity = Math.min(
        100,
        Math.max(1, Number($("#loteQuantidade").value) || 1)
    );
    const initial = Math.min(
        99999,
        Math.max(1, Number($("#loteSequenciaInicial").value) || 1)
    );
    const separator = $("#loteSeparador").value;

    return { sector, block, quantity, initial, separator };
}

function buildLotNumber(sector, block, sequence, separator) {
    return [
        sector,
        block,
        String(sequence).padStart(5, "0")
    ].join(separator);
}

function generateLotList() {
    const { sector, block, quantity, initial, separator } =
        getLotFormValues();

    return Array.from({ length: quantity }, (_, index) =>
        buildLotNumber(sector, block, initial + index, separator)
    );
}

function updateLotPreview() {
    const { sector, block, quantity, initial, separator } =
        getLotFormValues();

    $("#loteSetor").value = onlyDigits($("#loteSetor").value).slice(0, 3);
    $("#loteQuadra").value = onlyDigits($("#loteQuadra").value).slice(0, 3);
    $("#loteQuantidadeResumo").textContent = String(quantity);
    $("#loteProximaSequencia").textContent =
        String(getLastLotSequence() + 1).padStart(5, "0");

    const preview = buildLotNumber(
        sector,
        block,
        initial,
        separator
    );

    $("#lotePreview").textContent = preview;
    $("#lotePadraoExemplo").textContent = preview;
    saveFormData();
}

function updateLastLotDisplay() {
    const last = getLastLotSequence();
    $("#loteUltimaSequencia").textContent =
        String(last).padStart(5, "0");
    $("#loteProximaSequencia").textContent =
        String(last + 1).padStart(5, "0");
}

function restoreLotSequenceState() {
    const last = getLastLotSequence();
    $("#loteSequenciaInicial").value = last + 1;
    updateLastLotDisplay();
}

function getLotHistory() {
    return getJson(LOT_HISTORY_KEY, []);
}

function addLotHistory(lots) {
    const item = {
        id: createUniqueId(),
        first: lots[0],
        last: lots[lots.length - 1],
        quantity: lots.length,
        content: lots.join("\n"),
        createdAt: new Date().toISOString()
    };

    const history = getLotHistory().slice(0, 14);
    history.unshift(item);
    setJson(LOT_HISTORY_KEY, history);
    window.HistoryService?.notifyLocalChange?.();
    window.HistoryService?.queueHistory?.("lote", item, "generated");
    renderLotHistory();
}


function deleteLotHistoryItem(item) {
    if (!window.confirm("Excluir este registro do histórico sincronizado? A exclusão será aplicada aos demais dispositivos após sincronizar.")) return;
    const fingerprint = window.HistoryService?.fingerprintValue?.(item);
    const current = getJson(LOT_HISTORY_KEY, []);
    const next = (Array.isArray(current) ? current : []).filter((entry) => fingerprint ? window.HistoryService?.fingerprintValue?.(entry) !== fingerprint : entry !== item);
    setJson(LOT_HISTORY_KEY, next);
    window.HistoryService?.queueDeleteHistory?.("lote", item, { source: "lote_history" });
    renderLotHistory();
    window.renderProductivity33?.();
    showToast("Exclusão registrada para sincronização.");
}

function renderLotHistory() {
    const history = getLotHistory();

    renderHistoryList({
        list: $("#loteHistorico"),
        items: history,
        emptyMessage: "Nenhum lote gerado recentemente.",
        getText: (item) => item.quantity === 1
            ? item.first
            : `${item.first} até ${item.last} (${item.quantity})`,
        getActions: () => [
            {
                label: "Copiar",
                onClick: (item) => copyText(item.content)
            },
            {
                label: "Excluir",
                onClick: (item) => deleteLotHistoryItem(item)
            }
        ]
    });
}

[
    "loteSetor",
    "loteQuadra",
    "loteQuantidade",
    "loteSequenciaInicial",
    "loteSeparador"
].forEach((id) => {
    const field = document.getElementById(id);
    field.addEventListener("input", updateLotPreview);
    field.addEventListener("change", updateLotPreview);
});

$("#gerarLotes").addEventListener("click", async () => {
    const lots = generateLotList();
    const { initial, quantity } = getLotFormValues();
    const finalSequence = initial + quantity - 1;
    const nextSequence = finalSequence + 1;

    // v4.6.7: confirma o novo estado da sequência antes de concluir a geração.
    // Reduções manuais são válidas; somente uma revisão remota concorrente bloqueia a operação.
    let sequenceResult = await window.LotSequenceService?.commitSequence?.(finalSequence);
    if (sequenceResult?.conflict) {
        const remoteLast = Number(sequenceResult.remote?.last_sequence) || 0;
        const remoteNext = String(remoteLast + 1).padStart(5, "0");
        const localFirst = String(initial).padStart(5, "0");
        const localLast = String(finalSequence).padStart(5, "0");
        const useLocal = await confirmAction(
            `Outro dispositivo alterou a sequência. A próxima sequência online é ${remoteNext}. ` +
            `Você está tentando gerar ${localFirst}${quantity > 1 ? ` até ${localLast}` : ""}. ` +
            "Deseja usar sua sequência mesmo assim?",
            { title: "Conflito de sequência", confirmText: "Usar minha sequência" }
        );
        if (!useLocal) {
            await window.LotSequenceService?.sync?.({ preferRemote: true });
            showToast("Sequência online mantida. Nenhum lote foi gerado.");
            return;
        }
        sequenceResult = await window.LotSequenceService?.forceCommitSequence?.(finalSequence);
        if (sequenceResult?.conflict || sequenceResult?.offline) {
            await window.LotSequenceService?.sync?.({ preferRemote: true });
            showToast("A sequência mudou novamente. Sincronize e tente outra vez.");
            return;
        }
    }

    $("#loteResultado").textContent = lots.join("\n");
    localStorage.setItem(LOT_SEQUENCE_KEY, String(finalSequence));

    $("#loteSequenciaInicial").value = nextSequence;

    updateLastLotDisplay();
    updateLotPreview();
    addLotHistory(lots);
    await copyText(lots.join("\n"));
    showToast(`${lots.length} lote(s) gerado(s) e copiado(s). Próxima sequência preparada.`);
});


$("#baixarLotesTxt").addEventListener("click", () => {
    const content = $("#loteResultado").textContent.trim();

    if (!content || content === "—") {
        showToast("Gere os lotes antes de baixar.");
        return;
    }

    downloadTextFile(`lotes-${todayIsoDate()}.txt`, content);
    showToast("Arquivo TXT gerado.");
});

$("#limparLotes").addEventListener("click", () => {
    $("#loteResultado").textContent = "—";
    $("#loteQuantidade").value = 1;
    updateLotPreview();
});

$("#reiniciarSequenciaLotes").addEventListener("click", async () => {
    const confirmed = await confirmAction(
        "Deseja reiniciar a sequência para 00001?",
        { title: "Reiniciar sequência", confirmText: "Reiniciar" }
    );

    if (!confirmed) {
        return;
    }

    // Zero is used only as the internal state before the first sequence.
    // The first lot generated after a reset is therefore 00001.
    const resetResult = await window.LotSequenceService?.commitSequence?.(0);
    if (resetResult?.conflict) {
        showToast("A sequência foi alterada em outro dispositivo. Sincronize antes de reiniciar.");
        await window.LotSequenceService?.sync?.({ preferRemote: true });
        return;
    }
    localStorage.setItem(LOT_SEQUENCE_KEY, "0");
    $("#loteSequenciaInicial").value = 1;
    $("#loteResultado").textContent = "—";

    updateLastLotDisplay();
    updateLotPreview();
    showToast("Sequência reiniciada.");
});

// Permite atualizar o histórico após sincronização remota.
window.renderLotHistory = renderLotHistory;
