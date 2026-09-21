/* Versão 3: biblioteca mínima de componentes reutilizáveis. */
const UIComponents = Object.freeze({
    toolCard(tool, { compact = false, favorite = false } = {}) {
        const wrapper = document.createElement("div");
        wrapper.className = `dashboard-tool-wrapper${compact ? " is-compact" : ""}`;
        wrapper.dataset.toolId = tool.id;
        wrapper.dataset.category = tool.category;
        wrapper.innerHTML = `<button class="dashboard-tool-card" type="button" data-open-tab="${tool.id}">${toolIconMarkup(tool.icon, "dashboard-tool-icon")}<span class="dashboard-tool-content"><strong>${tool.name}</strong><small>${tool.description}</small><em class="tool-category-label">${tool.category}</em></span><span class="dashboard-tool-action">Abrir</span></button><button class="favorite-toggle${favorite ? " active" : ""}" type="button" data-favorite-tool="${tool.id}" aria-label="Favoritar ${tool.name}" title="Favorito">★</button>`;
        return wrapper;
    },
    empty(message) { const p = document.createElement("p"); p.className = "empty-state"; p.textContent = message; return p; },
    categoryButton(category, active = false) { const button = document.createElement("button"); button.type = "button"; button.className = `category-filter${active ? " active" : ""}`; button.dataset.toolCategory = category.id; button.textContent = category.name; return button; }
});
