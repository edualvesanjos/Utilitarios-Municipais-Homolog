/* Serviço de versão e metadados — v4.2.0. */
(function () {
    "use strict";

    window.VersionService = Object.freeze({
        current: () => APP_CONFIG.version,
        schema: () => APP_CONFIG.schemaVersion,
        label: () => `${APP_CONFIG.name} v${APP_CONFIG.version}`,
        info: () => Object.freeze({
            name: APP_CONFIG.name,
            version: APP_CONFIG.version,
            schemaVersion: APP_CONFIG.schemaVersion,
            environment: APP_CONFIG.environment
        })
    });
})();
