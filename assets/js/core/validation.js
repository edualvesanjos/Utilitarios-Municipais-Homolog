/* Núcleo: validação centralizada de campos. */
const ValidationCenter = (() => {
    const rules = new Map();

    function register(selector, validator, message) {
        rules.set(selector, { validator, message });
    }

    function validate(element) {
        const entry = [...rules.entries()].find(([selector]) => element.matches(selector));
        if (!entry) return true;

        const { validator, message } = entry[1];
        const result = validator(element.value, element);
        const valid = result === true;

        element.classList.toggle("field-invalid", !valid);
        element.setAttribute("aria-invalid", String(!valid));

        let feedback = element.parentElement.querySelector(".field-validation-message");

        if (!valid) {
            if (!feedback) {
                feedback = document.createElement("small");
                feedback.className = "field-validation-message";
                element.insertAdjacentElement("afterend", feedback);
            }
            feedback.textContent = typeof result === "string" ? result : message;
        } else if (feedback) {
            feedback.remove();
        }

        return valid;
    }

    function validateAll(container = document) {
        return [...container.querySelectorAll("input,select,textarea")].every(validate);
    }

    function initialize() {
        document.addEventListener("blur", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.matches("input,select,textarea")) {
                validate(target);
            }
        }, true);

        document.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.classList.contains("field-invalid")) {
                validate(target);
            }
        });
    }

    return { register, validate, validateAll, initialize };
})();

ValidationCenter.register(
    '[inputmode="decimal"]',
    (value) => !String(value).trim() || /^-?[\d.]*([,][\d]*)?$/.test(String(value).trim()),
    "Informe um número válido."
);

ValidationCenter.register(
    '#inscricaoValor',
    (value) => onlyDigits(value).length <= 17,
    "A inscrição excede o limite esperado."
);

ValidationCenter.register(
    'input[type="number"]',
    (value, element) => !value
        || (
            (element.min === "" || Number(value) >= Number(element.min))
            && (element.max === "" || Number(value) <= Number(element.max))
        ),
    "Valor fora do intervalo permitido."
);

ValidationCenter.initialize();
