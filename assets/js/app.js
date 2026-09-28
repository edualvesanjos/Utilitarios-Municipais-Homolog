/* Inicialização e integração geral da aplicação. */

/* Inicialização */

function applyApplicationMetadata() {
    document.title = APP_CONFIG.name;

    document.querySelectorAll("[data-app-version]").forEach((element) => {
        element.textContent = APP_CONFIG.version;
    });

    document.querySelectorAll("[data-app-name]").forEach((element) => {
        element.textContent = APP_CONFIG.name;
    });
}


function applyVersion241Defaults() {
    const migrationKey = `${STORAGE_PREFIX}migration:2.4.1`;

    if (localStorage.getItem(migrationKey) === "done") {
        return;
    }

    // Converte apenas os valores-padrão antigos, preservando escolhas personalizadas.
    if ($("#loteSetor").value === "97") {
        $("#loteSetor").value = "99";
    }

    if ($("#loteQuadra").value === "997") {
        $("#loteQuadra").value = "999";
    }

    if ($("#loteSeparador").value === ".") {
        $("#loteSeparador").value = "";
    }

    localStorage.setItem(migrationKey, "done");
    saveFormData();
}


function applyVersion412Cleanup() {
    const migrationKey = `${STORAGE_PREFIX}migration:4.1.2`;

    if (localStorage.getItem(migrationKey) === "done") {
        return;
    }

    // O módulo Fluxos de trabalho foi retirado na versão 4.1.2.
    localStorage.removeItem(`${STORAGE_PREFIX}workflowCurrent`);
    localStorage.removeItem(`${STORAGE_PREFIX}workflowHistory`);
    localStorage.setItem(migrationKey, "done");
}

function renderAllExistingHistories() {
    safeInvoke(renderFileHistory);
    safeInvoke(renderRegistrationHistory);
    safeInvoke(renderLotHistory);
    safeInvoke(renderUvrmHistory);
    safeInvoke(renderPercentageHistory);
    safeInvoke(() => window.renderDocumentoFiscalHistory?.());
    safeInvoke(() => window.renderDatesHistory?.());
}

function initializeApplication() {
    applyApplicationMetadata();
    if (typeof initializeV3Architecture === "function") initializeV3Architecture();
    migrateCompatibleStorageKeys();
    const salvarCampos = $("#salvarCampos");
    if (salvarCampos) {
        salvarCampos.checked = shouldSaveFields();
    }

    restoreFormData();
    applyVersion241Defaults();
    applyVersion412Cleanup();

    $("#arquivoSeparador").value = fileBuilderState.separator;
    $("#arquivoAnaliseProjeto").checked =
        fileBuilderState.enabled.includes("ap");
    $("#arquivoDataHora").checked =
        fileBuilderState.enabled.includes("datahora");

    renderAvailableBlocks();
    renderBlockOrder();
    renderFileModels();
    renderFileHistory();
    updateFilePreview();

    $("#inscricaoCopiaAutomatica").checked =
        localStorage.getItem(REGISTRATION_AUTO_COPY_KEY) === "true";

    renderRegistrationHistory();
    updateRegistrationField();

    // A sequência do módulo Lotes é independente da preferência genérica "Salvar campos".
    // Ao abrir/recarregar, sempre continua a partir da última sequência efetivamente gerada.
    restoreLotSequenceState();

    renderLotHistory();
    updateLotPreview();

    const storedUvrmValue = localStorage.getItem(UVRM_VALUE_KEY);
    const restoredUvrmValue = storedUvrmValue && storedUvrmValue.trim()
        ? String(storedUvrmValue).replace(".", ",")
        : $("#uvrmValorUnitario").value || "5,2151";
    $("#uvrmValorUnitario").value = restoredUvrmValue;
    localStorage.setItem(UVRM_VALUE_KEY, restoredUvrmValue);

    const restoredUvrmDecimals = localStorage.getItem(UVRM_DECIMALS_KEY)
        || $("#uvrmCasas").value
        || "2";
    $("#uvrmCasas").value = restoredUvrmDecimals;
    localStorage.setItem(UVRM_DECIMALS_KEY, restoredUvrmDecimals);

    renderUvrmHistory();
    renderUvrmCurrentList();
    updateUvrmTypeInterface();
    clearUvrmResult();

    renderPercentageHistory();
    updatePercentageMode();

    // Garante a recuperação de todos os históricos já existentes ao abrir ou restaurar a página.
    renderAllExistingHistories();

    updateSettingsSummary();
    updateDashboardSummary();

    const storedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    activateTab(storedTab && document.getElementById(storedTab) ? storedTab : "inicio", { track: false });
}

function refreshPersistedApplicationData() {
    migrateCompatibleStorageKeys();

    const storedUvrmValue = localStorage.getItem(UVRM_VALUE_KEY);
    if (storedUvrmValue !== null && document.activeElement !== $("#uvrmValorUnitario")) {
        const normalizedUvrmValue = String(storedUvrmValue).replace(".", ",");
        $("#uvrmValorUnitario").value = normalizedUvrmValue;
        if (normalizedUvrmValue !== storedUvrmValue) {
            localStorage.setItem(UVRM_VALUE_KEY, normalizedUvrmValue);
        }
    }

    const storedDecimals = localStorage.getItem(UVRM_DECIMALS_KEY);
    if (storedDecimals !== null) {
        $("#uvrmCasas").value = storedDecimals;
    }

    renderAllExistingHistories();
    safeInvoke(renderUvrmCurrentList);
    safeInvoke(updateSettingsSummary);
    safeInvoke(updateDashboardSummary);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
    initializeApplication();
}

window.addEventListener("pageshow", refreshPersistedApplicationData);
window.addEventListener("focus", refreshPersistedApplicationData);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshPersistedApplicationData();
});
window.addEventListener("storage", refreshPersistedApplicationData);
