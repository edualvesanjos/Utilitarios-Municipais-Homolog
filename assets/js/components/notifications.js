/* Componente: notificações temporárias. */

const NotificationService = (() => {
    let timeoutId = 0;

    function show(message, options = {}) {
        const toast = $("#toast");

        if (!toast) {
            return;
        }

        const {
            duration = 1800,
            type = "info"
        } = options;

        toast.textContent = String(message || "");
        toast.dataset.type = type;
        toast.classList.add("show");

        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            toast.classList.remove("show");
            delete toast.dataset.type;
        }, duration);
    }

    return {
        show,
        success(message, duration) {
            show(message, { type: "success", duration });
        },
        error(message, duration) {
            show(message, { type: "error", duration });
        },
        warning(message, duration) {
            show(message, { type: "warning", duration });
        }
    };
})();

function showToast(message, options) {
    NotificationService.show(message, options);
}
