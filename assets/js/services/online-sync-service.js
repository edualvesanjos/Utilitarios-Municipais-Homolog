/* Versão 4.5.3.1 — correção da autenticação e controles de conta. */
(function () {
    "use strict";

    const SYNC_GROUPS = Object.freeze({
        // Navegação (activeTab, lastToolTab e recentTools) é estado local de interface.
        // Não sincronizar: trocar de módulo não é alteração de dados e não pode gerar conflito.
        preferences: Object.freeze([`${APP_CONFIG.storagePrefix}saveFields`]),
        form_data: Object.freeze([`${APP_CONFIG.storagePrefix}formData`]),
        uvrm_description_history: Object.freeze([`${APP_CONFIG.storagePrefix}uvrmDescriptionHistory`]),
        file_builder: Object.freeze([`${APP_CONFIG.storagePrefix}fileBuilder`]),
        file_models: Object.freeze([`${APP_CONFIG.storagePrefix}fileModels`]),
        operational_preferences: Object.freeze([
            `${APP_CONFIG.storagePrefix}fileRemovePoints`,
            `${APP_CONFIG.storagePrefix}registrationAutoCopy`,
            `${APP_CONFIG.storagePrefix}documentoFiscalAutoCopy`,
            `${APP_CONFIG.storagePrefix}documentoFiscalSemMascara`,
            `${APP_CONFIG.storagePrefix}uvrmValue`,
            `${APP_CONFIG.storagePrefix}uvrmDecimals`,
            `${APP_CONFIG.storagePrefix}documentSort`
        ]),
        favorites: Object.freeze([`${APP_CONFIG.storagePrefix}favorites`]),
        personalization: Object.freeze([
            `${APP_CONFIG.storagePrefix}ux31:prefs`,
            `${APP_CONFIG.storagePrefix}compactMode`
        ]),
        documents: Object.freeze([
            `${APP_CONFIG.storagePrefix}documentTemplates`,
            `${APP_CONFIG.storagePrefix}documentGroups`,
            `${APP_CONFIG.storagePrefix}documentCategories`
        ])
    });

    const STATE_KEY = `${APP_CONFIG.storagePrefix}online:state`;
    const LAST_SYNC_KEY = `${APP_CONFIG.storagePrefix}online:lastSync`;
    const LAST_ATTEMPT_KEY = `${APP_CONFIG.storagePrefix}online:lastAttempt`;
    const LAST_LOCAL_CHANGE_KEY = `${APP_CONFIG.storagePrefix}online:lastLocalChange`;
    const LAST_LOCAL_GROUP_CHANGES_KEY = `${APP_CONFIG.storagePrefix}online:lastLocalGroupChanges`;
    const LAST_REMOTE_UPDATE_KEY = `${APP_CONFIG.storagePrefix}online:lastRemoteUpdate`;
    const AUTO_SYNC_KEY = `${APP_CONFIG.storagePrefix}online:autoSync`;
    const DEVICE_KEY = `${APP_CONFIG.storagePrefix}online:deviceId`;
    const PENDING_KEY = `${APP_CONFIG.storagePrefix}online:pending`;
    const CONFLICT_KEY = `${APP_CONFIG.storagePrefix}online:conflict`;
    const MIGRATION_KEY = `${APP_CONFIG.storagePrefix}online:conflictFix423`;
    const DOCUMENTS_MIGRATION_KEY = `${APP_CONFIG.storagePrefix}online:documents426`;
    const DOCUMENTS_STRUCTURE_MIGRATION_KEY =
        `${APP_CONFIG.storagePrefix}online:documents4524`;
    const SYNC_SCHEMA_VERSION = 13;
    const CONFLICT_TOLERANCE_MS = 2500;

    let client = null;
    let session = null;
    let sessionRefreshPromise = null;
    let syncTimer = null;
    let applyingRemote = false;
    let syncInProgress = false;
    let currentConflict = null;
    let watchedLocalSnapshot = "";
    let watchedLocalGroups = {};
    let localWatchTimer = null;

    function notify(message, type = "success") {
        if (window.NotificationService && typeof NotificationService[type] === "function") {
            NotificationService[type](message);
        } else if (typeof showToast === "function") {
            showToast(message);
        } else {
            window.Logger?.info(message);
        }
    }

    function safeGet(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (error) {
            window.ErrorHandler?.report(error, "Leitura da sincronização", { silent: true });
            return fallback;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, String(value));
            return true;
        } catch (error) {
            window.ErrorHandler?.report(error, "Gravação da sincronização", { silent: true });
            return false;
        }
    }

    function safeRemove(key) {
        try { localStorage.removeItem(key); } catch { }
    }

    function parseDate(value) {
        const timestamp = value ? Date.parse(value) : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function stableStringify(value) {
        if (value === null || typeof value !== "object") return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }

    function getDeviceId() {
        let id = safeGet(DEVICE_KEY, "");
        if (!id) {
            id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            safeSet(DEVICE_KEY, id);
        }
        return id;
    }

    function setOnlineState(value) {
        safeSet(STATE_KEY, JSON.stringify({ ...value, updatedAt: nowIso() }));
        renderOnlineStatus();
    }

    function isAutoSyncEnabled() {
        return safeGet(AUTO_SYNC_KEY, "true") !== "false";
    }

    function setPending(value, markChange = false) {
        safeSet(PENDING_KEY, value ? "true" : "false");
        if (value && markChange) safeSet(LAST_LOCAL_CHANGE_KEY, nowIso());
        renderOnlineStatus();
    }

    function hasPendingChanges() {
        return safeGet(PENDING_KEY, "false") === "true";
    }

    function hasConflict() {
        return safeGet(CONFLICT_KEY, "false") === "true";
    }

    function setConflict(value, details = null) {
        safeSet(CONFLICT_KEY, value ? "true" : "false");
        currentConflict = value ? details : null;
        if (!value) safeRemove(CONFLICT_KEY);
        renderOnlineStatus();
    }

    function collectGroup(keys) {
        const content = {};
        keys.forEach((key) => {
            const value = safeGet(key, null);
            if (value !== null) content[key] = value;
        });
        return content;
    }

    function isSyncGroupEnabled(group) {
        if (group === "form_data") {
            return safeGet(`${APP_CONFIG.storagePrefix}saveFields`, "false") === "true";
        }
        return true;
    }

    function collectLocalData() {
        return Object.entries(SYNC_GROUPS)
            .filter(([data_type]) => isSyncGroupEnabled(data_type))
            .map(([data_type, keys]) => ({
                data_type,
                content: collectGroup(keys)
            }));
    }

    function localSnapshotObject() {
        return Object.fromEntries(
            Object.entries(SYNC_GROUPS).map(([group, keys]) => [
                group,
                isSyncGroupEnabled(group) ? collectGroup(keys) : {}
            ])
        );
    }

    function remoteSnapshotObject(rows) {
        const result = Object.fromEntries(Object.keys(SYNC_GROUPS).map((group) => [group, {}]));
        rows.forEach((row) => {
            if (SYNC_GROUPS[row.data_type] && isSyncGroupEnabled(row.data_type)) {
                result[row.data_type] = row.content || {};
            }
        });
        return result;
    }

    function snapshotsEqual(rows) {
        return stableStringify(localSnapshotObject()) === stableStringify(remoteSnapshotObject(rows));
    }

    const UVRM_DESCRIPTION_HISTORY_GROUP = "uvrm_description_history";
    const UVRM_DESCRIPTION_HISTORY_KEY = `${APP_CONFIG.storagePrefix}uvrmDescriptionHistory`;
    const UVRM_DESCRIPTION_HISTORY_LIMIT = 30;

    function parseUvrmDescriptionHistory(raw) {
        try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            return Array.isArray(parsed)
                ? parsed.map((value) => String(value || "").trim().replace(/\s+/g, " ")).filter(Boolean)
                : [];
        } catch {
            return [];
        }
    }

    function mergeUvrmDescriptionLists(primary, secondary) {
        const result = [];
        const seen = new Set();
        [...primary, ...secondary].forEach((description) => {
            const value = String(description || "").trim().replace(/\s+/g, " ");
            const key = value.toLocaleLowerCase("pt-BR");
            if (!value || seen.has(key)) return;
            seen.add(key);
            result.push(value);
        });
        return result.slice(0, UVRM_DESCRIPTION_HISTORY_LIMIT);
    }

    async function mergeUvrmDescriptionHistory(rows) {
        if (!session?.user) return rows;

        const remoteRow = rows.find((row) => row.data_type === UVRM_DESCRIPTION_HISTORY_GROUP);
        const localList = parseUvrmDescriptionHistory(safeGet(UVRM_DESCRIPTION_HISTORY_KEY, "[]"));
        const remoteList = parseUvrmDescriptionHistory(remoteRow?.content?.[UVRM_DESCRIPTION_HISTORY_KEY] ?? "[]");
        if (!localList.length && !remoteList.length) return rows;

        const localChanged = Boolean(readLocalGroupChanges()[UVRM_DESCRIPTION_HISTORY_GROUP]);
        const merged = localChanged
            ? mergeUvrmDescriptionLists(localList, remoteList)
            : mergeUvrmDescriptionLists(remoteList, localList);
        const serialized = JSON.stringify(merged);
        safeSet(UVRM_DESCRIPTION_HISTORY_KEY, serialized);

        const remoteSerialized = JSON.stringify(remoteList);
        if (!remoteRow || serialized !== remoteSerialized) {
            const updatedAt = nowIso();
            const saved = await saveUserDataRows([{
                user_id: session.user.id,
                data_type: UVRM_DESCRIPTION_HISTORY_GROUP,
                content: { [UVRM_DESCRIPTION_HISTORY_KEY]: serialized },
                version: SYNC_SCHEMA_VERSION,
                updated_at: updatedAt
            }]);
            const savedRow = saved?.[0] || {
                data_type: UVRM_DESCRIPTION_HISTORY_GROUP,
                content: { [UVRM_DESCRIPTION_HISTORY_KEY]: serialized },
                version: SYNC_SCHEMA_VERSION,
                updated_at: updatedAt
            };
            rows = rows.filter((row) => row.data_type !== UVRM_DESCRIPTION_HISTORY_GROUP);
            rows.push(savedRow);
        } else if (remoteRow) {
            remoteRow.content = { ...(remoteRow.content || {}), [UVRM_DESCRIPTION_HISTORY_KEY]: serialized };
        }

        return rows;
    }

    function documentTemplatesCount(content = collectGroup(SYNC_GROUPS.documents)) {
        const key = `${APP_CONFIG.storagePrefix}documentTemplates`;
        const raw = content?.[key];
        if (raw == null) return 0;
        try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            return 0;
        }
    }

    function documentCollectionCount(keyName, content = collectGroup(SYNC_GROUPS.documents)) {
        const key = `${APP_CONFIG.storagePrefix}${keyName}`;
        const raw = content?.[key];

        if (raw == null) return 0;

        try {
            const parsed = typeof raw === "string"
                ? JSON.parse(raw)
                : raw;

            return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            return 0;
        }
    }

    function hasLocalDocumentStructure() {
        const content = collectGroup(SYNC_GROUPS.documents);

        return documentTemplatesCount(content) > 0
            || documentCollectionCount("documentGroups", content) > 0
            || documentCollectionCount("documentCategories", content) > 0;
    }

    async function ensureDocumentGroupStructure(rows) {
        if (!session?.user) return rows;

        const documentRow = rows.find(
            (row) => row.data_type === "documents"
        );
        const localContent = collectGroup(SYNC_GROUPS.documents);

        if (!documentRow) {
            if (!hasLocalDocumentStructure()) return rows;

            await saveUserDataRows([{
                user_id: session.user.id,
                data_type: "documents",
                content: localContent,
                version: SYNC_SCHEMA_VERSION,
                updated_at: nowIso()
            }]);

            await writeSyncLog("success", 1, {
                direction: "upload",
                groups: ["documents"],
                migration: "4.5.2.4-create"
            });

            return fetchRemoteRows();
        }

        const remoteContent = documentRow.content || {};
        const groupKey = `${APP_CONFIG.storagePrefix}documentGroups`;
        const categoryKey = `${APP_CONFIG.storagePrefix}documentCategories`;

        const missingKeys = [groupKey, categoryKey].filter(
            (key) =>
                !Object.prototype.hasOwnProperty.call(remoteContent, key)
                && Object.prototype.hasOwnProperty.call(localContent, key)
        );

        if (!missingKeys.length) return rows;

        const mergedContent = { ...remoteContent };

        missingKeys.forEach((key) => {
            mergedContent[key] = localContent[key];
        });

        await saveUserDataRows([{
            user_id: session.user.id,
            data_type: "documents",
            content: mergedContent,
            version: SYNC_SCHEMA_VERSION,
            updated_at: nowIso()
        }]);

        await writeSyncLog("success", 1, {
            direction: "upload",
            groups: ["documents"],
            migration: "4.5.2.4-structure",
            added_keys: missingKeys.map(
                (key) => key.replace(APP_CONFIG.storagePrefix, "")
            )
        });

        return fetchRemoteRows();
    }

    function hasLocalOperationalPreferences() {
        return SYNC_GROUPS.operational_preferences.some(
            (key) => safeGet(key, null) !== null
        );
    }

    async function ensureOperationalPreferencesGroup(rows) {
        if (!session?.user) return rows;
        if (rows.some((row) => row.data_type === "operational_preferences")) return rows;
        if (!hasLocalOperationalPreferences()) return rows;

        await saveUserDataRows([{
            user_id: session.user.id,
            data_type: "operational_preferences",
            content: collectGroup(SYNC_GROUPS.operational_preferences),
            version: SYNC_SCHEMA_VERSION,
            updated_at: nowIso()
        }]);

        await writeSyncLog("success", 1, {
            direction: "upload",
            groups: ["operational_preferences"],
            migration: "4.6.4-create"
        });

        return fetchRemoteRows();
    }


    function hasLocalFormData() {
        return isSyncGroupEnabled("form_data")
            && SYNC_GROUPS.form_data.some((key) => safeGet(key, null) !== null);
    }

    async function ensureFormDataGroup(rows) {
        if (!session?.user || !hasLocalFormData()) return rows;
        if (rows.some((row) => row.data_type === "form_data")) return rows;

        await saveUserDataRows([{
            user_id: session.user.id,
            data_type: "form_data",
            content: collectGroup(SYNC_GROUPS.form_data),
            version: SYNC_SCHEMA_VERSION,
            updated_at: nowIso()
        }]);

        await writeSyncLog("success", 1, {
            direction: "upload",
            groups: ["form_data"],
            migration: "4.6.8-create"
        });

        return fetchRemoteRows();
    }

    function hasLocalFileBuilder() {
        return SYNC_GROUPS.file_builder.some(
            (key) => safeGet(key, null) !== null
        );
    }

    async function ensureFileBuilderGroup(rows) {
        if (!session?.user) return rows;
        if (rows.some((row) => row.data_type === "file_builder")) return rows;
        if (!hasLocalFileBuilder()) return rows;

        await saveUserDataRows([{
            user_id: session.user.id,
            data_type: "file_builder",
            content: collectGroup(SYNC_GROUPS.file_builder),
            version: SYNC_SCHEMA_VERSION,
            updated_at: nowIso()
        }]);

        await writeSyncLog("success", 1, {
            direction: "upload",
            groups: ["file_builder"],
            migration: "4.6.5-create"
        });

        return fetchRemoteRows();
    }

    function hasLocalFileModels() {
        return SYNC_GROUPS.file_models.some(
            (key) => safeGet(key, null) !== null
        );
    }

    async function ensureFileModelsGroup(rows) {
        if (!session?.user) return rows;
        if (rows.some((row) => row.data_type === "file_models")) return rows;
        if (!hasLocalFileModels()) return rows;

        await saveUserDataRows([{
            user_id: session.user.id,
            data_type: "file_models",
            content: collectGroup(SYNC_GROUPS.file_models),
            version: SYNC_SCHEMA_VERSION,
            updated_at: nowIso()
        }]);

        await writeSyncLog("success", 1, {
            direction: "upload",
            groups: ["file_models"],
            migration: "4.6.6-create"
        });

        return fetchRemoteRows();
    }

    function readLocalGroupChanges() {
        try {
            const parsed = JSON.parse(safeGet(LAST_LOCAL_GROUP_CHANGES_KEY, "{}"));
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    function markLocalGroupChanges(groups) {
        if (!Array.isArray(groups) || !groups.length) return;
        const changes = readLocalGroupChanges();
        const changedAt = nowIso();
        groups.forEach((group) => {
            if (SYNC_GROUPS[group]) changes[group] = changedAt;
        });
        safeSet(LAST_LOCAL_GROUP_CHANGES_KEY, JSON.stringify(changes));
    }

    function clearLocalGroupChanges() {
        safeRemove(LAST_LOCAL_GROUP_CHANGES_KEY);
    }

    function groupForStorageKey(key) {
        return Object.entries(SYNC_GROUPS).find(([, keys]) => keys.includes(key))?.[0] || null;
    }

    function resetWatchedSnapshot() {
        watchedLocalGroups = localSnapshotObject();
        watchedLocalSnapshot = stableStringify(watchedLocalGroups);
    }

    function startSelectiveLocalWatch() {
        clearInterval(localWatchTimer);
        resetWatchedSnapshot();
        localWatchTimer = setInterval(() => {
            if (applyingRemote || !session?.user) {
                resetWatchedSnapshot();
                return;
            }
            const nextGroups = localSnapshotObject();
            const nextSnapshot = stableStringify(nextGroups);
            if (nextSnapshot === watchedLocalSnapshot) return;
            const changedGroups = Object.keys(SYNC_GROUPS).filter(
                (group) => stableStringify(nextGroups[group] || {}) !== stableStringify(watchedLocalGroups[group] || {})
            );
            watchedLocalGroups = nextGroups;
            watchedLocalSnapshot = nextSnapshot;
            markLocalGroupChanges(changedGroups);
            scheduleAutoSync(true);
        }, 900);
    }

    function applyGroup(content) {
        if (!content || typeof content !== "object") return;
        applyingRemote = true;
        try {
            Object.entries(content).forEach(([key, value]) => {
                const permitted = Object.values(SYNC_GROUPS).some((keys) => keys.includes(key));
                if (permitted && key.startsWith(APP_CONFIG.storagePrefix)) safeSet(key, value);
            });
        } finally {
            applyingRemote = false;
        }
    }

    function refreshApplication() {
        const refreshers = [
            "refreshPersistedApplicationData",
            "refreshUxPreferences",
            "renderDashboardFavorites",
            "refreshUsageViews",
            "updateDashboardLastToolHighlight",
            "refreshDocumentCentral",
            "refreshUvrmDescriptionSuggestions"
        ];
        refreshers.forEach((name) => {
            if (typeof window[name] === "function") {
                try { window[name](); } catch (error) { window.Logger?.warn(`Falha ao executar ${name}.`, error); }
            }
        });
    }

    async function ensureProfile(user) {
        if (!user) return;
        const prefsKey = `${APP_CONFIG.storagePrefix}ux31:prefs`;
        let displayName = "Usuário";
        try {
            const prefs = JSON.parse(safeGet(prefsKey, "{}"));
            displayName = String(prefs.displayName || "Usuário").trim().slice(0, 40) || "Usuário";
        } catch { }
        if (window.BackendClientService?.getActiveProvider?.() === "superdb") {
            const existing = await client.from("profiles").select("*").eq("id", user.id);
            if (existing.error) throw existing.error;
            const result = existing.data?.length
                ? await client.from("profiles").update({ display_name: displayName, updated_at: new Date().toISOString() }).eq("id", user.id).select()
                : await client.from("profiles").insert({ id: user.id, display_name: displayName }).select();
            if (result.error) throw result.error;
            return;
        }
        const { error } = await client.from("profiles").upsert(
            { id: user.id, display_name: displayName },
            { onConflict: "id" }
        );
        if (error) throw error;
    }

    async function superdbRestUpsertUserData(rows) {
        const tokenResult = await client.auth.getDataPlaneToken();
        if (tokenResult?.error) throw tokenResult.error;
        const token = typeof tokenResult === "string" ? tokenResult
            : tokenResult?.data?.token ?? tokenResult?.data?.data_plane_token
            ?? tokenResult?.token ?? tokenResult?.data_plane_token ?? null;
        if (!token) throw new Error("Não foi possível obter o data_plane_token do SuperDB.");

        const cfg = window.SuperDBClientService?.getConfiguration?.() || {};
        if (!cfg.project || !cfg.key) throw new Error("Configuração SuperDB incompleta para REST upsert.");

        const response = await fetch("https://api.superdb.com.br/user_data?on_conflict=user_id,data_type", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: cfg.key,
                "Content-Type": "application/json",
                Accept: "application/json",
                "Accept-Profile": `proj_${cfg.project}`,
                "Content-Profile": `proj_${cfg.project}`,
                Prefer: "resolution=merge-duplicates,return=representation"
            },
            body: JSON.stringify(rows)
        });
        const raw = await response.text();
        let body = raw;
        try { body = raw ? JSON.parse(raw) : []; } catch { }
        if (!response.ok) {
            const error = new Error(`SuperDB REST ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.details = body;
            throw error;
        }
        return Array.isArray(body) ? body : (body ? [body] : []);
    }

    async function saveUserDataRows(rows) {
        if (window.BackendClientService?.getActiveProvider?.() === "superdb") {
            return superdbRestUpsertUserData(rows);
        }
        const { data, error } = await client.from("user_data")
            .upsert(rows, { onConflict: "user_id,data_type" })
            .select("data_type,content,updated_at,version");
        if (error) throw error;
        return data || [];
    }

    async function deleteSyncedFormData() {
        if (!client || !session?.user) return false;
        if (!navigator.onLine) {
            notify("Sem conexão. Conecte-se para remover os dados preenchidos online.", "warning");
            return false;
        }
        const { error } = await client.from("user_data")
            .delete()
            .eq("user_id", session.user.id)
            .eq("data_type", "form_data");
        if (error) throw error;
        safeRemove(`${APP_CONFIG.storagePrefix}formData`);
        resetWatchedSnapshot();
        await writeSyncLog("success", 1, {
            direction: "delete",
            groups: ["form_data"],
            reason: "save-fields-disabled"
        });
        return true;
    }

    async function writeSyncLog(status, syncedItems, details = {}) {
        if (!session?.user) return;
        if (window.BACKEND_MIGRATION?.stage === "user-data") return;
        try {
            const { error } = await client.from("sync_log").insert({
                user_id: session.user.id,
                status,
                app_version: APP_CONFIG.version,
                device_id: getDeviceId(),
                synced_items: syncedItems,
                details: {
                    sync_schema: SYNC_SCHEMA_VERSION,
                    backend: window.BackendClientService?.getActiveProvider?.() || "unknown",
                    migration_stage: window.BACKEND_MIGRATION?.stage || "legacy",
                    ...details
                }
            });
            if (error) throw error;
        } catch (error) {
            window.Logger?.warn("Não foi possível gravar o log de sincronização.", error);
        }
    }

    async function fetchRemoteRows() {
        let query = client
            .from("user_data")
            .select("data_type,content,updated_at,version")
            .eq("user_id", session.user.id);

        // O SDK SuperDB 0.2.2 não implementa todos os modificadores do
        // Filtramos os grupos conhecidos localmente para manter
        // compatibilidade com os dados retornados pelo backend.
        const { data, error } = await query;
        if (error) throw error;
        const permittedTypes = new Set(Object.keys(SYNC_GROUPS));
        return (data || []).filter((row) => permittedTypes.has(row.data_type));
    }

    function latestRemoteTimestamp(rows) {
        return rows.reduce((latest, row) => Math.max(latest, parseDate(row.updated_at)), 0);
    }

    function detectConflict(rows) {
        if (!hasPendingChanges() || !rows.length || snapshotsEqual(rows)) return false;

        const lastSync = parseDate(safeGet(LAST_SYNC_KEY, ""));
        const localGroupChanges = readLocalGroupChanges();
        const localSnapshot = localSnapshotObject();
        const remoteSnapshot = remoteSnapshotObject(rows);
        const remoteRowsByGroup = Object.fromEntries(rows.map((row) => [row.data_type, row]));

        // Um conflito só existe quando o MESMO grupo foi alterado localmente
        // e também mudou no backend depois da última sincronização.
        // Alterações em grupos independentes não devem abrir o modal.
        return Object.keys(SYNC_GROUPS).some((group) => {
            if (group === UVRM_DESCRIPTION_HISTORY_GROUP) return false;
            if (stableStringify(localSnapshot[group] || {}) === stableStringify(remoteSnapshot[group] || {})) {
                return false;
            }
            const localChanged = parseDate(localGroupChanges[group]);
            const remoteChanged = parseDate(remoteRowsByGroup[group]?.updated_at);
            return localChanged > lastSync + CONFLICT_TOLERANCE_MS
                && remoteChanged > lastSync + CONFLICT_TOLERANCE_MS;
        });
    }

    async function pushLocalData({ silent = false, force = false } = {}) {
        if (syncInProgress) return false;
        if (!client || !session?.user) {
            if (!silent) notify("Faça login para sincronizar.", "warning");
            return false;
        }
        if (!navigator.onLine) {
            setPending(true);
            setOnlineState({ status: "offline", message: "Alterações pendentes. A sincronização será retomada quando houver conexão." });
            if (!silent) notify("Sem conexão. As alterações permanecem salvas localmente.", "warning");
            return false;
        }
        if (hasConflict() && !force) {
            openConflictModal();
            return false;
        }

        syncInProgress = true;
        safeSet(LAST_ATTEMPT_KEY, nowIso());
        setOnlineState({ status: "syncing", direction: "upload" });
        try {
            const updatedAt = nowIso();
            const rows = collectLocalData().map((item) => ({
                user_id: session.user.id,
                data_type: item.data_type,
                content: item.content,
                version: SYNC_SCHEMA_VERSION,
                updated_at: updatedAt
            }));
            const savedRows = await saveUserDataRows(rows);

            const remoteAt = latestRemoteTimestamp(savedRows || []);
            const completedAt = nowIso();
            const syncedAt = remoteAt ? new Date(remoteAt).toISOString() : completedAt;
            safeSet(LAST_SYNC_KEY, completedAt);
            safeSet(LAST_REMOTE_UPDATE_KEY, syncedAt);
            resetWatchedSnapshot();
            setPending(false);
            clearLocalGroupChanges();
            setConflict(false);
            setOnlineState({ status: "synced", at: syncedAt, direction: "upload" });
            await ensureProfile(session.user);
            await writeSyncLog("success", rows.length, { direction: "upload", groups: rows.map((row) => row.data_type) });
            if (!silent) notify("Dados locais enviados e sincronizados.");
            return true;
        } catch (error) {
            setPending(true);
            setOnlineState({ status: "error", message: error.message });
            await writeSyncLog("error", 0, { direction: "upload", error: error.message });
            window.ErrorHandler?.report(error, "Envio ao backend", { silent: true });
            if (!silent) notify(`Falha ao sincronizar: ${error.message}`, "error");
            return false;
        } finally {
            syncInProgress = false;
            renderOnlineStatus();
        }
    }

    async function applyRemoteRows(rows, { silent = false } = {}) {
        // Preferências primeiro: formData só pode ser aplicado quando
        // "Salvar dados preenchidos" estiver habilitado.
        const orderedRows = [...rows].sort((a, b) =>
            (a.data_type === "preferences" ? -1 : 0) - (b.data_type === "preferences" ? -1 : 0)
        );
        orderedRows.forEach((row) => {
            if (SYNC_GROUPS[row.data_type] && isSyncGroupEnabled(row.data_type)) {
                applyGroup(row.content);
            }
        });
        if (!isSyncGroupEnabled("form_data")) {
            safeRemove(`${APP_CONFIG.storagePrefix}formData`);
        }
        const syncedAt = nowIso();
        const remoteAt = latestRemoteTimestamp(rows);
        safeSet(LAST_SYNC_KEY, syncedAt);
        if (remoteAt) safeSet(LAST_REMOTE_UPDATE_KEY, new Date(remoteAt).toISOString());
        setPending(false);
        clearLocalGroupChanges();
        setConflict(false);
        setOnlineState({ status: "synced", at: syncedAt, direction: "download" });
        refreshApplication();
        resetWatchedSnapshot();
        await writeSyncLog("success", rows.length, { direction: "download", groups: rows.map((row) => row.data_type) });
        if (!silent) notify("Dados online aplicados neste navegador.");
        return true;
    }

    async function pullRemoteData({ silent = false, force = false } = {}) {
        if (syncInProgress || !client || !session?.user) return false;
        if (!navigator.onLine) {
            if (!silent) notify("Sem conexão. Não foi possível baixar os dados online.", "warning");
            return false;
        }

        syncInProgress = true;
        safeSet(LAST_ATTEMPT_KEY, nowIso());
        setOnlineState({ status: "syncing", direction: "download" });
        try {
            let rows = await fetchRemoteRows();
            rows = await ensureDocumentGroupStructure(rows);
            rows = await ensureOperationalPreferencesGroup(rows);
            rows = await ensureFileBuilderGroup(rows);
            rows = await ensureFileModelsGroup(rows);
            rows = await ensureFormDataGroup(rows);
            rows = await mergeUvrmDescriptionHistory(rows);
            if (!rows.length) {
                syncInProgress = false;
                return pushLocalData({ silent, force: true });
            }
            if (!force && detectConflict(rows)) {
                setConflict(true, { rows });
                setOnlineState({ status: "conflict", message: "Conflito pendente: existem alterações locais e online posteriores à última sincronização." });
                await writeSyncLog("conflict", rows.length, { direction: "compare" });
                if (!silent) notify("Conflito detectado. Escolha quais dados devem prevalecer.", "warning");
                openConflictModal();
                return false;
            }
            return await applyRemoteRows(rows, { silent });
        } catch (error) {
            setOnlineState({ status: "error", message: error.message });
            await writeSyncLog("error", 0, { direction: "download", error: error.message });
            window.ErrorHandler?.report(error, "Download do backend", { silent: true });
            if (!silent) notify(`Falha ao baixar dados: ${error.message}`, "error");
            return false;
        } finally {
            syncInProgress = false;
            renderOnlineStatus();
        }
    }

    function sessionExpiresAtMs(currentSession = session) {
        const value = Number(currentSession?.expires_at);
        if (!Number.isFinite(value) || value <= 0) return null;
        // SuperDB 0.2.2 retorna expires_at em milissegundos; aceita segundos
        // defensivamente caso o formato mude.
        return value < 100000000000 ? value * 1000 : value;
    }

    function isSessionNearExpiry(currentSession = session, marginMs = 60000) {
        const expiresAt = sessionExpiresAtMs(currentSession);
        return expiresAt !== null && expiresAt <= Date.now() + marginMs;
    }

    function isJwtExpiredError(error) {
        const text = [
            error?.message,
            error?.code,
            error?.details,
            error?.status
        ].filter(Boolean).join(" ").toLowerCase();
        return text.includes("jwt expired") ||
            text.includes("token expired") ||
            text.includes("expired jwt");
    }

    async function refreshBackendSession({ reason = "proactive", silent = false } = {}) {
        if (!client?.auth?.refreshSession) return false;

        // O refresh token do SuperDB e rotativo. Duas chamadas simultaneas de
        // refreshSession() podem tentar reutilizar o mesmo token e revogar a
        // sessao inteira. Todas as rotinas (sync, historico e Realtime) devem
        // compartilhar a mesma renovacao em andamento.
        if (sessionRefreshPromise) {
            window.Logger?.info?.("Renovação da sessão SuperDB já em andamento; aguardando.", { reason });
            return sessionRefreshPromise;
        }

        sessionRefreshPromise = (async () => {
            try {
                const { data, error } = await client.auth.refreshSession();
                if (error) throw error;

                const nextSession = data?.session || null;
                if (!nextSession?.user) throw new Error("A renovação não retornou uma sessão válida.");

                session = nextSession;
                renderOnlineStatus();
                window.Logger?.info?.("Sessão SuperDB renovada.", {
                    reason,
                    expires_at: session.expires_at ?? null
                });
                window.dispatchEvent(new CustomEvent("um:session-refreshed", {
                    detail: { reason }
                }));
                return true;
            } catch (error) {
                window.Logger?.warn?.("Não foi possível renovar a sessão SuperDB.", error);
                session = null;
                resetWatchedSnapshot();
                setConflict(false);
                setOnlineState({ status: "local" });
                renderOnlineStatus();
                if (!silent) notify("Sua sessão expirou. Entre novamente para continuar sincronizando.", "warning");
                return false;
            } finally {
                sessionRefreshPromise = null;
            }
        })();

        return sessionRefreshPromise;
    }

    async function ensureFreshBackendSession({ silent = false } = {}) {
        if (!client?.auth || !session?.user) return false;
        if (!isSessionNearExpiry(session)) return true;
        return refreshBackendSession({ reason: "session-expiring", silent });
    }

    async function synchronize({ silent = false, authRetry = false } = {}) {
        if (!window.IdentityGateService?.canUseOnlineSync?.(session?.user?.id)) {
            return false;
        }
        if (!client || !session?.user) {
            if (!silent) notify("Faça login para sincronizar.", "warning");
            return false;
        }
        if (!navigator.onLine) {
            setPending(hasPendingChanges());
            setOnlineState({ status: "offline" });
            if (!silent) notify("Sem conexão com a internet.", "warning");
            return false;
        }
        if (syncInProgress) return false;

        if (!(await ensureFreshBackendSession({ silent }))) {
            if (!silent && session?.user) notify("Não foi possível validar sua sessão.", "warning");
            return false;
        }

        try {
            let rows = await fetchRemoteRows();
            rows = await ensureDocumentGroupStructure(rows);
            rows = await ensureOperationalPreferencesGroup(rows);
            rows = await ensureFileBuilderGroup(rows);
            rows = await ensureFileModelsGroup(rows);
            rows = await ensureFormDataGroup(rows);
            rows = await mergeUvrmDescriptionHistory(rows);
            if (rows.length && snapshotsEqual(rows)) {
                const remoteAt = latestRemoteTimestamp(rows);
                const syncedAt = remoteAt ? new Date(remoteAt).toISOString() : nowIso();
                safeSet(LAST_SYNC_KEY, syncedAt);
                safeSet(LAST_REMOTE_UPDATE_KEY, syncedAt);
                setPending(false);
                setConflict(false);
                resetWatchedSnapshot();
                setOnlineState({ status: "synced", at: syncedAt, direction: "compare" });
                if (!silent) notify("Sincronização concluída. Os dados estão atualizados.", "success");
                return true;
            }
            if (detectConflict(rows)) {
                setConflict(true, { rows });
                setOnlineState({ status: "conflict" });
                openConflictModal();
                return false;
            }
            if (hasPendingChanges() || !rows.length) return pushLocalData({ silent });
            return applyRemoteRows(rows, { silent });
        } catch (error) {
            if (!authRetry && isJwtExpiredError(error)) {
                const refreshed = await refreshBackendSession({ reason: "jwt-expired", silent });
                if (refreshed) {
                    window.Logger?.info?.("Repetindo sincronização após renovar JWT.");
                    return synchronize({ silent, authRetry: true });
                }
                return false;
            }

            setOnlineState({ status: "error", message: error.message });
            if (!silent) notify(`Falha ao comparar os dados: ${error.message}`, "error");
            return false;
        }
    }

    function scheduleAutoSync(markChange = true) {
        if (applyingRemote || !session?.user) return;
        setPending(true, markChange);
        if (!isAutoSyncEnabled()) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => synchronize({ silent: true }), 1800);
    }

    function notifyLocalGroupChange(group) {
        if (!SYNC_GROUPS[group] || applyingRemote || !session?.user) return;
        markLocalGroupChanges([group]);
        resetWatchedSnapshot();
        scheduleAutoSync(true);
    }

    function formatDate(value) {
        if (!value) return "Nunca";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Nunca" : date.toLocaleString("pt-BR");
    }


    function getDisplayName() {
        try {
            const raw = safeGet(`${APP_CONFIG.storagePrefix}ux31:prefs`, "");
            const prefs = raw ? JSON.parse(raw) : {};
            const name = String(prefs?.displayName || "").replace(/\s+/g, " ").trim().slice(0, 40);
            if (name) return name;
        } catch { }
        const email = session?.user?.email || "";
        return email ? email.split("@")[0] : "Entrar";
    }

    function closeHeaderAccountMenu() {
        const menu = document.getElementById("headerAccountMenu");
        const button = document.getElementById("headerAccountButton");
        if (menu) menu.hidden = true;
        if (button) button.setAttribute("aria-expanded", "false");
    }

    async function signOutAndRefreshUi() {
        await window.IdentityGateService?.prepareSignOut?.();
        const authClient = client || window.BackendClientService?.getClient?.() || null;
        if (!authClient?.auth?.signOut) {
            notify("Não foi possível encerrar a sessão: cliente de autenticação indisponível.");
            return;
        }

        try {
            const result = await authClient.auth.signOut();
            if (result?.error) throw result.error;

            // Não depende exclusivamente de onAuthStateChange: o SDK pode
            // concluir o signOut sem emitir o evento imediatamente.
            session = null;
            resetWatchedSnapshot();
            setConflict(false);
            setOnlineState({ status: "local" });
            renderOnlineStatus();
            closeHeaderAccountMenu();
            notify("Sessão encerrada.");
            window.setTimeout(() => location.reload(), 150);
        } catch (error) {
            window.ErrorHandler?.report?.(error, "Logout do backend", { silent: true });
            notify(error?.message || "Não foi possível encerrar a sessão.");
        }
    }

    function setupHeaderAccountControls() {
        const button = document.getElementById("headerAccountButton");
        const menu = document.getElementById("headerAccountMenu");
        if (!button || !menu || button.dataset.ready === "true") return;
        button.dataset.ready = "true";
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            menu.hidden = !menu.hidden;
            button.setAttribute("aria-expanded", String(!menu.hidden));
        });
        menu.addEventListener("click", (event) => event.stopPropagation());
        document.addEventListener("click", closeHeaderAccountMenu);
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeHeaderAccountMenu(); });
        document.getElementById("headerSignIn")?.addEventListener("click", () => { closeHeaderAccountMenu(); openAuthModal(); });
        document.getElementById("headerSyncNow")?.addEventListener("click", () => { closeHeaderAccountMenu(); synchronize(); });
        document.getElementById("headerSignOut")?.addEventListener("click", () => { closeHeaderAccountMenu(); signOutAndRefreshUi(); });
        document.getElementById("headerAccountSettings")?.addEventListener("click", () => {
            closeHeaderAccountMenu();
            document.querySelector('.ux-main-navigation [data-tab="configuracoes"]')?.click();
            window.setTimeout(() => document.getElementById("onlineSettingsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        });
    }

    function renderOnlineStatus() {

        const email = session?.user?.email || "";
        const displayName = getDisplayName();
        const lastSync = safeGet(LAST_SYNC_KEY, "");
        const lastAttempt = safeGet(LAST_ATTEMPT_KEY, "");
        document.querySelectorAll("[data-online-user]").forEach((el) => { el.textContent = email || "Não conectado"; });
        document.querySelectorAll("[data-online-last-sync]").forEach((el) => { el.textContent = formatDate(lastSync); });
        document.querySelectorAll("[data-online-last-attempt]").forEach((el) => { el.textContent = formatDate(lastAttempt); });
        document.querySelectorAll("[data-online-pending]").forEach((el) => { el.textContent = hasPendingChanges() ? `${Object.keys(SYNC_GROUPS).length} grupos` : "Nenhuma"; });
        document.querySelectorAll("[data-online-authenticated]").forEach((el) => { el.hidden = !session?.user; });
        document.querySelectorAll("[data-online-anonymous]").forEach((el) => { el.hidden = !!session?.user; });
        document.querySelectorAll("[data-header-authenticated]").forEach((el) => { el.hidden = !session?.user; });
        document.querySelectorAll("[data-header-anonymous]").forEach((el) => { el.hidden = !!session?.user; });
        const conflictButton = document.getElementById("onlineResolveConflict");
        if (conflictButton) conflictButton.hidden = !hasConflict();

        let text = "Local";
        let state = "local";
        let message = "Dados armazenados neste navegador.";
        let accountState = "Somente local";

        if (session?.user) {
            accountState = navigator.onLine ? "Online" : "Offline";
            if (!navigator.onLine) {
                text = hasPendingChanges() ? "Offline — pendente" : "Offline";
                state = "offline";
                message = hasPendingChanges() ? "As alterações serão enviadas após a reconexão." : "Sem conexão com a internet.";
            } else if (syncInProgress) {
                text = "Sincronizando";
                state = "syncing";
                message = "Comparando e transferindo dados.";
            } else if (hasConflict()) {
                text = "Conflito";
                state = "conflict";
                message = "Escolha entre manter os dados locais ou usar os dados online.";
            } else if (hasPendingChanges()) {
                text = "Pendente";
                state = "pending";
                message = "Existem alterações locais aguardando sincronização.";
            } else {
                text = "Sincronizado";
                state = "online";
                message = lastSync ? `Última sincronização: ${formatDate(lastSync)}.` : "Conta conectada.";
            }
        }

        const badges = [document.getElementById("onlineStatusBadge"), document.getElementById("homeOnlineStatusBadge")].filter(Boolean);
        badges.forEach((badge) => {
            badge.textContent = text;
            badge.dataset.state = state;
            badge.title = message;
            badge.setAttribute("aria-label", `Sincronização: ${text}. ${message}`);
        });
        const detail = document.getElementById("onlineStatusDetail");
        if (detail) detail.textContent = message;

        const accountName = document.getElementById("headerAccountName");
        const accountStateEl = document.getElementById("headerAccountState");
        const accountMenuName = document.getElementById("headerAccountMenuName");
        const accountEmail = document.getElementById("headerAccountEmail");
        const accountDot = document.getElementById("headerAccountDot");
        const menuDot = document.getElementById("headerMenuStatusDot");
        const menuStatusText = document.getElementById("headerMenuStatusText");
        const accountVisualState = session?.user ? state : "local";
        const accountVisualText = session?.user ? text : "Somente local";

        if (accountName) accountName.textContent = session?.user ? displayName : "Entrar";
        if (accountStateEl) accountStateEl.textContent = accountVisualText;
        if (accountMenuName) accountMenuName.textContent = session?.user ? displayName : "Não conectado";
        if (accountEmail) accountEmail.textContent = email || "Use o armazenamento local ou entre em uma conta.";

        [accountDot, menuDot].filter(Boolean).forEach((dot) => {
            dot.dataset.state = accountVisualState;
            dot.title = accountVisualText;
        });

        if (menuStatusText) menuStatusText.textContent = accountVisualText;

        const footerDot = document.getElementById("footerSyncDot");
        const footerText = document.getElementById("footerSyncText");
        const footerTime = document.getElementById("footerSyncTime");
        if (footerDot) footerDot.dataset.state = state;
        if (footerText) footerText.textContent = session?.user ? text : "Somente local";
        if (footerTime) footerTime.textContent = session?.user
            ? (lastSync ? `Última sincronização: ${formatDate(lastSync)}` : message)
            : "Sem sincronização online";
    }

    function createConflictModal() {
        if (document.getElementById("onlineConflictModal")) return;
        const modal = document.createElement("div");
        modal.id = "onlineConflictModal";
        modal.className = "online-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <div class="online-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="onlineConflictTitle">
                <button class="online-modal-close" type="button" aria-label="Fechar">×</button>
                <span class="eyebrow">Sincronização</span>
                <h2 id="onlineConflictTitle">Conflito de dados</h2>
                <p>Foram encontradas alterações neste navegador e também nos dados online após a última sincronização.</p>
                <p class="help-text">Nenhum dado será substituído até você escolher uma opção.</p>
                <p class="mini-description">Nenhum lado será descartado automaticamente. Escolha qual versão deve prevalecer.</p>
                <div class="online-conflict-options">
                    <button id="onlineKeepLocal" class="primary" type="button"><strong>Manter dados locais</strong><span>Envia os dados deste navegador para o armazenamento online.</span></button>
                    <button id="onlineUseRemote" class="secondary" type="button"><strong>Usar dados online</strong><span>Substitui os dados locais pelos armazenados online.</span></button>
                </div>
                <button id="onlineResolveLater" class="text-button" type="button">Resolver depois</button>
            </div>`;
        document.body.appendChild(modal);
        const close = () => { modal.hidden = true; };
        modal.querySelector(".online-modal-close").addEventListener("click", close);
        modal.querySelector("#onlineResolveLater").addEventListener("click", close);
        modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
        modal.querySelector("#onlineKeepLocal").addEventListener("click", async () => {
            close();
            await pushLocalData({ force: true });
        });
        modal.querySelector("#onlineUseRemote").addEventListener("click", async () => {
            const rows = currentConflict?.rows;
            close();
            if (rows?.length) await applyRemoteRows(rows);
            else await pullRemoteData({ force: true });
        });
    }

    function openConflictModal() {
        if (!window.IdentityGateService?.canUseOnlineSync?.(session?.user?.id)) return;
        createConflictModal();
        const modal = document.getElementById("onlineConflictModal");
        if (modal) modal.hidden = false;
    }

    function createAuthModal() {
        if (document.getElementById("onlineAuthModal")) return;
        const modal = document.createElement("div");
        modal.id = "onlineAuthModal";
        modal.className = "online-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <div class="online-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="onlineAuthTitle">
                <button class="online-modal-close" type="button" aria-label="Fechar">×</button>
                <span class="eyebrow">SuperDB ${window.APP_ENVIRONMENT === "production" ? "PROD" : "DEV"}</span>
                <h2 id="onlineAuthTitle">Acesso online</h2>
                <p class="help-text">Entre para sincronizar preferências, personalização, favoritos, continuidade do Dashboard e seus modelos, grupos e categorias da Central de Documentos.</p>
                <label>E-mail<input id="onlineEmail" type="email" autocomplete="email" required></label>
                <label>Senha<input id="onlinePassword" type="password" autocomplete="current-password" minlength="6" required></label>
                <div class="actions"><button id="onlineSignIn" class="primary" type="button">Entrar</button><button id="onlineSignUp" class="secondary" type="button">Criar conta</button></div>
                <button id="onlineResetPassword" class="text-button" type="button">Esqueci minha senha</button>
                <p id="onlineAuthFeedback" class="feedback" aria-live="polite"></p>
            </div>`;
        document.body.appendChild(modal);
        const close = () => { modal.hidden = true; };
        modal.querySelector(".online-modal-close").addEventListener("click", close);
        modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
        const feedback = modal.querySelector("#onlineAuthFeedback");
        const emailInput = modal.querySelector("#onlineEmail");
        const passwordInput = modal.querySelector("#onlinePassword");
        const signInButton = modal.querySelector("#onlineSignIn");
        const credentials = () => ({ email: emailInput.value.trim(), password: passwordInput.value });

        emailInput.addEventListener("input", () => { if (feedback.textContent !== "Entrando...") feedback.textContent = ""; });
        passwordInput.addEventListener("input", () => { if (feedback.textContent !== "Entrando...") feedback.textContent = ""; });

        signInButton.addEventListener("click", async () => {
            const { email, password } = credentials();
            if (!email || !password) { feedback.textContent = "Informe o e-mail e a senha."; return; }
            signInButton.disabled = true;
            feedback.textContent = "Entrando...";

            try {
                let authClient = client;
                if (!authClient?.auth?.signInWithPassword) authClient = window.BackendClientService?.getClient?.() || null;
                if (!authClient?.auth?.signInWithPassword) throw new Error("Cliente de autenticação não inicializado.");
                client = authClient;
                const { data, error } = await authClient.auth.signInWithPassword({ email, password });
                if (error) {
                    feedback.textContent = error.message || "E-mail ou senha inválidos.";
                    passwordInput.value = ""; passwordInput.focus(); return;
                }
                if (!data?.session?.user) {
                    feedback.textContent = "Não foi possível iniciar a sessão. Tente novamente.";
                    passwordInput.value = ""; passwordInput.focus(); return;
                }
                session = data.session;
                feedback.textContent = "Login realizado.";
                renderOnlineStatus();


                await ensureProfile(session.user);
                setTimeout(close, 500);
            } catch (error) {
                feedback.textContent = error?.message || "Falha ao realizar o login. Tente novamente.";
                passwordInput.value = ""; passwordInput.focus();
            } finally {
                signInButton.disabled = false;
            }
        });
        modal.querySelector("#onlineSignUp").addEventListener("click", async () => {
            const { email, password } = credentials();
            feedback.textContent = "Criando conta...";
            const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0] } });
            feedback.textContent = error ? error.message : (data?.session ? "Conta criada e login realizado." : "Conta criada. O cadastro por senha não confirma o e-mail no SuperDB; use a recuperação de senha para comprovar a titularidade do endereço.");
            if (!error && data?.session) {
                session = data.session;
                renderOnlineStatus();
                if (session?.user) {
                        await ensureProfile(session.user);
                }
                setTimeout(close, 700);
            }
        });
        modal.querySelector("#onlineResetPassword").addEventListener("click", async () => {
            const email = modal.querySelector("#onlineEmail").value.trim();
            if (!email) { feedback.textContent = "Informe o e-mail."; return; }
            try {
                const cfg = window.BACKEND_MIGRATION?.superdb || {};
                const response = await fetch(`${cfg.authUrl}/auth/v1/password/forgot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-SuperDB-Project": cfg.project },
                    body: JSON.stringify({ email, redirect_to: cfg.passwordResetRedirect || location.href.split("#")[0] })
                });
                let payload = {};
                try { payload = await response.json(); } catch { }
                if (!response.ok) throw new Error(payload?.message || payload?.error_description || payload?.error || `Falha na recuperação de senha (${response.status}).`);
                feedback.textContent = "Se existir uma conta para esse e-mail, o link de recuperação foi enviado.";
            } catch (error) {
                feedback.textContent = error?.message || "Não foi possível enviar o e-mail de recuperação.";
            }
        });
    }

    function openAuthModal() {
        createAuthModal();
        const modal = document.getElementById("onlineAuthModal");
        if (!modal) return;
        modal.hidden = false;
        document.getElementById("onlineEmail")?.focus();
    }

    function addSettingsPanel() {
        const root = document.querySelector("#configuracoes .builder-panel");
        if (!root || document.getElementById("onlineSettingsPanel")) return;
        const panel = document.createElement("section");
        panel.id = "onlineSettingsPanel";
        panel.className = "settings-card online-settings-card";
        panel.innerHTML = `
            <div class="section-heading">
                <div><span class="eyebrow">Versão 4.3.1</span><h3>Conta e gerenciamento da sincronização</h3><p class="help-text">O armazenamento local continua ativo. A sincronização online mantém preferências, favoritos e modelos, grupos e categorias da Central de Documentos disponíveis em outros computadores.</p></div>
                <span id="onlineStatusBadge" class="online-status-badge">Local</span>
            </div>
            <p id="onlineStatusDetail" class="online-status-detail">Dados armazenados neste navegador.</p>
            <div class="online-account-summary">
                <div><span>Conta</span><strong data-online-user>Não conectado</strong></div>
                <div><span>Última sincronização</span><strong data-online-last-sync>Nunca</strong></div>
                <div><span>Última tentativa</span><strong data-online-last-attempt>Nunca</strong></div>
                <div><span>Pendências</span><strong data-online-pending>Nenhuma</strong></div>
            </div>
            <div class="actions online-account-actions" id="onlineAccountActions">
                <button id="onlineOpenAuth" class="primary" type="button" data-online-anonymous>Entrar ou criar conta</button>
                <button id="onlineSyncNow" class="primary" type="button" data-online-authenticated hidden>Sincronizar agora</button>
                <button id="onlineRestore" class="secondary" type="button" data-online-authenticated hidden>Usar dados online</button>
                <button id="onlineResolveConflict" class="secondary" type="button" data-online-authenticated hidden>Resolver conflito</button>
                <button id="onlineSignOut" class="danger-outline" type="button" data-online-authenticated hidden>Sair</button>
            </div>
            <label class="checkbox-row"><input id="onlineAutoSync" type="checkbox">Sincronizar automaticamente quando houver alterações</label>
            <p class="help-text">Sincronizados: preferências, nome de exibição, aparência, favoritos, última ferramenta, continuidade do Dashboard e modelos, grupos e categorias da Central de Documentos. Históricos dos módulos, estatísticas e valores da UVRM permanecem somente neste navegador.</p>`;
        root.prepend(panel);
        panel.querySelector("#onlineOpenAuth").addEventListener("click", openAuthModal);
        panel.querySelector("#onlineSyncNow").addEventListener("click", () => synchronize());
        panel.querySelector("#onlineRestore").addEventListener("click", () => pullRemoteData());
        panel.querySelector("#onlineResolveConflict").addEventListener("click", openConflictModal);
        panel.querySelector("#onlineSignOut").addEventListener("click", () => signOutAndRefreshUi());
        const auto = panel.querySelector("#onlineAutoSync");
        auto.checked = isAutoSyncEnabled();
        auto.addEventListener("change", () => {
            safeSet(AUTO_SYNC_KEY, auto.checked);
            notify(auto.checked ? "Sincronização automática ativada." : "Sincronização automática desativada.");
            if (auto.checked && hasPendingChanges()) scheduleAutoSync(false);
        });
        renderOnlineStatus();
    }

    async function initializeOnline() {
        addSettingsPanel();
        createAuthModal();
        createConflictModal();
        setupHeaderAccountControls();
        client = window.BackendClientService?.getClient() || null;
        if (!client) {
            const message = window.BackendClientService?.getError()?.message || "Backend online indisponível.";
            setOnlineState({ status: "unavailable", message });
            window.Logger?.warn(message);
            return;
        }

        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            session = data.session;

            if (session?.user && isSessionNearExpiry(session)) {
                const refreshed = await refreshBackendSession({
                    reason: "startup",
                    silent: true
                });

                if (!refreshed) {
                    window.Logger?.info?.(
                        "Sessão persistida expirada; novo login será necessário."
                    );
                }
            }

        } catch (error) {
            window.ErrorHandler?.report(
                error,
                "Sessão do backend",
                { silent: true }
            );
            session = null;
        }

        if (safeGet(MIGRATION_KEY, "false") !== "true") {
            setConflict(false);
            safeSet(MIGRATION_KEY, "true");
        }
        if (safeGet(DOCUMENTS_MIGRATION_KEY, "false") !== "true") {
            if (documentTemplatesCount() > 0) setPending(true, true);
            safeSet(DOCUMENTS_MIGRATION_KEY, "true");
        }

        if (safeGet(DOCUMENTS_STRUCTURE_MIGRATION_KEY, "false") !== "true") {
            if (hasLocalDocumentStructure()) {
                setPending(true, true);
            }

            safeSet(DOCUMENTS_STRUCTURE_MIGRATION_KEY, "true");
        }

        renderOnlineStatus();

        const authProfileStage = window.BACKEND_MIGRATION?.stage === "auth-profile-disabled";
        if (typeof client.auth.onAuthStateChange === "function") {
            client.auth.onAuthStateChange((event, nextSession) => {
                session = nextSession;
                resetWatchedSnapshot();
                renderOnlineStatus();

                setTimeout(async () => {
                    if (event === "INITIAL_SESSION" && session?.user) {
                            }

                    if (event === "SIGNED_IN" && session?.user) {
                        if (window.IdentityGateService?.isIdentityTransition?.()) return;
                        try {
                            await ensureProfile(session.user);

                            if (!authProfileStage) {
                                await synchronize({ silent: true });
                                await window.HistoryService?.syncAll?.({ silent: true });
                            }
                        } catch (error) {
                            window.ErrorHandler?.report(
                                error,
                                "Sincronização após login",
                                { silent: true }
                            );
                        }
                    }

                    if (event === "SIGNED_OUT") {
            
                        session = null;
                        resetWatchedSnapshot();
                        setConflict(false);
                        setOnlineState({ status: "local" });
                        renderOnlineStatus();
                    }
                }, 0);
            });
        }

        if (window.IdentityGateService?.isLocalMode?.() && session?.user) {
            try { await client.auth.signOut(); } catch { }
            session = null;
            renderOnlineStatus();
        }

        if (session?.user && navigator.onLine && window.IdentityGateService?.isAccountMode?.()) {
            await ensureProfile(session.user);
            if (!authProfileStage) await synchronize({ silent: true });
        }

        window.addEventListener("storage", (event) => {
            const group = event.key ? groupForStorageKey(event.key) : null;
            if (group) {
                markLocalGroupChanges([group]);
                resetWatchedSnapshot();
                scheduleAutoSync(true);
            }
        });
        window.addEventListener("um:display-name-changed", async () => {
            renderOnlineStatus();
            resetWatchedSnapshot();

            // v4.6.0 DEV — Etapa 2 (correção):
            // o nome de exibição pertence a profiles e deve ser persistido
            // independentemente da sincronização geral de user_data.
            if (session?.user) {
                try {
                    await ensureProfile(session.user);
                    Logger.info("Nome de exibição atualizado no profile SuperDB.");
                } catch (error) {
                    Logger.warn("Não foi possível atualizar o nome de exibição no profile SuperDB.", error);
                }
            }

            scheduleAutoSync(true);
        });

        window.addEventListener("um:documents-changed", () => {
            resetWatchedSnapshot();
            scheduleAutoSync(true);
        });

        startSelectiveLocalWatch();
        window.addEventListener("online", () => {
            renderOnlineStatus();
            if (session?.user && isAutoSyncEnabled()) synchronize({ silent: true });
        });
        window.addEventListener("offline", renderOnlineStatus);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && session?.user && navigator.onLine && isAutoSyncEnabled()) synchronize({ silent: true });
        });
        window.addEventListener("beforeunload", () => {
            if (session?.user && hasPendingChanges()) safeSet(PENDING_KEY, "true");
        });

        window.OnlineSyncService = Object.freeze({
            sync: synchronize,
            deleteSyncedFormData,
            upload: pushLocalData,
            restore: pullRemoteData,
            ensureFreshSession: ensureFreshBackendSession,
            refreshSession: refreshBackendSession,
            openLogin: openAuthModal,
            openConflict: openConflictModal,
            getSession: () => window.IdentityGateService?.canUseOnlineSync?.(session?.user?.id) ? session : null,
            getGroups: () => Object.keys(SYNC_GROUPS),
            hasPendingChanges,
            hasConflict,
            notifyLocalGroupChange
        });

        if (session?.user && window.IdentityGateService?.canUseOnlineSync?.(session.user.id)) {
            window.dispatchEvent(
                new CustomEvent("um:session-ready")
            );
        }        
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeOnline, { once: true });
    else initializeOnline();
})();
