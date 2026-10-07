/* v4.6.7.2 DEV — Estado sincronizado da sequência de lotes, sem Realtime. */
(function () {
    "use strict";

    const META_KEY = `${APP_CONFIG.storagePrefix}lotSequenceSync`;
    const DEVICE_KEY = `${APP_CONFIG.storagePrefix}online:deviceId`;
    let syncing = false;

    function readMeta() {
        try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
        catch { return {}; }
    }
    function writeMeta(meta) { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
    function localSequence() {
        const value = Number(localStorage.getItem(LOT_SEQUENCE_KEY));
        return Number.isInteger(value) && value >= 0 ? value : 0;
    }
    function deviceId() { return localStorage.getItem(DEVICE_KEY) || null; }
    function session() { return window.OnlineSyncService?.getSession?.() || null; }
    function client() { return window.BackendClientService?.getClient?.() || null; }

    function refreshUi(last) {
        const initial = document.getElementById("loteSequenciaInicial");
        const lastLabel = document.getElementById("loteUltimaSequencia");
        const nextLabel = document.getElementById("loteProximaSequencia");
        if (initial) initial.value = Number(last) + 1;
        if (lastLabel) lastLabel.textContent = String(last).padStart(5, "0");
        if (nextLabel) nextLabel.textContent = String(Number(last) + 1).padStart(5, "0");
        if (typeof window.updateLotPreview === "function") window.updateLotPreview();
    }

    async function fetchRemote() {
        const c = client(); const s = session();
        if (!c || !s?.user || !navigator.onLine) return null;
        const { data, error } = await c.from("lot_sequence_state")
            .select("last_sequence,revision,device_id,updated_at")
            .eq("user_id", s.user.id).maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async function createInitial(value) {
        const c = client(); const s = session();
        const payload = { user_id: s.user.id, last_sequence: value, revision: 1, device_id: deviceId() };
        const { data, error } = await c.from("lot_sequence_state").insert(payload)
            .select("last_sequence,revision,device_id,updated_at").single();
        if (error) throw error;
        return data;
    }

    async function sync({ preferRemote = false } = {}) {
        if (syncing) return { skipped: true };
        const s = session();
        if (!s?.user || !navigator.onLine) return { offline: true };
        syncing = true;
        try {
            let remote = await fetchRemote();
            const meta = readMeta();
            const local = localSequence();
            if (!remote) {
                remote = await createInitial(local);
                writeMeta({ revision: remote.revision, dirty: false, updatedAt: remote.updated_at });
                return { created: true, sequence: local };
            }
            if (meta.dirty && !preferRemote) {
                return commitSequence(local);
            }
            localStorage.setItem(LOT_SEQUENCE_KEY, String(remote.last_sequence));
            writeMeta({ revision: remote.revision, dirty: false, updatedAt: remote.updated_at });
            refreshUi(remote.last_sequence);
            return { downloaded: true, sequence: remote.last_sequence };
        } finally { syncing = false; }
    }

    async function commitSequence(value) {
        const next = Math.max(0, Math.min(99999, Number(value) || 0));
        const c = client(); const s = session();
        if (!c || !s?.user || !navigator.onLine) {
            localStorage.setItem(LOT_SEQUENCE_KEY, String(next));
            writeMeta({ ...readMeta(), dirty: true });
            return { offline: true, sequence: next };
        }
        let remote = await fetchRemote();
        const meta = readMeta();
        if (!remote) {
            remote = await createInitial(next);
            localStorage.setItem(LOT_SEQUENCE_KEY, String(next));
            writeMeta({ revision: remote.revision, dirty: false, updatedAt: remote.updated_at });
            return { saved: true, sequence: next };
        }
        if (meta.revision != null && Number(meta.revision) !== Number(remote.revision)) {
            return { conflict: true, remote };
        }
        const expected = Number(remote.revision);
        const { data, error } = await c.from("lot_sequence_state")
            .update({ last_sequence: next, revision: expected + 1, device_id: deviceId() })
            .eq("user_id", s.user.id).eq("revision", expected)
            .select("last_sequence,revision,device_id,updated_at");
        if (error) throw error;
        if (!data?.length) return { conflict: true, remote: await fetchRemote() };
        const saved = data[0];
        localStorage.setItem(LOT_SEQUENCE_KEY, String(next));
        writeMeta({ revision: saved.revision, dirty: false, updatedAt: saved.updated_at });
        return { saved: true, sequence: next };
    }

    // v4.6.7.2: aplica uma escolha local somente após confirmação explícita do usuário
    // quando a revisão remota avançou. A revisão corrente ainda é usada como trava
    // otimista para impedir uma segunda sobrescrita concorrente silenciosa.
    async function forceCommitSequence(value) {
        const next = Math.max(0, Math.min(99999, Number(value) || 0));
        const c = client(); const s = session();
        if (!c || !s?.user || !navigator.onLine) return { offline: true, sequence: next };
        const remote = await fetchRemote();
        if (!remote) return commitSequence(next);
        const expected = Number(remote.revision);
        const { data, error } = await c.from("lot_sequence_state")
            .update({ last_sequence: next, revision: expected + 1, device_id: deviceId() })
            .eq("user_id", s.user.id).eq("revision", expected)
            .select("last_sequence,revision,device_id,updated_at");
        if (error) throw error;
        if (!data?.length) return { conflict: true, remote: await fetchRemote() };
        const saved = data[0];
        localStorage.setItem(LOT_SEQUENCE_KEY, String(next));
        writeMeta({ revision: saved.revision, dirty: false, updatedAt: saved.updated_at });
        return { saved: true, sequence: next, forced: true };
    }

    function setLocalSequence(value, { dirty = false } = {}) {
        const next = Math.max(0, Number(value) || 0);
        localStorage.setItem(LOT_SEQUENCE_KEY, String(next));
        if (dirty) writeMeta({ ...readMeta(), dirty: true });
    }

    window.LotSequenceService = Object.freeze({ sync, commitSequence, forceCommitSequence, setLocalSequence, fetchRemote });
    window.addEventListener("um:session-ready", () => sync().catch((e) => window.Logger?.warn("Falha ao sincronizar sequência de lotes.", e)));
    window.addEventListener("online", () => sync().catch(() => {}));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") sync().catch(() => {});
    });
    window.setTimeout(() => sync().catch(() => {}), 1200);
})();
