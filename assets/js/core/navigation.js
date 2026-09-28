const LAST_TOOL_TAB_KEY = `${APP_CONFIG.storagePrefix}lastToolTab`;

/* Núcleo: navegação entre módulos. */

/* Navegação */

function activateTab(tabId, options = {}) {
    const button = document.querySelector(
        `.tab-button[data-tab="${tabId}"]`
    );
    const panel = document.getElementById(tabId);

    if (!button || !panel) {
        return;
    }

    document.querySelectorAll(".tab-button").forEach((item) => {
        item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".tab-panel").forEach((item) => {
        item.classList.toggle("active", item === panel);
    });

    localStorage.setItem(ACTIVE_TAB_KEY, tabId);

    if (options.track !== false && typeof trackToolAccess === "function") {
        trackToolAccess(tabId);
    }

    if (tabId !== "inicio" && tabId !== "configuracoes") {
        localStorage.setItem(LAST_TOOL_TAB_KEY, tabId);
    }

    if (tabId === "inicio" && typeof updateDashboardLastToolHighlight === "function") {
        updateDashboardLastToolHighlight();
    }

    if (typeof ModuleManager !== "undefined") ModuleManager.activate(tabId);

    if ((tabId === "biblioteca" || tabId === "historico-global") && typeof renderProductivity33 === "function") renderProductivity33();

    if (tabId === "inicio" && typeof updateDashboardSummary === "function") {
        updateDashboardSummary();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

document.addEventListener("click", (event) => {
    const tabButton = event.target.closest(".tab-button[data-tab]");

    if (tabButton) {
        activateTab(tabButton.dataset.tab);
    }
});
