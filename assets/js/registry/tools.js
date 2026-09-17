/* Versão 3: registro central e declarativo de ferramentas. */
const TOOL_REGISTRY = Object.freeze([
    { id: "central-documentos", name: "Central de documentos", shortName: "Documentos", icon: "documents", category: "Documentos", order: 5, description: "Crie despachos, certidões, ofícios, mensagens e declarações a partir de modelos.", keywords: ["documentos", "despacho", "certidão", "ofício", "whatsapp", "declaração", "modelo", "texto"], module: "central-documentos" },
    { id: "arquivo", name: "Nome de arquivo", shortName: "Arquivos", icon: "file", category: "Documentos", order: 10, description: "Monte nomes padronizados com blocos configuráveis.", keywords: ["arquivo", "nome", "padronização", "blocos", "modelos", "documento", "processo"], module: "arquivo" },
    { id: "inscricao", name: "Inscrição imobiliária", shortName: "Inscrições", icon: "building", category: "Cadastros", order: 20, description: "Normalize inscrições urbanas e rurais automaticamente.", keywords: ["inscrição", "imobiliária", "urbana", "iptu", "itr", "rural", "cadastro"], module: "inscricao" },
    { id: "cpf-cnpj", name: "CPF / CNPJ", shortName: "CPF/CNPJ", icon: "idcard", category: "Cadastros", order: 25, description: "Normalize e valide CPF e CNPJ com máscaras automáticas.", keywords: ["cpf", "cnpj", "documento", "fiscal", "cadastro", "máscara", "validar"], module: "cpf-cnpj" },
    { id: "lote", name: "Número de lote", shortName: "Lotes", icon: "grid", category: "Cadastros", order: 30, description: "Gere sequências de lotes com setor e quadra.", keywords: ["lote", "setor", "quadra", "sequência", "parcelamento"], module: "lote" },
    { id: "uvrm", name: "Calculadora UVRM", shortName: "UVRM", icon: "coins", category: "Cálculos", order: 40, description: "Organize lançamentos em reais e UVRM em uma única operação.", keywords: ["uvrm", "reais", "conversão", "cálculo", "multa", "taxa", "valor", "dias", "quantidade"], module: "uvrm" },
    { id: "percentual", name: "Percentual", shortName: "Percentual", icon: "percent", category: "Cálculos", order: 50, description: "Calcule percentuais, reajustes, descontos e variações.", keywords: ["percentual", "porcentagem", "desconto", "reajuste", "variação", "multa", "acréscimo"], module: "percentual" },
    { id: "datas", name: "Datas", shortName: "Datas", icon: "calendar", category: "Cálculos", order: 60, description: "Conte dias entre datas ou some e subtraia dias corridos.", keywords: ["datas", "dias", "contar", "contador", "somar dias", "subtrair dias", "prazo"], module: "datas" },
    { id: "biblioteca", name: "Biblioteca de ferramentas", shortName: "Biblioteca", icon: "library", category: "Produtividade", order: 70, description: "Explore ferramentas, modelos e acessos rápidos em um catálogo central.", keywords: ["biblioteca", "catálogo", "ferramentas", "modelos", "favoritos", "produtividade"], module: "biblioteca" },
    { id: "historico-global", name: "Histórico global", shortName: "Histórico", icon: "history", category: "Produtividade", order: 80, description: "Pesquise, filtre, copie e exporte registros de todos os módulos.", keywords: ["histórico", "ações", "registros", "pesquisa", "exportar", "filtros"], module: "historico-global" },
    { id: "configuracoes", name: "Configurações", shortName: "Configurações", icon: "settings", category: "Sistema", order: 90, description: "Gerencie interface, backup, dados e estatísticas.", keywords: ["configurações", "backup", "dados", "estatísticas", "exportar", "importar", "compacto", "tema"], module: "configuracoes" },
    { id: "sobre", name: "Sobre", shortName: "Sobre", icon: "info", category: "Sistema", order: 100, description: "Consulte a versão, as novidades e o histórico do aplicativo.", keywords: ["sobre", "versão", "novidades", "changelog", "histórico", "aplicativo"], module: "sobre" }
]);

const TOOL_CATEGORIES = Object.freeze([
    { id: "todos", name: "Todas" },
    { id: "Documentos", name: "Documentos" },
    { id: "Cadastros", name: "Cadastros" },
    { id: "Cálculos", name: "Cálculos" },
    { id: "Produtividade", name: "Produtividade" },
    { id: "Sistema", name: "Sistema" }
]);

function getRegisteredTools(options = {}) {
    const includeSystem = options.includeSystem !== false;
    return TOOL_REGISTRY.filter(tool => includeSystem || tool.category !== "Sistema").sort((a, b) => a.order - b.order);
}
function getRegisteredTool(id) { return TOOL_REGISTRY.find(tool => tool.id === id) || null; }
function getToolsByCategory(category) { return category && category !== "todos" ? getRegisteredTools().filter(tool => tool.category === category) : getRegisteredTools(); }


const TOOL_ICON_PATHS = Object.freeze({
    documents: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5"/><path d="M8 12h8M8 16h8"/><path d="M3 7v14h12"/>',
    file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    building: '<path d="M4 21h16"/><path d="M6 21V5l6-2 6 2v16"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c.8-1.6 2-2.5 3-2.5s2.2.9 3 2.5M13 9h5M13 13h5"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    percent: '<circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M18.5 5.5l-13 13"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    library: '<path d="M4 5h6v14H4zM14 5h6v14h-6z"/><path d="M7 8h1M7 12h1M17 8h1M17 12h1"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3 2.7-2.7a4 4 0 0 0 2 5L8 16l-3-3-3 3 6 6 3-3-3-3 6.7-6.7a4 4 0 0 0 5-5L17 7l-3-3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'
});
function toolIconMarkup(icon, extraClass = "") {
    const path = TOOL_ICON_PATHS[icon] || TOOL_ICON_PATHS.info;
    return `<span class="tool-icon-visual ${extraClass}" data-icon="${icon}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${path}</svg></span>`;
}
