/* Módulo: inscrição imobiliária. */

/* Inscrição imobiliária */

let lastAutoCopiedRegistration = "";

function getSelectedRegistrationType() {
    return document.querySelector(
        'input[name="inscricaoTipo"]:checked'
    )?.value || "auto";
}

function detectRegistrationType(digits) {
    const selectedType = getSelectedRegistrationType();

    if (selectedType !== "auto") {
        return selectedType;
    }

    if (digits.length > 13) {
        return "urbano";
    }

    if (digits.length === 13) {
        return "itr";
    }

    return "indefinido";
}

function applyUrbanMask(value) {
    const digits = onlyDigits(value).slice(0, 17);
    const groups = [2, 3, 3, 2, 7];
    const parts = [];
    let index = 0;

    for (const size of groups) {
        const part = digits.slice(index, index + size);

        if (!part) {
            break;
        }

        parts.push(part);
        index += size;
    }

    return parts.join(".");
}

function applyItrMask(value) {
    const digits = onlyDigits(value).slice(0, 13);
    const first = digits.slice(0, 3);
    const second = digits.slice(3, 6);
    const third = digits.slice(6, 9);
    const fourth = digits.slice(9, 12);
    const verifier = digits.slice(12, 13);

    let result = first;

    if (second) result += `.${second}`;
    if (third) result += `.${third}`;
    if (fourth) result += `.${fourth}`;
    if (verifier) result += `-${verifier}`;

    return result;
}

function getRegistrationHistory() {
    return getJson(REGISTRATION_HISTORY_KEY, []);
}

function addRegistrationHistory(masked, type) {
    const item = {
        masked,
        digits: onlyDigits(masked),
        type,
        copiedAt: new Date().toISOString()
    };

    const history = getRegistrationHistory()
        .filter((entry) => entry.masked !== masked)
        .slice(0, 14);

    history.unshift(item);
    setJson(REGISTRATION_HISTORY_KEY, history);
    window.HistoryService?.notifyLocalChange?.();
    window.HistoryService?.queueHistory?.("inscricao", item, "copied");
    renderRegistrationHistory();
}


function deleteRegistrationHistoryItem(item) {
    if (!window.confirm("Excluir este registro do histórico sincronizado? A exclusão será aplicada aos demais dispositivos após sincronizar.")) return;
    const fingerprint = window.HistoryService?.fingerprintValue?.(item);
    const current = getJson(REGISTRATION_HISTORY_KEY, []);
    const next = (Array.isArray(current) ? current : []).filter((entry) => fingerprint ? window.HistoryService?.fingerprintValue?.(entry) !== fingerprint : entry !== item);
    setJson(REGISTRATION_HISTORY_KEY, next);
    window.HistoryService?.queueDeleteHistory?.("inscricao", item, { source: "inscricao_history" });
    renderRegistrationHistory();
    window.renderProductivity33?.();
    showToast("Exclusão registrada para sincronização.");
}

function renderRegistrationHistory() {
    const history = getRegistrationHistory();

    renderHistoryList({
        list: $("#inscricaoHistorico"),
        items: history,
        emptyMessage: "Nenhuma inscrição copiada recentemente.",
        getText: (item) => `${item.masked} (${item.type.toUpperCase()})`,
        getActions: () => [
            {
                label: "Copiar",
                onClick: (item) => copyText(item.masked)
            },
            {
                label: "Números",
                onClick: (item) => copyText(item.digits)
            },
            {
                label: "Excluir",
                onClick: (item) => deleteRegistrationHistoryItem(item)
            }
        ]
    });
}

async function maybeAutoCopyRegistration(masked, type, valid) {
    if (
        !valid ||
        !$("#inscricaoCopiaAutomatica").checked ||
        masked === lastAutoCopiedRegistration
    ) {
        return;
    }

    const copied = await copyText(masked);

    if (copied) {
        lastAutoCopiedRegistration = masked;
        addRegistrationHistory(masked, type);
    }
}

function updateRegistrationField() {
    const field = $("#inscricaoValor");
    const preview = $("#inscricaoPreview");
    const help = $("#inscricaoAjuda");
    const typeElement = $("#inscricaoTipoDetectado");
    const countElement = $("#inscricaoContagem");
    const statusElement = $("#inscricaoStatus");

    const rawDigits = onlyDigits(field.value);
    const type = detectRegistrationType(rawDigits);
    const exceeded = (type === "urbano" && rawDigits.length > 17) || (type === "itr" && rawDigits.length > 13);
    const maxLength = type === "itr" ? 13 : 17;
    const digits = rawDigits.slice(0, maxLength);

    let masked = "";
    let expected = 0;
    let typeLabel = "Aguardando";

    if (type === "urbano") {
        expected = 17;
        typeLabel = "Urbano";
        masked = applyUrbanMask(digits);
    } else if (type === "itr") {
        expected = 13;
        typeLabel = "ITR";
        masked = applyItrMask(digits);
    } else {
        masked = digits;
    }

    field.value = masked;
    preview.textContent = masked || "—";
    typeElement.textContent = typeLabel;
    countElement.textContent = String(digits.length);

    help.classList.remove("error", "success");
    statusElement.classList.remove("status-valid", "status-invalid");

    if (digits.length === 0) {
        statusElement.textContent = "Aguardando";
        help.textContent =
            "O padrão urbano possui 17 números e o ITR possui 13 números.";
        lastAutoCopiedRegistration = "";
        return;
    }

    if (type === "indefinido") {
        statusElement.textContent = "Incompleta";
        statusElement.classList.add("status-invalid");
        help.textContent =
            "Continue digitando ou selecione manualmente o tipo.";
        help.classList.add("error");
        lastAutoCopiedRegistration = "";
        return;
    }

    if (exceeded) {
        statusElement.textContent = "Inválida";
        statusElement.classList.add("status-invalid");
        help.textContent = `Quantidade incorreta: informado ${rawDigits.length} números. O padrão ${typeLabel} aceita exatamente ${expected} números.`;
        help.classList.add("error");
        lastAutoCopiedRegistration = "";
        return;
    }

    const valid = digits.length === expected;

    if (valid) {
        statusElement.textContent = "Completa";
        statusElement.classList.add("status-valid");
        help.textContent = `Inscrição ${typeLabel} completa e normalizada.`;
        help.classList.add("success");
        maybeAutoCopyRegistration(masked, type, true);
    } else {
        statusElement.textContent = "Incompleta";
        statusElement.classList.add("status-invalid");
        help.textContent =
            `Quantidade atual: ${digits.length} de ${expected} números.`;
        help.classList.add("error");
        lastAutoCopiedRegistration = "";
    }
}

$("#inscricaoValor").addEventListener("input", updateRegistrationField);

$("#inscricaoValor").addEventListener("paste", () => {
    window.setTimeout(updateRegistrationField, 0);
});

document
    .querySelectorAll('input[name="inscricaoTipo"]')
    .forEach((radio) => {
        radio.addEventListener("change", () => {
            lastAutoCopiedRegistration = "";
            updateRegistrationField();
        });
    });

$("#inscricaoCopiaAutomatica").addEventListener("change", (event) => {
    localStorage.setItem(
        REGISTRATION_AUTO_COPY_KEY,
        String(event.target.checked)
    );

    lastAutoCopiedRegistration = "";

    if (event.target.checked) {
        showToast("Cópia automática ativada.");
        updateRegistrationField();
    } else {
        showToast("Cópia automática desativada.");
    }
});

$("#copiarInscricao").addEventListener("click", async () => {
    const masked = $("#inscricaoPreview").textContent.trim();
    const digits = onlyDigits(masked);
    const type = detectRegistrationType(digits);
    const expected = type === "urbano" ? 17 : type === "itr" ? 13 : 0;

    if (!expected || digits.length !== expected) {
        showToast("Complete a inscrição antes de copiar.");
        return;
    }

    const copied = await copyText(masked);

    if (copied) {
        addRegistrationHistory(masked, type);
    }
});

$("#copiarInscricaoSemMascara").addEventListener("click", async () => {
    const masked = $("#inscricaoPreview").textContent.trim();
    const digits = onlyDigits(masked);
    const type = detectRegistrationType(digits);
    const expected = type === "urbano" ? 17 : type === "itr" ? 13 : 0;

    if (!expected || digits.length !== expected) {
        showToast("Complete a inscrição antes de copiar.");
        return;
    }

    const copied = await copyText(digits);

    if (copied) {
        addRegistrationHistory(masked, type);
    }
});

$("#limparInscricao").addEventListener("click", () => {
    $("#inscricaoValor").value = "";
    lastAutoCopiedRegistration = "";
    updateRegistrationField();
});

// Permite atualizar o histórico após sincronização remota.
window.renderRegistrationHistory = renderRegistrationHistory;
