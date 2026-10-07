/* Utilitários Municipais v4.7.1.2 DEV — recuperação de senha via API REST oficial do SuperDB. */
(function () {
    "use strict";

    const PREFIX = APP_CONFIG.storagePrefix;
    const META = "um4611:";
    const MODE_KEY = `${META}mode`;
    const OWNER_KEY = `${META}owner`;
    const LOCAL_SNAPSHOT_KEY = `${META}snapshot:local`;
    const USER_SNAPSHOT_PREFIX = `${META}snapshot:user:`;
    const MIGRATED_KEY = `${META}legacyMigrated`;
    const SESSION_GATE_KEY = `${META}gatePassed`;
    const TRANSITION_KEY = `${META}identityTransition`;

    function appKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key?.startsWith(PREFIX)) keys.push(key);
        }
        return keys;
    }

    function captureRuntime() {
        const data = {};
        appKeys().forEach((key) => { data[key] = localStorage.getItem(key); });
        return data;
    }

    function clearRuntime() {
        appKeys().forEach((key) => localStorage.removeItem(key));
    }

    function saveSnapshot(key, data = captureRuntime()) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function readSnapshot(key) {
        try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
    }

    function restoreSnapshot(key) {
        clearRuntime();
        const data = readSnapshot(key);
        Object.entries(data).forEach(([storageKey, value]) => {
            if (storageKey.startsWith(PREFIX) && value !== null) localStorage.setItem(storageKey, String(value));
        });
    }

    function snapshotKeyForUser(userId) {
        return `${USER_SNAPSHOT_PREFIX}${userId}`;
    }

    function persistActiveSnapshot() {
        const mode = localStorage.getItem(MODE_KEY);
        if (mode === "local") saveSnapshot(LOCAL_SNAPSHOT_KEY);
        if (mode === "account") {
            const owner = localStorage.getItem(OWNER_KEY);
            if (owner) saveSnapshot(snapshotKeyForUser(owner));
        }
    }

    function migrateLegacyOnce() {
        if (localStorage.getItem(MIGRATED_KEY) === "true") return;
        saveSnapshot(LOCAL_SNAPSHOT_KEY);
        clearRuntime();
        localStorage.setItem(MIGRATED_KEY, "true");
        localStorage.removeItem(MODE_KEY);
        localStorage.removeItem(OWNER_KEY);
    }

    function prepareBoot() {
        migrateLegacyOnce();
        if (sessionStorage.getItem(SESSION_GATE_KEY) !== "true") {
            persistActiveSnapshot();
            clearRuntime();
            localStorage.removeItem(MODE_KEY);
            localStorage.removeItem(OWNER_KEY);
            return;
        }
        const mode = localStorage.getItem(MODE_KEY);
        const owner = localStorage.getItem(OWNER_KEY);
        if (mode === "local") restoreSnapshot(LOCAL_SNAPSHOT_KEY);
        else if (mode === "account" && owner) restoreSnapshot(snapshotKeyForUser(owner));
    }

    function waitForClient(timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const timer = setInterval(() => {
                const client = window.BackendClientService?.getClient?.();
                if (client?.auth) { clearInterval(timer); resolve(client); return; }
                if (Date.now() - started >= timeoutMs) {
                    clearInterval(timer);
                    reject(new Error("Serviço de autenticação indisponível."));
                }
            }, 100);
        });
    }

    function getPasswordResetToken() {
        const hash = String(location.hash || "").replace(/^#/, "");
        if (!hash) return "";
        const params = new URLSearchParams(hash);
        return params.get("token") || "";
    }

    function getAuthRedirectUrl() {
        return window.BACKEND_MIGRATION?.superdb?.passwordResetRedirect || `${location.origin}${location.pathname}${location.search}`;
    }

    function clearPasswordResetToken() {
        history.replaceState(null, "", `${location.pathname}${location.search}`);
    }

    async function superDbPasswordRequest(path, body) {
        const cfg = window.BACKEND_MIGRATION?.superdb || {};
        if (!cfg.authUrl || !cfg.project) throw new Error("Configuração SuperDB incompleta.");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`${cfg.authUrl}${path}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-SuperDB-Project": cfg.project
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            let payload = {};
            try { payload = await response.json(); } catch { }
            if (!response.ok) {
                const message = payload?.message || payload?.error_description || payload?.error || `Falha na recuperação de senha (${response.status}).`;
                throw new Error(message);
            }
            return payload;
        } catch (error) {
            if (error?.name === "AbortError") throw new Error("O SuperDB não respondeu à recuperação de senha. Tente novamente.");
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    function showGate() {
        if (sessionStorage.getItem(SESSION_GATE_KEY) === "true" || document.getElementById("identityGate")) return;
        const resetToken = getPasswordResetToken();
        const gate = document.createElement("div");
        gate.id = "identityGate";
        gate.className = "identity-gate";

        if (resetToken) {
            gate.innerHTML = `
                <section class="identity-gate-card" role="dialog" aria-modal="true" aria-labelledby="identityGateTitle">
                    <div class="identity-gate-brand"><span aria-hidden="true">🏛</span><div><strong>Utilitários Municipais</strong><small>v${APP_CONFIG.version} DEV</small></div></div>
                    <h1 id="identityGateTitle">Definir nova senha</h1>
                    <p>Informe uma nova senha para concluir a recuperação da sua conta.</p>
                    <label>Nova senha<input id="identityGateNewPassword" type="password" autocomplete="new-password" minlength="8"></label>
                    <label>Confirmar nova senha<input id="identityGateConfirmPassword" type="password" autocomplete="new-password" minlength="8"></label>
                    <button id="identityGateSavePassword" class="primary" type="button">Atualizar senha</button>
                    <button id="identityGateCancelReset" class="secondary" type="button">Voltar ao login</button>
                    <p class="help-text">A senha deve ter pelo menos 8 caracteres.</p>
                    <p id="identityGateFeedback" class="feedback" aria-live="polite"></p>
                </section>`;
            document.body.appendChild(gate);

            const feedback = gate.querySelector("#identityGateFeedback");
            const password = gate.querySelector("#identityGateNewPassword");
            const confirm = gate.querySelector("#identityGateConfirmPassword");
            const save = gate.querySelector("#identityGateSavePassword");
            const cancel = gate.querySelector("#identityGateCancelReset");

            async function updatePassword() {
                const newPassword = password.value;
                if (newPassword.length < 8) { feedback.textContent = "Use uma senha com pelo menos 8 caracteres."; return; }
                if (newPassword !== confirm.value) { feedback.textContent = "As senhas informadas não são iguais."; return; }
                save.disabled = true; cancel.disabled = true;
                feedback.textContent = "Atualizando senha...";
                try {
                    await superDbPasswordRequest("/auth/v1/password/reset", { token: resetToken, new_password: newPassword });
                    clearPasswordResetToken();
                    feedback.textContent = "Senha atualizada. Você já pode entrar com a nova senha.";
                    setTimeout(() => location.reload(), 900);
                } catch (error) {
                    feedback.textContent = error?.message || "Não foi possível atualizar a senha. Solicite um novo link e tente novamente.";
                    save.disabled = false; cancel.disabled = false;
                }
            }

            save.addEventListener("click", updatePassword);
            confirm.addEventListener("keydown", (event) => { if (event.key === "Enter") updatePassword(); });
            cancel.addEventListener("click", () => { clearPasswordResetToken(); location.reload(); });
            setTimeout(() => password.focus(), 0);
            return;
        }

        gate.innerHTML = `
            <section class="identity-gate-card" role="dialog" aria-modal="true" aria-labelledby="identityGateTitle">
                <div class="identity-gate-brand"><span aria-hidden="true">🏛</span><div><strong>Utilitários Municipais</strong><small>v${APP_CONFIG.version} DEV</small></div></div>
                <h1 id="identityGateTitle">Acessar o aplicativo</h1>
                <p>Entre com sua conta para carregar e sincronizar somente os seus dados.</p>
                <label>E-mail<input id="identityGateEmail" type="email" autocomplete="email"></label>
                <label>Senha<input id="identityGatePassword" type="password" autocomplete="current-password"></label>
                <button id="identityGateLogin" class="primary" type="button">Entrar</button>
                <button id="identityGateForgotPassword" class="text-button" type="button">Esqueci minha senha</button>
                <div class="identity-gate-divider"><span>ou</span></div>
                <button id="identityGateLocal" class="secondary" type="button">Usar somente local</button>
                <p class="help-text">No modo local, os dados ficam somente neste navegador e nunca são sincronizados com o SuperDB.</p>
                <p id="identityGateFeedback" class="feedback" aria-live="polite"></p>
            </section>`;
        document.body.appendChild(gate);

        const feedback = gate.querySelector("#identityGateFeedback");
        const email = gate.querySelector("#identityGateEmail");
        const password = gate.querySelector("#identityGatePassword");
        const login = gate.querySelector("#identityGateLogin");
        const forgot = gate.querySelector("#identityGateForgotPassword");
        const local = gate.querySelector("#identityGateLocal");

        async function chooseLocal() {
            local.disabled = true; login.disabled = true; forgot.disabled = true;
            feedback.textContent = "Preparando modo local...";
            try {
                const client = await waitForClient(3000).catch(() => null);
                if (client?.auth?.signOut) await client.auth.signOut().catch?.(() => {});
            } catch { }
            restoreSnapshot(LOCAL_SNAPSHOT_KEY);
            localStorage.setItem(MODE_KEY, "local");
            localStorage.removeItem(OWNER_KEY);
            sessionStorage.setItem(SESSION_GATE_KEY, "true");
            location.reload();
        }

        async function chooseAccount() {
            const userEmail = email.value.trim();
            const userPassword = password.value;
            if (!userEmail || !userPassword) { feedback.textContent = "Informe o e-mail e a senha."; return; }
            login.disabled = true; local.disabled = true; forgot.disabled = true;
            feedback.textContent = "Entrando...";
            sessionStorage.setItem(TRANSITION_KEY, "true");
            try {
                const client = await waitForClient();
                const { data, error } = await client.auth.signInWithPassword({ email: userEmail, password: userPassword });
                if (error) throw error;
                const userId = data?.session?.user?.id;
                if (!userId) throw new Error("Não foi possível identificar o usuário autenticado.");
                restoreSnapshot(snapshotKeyForUser(userId));
                localStorage.setItem(MODE_KEY, "account");
                localStorage.setItem(OWNER_KEY, userId);
                sessionStorage.setItem(SESSION_GATE_KEY, "true");
                sessionStorage.removeItem(TRANSITION_KEY);
                location.reload();
            } catch (error) {
                sessionStorage.removeItem(TRANSITION_KEY);
                feedback.textContent = error?.message || "Não foi possível entrar.";
                password.value = ""; password.focus();
                login.disabled = false; local.disabled = false; forgot.disabled = false;
            }
        }

        async function requestPasswordReset() {
            const userEmail = email.value.trim();
            if (!userEmail) { feedback.textContent = "Informe o e-mail para receber o link de recuperação."; email.focus(); return; }
            login.disabled = true; local.disabled = true; forgot.disabled = true;
            feedback.textContent = "Enviando link de recuperação...";
            try {
                await superDbPasswordRequest("/auth/v1/password/forgot", { email: userEmail, redirect_to: getAuthRedirectUrl() });
                feedback.textContent = "Se existir uma conta para esse e-mail, o link de recuperação foi enviado.";
            } catch (error) {
                feedback.textContent = error?.message || "Não foi possível enviar o link de recuperação.";
            } finally {
                login.disabled = false; local.disabled = false; forgot.disabled = false;
            }
        }

        login.addEventListener("click", chooseAccount);
        forgot.addEventListener("click", requestPasswordReset);
        local.addEventListener("click", chooseLocal);
        password.addEventListener("keydown", (event) => { if (event.key === "Enter") chooseAccount(); });
        setTimeout(() => email.focus(), 0);
    }

    async function prepareSignOut() {
        persistActiveSnapshot();
        clearRuntime();
        localStorage.removeItem(MODE_KEY);
        localStorage.removeItem(OWNER_KEY);
        sessionStorage.removeItem(SESSION_GATE_KEY);
    }

    function isAccountMode() { return localStorage.getItem(MODE_KEY) === "account"; }
    function isLocalMode() { return localStorage.getItem(MODE_KEY) === "local"; }
    function isIdentityTransition() { return sessionStorage.getItem(TRANSITION_KEY) === "true"; }
    function isGatePassed() { return sessionStorage.getItem(SESSION_GATE_KEY) === "true"; }
    function canUseOnlineSync(userId = null) {
        if (!isGatePassed() || !isAccountMode() || isIdentityTransition()) return false;
        const owner = localStorage.getItem(OWNER_KEY);
        return Boolean(owner && (!userId || owner === userId));
    }

    prepareBoot();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showGate, { once: true });
    else showGate();

    setInterval(() => {
        if (sessionStorage.getItem(SESSION_GATE_KEY) === "true") persistActiveSnapshot();
    }, 1500);
    window.addEventListener("pagehide", persistActiveSnapshot);

    window.IdentityGateService = Object.freeze({
        persistActiveSnapshot, prepareSignOut, isAccountMode, isLocalMode, isIdentityTransition, isGatePassed, canUseOnlineSync
    });
})();
