/* Utilitário central de logs — v4.2.0. */
(function () {
    "use strict";

    const enabled = APP_CONFIG.environment !== "production" || APP_CONFIG.debug === true;
    const prefix = `[${APP_CONFIG.name}]`;

    function write(method, args) {
        if (!enabled && method === "debug") return;
        const target = console[method] || console.log;
        target.call(console, prefix, ...args);
    }

    window.Logger = Object.freeze({
        debug: (...args) => write("debug", args),
        info: (...args) => write("info", args),
        warn: (...args) => write("warn", args),
        error: (...args) => write("error", args)
    });
})();
