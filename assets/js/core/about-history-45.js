(() => {
    "use strict";

    function setExpanded(item, expanded) {
        const button = item.querySelector(".about-version-toggle");
        const details = item.querySelector(".about-version-details");
        if (!button || !details) return;
        item.classList.toggle("is-open", expanded);
        button.setAttribute("aria-expanded", String(expanded));
        details.hidden = !expanded;
    }

    function initializeAboutVersionHistory() {
        const history = document.getElementById("aboutVersionHistory");
        if (!history || history.dataset.initialized === "true") return;
        history.dataset.initialized = "true";

        history.addEventListener("click", (event) => {
            const button = event.target.closest(".about-version-toggle");
            if (!button || !history.contains(button)) return;
            const item = button.closest(".about-version-item");
            if (!item) return;
            const willExpand = button.getAttribute("aria-expanded") !== "true";
            if (willExpand) {
                history.querySelectorAll(".about-version-item.is-open").forEach((other) => {
                    if (other !== item) setExpanded(other, false);
                });
            }
            setExpanded(item, willExpand);
            if (willExpand) {
                item.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                    block: "nearest",
                });
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeAboutVersionHistory, { once: true });
    } else {
        initializeAboutVersionHistory();
    }

    window.initializeAboutVersionHistory = initializeAboutVersionHistory;
})();
