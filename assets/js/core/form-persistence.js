/* Núcleo: persistência opcional dos campos. */

/* Persistência opcional dos demais campos */

const persistentFieldIds = [
    "loteSetor",
    "loteQuadra",
    "loteQuantidade",
    "loteSeparador",
    "uvrmValorUnitario",
    "uvrmCasas",
    "uvrmTipoLancamento",
    "percentualModo",
    "percentualValor1",
    "percentualValor2"
];

function shouldSaveFields() {
    return localStorage.getItem(SAVE_FIELDS_KEY) === "true";
}

function collectFormData() {
    const data = {};

    persistentFieldIds.forEach((id) => {
        const field = document.getElementById(id);

        if (field) {
            data[id] = field.value;
        }
    });

    return data;
}

function saveFormData() {
    if (shouldSaveFields()) {
        setJson(FORM_DATA_KEY, collectFormData());
    }
}

function restoreFormData() {
    if (!shouldSaveFields()) {
        return;
    }

    const data = getJson(FORM_DATA_KEY, {});

    persistentFieldIds.forEach((id) => {
        const field = document.getElementById(id);

        if (field && Object.prototype.hasOwnProperty.call(data, id)) {
            field.value = data[id];
        }
    });
}

persistentFieldIds.forEach((id) => {
    const field = document.getElementById(id);

    if (field) {
        field.addEventListener("input", saveFormData);
        field.addEventListener("change", saveFormData);
    }
});
