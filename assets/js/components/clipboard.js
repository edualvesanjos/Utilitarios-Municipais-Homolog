/* Componente: cópia para a área de transferência. */

const ClipboardService = {
    async copy(text, options = {}) {
        const value = String(text || "").trim();
        const {
            successMessage = "Conteúdo copiado.",
            emptyMessage = "Não há conteúdo para copiar.",
            errorMessage = "Não foi possível copiar."
        } = options;

        if (!value || value === "—") {
            NotificationService.warning(emptyMessage);
            return false;
        }

        try {
            await navigator.clipboard.writeText(value);
            NotificationService.success(successMessage);
            return true;
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = value;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();

            let copied = false;

            try {
                copied = document.execCommand("copy");
            } finally {
                textarea.remove();
            }

            if (copied) {
                NotificationService.success(successMessage);
            } else {
                NotificationService.error(errorMessage);
            }

            return copied;
        }
    }
};

function copyText(text, options) {
    return ClipboardService.copy(text, options);
}
