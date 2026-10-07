/* Utilitários Municipais v4.6.x DEV — Backend Adapter SuperDB. */
(function () {
    "use strict";

    let initializationError = null;

    function getActiveProvider() {
        return "superdb";
    }

    function getTargetProvider() {
        return "superdb";
    }

    function getClient() {
        try {
            const client =
                window.SuperDBClientService?.getClient?.() || null;

            if (!client) {
                const serviceError =
                    window.SuperDBClientService?.getError?.();

                if (serviceError) {
                    throw serviceError;
                }
            }

            return client;
        } catch (error) {
            initializationError = error;

            window.ErrorHandler?.report(
                error,
                "Backend Adapter",
                { silent: true }
            );

            return null;
        }
    }

    function isConfigured() {
        return Boolean(
            window.SuperDBClientService?.isConfigured?.()
        );
    }

    function getEnvironment() {
        return {
            id: APP_CONFIG.environment,
            name: APP_CONFIG.environmentName,
            activeProvider: getActiveProvider(),
            targetProvider: getTargetProvider(),
            migrationStage:
                window.BACKEND_MIGRATION?.stage || "superdb-only"
        };
    }

    function getError() {
        return (
            initializationError ||
            window.SuperDBClientService?.getError?.() ||
            null
        );
    }

    window.BackendClientService = Object.freeze({
        getClient,
        isConfigured,
        getEnvironment,
        getActiveProvider,
        getTargetProvider,
        getError
    });
})();