/* Serviço centralizado de persistência, histórico e migração — v4.2.0. */
const StorageService = Object.freeze({
    prefix: APP_CONFIG.storagePrefix,
    key(name) { return `${this.prefix}${name}`; },
    isAvailable() {
        try {
            const testKey = `${this.prefix}storage:test`;
            localStorage.setItem(testKey, "1");
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            window.ErrorHandler?.report(error, "Armazenamento local", { silent: true });
            return false;
        }
    },
    has(name) {
        try { return localStorage.getItem(this.key(name)) !== null; }
        catch (error) { window.ErrorHandler?.report(error, "StorageService.has", { silent: true }); return false; }
    },
    getText(name, fallback = "") {
        try {
            const value = localStorage.getItem(this.key(name));
            return value === null ? fallback : value;
        } catch (error) {
            window.ErrorHandler?.report(error, "StorageService.getText", { silent: true });
            return fallback;
        }
    },
    setText(name, value) {
        try { localStorage.setItem(this.key(name), String(value ?? "")); return value; }
        catch (error) { window.ErrorHandler?.report(error, "StorageService.setText", { silent: true }); return null; }
    },
    get(name, fallback = null) {
        try {
            const value = localStorage.getItem(this.key(name));
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            window.ErrorHandler?.report(error, `StorageService.get(${name})`, { silent: true });
            return fallback;
        }
    },
    set(name, value) {
        try { localStorage.setItem(this.key(name), JSON.stringify(value)); return value; }
        catch (error) { window.ErrorHandler?.report(error, `StorageService.set(${name})`, { silent: true }); return null; }
    },
    remove(name) {
        try { localStorage.removeItem(this.key(name)); return true; }
        catch (error) { window.ErrorHandler?.report(error, `StorageService.remove(${name})`, { silent: true }); return false; }
    },
    update(name, fallback, updater) {
        const current = this.get(name, fallback);
        const next = updater(current);
        this.set(name, next);
        return next;
    },
    history(name) {
        return {
            list: () => { const value = this.get(name, []); return Array.isArray(value) ? value : []; },
            add: (entry, limit = 100) => this.update(name, [], items => [entry, ...(Array.isArray(items) ? items : [])].slice(0, limit)),
            replace: (items) => this.set(name, Array.isArray(items) ? items : []),
            clear: () => this.remove(name)
        };
    },
    exportAll() {
        const data = { application: APP_CONFIG.name, version: APP_CONFIG.version, schemaVersion: APP_CONFIG.schemaVersion, exportedAt: new Date().toISOString(), storage: {} };
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (key?.startsWith(this.prefix)) data.storage[key] = localStorage.getItem(key);
            }
        } catch (error) { window.ErrorHandler?.report(error, "StorageService.exportAll", { silent: true }); }
        return data;
    },
    importAll(data) {
        if (!data || typeof data !== "object" || !data.storage) throw new Error("Backup inválido.");
        Object.entries(data.storage).forEach(([key, value]) => {
            if (key.startsWith(this.prefix)) localStorage.setItem(key, String(value));
        });
        this.setText("schemaVersion", APP_CONFIG.schemaVersion);
    },
    migrate() {
        const current = Number(this.getText("schemaVersion", "2")) || 2;
        if (current < APP_CONFIG.schemaVersion) {
            this.setText("schemaVersion", APP_CONFIG.schemaVersion);
            this.set("migration:last", { from: current, to: APP_CONFIG.schemaVersion, at: new Date().toISOString() });
            window.Logger?.info(`Armazenamento migrado do schema ${current} para ${APP_CONFIG.schemaVersion}.`);
        }
    }
});
