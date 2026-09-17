/* Módulo: configurações, backup e restauração. */

/* Configurações */

function getStoredArrayLength(key) {
    const value = getJson(key, []);
    return Array.isArray(value) ? value.length : 0;
}

function updateSettingsStatistics() {
    const summary = getUsageSummary();
    const map = {
        configTotalAccesses: summary.totalAccesses,
        configTotalActions: summary.totalActions,
        configFavoriteCount: summary.favoriteCount
    };

    Object.entries(map).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = String(value);
        }
    });

    const body = document.getElementById("configStatisticsBody");

    if (body) {
        body.innerHTML = summary.rows
            .map(
                (row) =>
                    `<tr><td>${row.name}</td><td>${row.accesses}</td><td>${row.actions}</td><td><strong>${row.accesses + row.actions}</strong></td></tr>`
            )
            .join("");
    }
}

function updateSettingsSummary() {
    const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);

    $("#ultimoBackupInfo").textContent = lastBackup
        ? `Último backup exportado em ${formatDateTime(lastBackup)}.`
        : "Nenhum backup registrado.";

    updateSettingsStatistics();
}

function formatBackupTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");

    return `${pad(date.getDate())}${pad(date.getMonth() + 1)}${date.getFullYear()}${pad(
        date.getHours()
    )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function buildBackupPayload() {
    const data = {};

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);

        if (key && key.startsWith(STORAGE_PREFIX)) {
            data[key] = localStorage.getItem(key);
        }
    }

    return {
        app: APP_CONFIG.name,
        version: APP_CONFIG.version,
        exportedAt: new Date().toISOString(),
        storagePrefix: STORAGE_PREFIX,
        data
    };
}

function validateBackupPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return "Estrutura de backup inválida.";
    }

    if (payload.app !== APP_CONFIG.name) {
        return "O arquivo não pertence ao aplicativo Utilitários Municipais.";
    }

    if (!payload.data || typeof payload.data !== "object") {
        return "O arquivo não contém dados restauráveis.";
    }

    if (Object.keys(payload.data).some((key) => !key.startsWith(STORAGE_PREFIX))) {
        return "O backup contém chaves incompatíveis.";
    }

    return "";
}

function getLocalHistoryKeys() {
    return Object.values(window.HistoryService?.localHistoryConfig || {})
        .map((config) => config?.key)
        .filter(Boolean);
}

function clearLocalHistoriesFromSettings() {
    if (typeof window.HistoryService?.clearLocalHistories === "function") {
        window.HistoryService.clearLocalHistories();
        return;
    }

    getLocalHistoryKeys().forEach((key) => {
        localStorage.removeItem(key);
    });
}

$("#exportarBackup").addEventListener("click", () => {
    saveFormData();

    const payload = buildBackupPayload();

    downloadTextFile(
        `UM-BKP-${APP_VERSION}-${formatBackupTimestamp(new Date())}.json`,
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8"
    );

    localStorage.setItem(LAST_BACKUP_KEY, payload.exportedAt);
    $("#backupStatus").textContent = "Backup exportado com sucesso.";
    updateSettingsSummary();
    showToast("Backup exportado.");
});

$("#importarBackup").addEventListener("change", async (event) => {
    const [file] = event.target.files;

    if (!file) {
        return;
    }

    try {
        const payload = await readJsonFile(file);
        const error = validateBackupPayload(payload);

        if (error) {
            throw new Error(error);
        }

        const confirmed = await confirmAction(
            "A importação substituirá os dados atuais. Deseja continuar?",
            {
                title: "Importar backup",
                confirmText: "Importar"
            }
        );

        if (!confirmed) {
            return;
        }

        Object.keys(localStorage)
            .filter((key) => key.startsWith(STORAGE_PREFIX))
            .forEach((key) => localStorage.removeItem(key));

        Object.entries(payload.data).forEach(([key, value]) => {
            if (typeof value === "string") {
                localStorage.setItem(key, value);
            }
        });

        localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
        $("#backupStatus").textContent = "Backup importado. A página será atualizada.";
        showToast("Backup importado com sucesso.");

        window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
        $("#backupStatus").textContent =
            error.message || "Não foi possível importar o backup.";
        $("#backupStatus").classList.add("error");
        showToast("Falha ao importar o backup.");
    } finally {
        event.target.value = "";
    }
});

$("#executarLimpezaSeletiva").addEventListener("click", async () => {
    const clearModels = $("#limparModelosArquivos").checked;
    const clearFields = $("#limparPreferenciasCampos").checked;
    const resetSequence = $("#reiniciarSequenciaNoReset").checked;

    if (!clearModels && !clearFields && !resetSequence) {
        showToast("Selecione pelo menos uma opção.");
        return;
    }

    const confirmed = await confirmAction(
        "Deseja executar a limpeza selecionada?",
        {
            title: "Limpeza seletiva",
            confirmText: "Executar limpeza"
        }
    );

    if (!confirmed) {
        return;
    }

    if (clearModels) {
        localStorage.removeItem(FILE_MODELS_KEY);
    }

    if (clearFields) {
        [
            FORM_DATA_KEY,
            FILE_BUILDER_KEY,
            REGISTRATION_AUTO_COPY_KEY,
            UVRM_VALUE_KEY,
            UVRM_DECIMALS_KEY
        ].forEach((key) => localStorage.removeItem(key));
    }

    if (resetSequence) {
        localStorage.setItem(LOT_SEQUENCE_KEY, "3");
    }

    showToast("Limpeza seletiva concluída.");
    window.setTimeout(() => window.location.reload(), 300);
});

const clearDeviceHistoriesButton = $("#limparHistoricosDispositivo");

if (clearDeviceHistoriesButton) {
    clearDeviceHistoriesButton.addEventListener("click", async () => {
        const confirmed = await confirmAction(
            "Os históricos serão removidos somente deste navegador. Registros existentes no armazenamento online poderão retornar na próxima sincronização. Deseja continuar?",
            {
                title: "Limpar históricos deste dispositivo",
                confirmText: "Limpar deste dispositivo"
            }
        );

        if (!confirmed) {
            return;
        }

        clearLocalHistoriesFromSettings();
        NotificationService.success("Históricos locais removidos.");

        window.setTimeout(() => window.location.reload(), 250);
    });
}

const deleteSyncedHistoriesButton = $("#excluirHistoricosSincronizados");

if (deleteSyncedHistoriesButton) {
    deleteSyncedHistoriesButton.addEventListener("click", async () => {
        if (!navigator.onLine) {
            NotificationService.error(
                "Conecte-se à internet para excluir os históricos sincronizados."
            );
            return;
        }

        if (!window.OnlineSyncService?.getSession?.()?.user) {
            NotificationService.error(
                "Conecte sua conta antes de excluir os históricos sincronizados."
            );
            return;
        }

        const firstConfirmation = await confirmAction(
            "Esta ação excluirá os históricos sincronizados desta conta e propagará a exclusão para os outros navegadores e dispositivos. Deseja continuar?",
            {
                title: "Excluir históricos sincronizados",
                confirmText: "Continuar"
            }
        );

        if (!firstConfirmation) {
            return;
        }

        const finalConfirmation = await confirmAction(
            "Confirme a exclusão definitiva dos históricos sincronizados. Os tombstones serão mantidos para impedir que registros excluídos reapareçam.",
            {
                title: "Confirmação final",
                confirmText: "Excluir históricos"
            }
        );

        if (!finalConfirmation) {
            return;
        }

        deleteSyncedHistoriesButton.disabled = true;

        try {
            const result =
                await window.HistoryService.deleteAllSyncedHistories();

            if (result.remaining > 0) {
                NotificationService.warning(
                    "A exclusão foi registrada, mas ainda existem alterações pendentes de sincronização."
                );
            } else {
                NotificationService.success(
                    "Históricos sincronizados excluídos com sucesso."
                );
            }

            window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
            NotificationService.error(
                error?.message || "Não foi possível excluir os históricos sincronizados."
            );
        } finally {
            deleteSyncedHistoriesButton.disabled = false;
        }
    });
}

$("#limparTudo").addEventListener("click", async () => {
    const confirmed = await confirmAction(
        "Esta ação apagará todos os dados locais do aplicativo neste navegador. Dados sincronizados online não serão excluídos. Deseja continuar?",
        {
            title: "Apagar todos os dados locais",
            confirmText: "Apagar dados locais"
        }
    );

    if (!confirmed) {
        return;
    }

    Object.keys(localStorage)
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));

    showToast("Todos os dados locais foram removidos.");
    window.setTimeout(() => window.location.reload(), 300);
});

const resetStatisticsButton = $("#resetarEstatisticas");

if (resetStatisticsButton) {
    resetStatisticsButton.addEventListener("click", async () => {
        const confirmed = await confirmAction(
            "Deseja zerar as estatísticas de acessos e ações?",
            {
                title: "Zerar estatísticas",
                confirmText: "Zerar"
            }
        );

        if (!confirmed) {
            return;
        }

        resetUsageStatistics();
        showToast("Estatísticas zeradas.");
    });
}

function statisticsExportRows() {
    return getUsageSummary().rows.map((row) => ({
        ferramenta: row.name,
        acessos: row.accesses,
        acoes: row.actions,
        total: row.accesses + row.actions,
        ultimoUso: row.lastUsed ? formatDateTime(row.lastUsed) : "Nunca"
    }));
}

function exportStatistics(format) {
    const rows = statisticsExportRows();
    const date = todayIsoDate();

    if (format === "json") {
        return downloadTextFile(
            `estatisticas-utilitarios-${date}.json`,
            JSON.stringify(
                {
                    exportadoEm: new Date().toISOString(),
                    resumo: getUsageSummary(),
                    ferramentas: rows
                },
                null,
                2
            ),
            "application/json;charset=utf-8"
        );
    }

    if (format === "csv") {
        const text = [
            "Ferramenta;Acessos;Ações;Total;Último uso",
            ...rows.map((row) =>
                [
                    row.ferramenta,
                    row.acessos,
                    row.acoes,
                    row.total,
                    row.ultimoUso
                ]
                    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
                    .join(";")
            )
        ].join("\n");

        return downloadTextFile(
            `estatisticas-utilitarios-${date}.csv`,
            text,
            "text/csv;charset=utf-8"
        );
    }

    const text = [
        "ESTATÍSTICAS — UTILITÁRIOS MUNICIPAIS",
        `Exportado em: ${formatDateTime(new Date().toISOString())}`,
        "",
        ...rows.map(
            (row) =>
                `${row.ferramenta}: ${row.acessos} acessos | ${row.acoes} ações | ${row.total} total | Último uso: ${row.ultimoUso}`
        )
    ].join("\n");

    downloadTextFile(
        `estatisticas-utilitarios-${date}.txt`,
        text,
        "text/plain;charset=utf-8"
    );
}

[
    ["exportarEstatisticasCsv", "csv"],
    ["exportarEstatisticasJson", "json"],
    ["exportarEstatisticasTxt", "txt"]
].forEach(([id, type]) => {
    const button = $("#" + id);

    if (button) {
        button.addEventListener("click", () => {
            exportStatistics(type);
            NotificationService.success("Estatísticas exportadas.");
        });
    }
});

const resetFavoritesButton = $("#resetarFavoritos");

if (resetFavoritesButton) {
    resetFavoritesButton.addEventListener("click", async () => {
        const confirmed = await confirmAction(
            "Deseja remover todas as ferramentas favoritas?",
            {
                title: "Resetar favoritos",
                confirmText: "Resetar"
            }
        );

        if (!confirmed) {
            return;
        }

        localStorage.removeItem(FAVORITES_KEY);
        renderDashboardFavorites();
        refreshUsageViews();
        NotificationService.success("Favoritos removidos.");
    });
}
