/* v4.5.0.2 DEV — comportamento da navegação lateral. */
(() => {
    "use strict";

    const COLLAPSED_KEY = "utilitariosMunicipais:sidebarCollapsed";
    const MOBILE_BREAKPOINT = 820;

    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function getCollapsedPreference() {
        try {
            return localStorage.getItem(COLLAPSED_KEY) === "true";
        } catch {
            return false;
        }
    }

    function saveCollapsedPreference(collapsed) {
        try {
            localStorage.setItem(COLLAPSED_KEY, String(collapsed));
        } catch {}
    }

    function setCollapsed(collapsed) {
        if (isMobile()) collapsed = false;

        document.body.classList.toggle("v45-sidebar-collapsed", collapsed);

        const button = document.getElementById("v45SidebarCollapse");
        if (!button) return;

        button.setAttribute("aria-pressed", String(collapsed));
        button.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
        button.title = collapsed ? "Expandir menu" : "Recolher menu";

        const label = button.querySelector(".v45-collapse-label");
        if (label) label.textContent = collapsed ? "Expandir" : "Recolher";
    }

    function setMobileOpen(open) {
        const mobile = isMobile();
        const sidebar = document.getElementById("v45Sidebar");
        const button = document.getElementById("v45MobileMenuButton");
        const backdrop = document.getElementById("v45SidebarBackdrop");

        if (!sidebar || !button || !backdrop) return;

        const shouldOpen = mobile && open;
        document.body.classList.toggle("v45-sidebar-mobile-open", shouldOpen);
        button.setAttribute("aria-expanded", String(shouldOpen));
        button.setAttribute("aria-label", shouldOpen ? "Fechar menu" : "Abrir menu");
        backdrop.hidden = !shouldOpen;
    }

    function install() {
        const collapseButton = document.getElementById("v45SidebarCollapse");
        const mobileButton = document.getElementById("v45MobileMenuButton");
        const backdrop = document.getElementById("v45SidebarBackdrop");
        const sidebar = document.getElementById("v45Sidebar");

        setCollapsed(getCollapsedPreference());

        collapseButton?.addEventListener("click", () => {
            const next = !document.body.classList.contains("v45-sidebar-collapsed");
            saveCollapsedPreference(next);
            setCollapsed(next);
        });

        mobileButton?.addEventListener("click", () => {
            setMobileOpen(!document.body.classList.contains("v45-sidebar-mobile-open"));
        });

        backdrop?.addEventListener("click", () => setMobileOpen(false));

        sidebar?.querySelectorAll(".tab-button[data-tab]").forEach((button) => {
            button.addEventListener("click", () => {
                if (isMobile()) setMobileOpen(false);
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setMobileOpen(false);
        });

        window.addEventListener("resize", () => {
            if (isMobile()) {
                setCollapsed(false);
            } else {
                setMobileOpen(false);
                setCollapsed(getCollapsedPreference());
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
        install();
    }
})();
