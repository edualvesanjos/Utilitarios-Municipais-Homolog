/* Módulo Datas — v4.3.5 */

(function () {
    const $ = (selector) => document.querySelector(selector);
    const operation = $("#datasOperacao");
    const start = $("#datasInicio");
    const end = $("#datasFinal");
    const quantity = $("#datasQuantidade");
    const endField = $("#datasFinalCampo");
    const quantityField = $("#datasQuantidadeCampo");
    const feedback = $("#datasFeedback");
    const resultLabel = $("#datasResultadoRotulo");
    const result = $("#datasResultado");
    const detail = $("#datasResultadoDetalhe");
    const copyButton = $("#copiarDatasResultado");
    const calculateButton = $("#calcularDatas");
    const clearButton = $("#limparDatas");

    if (!operation || !start || !end || !quantity || !result) return;

    let copyValue = "";
    const DATES_HISTORY_LIMIT = 30;

    function datesHistoryTime(item) {
        const raw = item?.occurred_at || item?.createdAt || item?.timestamp || item?.created_at || null;
        const time = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    }

    function getDatesHistory() {
        const history = getJson(DATES_HISTORY_KEY, []);
        const rows = Array.isArray(history) ? history : [];
        return rows.map((item,index)=>({item,index})).sort((a,b)=>{
            const diff=datesHistoryTime(b.item)-datesHistoryTime(a.item);
            if(diff) return diff;
            const idDiff=String(a.item?.id||"").localeCompare(String(b.item?.id||""));
            return idDiff || a.index-b.index;
        }).map(entry=>entry.item);
    }

    function renderDatesHistory() {
        const list = $("#datasHistorico");
        if (!list) return;
        const rows = getDatesHistory();
        if (!rows.length) {
            list.innerHTML = '<li class="empty-state">Nenhum cálculo de datas realizado recentemente.</li>';
            return;
        }
        list.innerHTML = rows.map((item,index)=>{
            const op = item.operation === "entre" ? "Entre datas" : item.operation === "somar" ? "Somar dias" : "Subtrair dias";
            const startText = item.start ? item.start.split("-").reverse().join("/") : "—";
            const parameter = item.operation === "entre"
                ? ` até ${item.end ? item.end.split("-").reverse().join("/") : "—"}`
                : ` • ${Number(item.quantity||0)} dia(s)`;
            const resultText = String(item.result || "—");
            return `<li><span class="dates-history-entry"><strong>${op}: ${startText}${parameter}</strong><small class="dates-history-result">${resultText}</small></span><div class="list-actions"><button type="button" class="secondary mini-button" data-copy-dates-history="${index}">Copiar</button><button type="button" class="secondary mini-button" data-delete-dates-history="${index}">Excluir</button></div></li>`;
        }).join("");
        list.querySelectorAll("[data-copy-dates-history]").forEach(button=>button.addEventListener("click",async()=>{
            const item=rows[Number(button.dataset.copyDatesHistory)];
            if(!item) return;
            const value=String(item.result||"");
            if(typeof copyText==="function") await copyText(value);
            else if(navigator.clipboard) await navigator.clipboard.writeText(value);
        }));
        list.querySelectorAll("[data-delete-dates-history]").forEach(button=>button.addEventListener("click",()=>{
            const item=rows[Number(button.dataset.deleteDatesHistory)];
            if(!item || !window.confirm("Excluir este registro do histórico sincronizado? A exclusão será aplicada aos demais dispositivos após sincronizar.")) return;
            const fp=window.HistoryService?.fingerprintValue?.(item);
            const next=getDatesHistory().filter(entry=>fp ? window.HistoryService?.fingerprintValue?.(entry)!==fp : entry!==item);
            setJson(DATES_HISTORY_KEY,next.slice(0,DATES_HISTORY_LIMIT));
            window.HistoryService?.queueDeleteHistory?.("datas",item,{source:"datas_history"});
            renderDatesHistory(); window.renderProductivity33?.(); showToast("Exclusão registrada para sincronização.");
        }));
    }

    function saveDatesHistory(entry) {
        const rows = getDatesHistory();
        rows.unshift(entry);
        setJson(DATES_HISTORY_KEY, rows.slice(0, DATES_HISTORY_LIMIT));
        renderDatesHistory();
        window.HistoryService?.notifyLocalChange?.();
        window.HistoryService?.queueHistory?.("datas", entry, "calculated");
        window.renderProductivity33?.();
    }

    function parseDate(value) {
        if (!value) return null;
        const parts = value.split("-").map(Number);
        if (parts.length !== 3) return null;
        const [year, month, day] = parts;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) return null;
        return date;
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC"
        }).format(date);
    }

    function setFeedback(message = "", type = "") {
        feedback.textContent = message;
        feedback.className = `feedback-message${type ? ` ${type}` : ""}`;
    }

    function resetResult() {
        copyValue = "";
        resultLabel.textContent = "RESULTADO";
        result.textContent = "—";
        detail.textContent = "Informe os dados para calcular.";
        copyButton.disabled = true;
    }

    function updateInterface({ clearDependentFields = false } = {}) {
        const between = operation.value === "entre";
        if (clearDependentFields) {
            end.value = "";
            quantity.value = "";
        }
        endField.hidden = !between;
        quantityField.hidden = between;
        end.disabled = !between;
        quantity.disabled = between;
        setFeedback();
        resetResult();
    }

    function validate() {
        const initial = parseDate(start.value);
        if (!initial) {
            setFeedback("Informe uma data inicial válida.", "error");
            return null;
        }

        if (operation.value === "entre") {
            const finalDate = parseDate(end.value);
            if (!finalDate) {
                setFeedback("Informe uma data final válida.", "error");
                return null;
            }
            if (finalDate < initial) {
                setFeedback("A data final não pode ser anterior à data inicial.", "error");
                return null;
            }
            return { initial, finalDate };
        }

        const days = Number(quantity.value);
        if (!Number.isInteger(days) || days < 0) {
            setFeedback("Informe uma quantidade inteira de dias igual ou maior que zero.", "error");
            return null;
        }
        return { initial, days };
    }

    function calculate() {
        const values = validate();
        if (!values) {
            resetResult();
            return;
        }

        setFeedback();

        if (operation.value === "entre") {
            const days = Math.floor((values.finalDate.getTime() - values.initial.getTime()) / 86400000);
            const weeks = Math.floor(days / 7);
            const remainder = days % 7;

            resultLabel.textContent = "DIAS ENTRE AS DATAS";
            result.textContent = `${days} ${days === 1 ? "dia" : "dias"}`;
            detail.textContent =
                `De ${formatDate(values.initial)} até ${formatDate(values.finalDate)} — ` +
                `${weeks} ${weeks === 1 ? "semana" : "semanas"} e ` +
                `${remainder} ${remainder === 1 ? "dia" : "dias"}.`;
            copyValue = result.textContent;
            saveDatesHistory({
                id: typeof createUniqueId === "function" ? createUniqueId() : `${Date.now()}-datas`,
                operation: "entre",
                start: start.value,
                end: end.value,
                days,
                result: copyValue,
                detail: detail.textContent,
                createdAt: new Date().toISOString()
            });
        } else {
            const direction = operation.value === "somar" ? 1 : -1;
            const calculated = new Date(values.initial.getTime());
            calculated.setUTCDate(calculated.getUTCDate() + direction * values.days);

            const sign = direction === 1 ? "+" : "−";
            resultLabel.textContent = "DATA RESULTANTE";
            result.textContent = formatDate(calculated);
            detail.textContent =
                `${formatDate(values.initial)} ${sign} ${values.days} ` +
                `${values.days === 1 ? "dia" : "dias"}.`;
            copyValue = result.textContent;
            saveDatesHistory({
                id: typeof createUniqueId === "function" ? createUniqueId() : `${Date.now()}-datas`,
                operation: operation.value,
                start: start.value,
                quantity: values.days,
                result: copyValue,
                detail: detail.textContent,
                createdAt: new Date().toISOString()
            });
        }

        copyButton.disabled = false;
    }

    function clearAll() {
        operation.value = "entre";
        start.value = "";
        end.value = "";
        quantity.value = "";
        updateInterface();
        start.focus();
    }

    operation.addEventListener("change", () => updateInterface({ clearDependentFields: true }));
    calculateButton.addEventListener("click", calculate);
    clearButton.addEventListener("click", clearAll);

    copyButton.addEventListener("click", async () => {
        if (!copyValue) return;
        if (typeof copyText === "function") {
            await copyText(copyValue);
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(copyValue);
        }
    });

    [start, end, quantity].forEach((field) => {
        field.addEventListener("input", () => {
            if (feedback.textContent) setFeedback();
        });
        field.addEventListener("keydown", (event) => {
            if (event.key === "Enter") calculate();
        });
    });

    window.renderDatesHistory = renderDatesHistory;
    updateInterface();
    renderDatesHistory();
})();
