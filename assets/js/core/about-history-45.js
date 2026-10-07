(() => {
    "use strict";

    const HISTORY_URL = "assets/data/version-history.json";

    function setExpanded(item, expanded) {
        const button = item.querySelector(".about-version-toggle");
        const details = item.querySelector(".about-version-details, .about-version-content");
        if (!button || !details) return;
        item.classList.toggle("is-open", expanded);
        button.setAttribute("aria-expanded", String(expanded));
        details.hidden = !expanded;
    }

    function createVersionItem(entry) {
        const article = document.createElement("article");
        article.className = "about-version-item";
        const button = document.createElement("button");
        button.className = "about-version-toggle"; button.type = "button"; button.setAttribute("aria-expanded", "false");
        const heading = document.createElement("span"); heading.className = "about-version-heading";
        const version = document.createElement("strong"); version.textContent = entry.version || "Versão";
        const title = document.createElement("span"); title.textContent = entry.title || "Atualização";
        heading.append(version, title);
        const chevron = document.createElement("span"); chevron.className = "about-version-chevron"; chevron.setAttribute("aria-hidden", "true"); chevron.textContent = "⌄";
        button.append(heading, chevron);
        const details = document.createElement("div");
        details.className = entry.contentClass === "about-version-content" ? "about-version-content" : "about-version-details";
        details.hidden = true; details.innerHTML = entry.contentHtml || "<p>Sem detalhes adicionais.</p>";
        article.append(button, details);
        return article;
    }

    async function loadVersionHistory(history) {
        try {
            const response = await fetch(HISTORY_URL, { cache: "no-cache" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const versions = Array.isArray(data?.versions) ? data.versions : [];
            history.replaceChildren(...versions.map(createVersionItem));
            if (!versions.length) history.innerHTML = '<p class="help-text">Nenhuma versão registrada.</p>';
        } catch (error) {
            console.error("[Utilitários Municipais] Falha ao carregar histórico de versões.", error);
            history.innerHTML = '<p class="help-text">Não foi possível carregar o histórico de versões.</p>';
        }
    }

    async function initializeAboutVersionHistory() {
        const history = document.getElementById("aboutVersionHistory");
        if (!history || history.dataset.initialized === "true") return;
        history.dataset.initialized = "true";
        history.addEventListener("click", (event) => {
            const button = event.target.closest(".about-version-toggle");
            if (!button || !history.contains(button)) return;
            const item = button.closest(".about-version-item");
            if (!item) return;
            const willExpand = button.getAttribute("aria-expanded") !== "true";
            if (willExpand) history.querySelectorAll(".about-version-item.is-open").forEach((other) => { if (other !== item) setExpanded(other, false); });
            setExpanded(item, willExpand);
            if (willExpand) item.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
        });
        await loadVersionHistory(history);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeAboutVersionHistory, { once: true });
    else initializeAboutVersionHistory();
    window.initializeAboutVersionHistory = initializeAboutVersionHistory;
})();
