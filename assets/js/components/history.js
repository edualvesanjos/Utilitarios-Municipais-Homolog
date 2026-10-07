/* Componente: listas padronizadas de histórico. */

function createEmptyState(message) {
    const item = document.createElement("li");
    item.className = "empty-state";
    item.textContent = message;
    return item;
}

function createHistoryActionButton(action, item) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = action.label;
    button.className = action.className || "secondary mini-button";
    button.addEventListener("click", () => action.onClick(item));

    return button;
}

function renderHistoryList({
    list,
    items,
    emptyMessage,
    getText,
    getActions = () => []
}) {
    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
        list.appendChild(createEmptyState(emptyMessage));
        return;
    }

    items.forEach((item) => {
        const row = document.createElement("li");
        const text = document.createElement("span");
        const actions = document.createElement("div");

        text.textContent = getText(item);
        actions.className = "list-actions";

        getActions(item).forEach((action) => {
            actions.appendChild(createHistoryActionButton(action, item));
        });

        row.append(text);

        if (actions.childElementCount > 0) {
            row.append(actions);
        }

        list.appendChild(row);
    });
}
