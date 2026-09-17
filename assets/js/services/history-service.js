/* Utilitários Municipais v4.4.5 — sincronização automática de históricos. */
(function () {
    "use strict";

    const OUTBOX_KEY = "history:outbox";
    const DEVICE_KEY = "online:deviceId";
    const HISTORY_SCHEMA_VERSION = 1;
    const MIGRATION_KEY = "history:migrated:4.4.0.1";
    const SYNC_STATE_KEY = "history:syncState";
    const RETRY_BASE_MS = 3000;
    const RETRY_MAX_MS = 60000;
    const AUTO_SYNC_MIN_INTERVAL_MS = 3000;
    const AUTO_SYNC_STARTUP_RETRIES = 5;
    const LOCAL_HISTORY = Object.freeze({
        arquivo: { key: "fileHistory", limit: 15 },
        inscricao: { key: "registrationHistory", limit: 15 },
        lote: { key: "lotHistory", limit: 15 },
        uvrm: { key: "uvrmHistory", limit: 50 },
        percentual: { key: "percentageHistory", limit: 30 },
        datas: { key: "datesHistory", limit: 30 },
        "cpf-cnpj": { key: "documentoFiscalHistory", limit: 20 }
    });
    const SUPPORTED_MODULES = Object.freeze(["arquivo", "inscricao", "lote", "uvrm", "percentual", "datas", "cpf-cnpj"]);

    let automaticSyncTimer = null;
    let lastAutomaticSyncAt = 0;

    function nowIso() {
        return new Date().toISOString();
    }

    function randomId() {
        if (crypto.randomUUID) return crypto.randomUUID();
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
        return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    }

    function getDeviceId() {
        let id = StorageService.getText(DEVICE_KEY, "");
        if (!id) {
            id = randomId();
            StorageService.setText(DEVICE_KEY, id);
        }
        return id;
    }

    function safeTimestamp(value) {
        const date = value ? new Date(value) : new Date();
        return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
    }

    function normalizeValue(value) {
        if (value === undefined) return null;
        if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return value;
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return String(value);
        }
    }

    function createRecord({ module, action = "record", value = null, timestamp = null, clientId = null, metadata = {} }) {
        if (!SUPPORTED_MODULES.includes(module)) throw new Error(`Módulo de histórico não suportado: ${module}`);
        return {
            id: randomId(),
            client_id: clientId || randomId(),
            module,
            action: String(action || "record"),
            value: normalizeValue(value),
            metadata: normalizeValue(metadata) || {},
            occurred_at: safeTimestamp(timestamp),
            device_id: getDeviceId(),
            schema_version: HISTORY_SCHEMA_VERSION,
            sync_status: "pending",
            retry_count: 0,
            last_attempt_at: null,
            last_error: null
        };
    }

    function getSyncState() {
        const state = StorageService.get(SYNC_STATE_KEY, {});
        return {
            syncing: Boolean(state?.syncing),
            lastSuccessAt: state?.lastSuccessAt || null,
            lastAttemptAt: state?.lastAttemptAt || null,
            lastError: state?.lastError || null,
            uploaded: Number(state?.uploaded || 0),
            downloaded: Number(state?.downloaded || 0)
        };
    }

    function setSyncState(patch = {}) {
        const next = { ...getSyncState(), ...patch };
        StorageService.set(SYNC_STATE_KEY, next);
        window.dispatchEvent(new CustomEvent("history-sync-state", { detail: next }));
        return next;
    }

    function listPending() {
        const rows = StorageService.get(OUTBOX_KEY, []);
        return Array.isArray(rows) ? rows : [];
    }

    function enqueue(input) {
        const record = input?.module ? createRecord(input) : input;
        if (!record?.client_id) throw new Error("Registro de histórico sem client_id.");
        const rows = listPending();
        if (!rows.some((item) => item.client_id === record.client_id)) rows.push(record);
        StorageService.set(OUTBOX_KEY, rows);
        return record;
    }

    function removePending(clientIds) {
        const ids = new Set(Array.isArray(clientIds) ? clientIds : [clientIds]);
        const next = listPending().filter((item) => !ids.has(item.client_id));
        StorageService.set(OUTBOX_KEY, next);
        return next;
    }

    function clearPending() {
        StorageService.remove(OUTBOX_KEY);
    }

    function updatePendingAttempt(clientIds, { error = null } = {}) {
        const ids = new Set(Array.isArray(clientIds) ? clientIds : [clientIds]);
        const now = nowIso();
        const rows = listPending().map((row) => {
            if (!ids.has(row.client_id)) return row;
            return {
                ...row,
                retry_count: Number(row.retry_count || 0) + 1,
                last_attempt_at: now,
                last_error: error ? String(error).slice(0, 500) : null
            };
        });
        StorageService.set(OUTBOX_KEY, rows);
        return rows;
    }

    function getSuperDbConfig() {
        const migration = window.BACKEND_MIGRATION || {};
        return {
            authUrl: migration?.superdb?.authUrl || "",
            project: migration?.superdb?.project || "",
            anonKey: migration?.superdb?.anonKey || ""
        };
    }

    async function getHistoryDataPlaneToken() {
        const client = window.BackendClientService?.getClient?.();
        if (!client?.auth?.getDataPlaneToken) {
            throw new Error("Token do Data Plane indisponível para history_entries.");
        }
        const result = await client.auth.getDataPlaneToken();

        // Diagnóstico seguro: revela apenas estrutura/tipos, nunca valores.
        const describeObject = (value) => {
            if (value === null) return { tipo: "null", propriedades: [] };
            if (Array.isArray(value)) return { tipo: "array", propriedades: [] };
            if (typeof value !== "object") return { tipo: typeof value, propriedades: [] };
            return {
                tipo: "object",
                propriedades: Object.keys(value).sort()
            };
        };


        if (result?.error) throw result.error;

        const token =
            typeof result === "string"
                ? result
                : result?.data?.token ||
                  result?.data?.access_token ||
                  result?.token ||
                  result?.access_token ||
                  null;

        if (!token) throw new Error("SuperDB não retornou token do Data Plane.");
        return token;
    }

    async function superDbHistoryUpsert(payload) {
        const cfg = getSuperDbConfig();
        if (!cfg.authUrl || !cfg.project) throw new Error("Configuração SuperDB incompleta.");

        const token = await getHistoryDataPlaneToken();
        const endpoint = "https://api.superdb.com.br/history_entries?on_conflict=user_id,client_id";
        const profile = `proj_${cfg.project}`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                ...(cfg.anonKey ? { "apikey": cfg.anonKey } : {}),
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Profile": profile,
                "Content-Profile": profile,
                "Prefer": "resolution=merge-duplicates,return=representation"
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        let data = [];
        if (text) {
            try { data = JSON.parse(text); }
            catch { data = text; }
        }

        /*historyDevLog("Resposta REST de history_entries.", {
            status: response.status,
            ok: response.ok,
            registros_retornados: Array.isArray(data) ? data.length : null
        });*/
        if (!response.ok) {
            const error = new Error(data?.message || data?.error || `Falha HTTP ${response.status} no history_entries.`);
            error.status = response.status;
            error.code = data?.code || null;
            error.details = data?.details || null;
            throw error;
        }
        return Array.isArray(data) ? data : [];
    }

    async function uploadPending() {
        const sync = window.OnlineSyncService;
        const session = sync?.getSession?.();
        const client = window.BackendClientService?.getClient?.();
        const rows = listPending();

        if (!rows.length) return { uploaded: 0, remaining: 0 };
        if (!client || !session?.user) return { uploaded: 0, remaining: rows.length, reason: "not_authenticated" };
        if (!navigator.onLine) return { uploaded: 0, remaining: rows.length, reason: "offline" };

        const clientIds = rows.map((row) => row.client_id);
        updatePendingAttempt(clientIds);

        const payload = rows.map((row) => ({
            id: row.id,
            user_id: session.user.id,
            client_id: row.client_id,
            module: row.module,
            action: row.action,
            value: row.value,
            metadata: row.metadata || {},
            occurred_at: row.occurred_at,
            device_id: row.device_id,
            schema_version: row.schema_version || HISTORY_SCHEMA_VERSION
        }));

        try {
            let data = [];

            if (window.BackendClientService?.getActiveProvider?.() === "superdb") {
                data = await superDbHistoryUpsert(payload);
            } else {
                const result = await client
                    .from("history_entries")
                    .upsert(payload, { onConflict: "user_id,client_id", ignoreDuplicates: false })
                    .select("client_id");
                if (result.error) throw result.error;
                data = result.data || [];
            }

            const uploadedIds = (data || []).map((item) => item.client_id).filter(Boolean);
            removePending(uploadedIds);
            return { uploaded: uploadedIds.length, remaining: listPending().length };
        } catch (error) {
            updatePendingAttempt(clientIds, { error: error?.message || error });
            throw error;
        }
    }

    async function listRemote({ module = null, limit = 1000 } = {}) {
        const sync = window.OnlineSyncService;
        const session = sync?.getSession?.();
        const client = window.BackendClientService?.getClient?.();
        if (!client || !session?.user) return [];

        const requested = Math.max(1, Math.min(Number(limit) || 1000, 2000));
        const pageSize = Math.min(250, requested);
        const rows = [];

        for (let offset = 0; offset < requested; offset += pageSize) {
            let query = client
                .from("history_entries")
                .select("id,client_id,module,action,value,metadata,occurred_at,device_id,schema_version,created_at,updated_at")
                .eq("user_id", session.user.id)
                .order("occurred_at", { ascending: false })
                .range(offset, Math.min(offset + pageSize - 1, requested - 1));

            if (module) query = query.eq("module", module);

            const { data, error } = await query;
            if (error) throw error;

            const page = data || [];
            rows.push(...page);
            if (page.length < pageSize) break;
        }

        return rows.slice(0, requested);
    }


    const TECHNICAL_FIELDS = new Set([
        "id",
        "client_id",
        "clientId",
        "device_id",
        "deviceId",
        "schema_version",
        "schemaVersion",
        "sync_status",
        "created_at",
        "updated_at",
        "createdAt",
        "copiedAt",
        "timestamp",
        "date",
        "savedAt",
        "finishedAt",
        "occurred_at"
    ]);

    function sanitizeForFingerprint(value) {
        if (Array.isArray(value)) return value.map(sanitizeForFingerprint);
        if (!value || typeof value !== "object") return value;

        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !TECHNICAL_FIELDS.has(key))
                .map(([key, item]) => [key, sanitizeForFingerprint(item)])
        );
    }

    function stableStringify(value) {
        if (value === null || typeof value !== "object") return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }

    function deterministicClientId(module, value) {
        const text = `${module}|${stableStringify(sanitizeForFingerprint(value))}`;
        const hashes = [2166136261, 2246822519, 3266489917, 668265263];
        for (let j = 0; j < hashes.length; j += 1) {
            let h = hashes[j] >>> 0;
            for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
            hashes[j] = h >>> 0;
        }
        const hex = hashes.map((h) => h.toString(16).padStart(8, "0")).join("");
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    }

    function fingerprintValue(value) {
        return stableStringify(sanitizeForFingerprint(value));
    }

    function deterministicActionClientId(module, action, value) {
        return deterministicClientId(`${module}:${action}`, value);
    }

    function queueDeleteHistory(module, value, options = {}) {
        if (!SUPPORTED_MODULES.includes(module)) {
            throw new Error(`Módulo de histórico não suportado: ${module}`);
        }

        const fingerprint = fingerprintValue(value);
        const record = enqueue({
            module,
            action: "delete",
            value,
            timestamp: options.timestamp || nowIso(),
            clientId: options.clientId || deterministicActionClientId(module, "delete", value),
            metadata: {
                tombstone: true,
                target_fingerprint: fingerprint,
                source: options.source || "user_delete"
            }
        });

        window.setTimeout(() => syncAll({ silent: true }).catch(() => {}), 0);
        return record;
    }

    function timestampFromValue(value) {
        return value?.createdAt || value?.copiedAt || value?.timestamp || null;
    }

    function queueHistory(module, value, action = "record", options = {}) {
        const clientId =
            options.clientId ||
            deterministicActionClientId(module, action, value);

        const record = enqueue({
            module,
            action,
            value,
            timestamp: options.timestamp || timestampFromValue(value),
            clientId,
            metadata: options.metadata || {}
        });

        window.setTimeout(() => syncAll({ silent: true }).catch(() => {}), 0);
        return record;
    }

    function scanLocalHistories() {
        let queued = 0;
        Object.entries(LOCAL_HISTORY).forEach(([module, cfg]) => {
            const items = StorageService.get(cfg.key, []);
            if (!Array.isArray(items)) return;
            items.forEach((value) => {
                const clientId = deterministicActionClientId(module, "record", value);
                const before = listPending().length;
                enqueue({
                    module,
                    action: "record",
                    value,
                    timestamp: timestampFromValue(value),
                    clientId,
                    metadata: { source: "local_history", deduplicated: true }
                });
                if (listPending().length > before) queued += 1;
            });
        });
        StorageService.setText(MIGRATION_KEY, "done");
        return queued;
    }

    let syncScheduleTimer = null;
    let retryTimer = null;
    let syncInFlight = null;

    function retryDelay() {
        const maxRetry = listPending().reduce((max, row) => Math.max(max, Number(row.retry_count || 0)), 0);
        return Math.min(RETRY_BASE_MS * Math.max(1, 2 ** Math.min(maxRetry, 4)), RETRY_MAX_MS);
    }

    function clearRetryTimer() {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
    }

    function scheduleRetry() {
        clearRetryTimer();
        if (!listPending().length || !navigator.onLine) return;
        retryTimer = window.setTimeout(() => {
            syncAll({ silent: true }).catch(() => {});
        }, retryDelay());
    }

    function notifyLocalChange() {
        clearTimeout(syncScheduleTimer);
        syncScheduleTimer = window.setTimeout(() => {
            syncAll({ silent: true }).catch(() => {});
        }, 900);
    }

    function historyTimestamp(item) {
        if (!item || typeof item !== "object") return 0;
        const raw = item.occurred_at || item.createdAt || item.copiedAt || item.timestamp || item.date || item.savedAt || item.finishedAt || item.created_at || null;
        const time = raw ? new Date(raw).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    }

    function stableHistoryIdentity(item) {
        if (!item || typeof item !== "object") return stableStringify(item);
        return String(item.id || item.client_id || item.clientId || stableStringify(sanitizeForFingerprint(item)));
    }

    function sortHistoryStable(items) {
        return (Array.isArray(items) ? items : []).map((item,index)=>({item,index})).sort((a,b)=>{
            const dateDiff=historyTimestamp(b.item)-historyTimestamp(a.item);
            if(dateDiff) return dateDiff;
            const idDiff=stableHistoryIdentity(a.item).localeCompare(stableHistoryIdentity(b.item));
            return idDiff || a.index-b.index;
        }).map(({item})=>item);
    }

    function mergeRemoteRows(rows) {
        let added = 0;
        let removed = 0;

        Object.entries(LOCAL_HISTORY).forEach(([module, cfg]) => {
            const local = StorageService.get(cfg.key, []);
            let items = Array.isArray(local) ? local.slice() : [];
            const moduleRows = rows.filter((row) => row.module === module);

            const deletedFingerprints = new Set(
                moduleRows
                    .filter((row) => row.action === "delete")
                    .map((row) => row?.metadata?.target_fingerprint || fingerprintValue(row.value))
                    .filter(Boolean)
            );

            if (deletedFingerprints.size) {
                const before = items.length;
                items = items.filter((item) => !deletedFingerprints.has(fingerprintValue(item)));
                removed += Math.max(0, before - items.length);
            }

            const seen = new Set(items.map((item) => fingerprintValue(item)));

            moduleRows
                .filter((row) => row.action !== "delete")
                .forEach((row) => {
                    const value = row.value;
                    if (!value || typeof value !== "object") return;

                    const fingerprint = fingerprintValue(value);
                    if (deletedFingerprints.has(fingerprint)) return;

                    if (!seen.has(fingerprint)) {
                        items.push(value);
                        seen.add(fingerprint);
                        added += 1;
                    }
                });

            StorageService.set(cfg.key, sortHistoryStable(items).slice(0, cfg.limit));
        });

        if (added || removed) {
            refreshHistoryViews();
        }

        return { added, removed, changed: added + removed };
    }

    function refreshHistoryViews() {
        [
            "renderFileHistory",
            "renderRegistrationHistory",
            "renderLotHistory",
            "renderUvrmHistory",
            "renderPercentageHistory",
            "renderDocumentoFiscalHistory",
            "renderDatesHistory",
            "renderProductivity33",
            "renderGlobalHistory",
            "updateDashboardSummary"
        ].forEach((name) => {
            try {
                if (typeof window[name] === "function") {
                    window[name]();
                }
            } catch {}
        });
    }

    function clearLocalHistories() {
        Object.values(LOCAL_HISTORY).forEach((cfg) => {
            StorageService.remove(cfg.key);
        });

        refreshHistoryViews();
    }

    async function deleteAllSyncedHistories() {
        const sync = window.OnlineSyncService;
        const user = sync?.getSession?.()?.user;

        if (!navigator.onLine) {
            throw new Error("É necessário estar online para excluir os históricos sincronizados.");
        }

        if (!user) {
            throw new Error("É necessário estar conectado para excluir os históricos sincronizados.");
        }

        /*
         * Faz uma sincronização inicial para enviar registros pendentes antes
         * de calcular o conjunto completo que será tombstonado.
         */
        await syncAll({ silent: true });

        const remoteRows = await listRemote({ limit: 2000 });
        const fingerprintsByModule = new Map(
            SUPPORTED_MODULES.map((module) => [module, new Map()])
        );
        const alreadyDeleted = new Map(
            SUPPORTED_MODULES.map((module) => [module, new Set()])
        );

        remoteRows.forEach((row) => {
            if (!SUPPORTED_MODULES.includes(row.module)) {
                return;
            }

            const fingerprint =
                row?.metadata?.target_fingerprint || fingerprintValue(row.value);

            if (!fingerprint) {
                return;
            }

            if (row.action === "delete") {
                alreadyDeleted.get(row.module).add(fingerprint);
                return;
            }

            if (row.value && typeof row.value === "object") {
                fingerprintsByModule.get(row.module).set(fingerprint, row.value);
            }
        });

        Object.entries(LOCAL_HISTORY).forEach(([module, cfg]) => {
            const localItems = StorageService.get(cfg.key, []);

            if (!Array.isArray(localItems)) {
                return;
            }

            localItems.forEach((value) => {
                const fingerprint = fingerprintValue(value);
                fingerprintsByModule.get(module).set(fingerprint, value);
            });
        });

        let queued = 0;

        SUPPORTED_MODULES.forEach((module) => {
            fingerprintsByModule.get(module).forEach((value, fingerprint) => {
                if (alreadyDeleted.get(module).has(fingerprint)) {
                    return;
                }

                const before = listPending().length;

                enqueue({
                    module,
                    action: "delete",
                    value,
                    timestamp: nowIso(),
                    clientId: deterministicActionClientId(module, "delete", value),
                    metadata: {
                        tombstone: true,
                        target_fingerprint: fingerprint,
                        source: "global_history_delete"
                    }
                });

                if (listPending().length > before) {
                    queued += 1;
                }
            });
        });

        /*
         * Remove primeiro a cópia local. Assim, a próxima sync não volta a
         * enfileirar os registros apagados como novas ações "record".
         */
        clearLocalHistories();

        const result = await syncAll({ silent: true });
        refreshHistoryViews();

        return {
            queued,
            uploaded: Number(result?.uploaded || 0),
            remaining: Number(result?.remaining || 0)
        };
    }

    async function performSync({ silent = true } = {}) {
        const scanned = scanLocalHistories();
        setSyncState({
            syncing: true,
            lastAttemptAt: nowIso(),
            lastError: null
        });

        try {
            const uploaded = await uploadPending();
            const sync = window.OnlineSyncService;

            if (!sync?.getSession?.()?.user || !navigator.onLine) {
                const result = { ...uploaded, downloaded: 0 };
                setSyncState({
                    syncing: false,
                    uploaded: result.uploaded || 0,
                    downloaded: 0,
                    lastError: uploaded.reason || null
                });
                if (uploaded.remaining) scheduleRetry();
                return result;
            }

            const remote = await listRemote({ limit: 2000 });
            const merged = mergeRemoteRows(remote);
            const downloaded = Number(merged?.changed || 0);
            const result = {
                ...uploaded,
                downloaded,
                mergedAdded: Number(merged?.added || 0),
                mergedRemoved: Number(merged?.removed || 0)
            };

            setSyncState({
                syncing: false,
                lastSuccessAt: nowIso(),
                lastError: null,
                uploaded: result.uploaded || 0,
                downloaded
            });

            if (result.remaining) scheduleRetry();
            else clearRetryTimer();

            return result;
        } catch (error) {
            setSyncState({
                syncing: false,
                lastError: String(error?.message || error || "Falha de sincronização")
            });
            scheduleRetry();
            throw error;
        }
    }

    function syncAll(options = {}) {
        if (syncInFlight) return syncInFlight;
        syncInFlight = performSync(options).finally(() => {
            syncInFlight = null;
        });
        return syncInFlight;
    }

    window.HistoryService = Object.freeze({
        schemaVersion: HISTORY_SCHEMA_VERSION,
        supportedModules: SUPPORTED_MODULES,
        localHistoryConfig: LOCAL_HISTORY,
        sanitizeForFingerprint,
        fingerprintValue,
        sortHistoryStable,
        createRecord,
        enqueue,
        listPending,
        getSyncState,
        removePending,
        clearPending,
        uploadPending,
        listRemote,
        getDeviceId,
        queueHistory,
        queueDeleteHistory,
        clearLocalHistories,
        deleteAllSyncedHistories,
        scanLocalHistories,
        notifyLocalChange,
        scheduleRetry,
        refreshHistoryViews,
        mergeRemoteRows,
        syncAll
    });

    function canAutomaticallySync() {
        return Boolean(
            navigator.onLine &&
            window.OnlineSyncService?.getSession?.()?.user
        );
    }

    function requestAutomaticSync(options = {}) {
        const {
            delay = 300,
            force = false,
            retryIfSessionMissing = false,
            retriesRemaining = AUTO_SYNC_STARTUP_RETRIES
        } = options;

        if (automaticSyncTimer) {
            window.clearTimeout(automaticSyncTimer);
            automaticSyncTimer = null;
        }

        automaticSyncTimer = window.setTimeout(async () => {
            automaticSyncTimer = null;

            if (!navigator.onLine) {
                return;
            }

            if (!window.OnlineSyncService?.getSession?.()?.user) {
                if (retryIfSessionMissing && retriesRemaining > 0) {
                    requestAutomaticSync({
                        delay: 1000,
                        force,
                        retryIfSessionMissing: true,
                        retriesRemaining: retriesRemaining - 1
                    });
                }
                return;
            }

            const now = Date.now();
            const elapsed = now - lastAutomaticSyncAt;

            if (!force && elapsed < AUTO_SYNC_MIN_INTERVAL_MS) {
                requestAutomaticSync({
                    delay: AUTO_SYNC_MIN_INTERVAL_MS - elapsed,
                    force: true
                });
                return;
            }

            lastAutomaticSyncAt = now;

            try {
                await syncAll({ silent: true });
            } catch {
                // O próprio syncAll atualiza o estado e agenda retry quando necessário.
            }
        }, Math.max(0, Number(delay) || 0));
    }

    window.addEventListener("online", () => {
        clearRetryTimer();
        requestAutomaticSync({ delay: 300, force: true });
    });

    window.addEventListener("offline", () => {
        if (automaticSyncTimer) {
            window.clearTimeout(automaticSyncTimer);
            automaticSyncTimer = null;
        }

        clearRetryTimer();
        setSyncState({ syncing: false, lastError: "offline" });
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            requestAutomaticSync({ delay: 300 });
        }
    });

    window.addEventListener("focus", () => {
        requestAutomaticSync({ delay: 300 });
    });

    requestAutomaticSync({
        delay: 1200,
        force: true,
        retryIfSessionMissing: true
    });
})();
