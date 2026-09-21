/* Módulo: calculadora percentual. */

/* Percentual */

let percentageCurrentValue = "";
let percentageCurrentFullText = "";

const percentageModeSettings = {
    percentual: {
        label1: "Valor base",
        label2: "Percentual",
        placeholder1: "0,00",
        placeholder2: "0",
        help: "Informe o valor base e o percentual desejado.",
        operation: "Percentual do valor",
        secondaryLabel: "Valor do percentual",
        finalLabel: "Valor base"
    },
    acrescimo: {
        label1: "Valor base",
        label2: "Percentual de acréscimo",
        placeholder1: "0,00",
        placeholder2: "0",
        help: "Informe o valor original e o percentual que será acrescentado.",
        operation: "Acréscimo percentual",
        secondaryLabel: "Valor do acréscimo",
        finalLabel: "Valor com acréscimo"
    },
    desconto: {
        label1: "Valor base",
        label2: "Percentual de desconto",
        placeholder1: "0,00",
        placeholder2: "0",
        help: "Informe o valor original e o percentual que será descontado.",
        operation: "Desconto percentual",
        secondaryLabel: "Valor do desconto",
        finalLabel: "Valor com desconto"
    },
    proporcao: {
        label1: "Valor parcial",
        label2: "Valor total",
        placeholder1: "0,00",
        placeholder2: "0,00",
        help: "Informe o valor parcial e o valor total de referência.",
        operation: "Proporção percentual",
        secondaryLabel: "Valor parcial",
        finalLabel: "Valor total"
    },
    variacao: {
        label1: "Valor inicial",
        label2: "Valor final",
        placeholder1: "0,00",
        placeholder2: "0,00",
        help: "Informe o valor inicial e o valor final para medir a variação.",
        operation: "Variação percentual",
        secondaryLabel: "Diferença",
        finalLabel: "Classificação"
    }
};

function getPercentageHistory() {
    return getJson(PERCENTAGE_HISTORY_KEY, []);
}

function addPercentageHistory(fullText, resultValue) {
    const item = {
        id: createUniqueId(),
        fullText,
        resultValue,
        createdAt: new Date().toISOString()
    };

    const history = getPercentageHistory()
        .filter((entry) => entry.fullText !== fullText)
        .slice(0, 29);

    history.unshift(item);
    setJson(PERCENTAGE_HISTORY_KEY, history);
    window.HistoryService?.notifyLocalChange?.();
    window.HistoryService?.queueHistory?.("percentual", item, "calculated");
    renderPercentageHistory();
}


function deletePercentageHistoryItem(item) {
    if (!window.confirm("Excluir este registro do histórico sincronizado? A exclusão será aplicada aos demais dispositivos após sincronizar.")) return;
    const fingerprint = window.HistoryService?.fingerprintValue?.(item);
    const current = getJson(PERCENTAGE_HISTORY_KEY, []);
    const next = (Array.isArray(current) ? current : []).filter((entry) => fingerprint ? window.HistoryService?.fingerprintValue?.(entry) !== fingerprint : entry !== item);
    setJson(PERCENTAGE_HISTORY_KEY, next);
    window.HistoryService?.queueDeleteHistory?.("percentual", item, { source: "percentual_history" });
    renderPercentageHistory();
    window.renderProductivity33?.();
    showToast("Exclusão registrada para sincronização.");
}

function renderPercentageHistory() {
    const query = ($("#pesquisaHistoricoPercentual").value || "")
        .trim()
        .toLocaleLowerCase("pt-BR");

    const history = getPercentageHistory().filter((item) =>
        item.fullText.toLocaleLowerCase("pt-BR").includes(query)
    );

    renderHistoryList({
        list: $("#percentualHistorico"),
        items: history,
        emptyMessage: "Nenhum cálculo encontrado.",
        getText: (item) => item.fullText,
        getActions: () => [
            {
                label: "Copiar",
                onClick: (item) => copyText(item.fullText)
            },
            {
                label: "Excluir",
                onClick: (item) => deletePercentageHistoryItem(item)
            }
        ]
    });
}

function resetPercentageResult(message) {
    const settings =
        percentageModeSettings[$("#percentualModo").value] ||
        percentageModeSettings.percentual;

    $("#percentualResultadoResumo").textContent = "—";
    $("#percentualStatus").textContent = "Aguardando";
    $("#percentualStatus").classList.remove("status-valid", "status-invalid");
    $("#percentualResultadoCompleto").textContent = "—";
    $("#percentualResultadoSecundario").textContent = "—";
    $("#percentualResultadoFinal").textContent = "—";
    $("#percentualAjuda").textContent = message || settings.help;
    $("#percentualAjuda").classList.remove("error", "success");

    percentageCurrentValue = "";
    percentageCurrentFullText = "";
}

function updatePercentageMode() {
    const settings =
        percentageModeSettings[$("#percentualModo").value] ||
        percentageModeSettings.percentual;

    $("#percentualRotuloValor1").textContent = settings.label1;
    $("#percentualRotuloValor2").textContent = settings.label2;
    $("#percentualValor1").placeholder = settings.placeholder1;
    $("#percentualValor2").placeholder = settings.placeholder2;
    $("#percentualOperacaoResumo").textContent = settings.operation;
    $("#percentualResultadoSecundarioRotulo").textContent =
        settings.secondaryLabel;
    $("#percentualResultadoFinalRotulo").textContent = settings.finalLabel;

    resetPercentageResult(settings.help);
    calculatePercentage();
    saveFormData();
}

function setPercentageValidResult({
    main,
    full,
    secondary,
    final
}) {
    $("#percentualResultadoResumo").textContent = main;
    $("#percentualResultadoCompleto").textContent = full;
    $("#percentualResultadoSecundario").textContent = secondary;
    $("#percentualResultadoFinal").textContent = final;
    $("#percentualStatus").textContent = "Calculado";
    $("#percentualStatus").classList.remove("status-invalid");
    $("#percentualStatus").classList.add("status-valid");
    $("#percentualAjuda").textContent = "Resultado atualizado automaticamente.";
    $("#percentualAjuda").classList.remove("error");
    $("#percentualAjuda").classList.add("success");

    percentageCurrentValue = main;
    percentageCurrentFullText = full;
}

function setPercentageError(message) {
    resetPercentageResult(message);
    $("#percentualStatus").textContent = "Inválido";
    $("#percentualStatus").classList.add("status-invalid");
    $("#percentualAjuda").classList.add("error");
}

function calculatePercentage() {
    const mode = $("#percentualModo").value;
    const value1Text = $("#percentualValor1").value.trim();
    const value2Text = $("#percentualValor2").value.trim();

    if (!value1Text || !value2Text) {
        resetPercentageResult();
        saveFormData();
        return;
    }

    const value1 = parseDecimal(value1Text);
    const value2 = parseDecimal(value2Text);

    if (
        !Number.isFinite(value1) ||
        !Number.isFinite(value2) ||
        value1 < 0 ||
        value2 < 0
    ) {
        setPercentageError("Informe valores numéricos válidos e não negativos.");
        return;
    }

    if (mode === "percentual") {
        const result = value1 * (value2 / 100);
        const main = formatCurrency(result);
        const base = formatCurrency(value1);
        const rate = formatDecimal(value2, 2);

        setPercentageValidResult({
            main,
            full: `${rate}% de ${base} = ${main}`,
            secondary: main,
            final: base
        });
    }

    if (mode === "acrescimo") {
        const addition = value1 * (value2 / 100);
        const finalValue = value1 + addition;
        const additionText = formatCurrency(addition);
        const finalText = formatCurrency(finalValue);
        const base = formatCurrency(value1);
        const rate = formatDecimal(value2, 2);

        setPercentageValidResult({
            main: finalText,
            full: `${base} + ${rate}% (${additionText}) = ${finalText}`,
            secondary: additionText,
            final: finalText
        });
    }

    if (mode === "desconto") {
        const discount = value1 * (value2 / 100);
        const finalValue = value1 - discount;
        const discountText = formatCurrency(discount);
        const finalText = formatCurrency(finalValue);
        const base = formatCurrency(value1);
        const rate = formatDecimal(value2, 2);

        setPercentageValidResult({
            main: finalText,
            full: `${base} - ${rate}% (${discountText}) = ${finalText}`,
            secondary: discountText,
            final: finalText
        });
    }

    if (mode === "proporcao") {
        if (value2 === 0) {
            setPercentageError("O valor total deve ser maior que zero.");
            return;
        }

        const rate = (value1 / value2) * 100;
        const rateText = `${formatDecimal(rate, 2)}%`;
        const partial = formatCurrency(value1);
        const total = formatCurrency(value2);

        setPercentageValidResult({
            main: rateText,
            full: `${partial} representa ${rateText} de ${total}`,
            secondary: partial,
            final: total
        });
    }

    if (mode === "variacao") {
        if (value1 === 0) {
            setPercentageError("O valor inicial deve ser maior que zero.");
            return;
        }

        const difference = value2 - value1;
        const variation = (difference / value1) * 100;
        const variationText = `${formatDecimal(variation, 2)}%`;
        const initial = formatCurrency(value1);
        const finalValue = formatCurrency(value2);
        const differenceText = formatCurrency(Math.abs(difference));
        const classification =
            difference > 0 ? "Aumento" :
            difference < 0 ? "Redução" :
            "Sem alteração";

        setPercentageValidResult({
            main: variationText,
            full: `${initial} para ${finalValue} = ${variationText} (${classification})`,
            secondary: differenceText,
            final: classification
        });
    }

    saveFormData();
}

$("#percentualModo").addEventListener("change", updatePercentageMode);
$("#percentualValor1").addEventListener("input", calculatePercentage);
$("#percentualValor2").addEventListener("input", calculatePercentage);

$("#copiarPercentualValor").addEventListener("click", async () => {
    if (!percentageCurrentValue) {
        showToast("Informe os valores para realizar o cálculo.");
        return;
    }

    const copied = await copyText(percentageCurrentValue);

    if (copied) {
        addPercentageHistory(
            percentageCurrentFullText,
            percentageCurrentValue
        );
    }
});

$("#copiarPercentualCompleto").addEventListener("click", async () => {
    if (!percentageCurrentFullText) {
        showToast("Informe os valores para realizar o cálculo.");
        return;
    }

    const copied = await copyText(percentageCurrentFullText);

    if (copied) {
        addPercentageHistory(
            percentageCurrentFullText,
            percentageCurrentValue
        );
    }
});

$("#limparPercentual").addEventListener("click", () => {
    $("#percentualModo").value = "percentual";
    updatePercentageInterface();
    $("#percentualValor1").value = "";
    $("#percentualValor2").value = "";
    resetPercentageResult();
    saveFormData();
});


$("#pesquisaHistoricoPercentual").addEventListener(
    "input",
    renderPercentageHistory
);

// Permite atualizar o histórico após sincronização remota.
window.renderPercentageHistory = renderPercentageHistory;
