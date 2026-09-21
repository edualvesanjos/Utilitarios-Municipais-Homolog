/* Módulo: calculadora UVRM com lista de lançamentos. */

const DEFAULT_UVRM_VALUE = 5.2151;
const UVRM_CURRENT_LIST_KEY = `${STORAGE_PREFIX}uvrmCurrentList`;
const UVRM_DESCRIPTION_HISTORY_KEY = `${STORAGE_PREFIX}uvrmDescriptionHistory`;
const UVRM_DESCRIPTION_HISTORY_LIMIT = 30;
let uvrmEditingId = null;
let uvrmPreview = null;

function parseLocaleNumber(value) {
    if (typeof value === "number") return value;
    const normalized = String(value).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDecimal(value, decimals) {
    return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function roundCurrency(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }

function formatUvrmCurrency(value) {
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getUvrmValue() {
    const value = parseLocaleNumber($("#uvrmValorUnitario").value);
    return Number.isFinite(value) && value > 0 ? value : NaN;
}

function getUvrmDecimals() {
    return Math.max(2, Math.min(6, Number($("#uvrmCasas").value) || 2));
}

function getUvrmCurrentList() { return getJson(UVRM_CURRENT_LIST_KEY, []); }
function saveUvrmCurrentList(items) { setJson(UVRM_CURRENT_LIST_KEY, items); renderUvrmCurrentList(); }
function getUvrmHistory() { return getJson(UVRM_HISTORY_KEY, []); }
function normalizeUvrmDescription(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
}

function getUvrmDescriptionHistory() {
    const stored = getJson(UVRM_DESCRIPTION_HISTORY_KEY, []);
    return Array.isArray(stored)
        ? stored.map(normalizeUvrmDescription).filter(Boolean).slice(0, UVRM_DESCRIPTION_HISTORY_LIMIT)
        : [];
}

function renderUvrmDescriptionSuggestions() {
    const list = $("#uvrmDescricaoSugestoes");
    if (!list) return;
    list.replaceChildren(...getUvrmDescriptionHistory().map(description => {
        const option = document.createElement("option");
        option.value = description;
        return option;
    }));
}

function rememberUvrmDescription(value) {
    const description = normalizeUvrmDescription(value);
    if (!description) return;

    const normalizedKey = description.toLocaleLowerCase("pt-BR");
    const history = getUvrmDescriptionHistory()
        .filter(item => item.toLocaleLowerCase("pt-BR") !== normalizedKey);

    history.unshift(description);
    setJson(UVRM_DESCRIPTION_HISTORY_KEY, history.slice(0, UVRM_DESCRIPTION_HISTORY_LIMIT));
    renderUvrmDescriptionSuggestions();
}


function clearUvrmResult(message = "Informe o valor do lançamento.") {
    $("#uvrmResultado").textContent = "—";
    $("#uvrmResultadoDetalhe").textContent = "";
    $("#uvrmAjuda").textContent = message;
    $("#uvrmAjuda").classList.remove("error", "success");
    uvrmPreview = null;
}

function updateUvrmTypeInterface() {
    const isUvrm = $("#uvrmTipoLancamento").value === "uvrm";
    $("#uvrmValorLancamentoLabel").textContent = isUvrm ? "Valor em UVRM" : "Valor em reais";
    $("#uvrmValorLancamento").placeholder = "0,00";
    $("#uvrmMultiplicadorCampo").hidden = !isUvrm;
    if (isUvrm && (!Number.isFinite(Number($("#uvrmMultiplicador").value)) || Number($("#uvrmMultiplicador").value) < 1)) {
        $("#uvrmMultiplicador").value = "1";
    }
    calculateUvrmPreview();
}

function calculateUvrmPreview() {
    const unit = getUvrmValue();
    const input = parseLocaleNumber($("#uvrmValorLancamento").value);
    const type = $("#uvrmTipoLancamento").value;
    const description = $("#uvrmDescricao").value.trim();
    const decimals = getUvrmDecimals();
    const multiplier = type === "uvrm" ? Number($("#uvrmMultiplicador").value) : 1;

    if (!Number.isFinite(unit)) {
        clearUvrmResult("Informe um valor válido para a UVRM.");
        $("#uvrmAjuda").classList.add("error");
        return;
    }
    if (!Number.isFinite(input) || input < 0) { clearUvrmResult(); return; }
    if (type === "uvrm" && (!Number.isInteger(multiplier) || multiplier < 1)) {
        clearUvrmResult("Informe uma quantidade inteira igual ou maior que 1.");
        $("#uvrmAjuda").classList.add("error");
        return;
    }

    const rawReais = type === "uvrm" ? input * multiplier * unit : input;
    const reais = roundCurrency(rawReais);
    const quantity = type === "uvrm" ? input * multiplier : input / unit;
    const formattedReais = formatUvrmCurrency(reais);
    const formattedQuantity = formatDecimal(quantity, decimals);

    uvrmPreview = { type, inputValue: input, multiplier, reais, quantity, unitValue: unit, description };
    $("#uvrmResultado").textContent = formattedReais;
    $("#uvrmResultadoDetalhe").textContent = type === "uvrm"
        ? `${formatDecimal(input, decimals)} UVRM × ${multiplier} × ${formatUvrmCurrency(unit)} = ${formattedQuantity} UVRM`
        : `${formattedReais} corresponde a ${formattedQuantity} UVRM`;
    $("#uvrmAjuda").textContent = "Lançamento pronto para ser adicionado.";
    $("#uvrmAjuda").classList.remove("error");
    $("#uvrmAjuda").classList.add("success");
}

function resetUvrmEntryForm() {
    $("#uvrmDescricao").value = "";
    $("#uvrmValorLancamento").value = "";
    $("#uvrmMultiplicador").value = "1";
    uvrmEditingId = null;
    $("#adicionarUvrmLancamento").textContent = "Adicionar à lista";
    $("#cancelarEdicaoUvrm").hidden = true;
    clearUvrmResult();
}

function addOrUpdateUvrmEntry() {
    calculateUvrmPreview();
    if (!uvrmPreview) {
        showToast("Informe um valor válido para o lançamento.", "warning");
        return;
    }
    const items = getUvrmCurrentList();
    rememberUvrmDescription(uvrmPreview.description);
    const entry = { ...uvrmPreview, id: uvrmEditingId || createUniqueId(), createdAt: new Date().toISOString() };
    const index = items.findIndex(item => item.id === uvrmEditingId);
    if (index >= 0) items[index] = entry; else items.push(entry);
    saveUvrmCurrentList(items);
    resetUvrmEntryForm();
    showToast(index >= 0 ? "Lançamento atualizado." : "Lançamento adicionado.");
}

function getUvrmEntryDetail(item) {
    const decimals = getUvrmDecimals();
    const multiplier = Math.max(1, Number(item.multiplier) || 1);
    return item.type === "uvrm"
        ? `${formatDecimal(item.inputValue ?? item.quantity, decimals)} UVRM × ${multiplier} × ${formatUvrmCurrency(item.unitValue)}`
        : `Valor informado diretamente em reais`;
}

function renderUvrmCurrentList() {
    const items = getUvrmCurrentList();
    const container = $("#uvrmListaAtual");
    const total = roundCurrency(items.reduce((sum, item) => sum + roundCurrency(item.reais || 0), 0));
    $("#uvrmContador").textContent = `${items.length} ${items.length === 1 ? "item" : "itens"}`;
    $("#uvrmTotalAtual").textContent = formatUvrmCurrency(total);

    if (!items.length) {
        container.innerHTML = '<p class="empty-state">Nenhum lançamento adicionado.</p>';
        return;
    }
    container.innerHTML = items.map((item, index) => `
        <article class="uvrm-entry-row" data-id="${item.id}">
            <div class="uvrm-entry-number">${index + 1}</div>
            <div class="uvrm-entry-content">
                <strong>${escapeHtml(item.description || `Lançamento ${index + 1}`)}</strong>
                <span>${escapeHtml(getUvrmEntryDetail(item))}</span>
            </div>
            <strong class="uvrm-entry-value">${formatUvrmCurrency(item.reais)}</strong>
            <div class="uvrm-entry-actions">
                <button type="button" class="small-button" data-uvrm-action="copy">Copiar</button>
                <button type="button" class="small-button secondary" data-uvrm-action="edit">Editar</button>
                <button type="button" class="small-button danger" data-uvrm-action="delete">Excluir</button>
            </div>
        </article>`).join("");

    container.querySelectorAll("[data-uvrm-action]").forEach(button => {
        button.addEventListener("click", async () => {
            const id = button.closest("[data-id]").dataset.id;
            const item = getUvrmCurrentList().find(entry => entry.id === id);
            if (!item) return;
            const action = button.dataset.uvrmAction;
            if (action === "copy") await copyText(formatUvrmCurrency(item.reais));
            if (action === "edit") editUvrmEntry(item);
            if (action === "delete") saveUvrmCurrentList(getUvrmCurrentList().filter(entry => entry.id !== id));
        });
    });
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value || "");
    return div.innerHTML;
}

function editUvrmEntry(item) {
    uvrmEditingId = item.id;
    $("#uvrmDescricao").value = item.description || "";
    $("#uvrmTipoLancamento").value = item.type;
    $("#uvrmValorLancamento").value = formatDecimal(item.inputValue, item.type === "reais" ? 2 : getUvrmDecimals());
    $("#uvrmMultiplicador").value = String(Math.max(1, Number(item.multiplier) || 1));
    $("#adicionarUvrmLancamento").textContent = "Salvar alteração";
    $("#cancelarEdicaoUvrm").hidden = false;
    updateUvrmTypeInterface();
    $("#uvrmDescricao").focus();
}

function buildUvrmPlainValues(items) { return items.map(item => formatUvrmCurrency(item.reais)).join("\n"); }
function buildUvrmDetailedText(items) {
    const total = roundCurrency(items.reduce((sum, item) => sum + roundCurrency(item.reais || 0), 0));
    const lines = items.map((item, index) => `${index + 1}. ${item.description || "Lançamento"}: ${formatUvrmCurrency(item.reais)}`);
    return [...lines, `Total: ${formatUvrmCurrency(total)}`].join("\n");
}

function saveUvrmOperation() {
    const items = getUvrmCurrentList();
    if (!items.length) return showToast("Adicione pelo menos um lançamento.", "warning");
    const total = roundCurrency(items.reduce((sum, item) => sum + roundCurrency(item.reais || 0), 0));
    const operation = { id: createUniqueId(), items, total, itemCount: items.length, createdAt: new Date().toISOString(), fullText: buildUvrmDetailedText(items), plainValue: formatUvrmCurrency(total) };
    const history = getUvrmHistory();
    history.unshift(operation);
    setJson(UVRM_HISTORY_KEY, history.slice(0, 50));
    window.HistoryService?.notifyLocalChange?.();
    window.HistoryService?.queueHistory?.("uvrm", operation, "saved");
    localStorage.removeItem(UVRM_CURRENT_LIST_KEY);
    renderUvrmCurrentList();
    renderUvrmHistory();
    showToast("Operação salva no histórico.");
}

function normalizeLegacyHistoryItem(item) {
    if (Array.isArray(item.items)) return item;
    return { ...item, legacy: true, total: null, itemCount: 1, items: [], fullText: item.fullText || item.plainValue || "Cálculo UVRM" };
}

function renderUvrmHistory() {
    const query = ($("#pesquisaHistoricoUvrm")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const history = getUvrmHistory().map(normalizeLegacyHistoryItem).filter(item => item.fullText.toLocaleLowerCase("pt-BR").includes(query));
    const container = $("#uvrmHistorico");
    if (!container) return;
    if (!history.length) { container.innerHTML = '<p class="empty-state">Nenhuma operação encontrada.</p>'; return; }
    container.innerHTML = history.map(item => {
        const date = item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "";
        return `<article class="uvrm-history-card" data-history-id="${item.id}">
            <div><strong>${item.legacy ? "Cálculo anterior" : `${item.itemCount} ${item.itemCount === 1 ? "lançamento" : "lançamentos"}`}</strong><span>${date}</span></div>
            <strong>${item.total === null ? escapeHtml(item.plainValue || "") : formatUvrmCurrency(item.total)}</strong>
            <div class="uvrm-history-actions">
                <button type="button" class="small-button" data-history-action="copy">Copiar</button>
                ${item.legacy ? "" : '<button type="button" class="small-button secondary" data-history-action="restore">Reabrir</button>'}
                <button type="button" class="small-button danger" data-history-action="delete">Excluir</button>
            </div>
        </article>`;
    }).join("");
    container.querySelectorAll("[data-history-action]").forEach(button => button.addEventListener("click", async () => {
        const id = button.closest("[data-history-id]").dataset.historyId;
        const raw = getUvrmHistory();
        const item = raw.find(entry => entry.id === id);
        if (!item) return;
        const action = button.dataset.historyAction;
        if (action === "copy") await copyText(item.fullText || item.plainValue);
        if (action === "restore" && Array.isArray(item.items)) { saveUvrmCurrentList(item.items); showToast("Operação reaberta."); }
        if (action === "delete") {
            if (!window.confirm("Excluir este registro do histórico sincronizado? A exclusão será aplicada aos demais dispositivos após sincronizar.")) return;
            setJson(UVRM_HISTORY_KEY, raw.filter(entry => entry.id !== id));
            window.HistoryService?.queueDeleteHistory?.("uvrm", item, { source: "uvrm_history" });
            renderUvrmHistory();
            window.renderProductivity33?.();
            showToast("Exclusão registrada para sincronização.");
        }
    }));
}

$("#uvrmTipoLancamento").addEventListener("change", updateUvrmTypeInterface);
$("#uvrmValorLancamento").addEventListener("input", calculateUvrmPreview);
$("#uvrmMultiplicador").addEventListener("input", calculateUvrmPreview);
$("#uvrmDescricao").addEventListener("input", calculateUvrmPreview);
function persistUvrmPreferences() {
    localStorage.setItem(UVRM_VALUE_KEY, $("#uvrmValorUnitario").value);
    localStorage.setItem(UVRM_DECIMALS_KEY, $("#uvrmCasas").value);
    saveFormData();
}

["input", "change", "blur"].forEach((eventName) => {
    $("#uvrmValorUnitario").addEventListener(eventName, () => {
        persistUvrmPreferences();
        calculateUvrmPreview();
        updateDashboardSummary();
    });
});

$("#uvrmCasas").addEventListener("change", () => {
    persistUvrmPreferences();
    calculateUvrmPreview();
    renderUvrmCurrentList();
});
$("#uvrmRestaurarPadrao").addEventListener("click", () => {
    const formattedValue = formatDecimal(DEFAULT_UVRM_VALUE, 4);
    $("#uvrmValorUnitario").value = formattedValue;
    localStorage.setItem(UVRM_VALUE_KEY, formattedValue);
    calculateUvrmPreview();
    showToast("Valor padrão da UVRM restaurado.");
});
$("#adicionarUvrmLancamento").addEventListener("click", addOrUpdateUvrmEntry);
$("#cancelarEdicaoUvrm").addEventListener("click", resetUvrmEntryForm);
$("#limparUvrm").addEventListener("click", resetUvrmEntryForm);
$("#copiarTodosUvrm").addEventListener("click", () => { const items=getUvrmCurrentList(); if(!items.length)return showToast("A lista está vazia.","warning"); copyText(buildUvrmPlainValues(items)); });
$("#copiarUvrmCompleto").addEventListener("click", () => { const items=getUvrmCurrentList(); if(!items.length)return showToast("A lista está vazia.","warning"); copyText(buildUvrmDetailedText(items)); });
$("#copiarUvrmValor").addEventListener("click", () => { const items=getUvrmCurrentList(); if(!items.length)return showToast("A lista está vazia.","warning"); copyText(formatUvrmCurrency(roundCurrency(items.reduce((s,i)=>s+roundCurrency(i.reais||0),0)))); });
$("#salvarOperacaoUvrm").addEventListener("click", saveUvrmOperation);
$("#limparListaUvrm").addEventListener("click", () => { if(!getUvrmCurrentList().length)return; if(confirm("Limpar todos os lançamentos da operação atual?")){ localStorage.removeItem(UVRM_CURRENT_LIST_KEY); renderUvrmCurrentList(); resetUvrmEntryForm(); } });
$("#pesquisaHistoricoUvrm").addEventListener("input", renderUvrmHistory);

renderUvrmDescriptionSuggestions();

// Permite atualizar o histórico após sincronização remota.
window.renderUvrmHistory = renderUvrmHistory;
