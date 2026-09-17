/* Tratamento centralizado de falhas — v4.2.0. */
(function () {
    "use strict";

    function normalize(error, context = "Aplicação") {
        if (error instanceof Error) return error;
        const message = typeof error === "string" ? error : "Erro não identificado.";
        const normalized = new Error(message);
        normalized.name = context;
        return normalized;
    }

    function report(error, context = "Aplicação", options = {}) {
        const normalized = normalize(error, context);
        const message = `${context}: ${normalized.message}`;
        window.Logger?.error(message, normalized);
        if (!options.silent) {
            if (window.NotificationService?.error) NotificationService.error(options.userMessage || normalized.message);
            else if (typeof showToast === "function") showToast(options.userMessage || normalized.message);
        }
        return normalized;
    }

    window.addEventListener("error", (event) => {
        report(event.error || event.message, "Erro global", { silent: true });
    });

    window.addEventListener("unhandledrejection", (event) => {
        report(event.reason, "Promessa não tratada", { silent: true });
    });

    window.ErrorHandler = Object.freeze({ normalize, report });
})();
