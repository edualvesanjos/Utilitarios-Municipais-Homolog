const APP_VERSION = "4.6.1.17";
window.APP_VERSION = APP_VERSION;

/*
 * Ambiente ativo da aplicação.
 *
 * Para testes:
 *   const APP_ENVIRONMENT = "development";
 *
 * Para publicação oficial:
 *   const APP_ENVIRONMENT = "production";
 *
 * IMPORTANTE:
 * - Nunca inclua chaves privadas ou credenciais administrativas
 *   no código executado pelo navegador.
 * - Credenciais públicas necessárias ao frontend devem ser
 *   fornecidas somente pelos mecanismos previstos para o ambiente.
 */
const APP_ENVIRONMENT = "development";
window.APP_ENVIRONMENT = APP_ENVIRONMENT;

const APP_ENVIRONMENT_NAMES = Object.freeze({
    development: "Desenvolvimento",
    production: "Produção"
});

function getEnvironmentName(environment = APP_ENVIRONMENT) {
    return APP_ENVIRONMENT_NAMES[environment] || environment;
}

const APP_CONFIG = Object.freeze({
    name: "Utilitários Municipais",
    version: APP_VERSION,
    schemaVersion: 13,
    storagePrefix: "utilitariosMunicipais:",
    environment: APP_ENVIRONMENT,
    environmentName: getEnvironmentName(),
    debug: APP_ENVIRONMENT === "development"
});

/* v4.6.x DEV — SuperDB como backend operacional exclusivo.
 * Migração funcional concluída em DEV após homologação de autenticação,
 * user_data, sync_log e history_entries.
 * Nenhuma chave privada deve ser incluída no código-fonte.
 */
const BACKEND_MIGRATION = Object.freeze({
    activeProvider: "superdb",
    targetProvider: "superdb",
    stage: "superdb-only",
    superdb: Object.freeze({
        authUrl: "https://auth.superdb.com.br",
        project: "utilitariosmunicipais_teste",
        anonKey: ""
    })
});

window.BACKEND_MIGRATION = BACKEND_MIGRATION;
