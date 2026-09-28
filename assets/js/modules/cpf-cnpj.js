/* Módulo CPF / CNPJ — v4.4.5 */
(function () {
    const $ = (selector) => document.querySelector(selector);
    const HISTORY_KEY = `${STORAGE_PREFIX}documentoFiscalHistory`;
    const LIMIT = 20;

    const typeFields = [
        ...document.querySelectorAll('input[name="documentoFiscalTipo"]')
    ];
    const input = $("#documentoFiscalEntrada");
    const autoCopy = $("#documentoFiscalAutoCopy");
    const noMask = $("#documentoFiscalSemMascara");
    const detected = $("#documentoFiscalTipoDetectado");
    const status = $("#documentoFiscalStatus");
    const result = $("#documentoFiscalResultado");
    const feedback = $("#documentoFiscalFeedback");
    const copyBtn = $("#copiarDocumentoFiscal");
    const clearBtn = $("#limparDocumentoFiscal");
    const historyList = $("#documentoFiscalHistorico");

    if (!typeFields.length || !input) {
        return;
    }

    let current = "";
    let lastAuto = "";

    function escapeDocumentHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function onlyDigits(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function cnpjCharacters(value) {
        return String(value || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    }

    function formatCpf(value) {
        return onlyDigits(value)
            .slice(0, 11)
            .replace(/^(\d{3})(\d)/, "$1.$2")
            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }

    function formatCnpj(value) {
        const raw = cnpjCharacters(value).slice(0, 14);
        const base = raw.slice(0, 12);
        const checkDigits = raw.slice(12).replace(/\D/g, "").slice(0, 2);
        const normalized = base + checkDigits;

        return normalized
            .replace(/^([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
            .replace(
                /^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/,
                "$1.$2.$3"
            )
            .replace(
                /\.([A-Z0-9]{3})([A-Z0-9])/,
                ".$1/$2"
            )
            .replace(/\/([A-Z0-9]{4})(\d)/, "/$1-$2");
    }

    function hasRepeatedDigits(value) {
        return /^(\d)\1+$/.test(value);
    }

    function validCpf(value) {
        if (value.length !== 11 || hasRepeatedDigits(value)) {
            return false;
        }

        const calculateDigit = (base, factor) => {
            let sum = 0;

            for (let index = 0; index < base.length; index += 1) {
                sum += Number(base[index]) * (factor - index);
            }

            const remainder = (sum * 10) % 11;
            return remainder === 10 ? 0 : remainder;
        };

        return (
            calculateDigit(value.slice(0, 9), 10) === Number(value[9]) &&
            calculateDigit(value.slice(0, 10), 11) === Number(value[10])
        );
    }

    function cnpjCharacterValue(character) {
        return character.charCodeAt(0) - 48;
    }

    function calculateCnpjDigit(base, weights) {
        const sum = base
            .split("")
            .reduce(
                (total, character, index) =>
                    total + cnpjCharacterValue(character) * weights[index],
                0
            );

        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }

    function validCnpj(value) {
        if (!/^[A-Z0-9]{12}\d{2}$/.test(value)) {
            return false;
        }

        if (/^\d{14}$/.test(value) && hasRepeatedDigits(value)) {
            return false;
        }

        const firstDigit = calculateCnpjDigit(
            value.slice(0, 12),
            [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        );

        if (firstDigit !== Number(value[12])) {
            return false;
        }

        const secondDigit = calculateCnpjDigit(
            value.slice(0, 12) + String(firstDigit),
            [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        );

        return secondDigit === Number(value[13]);
    }

    function selectedType() {
        return (
            typeFields.find((field) => field.checked)?.value ||
            "auto"
        );
    }

    function resolveType(rawValue) {
        const selected = selectedType();

        if (selected === "cpf") {
            return "cpf";
        }

        if (selected === "cnpj") {
            return "cnpj";
        }

        const cleaned = cnpjCharacters(rawValue);

        if (/[A-Z]/.test(cleaned)) {
            return "cnpj";
        }

        return onlyDigits(rawValue).length <= 11 ? "cpf" : "cnpj";
    }

    function message(text = "", type = "") {
        feedback.textContent = text;
        feedback.className = `feedback-message${type ? ` ${type}` : ""}`;
    }

    function historyTime(item) {
        const raw =
            item?.occurred_at ||
            item?.createdAt ||
            item?.copiedAt ||
            item?.timestamp ||
            item?.savedAt ||
            item?.finishedAt ||
            item?.created_at ||
            null;

        const time = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    }

    function stableHistoryId(item) {
        return String(
            item?.id ||
            item?.client_id ||
            item?.normalized ||
            ""
        );
    }

    function historyItems() {
        const value = getJson(HISTORY_KEY, []);
        const rows = Array.isArray(value) ? value : [];

        return rows
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const dateDifference =
                    historyTime(b.item) - historyTime(a.item);

                if (dateDifference) {
                    return dateDifference;
                }

                const idDifference = stableHistoryId(a.item).localeCompare(
                    stableHistoryId(b.item)
                );

                return idDifference || a.index - b.index;
            })
            .map(({ item }) => item);
    }

    function render() {
        const history = historyItems();

        if (!history.length) {
            historyList.innerHTML =
                '<li class="empty-state">Nenhum documento normalizado recentemente.</li>';
            return;
        }

        historyList.innerHTML = history
            .map(
                (item, index) => `
                    <li>
                        <span>
                            <strong>${escapeDocumentHtml(item.normalized)}</strong>
                            <small>${escapeDocumentHtml(
                                String(item.type || "").toUpperCase()
                            )}</small>
                        </span>
                        <div class="history-item-actions">
                            <button
                                type="button"
                                class="secondary mini-button"
                                data-copy-document="${escapeDocumentHtml(
                                    item.normalized
                                )}"
                            >
                                Copiar
                            </button>
                            <button
                                type="button"
                                class="danger-outline mini-button"
                                data-delete-document-history="${index}"
                            >
                                Excluir
                            </button>
                        </div>
                    </li>
                `
            )
            .join("");

        historyList
            .querySelectorAll("[data-copy-document]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    copyText(button.dataset.copyDocument);
                });
            });

        historyList
            .querySelectorAll("[data-delete-document-history]")
            .forEach((button) => {
                button.addEventListener("click", async () => {
                    const item =
                        history[Number(button.dataset.deleteDocumentHistory)];

                    if (!item) {
                        return;
                    }

                    const confirmed =
                        typeof confirmAction === "function"
                            ? await confirmAction(
                                  "Excluir este registro do histórico sincronizado? A exclusão será aplicada aos demais dispositivos após sincronizar.",
                                  {
                                      title: "Excluir registro",
                                      confirmText: "Excluir"
                                  }
                              )
                            : confirm(
                                  "Excluir este registro do histórico sincronizado?"
                              );

                    if (!confirmed) {
                        return;
                    }

                    const currentHistory = historyItems();
                    const fingerprint =
                        window.HistoryService?.fingerprintValue?.(item);

                    const nextHistory = currentHistory.filter((entry) => {
                        if (!fingerprint) {
                            return entry !== item;
                        }

                        return (
                            window.HistoryService?.fingerprintValue?.(entry) !==
                            fingerprint
                        );
                    });

                    setJson(HISTORY_KEY, nextHistory.slice(0, LIMIT));

                    window.HistoryService?.queueDeleteHistory?.(
                        "cpf-cnpj",
                        item,
                        { source: "cpf_cnpj_history" }
                    );

                    render();
                    window.renderProductivity33?.();
                    showToast("Exclusão registrada para sincronização.");
                });
            });
    }

    function save(item) {
        const currentHistory = historyItems();
        const existing = currentHistory.find(
            (entry) =>
                entry.normalized === item.normalized &&
                entry.type === item.type
        );

        if (existing) {
            return existing;
        }

        const history = currentHistory.filter(
            (entry) => entry.normalized !== item.normalized
        );

        history.unshift(item);
        setJson(HISTORY_KEY, history.slice(0, LIMIT));

        render();
        window.HistoryService?.notifyLocalChange?.();
        window.renderProductivity33?.();

        return item;
    }

    async function update() {
        const type = resolveType(input.value);
        let raw;
        let max;
        let formatted;
        let complete;
        let valid;

        if (type === "cpf") {
            raw = onlyDigits(input.value).slice(0, 11);
            max = 11;
            formatted = formatCpf(raw);
            complete = raw.length === max;
            valid = complete && validCpf(raw);
        } else {
            raw = cnpjCharacters(input.value).slice(0, 14);
            max = 14;

            if (raw.length > 12) {
                raw =
                    raw.slice(0, 12) +
                    raw.slice(12).replace(/\D/g, "").slice(0, 2);
            }

            formatted = formatCnpj(raw);
            complete = raw.length === max;
            valid = complete && validCnpj(raw);
        }

        input.value = formatted;
        detected.textContent = type.toUpperCase();

        const output = noMask?.checked ? raw : formatted;

        current = valid ? output : "";
        result.textContent = output || "—";
        copyBtn.disabled = !valid;

        if (!raw.length) {
            status.textContent = "Aguardando";
            status.dataset.state = "";
            message();
            lastAuto = "";
            return;
        }

        if (!complete) {
            status.textContent = "Incompleto";
            status.dataset.state = "invalid";

            message(
                type === "cnpj"
                    ? "Informe 14 posições: as 12 primeiras podem conter letras ou números e as 2 últimas devem ser numéricas."
                    : "Informe 11 dígitos para completar o CPF.",
                "warning"
            );

            lastAuto = "";
            return;
        }

        if (!valid) {
            status.textContent = "Inválido";
            status.dataset.state = "invalid";
            message(
                `${type.toUpperCase()} inválido. Verifique o documento e os dígitos verificadores.`,
                "error"
            );
            lastAuto = "";
            return;
        }

        status.textContent = "Válido";
        status.dataset.state = "valid";
        message(
            `${type.toUpperCase()} válido e normalizado.`,
            "success"
        );

        save({
            id:
                typeof createUniqueId === "function"
                    ? createUniqueId()
                    : `${Date.now()}-${raw}`,
            type,
            digits: raw,
            normalized: formatted,
            createdAt: new Date().toISOString()
        });

        if (autoCopy.checked && output !== lastAuto) {
            await copyText(output);
            lastAuto = output;
            showToast("Documento copiado automaticamente.");
        }
    }

    function clearAll() {
        typeFields.forEach((field) => {
            field.checked = field.value === "auto";
        });

        input.value = "";
        autoCopy.checked = false;

        if (noMask) {
            noMask.checked = false;
        }

        current = "";
        lastAuto = "";
        detected.textContent = "—";
        status.textContent = "Aguardando";
        status.dataset.state = "";
        result.textContent = "—";
        copyBtn.disabled = true;
        message();
        input.focus();
    }

    typeFields.forEach((field) => {
        field.addEventListener("change", () => {
            const raw =
                field.value === "cpf"
                    ? onlyDigits(input.value)
                    : cnpjCharacters(input.value);

            input.value = raw;
            lastAuto = "";
            update();
        });
    });

    input.addEventListener("input", update);
    input.addEventListener("paste", () => {
        window.setTimeout(update, 0);
    });

    input.addEventListener("dblclick", () => {
        if (input.value) {
            input.select();
        }
    });

    autoCopy.addEventListener("change", () => {
        lastAuto = "";

        if (autoCopy.checked) {
            update();
        }
    });

    noMask?.addEventListener("change", () => {
        lastAuto = "";
        update();
    });

    copyBtn.addEventListener("click", () => {
        if (current) {
            copyText(current);
        }
    });

    clearBtn.addEventListener("click", clearAll);

    render();
    window.renderDocumentoFiscalHistory = render;
})();
