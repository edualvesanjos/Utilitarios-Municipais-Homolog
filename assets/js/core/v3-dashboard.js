/* Versão 3: dashboard gerado pelo registro central e filtros por categoria. */
let activeToolCategory="todos";
function renderV3ToolCategories(){
    const container=document.getElementById("dashboardToolCategories");
    if(!container) return;
    container.innerHTML="";
    TOOL_CATEGORIES.forEach(category=>container.appendChild(UIComponents.categoryButton(category,category.id===activeToolCategory)));
}
function renderV3ToolCatalog(){
    const container=document.getElementById("dashboardAllTools");
    if(!container) return;
    const tools=getToolsByCategory(activeToolCategory);
    container.innerHTML="";
    tools.forEach(tool=>container.appendChild(UIComponents.toolCard(tool,{favorite:typeof isFavorite==="function"&&isFavorite(tool.id)})));
    if(!tools.length) container.appendChild(UIComponents.empty("Nenhuma ferramenta nesta categoria."));
}
document.addEventListener("click",event=>{
    const filter=event.target.closest("[data-tool-category]");
    if(!filter) return;
    activeToolCategory=filter.dataset.toolCategory;
    renderV3ToolCategories();
    renderV3ToolCatalog();
});
function initializeV3Architecture(){
    StorageService.migrate();
    renderV3ToolCategories();
    renderV3ToolCatalog();
    ModuleManager.initializeAll();
}
