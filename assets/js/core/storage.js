/* Núcleo: armazenamento, formatação, área de transferência e utilidades. */

const $ = (selector) => document.querySelector(selector);

const STORAGE_PREFIX = APP_CONFIG.storagePrefix;
const ACTIVE_TAB_KEY = `${STORAGE_PREFIX}activeTab`;
const LOT_SEQUENCE_KEY = `${STORAGE_PREFIX}lastLotSequence`;
const SAVE_FIELDS_KEY = `${STORAGE_PREFIX}saveFields`;
const FORM_DATA_KEY = `${STORAGE_PREFIX}formData`;
const FILE_HISTORY_KEY = `${STORAGE_PREFIX}fileHistory`;
const FILE_MODELS_KEY = `${STORAGE_PREFIX}fileModels`;
const FILE_BUILDER_KEY = `${STORAGE_PREFIX}fileBuilder`;
const REGISTRATION_HISTORY_KEY = `${STORAGE_PREFIX}registrationHistory`;
const REGISTRATION_AUTO_COPY_KEY = `${STORAGE_PREFIX}registrationAutoCopy`;
const LOT_HISTORY_KEY = `${STORAGE_PREFIX}lotHistory`;
const UVRM_VALUE_KEY = `${STORAGE_PREFIX}uvrmValue`;
const UVRM_HISTORY_KEY = `${STORAGE_PREFIX}uvrmHistory`;
const UVRM_DECIMALS_KEY = `${STORAGE_PREFIX}uvrmDecimals`;
const PERCENTAGE_HISTORY_KEY = `${STORAGE_PREFIX}percentageHistory`;
const DATES_HISTORY_KEY = `${STORAGE_PREFIX}datesHistory`;
const DOCUMENT_FISCAL_HISTORY_KEY = `${STORAGE_PREFIX}documentoFiscalHistory`;
const LAST_BACKUP_KEY = `${STORAGE_PREFIX}lastBackup`;
const FILE_REMOVE_POINTS_KEY = `${STORAGE_PREFIX}fileRemovePoints`;


/* Compatibilidade e hidratação dos dados locais. */
const STORAGE_SUFFIXES = Object.freeze({
    fileHistory: FILE_HISTORY_KEY,
    registrationHistory: REGISTRATION_HISTORY_KEY,
    lotHistory: LOT_HISTORY_KEY,
    uvrmHistory: UVRM_HISTORY_KEY,
    percentageHistory: PERCENTAGE_HISTORY_KEY,
    uvrmValue: UVRM_VALUE_KEY,
    uvrmDecimals: UVRM_DECIMALS_KEY,
    formData: FORM_DATA_KEY,
    saveFields: SAVE_FIELDS_KEY,
    fileModels: FILE_MODELS_KEY,
    fileBuilder: FILE_BUILDER_KEY,
    lastLotSequence: LOT_SEQUENCE_KEY
});

function migrateCompatibleStorageKeys() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) keys.push(key);
    }

    Object.entries(STORAGE_SUFFIXES).forEach(([suffix, canonicalKey]) => {
        if (localStorage.getItem(canonicalKey) !== null) return;

        const compatibleKey = keys.find((key) =>
            key !== canonicalKey &&
            (key === suffix || key.endsWith(`:${suffix}`) || key.endsWith(`.${suffix}`))
        );

        if (compatibleKey) {
            localStorage.setItem(canonicalKey, localStorage.getItem(compatibleKey));
        }
    });
}

function safeInvoke(callback) {
    try {
        callback();
    } catch (error) {
        console.error("Falha ao restaurar dados locais:", error);
    }
}

const formatCurrency = (value) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value) || 0);

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");


function normalizeFileNamePerson(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " E ")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function normalizeCompact(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
}

function normalizePrefix(value) {
    return normalizeCompact(value);
}

function normalizeProcess(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/\//g, "-")
        .toUpperCase();
}

function parseDecimal(value) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");

    const number = Number(normalized);
    return Number.isFinite(number) ? number : NaN;
}

function getDateTimeStamp() {
    const now = new Date();

    return [
        String(now.getDate()).padStart(2, "0"),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getFullYear()),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0")
    ].join("");
}


function getJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function setJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function setFeedback(element, message = "", type = "") {
    element.textContent = message;
    element.classList.remove("error", "success");

    if (type) {
        element.classList.add(type);
    }
}
