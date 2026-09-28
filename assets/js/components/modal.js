/* Componente: modal reutilizável de confirmação. */

const ConfirmDialog = (() => {
    let elements = null;
    let resolver = null;

    function ensureElements() {
        if (elements) {
            return elements;
        }

        const overlay = document.createElement("div");
        overlay.className = "confirm-dialog-overlay";
        overlay.hidden = true;

        overlay.innerHTML = `
            <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
                <h2 id="confirmDialogTitle">Confirmar ação</h2>
                <p id="confirmDialogMessage"></p>
                <div class="confirm-dialog-actions">
                    <button type="button" class="secondary" data-confirm-cancel>Cancelar</button>
                    <button type="button" class="danger" data-confirm-accept>Confirmar</button>
                </div>
            </section>
        `;

        document.body.appendChild(overlay);

        elements = {
            overlay,
            dialog: overlay.querySelector(".confirm-dialog"),
            title: overlay.querySelector("#confirmDialogTitle"),
            message: overlay.querySelector("#confirmDialogMessage"),
            cancel: overlay.querySelector("[data-confirm-cancel]"),
            accept: overlay.querySelector("[data-confirm-accept]")
        };

        elements.cancel.addEventListener("click", () => close(false));
        elements.accept.addEventListener("click", () => close(true));

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                close(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !overlay.hidden) {
                close(false);
            }
        });

        return elements;
    }

    function close(result) {
        if (!elements || elements.overlay.hidden) {
            return;
        }

        elements.overlay.hidden = true;
        document.body.classList.remove("modal-open");

        const currentResolver = resolver;
        resolver = null;

        if (currentResolver) {
            currentResolver(result);
        }
    }

    function ask(message, options = {}) {
        const ui = ensureElements();
        const {
            title = "Confirmar ação",
            confirmText = "Confirmar",
            cancelText = "Cancelar",
            danger = true
        } = options;

        ui.title.textContent = title;
        ui.message.textContent = message;
        ui.accept.textContent = confirmText;
        ui.cancel.textContent = cancelText;
        ui.accept.className = danger ? "danger" : "primary";

        ui.overlay.hidden = false;
        document.body.classList.add("modal-open");

        window.setTimeout(() => ui.cancel.focus(), 0);

        return new Promise((resolve) => {
            resolver = resolve;
        });
    }

    return { ask };
})();

function confirmAction(message, options) {
    return ConfirmDialog.ask(message, options);
}
