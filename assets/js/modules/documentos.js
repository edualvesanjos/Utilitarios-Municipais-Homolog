/* Versão 4.5.2.2: Central de Documentos com categorias e grupos gerenciáveis. */
(() => {
    "use strict";

    const $ = (selector) => document.querySelector(selector);

    const CUSTOM_KEY = "utilitariosMunicipais:documentTemplates";
    const SORT_KEY = "utilitariosMunicipais:documentSort";
    const GROUPS_KEY = "utilitariosMunicipais:documentGroups";
    const CATEGORIES_KEY = "utilitariosMunicipais:documentCategories";
    const NO_GROUP = "";
    const NO_CATEGORY = "";
    const DEFAULT_CATEGORIES = [
        "Despachos",
        "Certidões",
        "Ofícios",
        "WhatsApp",
        "Declarações",
        "Personalizados"
    ];

    let selectedId = null;
    let variableValues = {};


    function notifyDocumentStorageChanged(kind) {
        window.dispatchEvent(new CustomEvent("um:documents-changed", {
            detail: { kind }
        }));
    }

    function normalizeGroup(value) {
        return String(value ?? "").trim();
    }

    function normalizeCategory(value) {
        return String(value ?? "").trim();
    }

    function normalizeTemplate(template) {
        return {
            id: String(template?.id || `custom-${Date.now()}`),
            title: String(template?.title || ""),
            category: normalizeCategory(template?.category),
            group: normalizeGroup(template?.group),
            content: String(template?.content || "")
        };
    }

    function loadTemplates() {
        try {
            const stored = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
            return Array.isArray(stored) ? stored.map(normalizeTemplate) : [];
        } catch {
            return [];
        }
    }

    function saveTemplates(templates) {
        localStorage.setItem(
            CUSTOM_KEY,
            JSON.stringify(templates.map(normalizeTemplate))
        );
        notifyDocumentStorageChanged("templates");
    }

    function loadSavedGroups() {
        try {
            const stored = JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");
            return Array.isArray(stored)
                ? stored.map(normalizeGroup).filter(Boolean)
                : [];
        } catch {
            return [];
        }
    }

    function saveGroups(groups) {
        const unique = [...new Set(
            groups.map(normalizeGroup).filter(Boolean)
        )];

        unique.sort((a, b) => new Intl.Collator("pt-BR", {
            sensitivity: "base",
            numeric: true
        }).compare(a, b));

        localStorage.setItem(GROUPS_KEY, JSON.stringify(unique));
        notifyDocumentStorageChanged("groups");
    }

    function allGroups() {
        const groups = [
            ...loadSavedGroups(),
            ...loadTemplates().map((template) => normalizeGroup(template.group))
        ].filter(Boolean);

        return [...new Set(groups)].sort((a, b) => new Intl.Collator("pt-BR", {
            sensitivity: "base",
            numeric: true
        }).compare(a, b));
    }

    function loadSavedCategories() {
        try {
            const raw = localStorage.getItem(CATEGORIES_KEY);

            if (raw === null) {
                saveCategories(DEFAULT_CATEGORIES);
                return [...DEFAULT_CATEGORIES];
            }

            const stored = JSON.parse(raw);
            return Array.isArray(stored)
                ? stored.map(normalizeCategory).filter(Boolean)
                : [];
        } catch {
            return [...DEFAULT_CATEGORIES];
        }
    }

    function saveCategories(categories) {
        const unique = [...new Set(
            categories.map(normalizeCategory).filter(Boolean)
        )];

        unique.sort((a, b) => new Intl.Collator("pt-BR", {
            sensitivity: "base",
            numeric: true
        }).compare(a, b));

        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(unique));
        notifyDocumentStorageChanged("categories");
    }

    function allCategories() {
        const categories = [
            ...loadSavedCategories(),
            ...loadTemplates().map((template) =>
                normalizeCategory(template.category)
            )
        ].filter(Boolean);

        return [...new Set(categories)].sort((a, b) =>
            new Intl.Collator("pt-BR", {
                sensitivity: "base",
                numeric: true
            }).compare(a, b)
        );
    }

    function allTemplates() {
        return loadTemplates();
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"]/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;"
        }[char]));
    }

    function setFeedback(message, type = "") {
        const element = $("#documentFeedback");
        if (!element) return;

        element.textContent = message || "";
        element.className = `feedback-message ${type}`;
    }

    function setGroupFeedback(message, type = "") {
        const element = $("#documentGroupFeedback");
        if (!element) return;

        element.textContent = message || "";
        element.className = `feedback-message ${type}`;
    }

    function setCategoryFeedback(message, type = "") {
        const element = $("#documentCategoryFeedback");
        if (!element) return;

        element.textContent = message || "";
        element.className = `feedback-message ${type}`;
    }

    function getSortOrder() {
        const saved = localStorage.getItem(SORT_KEY);
        return ["titulo", "categoria", "grupo"].includes(saved)
            ? saved
            : "titulo";
    }

    function setSortOrder(value) {
        localStorage.setItem(
            SORT_KEY,
            ["titulo", "categoria", "grupo"].includes(value)
                ? value
                : "titulo"
        );
    }

    function setEditorVisible(visible) {
        const emptyState = $("#documentEmptyState");
        const editorContent = $("#documentEditorContent");

        if (emptyState) emptyState.hidden = visible;
        if (editorContent) editorContent.hidden = !visible;
    }

    function updateEditorHeading() {
        const heading = $("#documentEditorHeading");
        if (!heading) return;

        const title = $("#documentTitle")?.value.trim();
        heading.textContent = title || (selectedId ? "Editar modelo" : "Novo modelo");
    }

    function refreshCategoryControls() {
        const categories = allCategories();
        const filter = $("#documentCategory");
        const editor = $("#documentEditorCategory");

        if (filter) {
            const current = filter.value || "todos";
            filter.innerHTML = [
                '<option value="todos">Todas as categorias</option>',
                '<option value="sem-categoria">Sem categoria</option>',
                ...categories.map((category) =>
                    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
                )
            ].join("");

            filter.value = [
                "todos",
                "sem-categoria",
                ...categories
            ].includes(current) ? current : "todos";
        }

        if (editor) {
            const current = editor.value;
            editor.innerHTML = [
                '<option value="">Sem categoria</option>',
                ...categories.map((category) =>
                    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
                )
            ].join("");

            editor.value = categories.includes(current) ? current : "";
        }
    }

    function refreshGroupControls() {
        const groups = allGroups();
        const filter = $("#documentGroupFilter");
        const editor = $("#documentEditorGroup");

        if (filter) {
            const current = filter.value || "todos";
            filter.innerHTML = [
                '<option value="todos">Todos os grupos</option>',
                '<option value="sem-grupo">Sem grupo</option>',
                ...groups.map((group) =>
                    `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`
                )
            ].join("");

            filter.value = [
                "todos",
                "sem-grupo",
                ...groups
            ].includes(current) ? current : "todos";
        }

        if (editor) {
            const current = editor.value;
            editor.innerHTML = [
                '<option value="">Sem grupo</option>',
                ...groups.map((group) =>
                    `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`
                )
            ].join("");

            editor.value = groups.includes(current) ? current : "";
        }
    }

    function filtered() {
        const query = ($("#documentSearch")?.value || "")
            .trim()
            .toLocaleLowerCase("pt-BR");
        const category = $("#documentCategory")?.value || "todos";
        const group = $("#documentGroupFilter")?.value || "todos";
        const order = $("#documentOrder")?.value || getSortOrder();

        const collator = new Intl.Collator("pt-BR", {
            sensitivity: "base",
            numeric: true
        });

        return allTemplates()
            .filter((template) => {
                const templateGroup = normalizeGroup(template.group);
                const templateCategory = normalizeCategory(template.category);
                const matchesCategory =
                    category === "todos"
                    || (category === "sem-categoria" && !templateCategory)
                    || templateCategory === category;

                const matchesGroup =
                    group === "todos"
                    || (group === "sem-grupo" && !templateGroup)
                    || templateGroup === group;

                const searchable = [
                    template.title,
                    template.category,
                    templateGroup,
                    template.content
                ].join(" ").toLocaleLowerCase("pt-BR");

                return matchesCategory
                    && matchesGroup
                    && (!query || searchable.includes(query));
            })
            .sort((a, b) => {
                const groupA = normalizeGroup(a.group) || "Sem grupo";
                const groupB = normalizeGroup(b.group) || "Sem grupo";

                if (order === "categoria") {
                    return collator.compare(a.category, b.category)
                        || collator.compare(groupA, groupB)
                        || collator.compare(a.title, b.title);
                }

                if (order === "grupo") {
                    return collator.compare(groupA, groupB)
                        || collator.compare(a.category, b.category)
                        || collator.compare(a.title, b.title);
                }

                return collator.compare(a.title, b.title)
                    || collator.compare(a.category, b.category)
                    || collator.compare(groupA, groupB);
            });
    }

    function renderModelSelect() {
        const select = $("#documentModelSelect");
        if (!select) return;

        const items = filtered();
        const selectedIsVisible = items.some((template) => template.id === selectedId);

        select.innerHTML = [
            `<option value="">${
                items.length
                    ? "Selecione um modelo de documento..."
                    : "Nenhum modelo encontrado com os filtros atuais"
            }</option>`,
            ...items.map((template) => {
                const group = normalizeGroup(template.group);
                const suffix = [
                    normalizeCategory(template.category) || "Sem categoria",
                    group || "Sem grupo"
                ].join(" · ");

                return `
                    <option value="${escapeHtml(template.id)}">
                        ${escapeHtml(template.title)} — ${escapeHtml(suffix)}
                    </option>
                `;
            })
        ].join("");

        select.value = selectedIsVisible ? selectedId : "";
    }

    function renderFiltersAndModels() {
        refreshCategoryControls();
        refreshGroupControls();
        renderModelSelect();
    }

    function selectTemplate(id) {
        if (!id) return;

        const template = allTemplates().find((item) => item.id === id);
        if (!template) return;

        selectedId = id;
        variableValues = {};

        $("#documentTitle").value = template.title;

        refreshCategoryControls();
        $("#documentEditorCategory").value = normalizeCategory(template.category);

        refreshGroupControls();
        $("#documentEditorGroup").value = normalizeGroup(template.group);

        $("#documentTemplate").value = template.content;

        setEditorVisible(true);
        updateEditorHeading();
        renderVariables();
        renderModelSelect();
        setFeedback();
    }

    function variables() {
        return [...new Set(
            (($("#documentTemplate")?.value || "").match(/\{[^{}]+\}/g) || [])
                .map((value) => value.slice(1, -1).trim())
                .filter(Boolean)
        )];
    }

    function defaultValue(variable) {
        if (variable.toLowerCase() === "data") {
            return new Intl.DateTimeFormat("pt-BR").format(new Date());
        }

        return "";
    }

    function renderVariables() {
        const host = $("#documentVariables");
        if (!host) return;

        const vars = variables();

        host.innerHTML = vars.length
            ? vars.map((variable) => `
                <label>
                    <span>${escapeHtml(variable)}</span>
                    <input
                        data-document-variable="${escapeHtml(variable)}"
                        value="${escapeHtml(variableValues[variable] || defaultValue(variable))}"
                        placeholder="${escapeHtml(variable)}"
                    >
                </label>
            `).join("")
            : '<p class="empty-state">Nenhuma variável encontrada neste modelo.</p>';

        host.querySelectorAll("[data-document-variable]").forEach((input) => {
            input.addEventListener("input", () => {
                variableValues[input.dataset.documentVariable] = input.value;
                renderPreview();
            });
        });

        vars.forEach((variable) => {
            const input = host.querySelector(
                `[data-document-variable="${CSS.escape(variable)}"]`
            );
            if (input) variableValues[variable] = input.value;
        });

        renderPreview();
    }

    function renderPreview() {
        let text = $("#documentTemplate")?.value || "";

        for (const variable of variables()) {
            text = text
                .split(`{${variable}}`)
                .join(variableValues[variable] || `{${variable}}`);
        }

        const preview = $("#documentPreview");
        if (preview) preview.value = text;
    }

    function newModel() {
        selectedId = null;
        variableValues = {};

        $("#documentTitle").value = "";

        refreshCategoryControls();
        $("#documentEditorCategory").value = allCategories().includes("Personalizados")
            ? "Personalizados"
            : NO_CATEGORY;

        refreshGroupControls();
        $("#documentEditorGroup").value = NO_GROUP;

        $("#documentTemplate").value = "";
        $("#documentModelSelect").value = "";

        setEditorVisible(true);
        updateEditorHeading();
        renderVariables();
        setFeedback();

        window.setTimeout(() => $("#documentTitle")?.focus(), 0);
    }

    function saveModel() {
        const title = $("#documentTitle").value.trim();
        const content = $("#documentTemplate").value.trim();
        const category = normalizeCategory(
            $("#documentEditorCategory").value
        );
        const group = normalizeGroup($("#documentEditorGroup").value);

        if (!title || !content) {
            setFeedback("Informe o título e o conteúdo do modelo.", "error");
            return;
        }

        if (category) {
            saveCategories([...allCategories(), category]);
        }

        if (group) {
            saveGroups([...allGroups(), group]);
        }

        const list = loadTemplates();
        const id = selectedId || `custom-${Date.now()}`;
        const item = {
            id,
            title,
            category,
            group,
            content
        };

        const index = list.findIndex((template) => template.id === id);

        if (index >= 0) {
            list.splice(index, 1, item);
        } else {
            list.unshift(item);
        }

        saveTemplates(list);
        selectedId = id;

        renderFiltersAndModels();
        $("#documentModelSelect").value = id;
        updateEditorHeading();
        setFeedback("Modelo salvo.", "success");

        if (typeof showToast === "function") {
            showToast("Modelo salvo.");
        }
    }

    function createUniqueTemplateId(preferredId, usedIds) {
        const preferred = String(preferredId || "").trim();

        if (preferred && !usedIds.has(preferred)) {
            usedIds.add(preferred);
            return preferred;
        }

        let attempt = 0;
        let candidate;

        do {
            attempt += 1;
            candidate = `custom-${Date.now()}-${attempt}`;
        } while (usedIds.has(candidate));

        usedIds.add(candidate);
        return candidate;
    }

    function duplicateModel() {
        if (!selectedId) {
            setFeedback("Selecione um modelo para duplicar.", "error");
            return;
        }

        const source = allTemplates().find((item) => item.id === selectedId);

        if (!source) {
            setFeedback("Modelo não encontrado.", "error");
            return;
        }

        const list = loadTemplates();
        const usedIds = new Set(list.map((item) => item.id));
        const copy = {
            id: createUniqueTemplateId("", usedIds),
            title: `${source.title} (cópia)`,
            category: source.category,
            group: normalizeGroup(source.group),
            content: source.content
        };

        list.unshift(copy);
        saveTemplates(list);

        selectedId = copy.id;
        variableValues = {};

        renderFiltersAndModels();
        selectTemplate(copy.id);
        setFeedback(
            "Modelo duplicado. Edite a cópia e salve as alterações.",
            "success"
        );

        if (typeof showToast === "function") {
            showToast("Modelo duplicado.");
        }
    }

    function buildModelsExportPayload() {
        return {
            app: "Utilitários Municipais",
            type: "document-templates",
            schema_version: 2,
            app_version: typeof APP_VERSION !== "undefined"
                ? APP_VERSION
                : null,
            exported_at: new Date().toISOString(),
            categories: allCategories(),
            groups: allGroups(),
            templates: allTemplates().map((template) => ({
                id: template.id,
                title: template.title,
                category: template.category,
                group: normalizeGroup(template.group),
                content: template.content
            }))
        };
    }

    function exportModels() {
        const templates = allTemplates();

        if (!templates.length) {
            setFeedback("Não há modelos para exportar.", "error");
            return;
        }

        const blob = new Blob(
            [JSON.stringify(buildModelsExportPayload(), null, 2)],
            { type: "application/json;charset=utf-8" }
        );
        const link = document.createElement("a");
        const date = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[-:T]/g, "");

        link.href = URL.createObjectURL(blob);
        link.download = `utilitarios-municipais-modelos-${date}.json`;
        link.click();
        URL.revokeObjectURL(link.href);

        setFeedback(
            `${templates.length} ${
                templates.length === 1
                    ? "modelo exportado"
                    : "modelos exportados"
            }.`,
            "success"
        );
    }

    function normalizeImportedTemplate(raw, index) {
        if (!raw || typeof raw !== "object") {
            throw new Error(`Modelo ${index + 1}: estrutura inválida.`);
        }

        const title = String(raw.title || "").trim();
        const content = String(raw.content || "").trim();

        if (!title || !content) {
            throw new Error(
                `Modelo ${index + 1}: título e conteúdo são obrigatórios.`
            );
        }

        return {
            id: String(raw.id || "").trim(),
            title,
            category: normalizeCategory(raw.category),
            group: normalizeGroup(raw.group),
            content
        };
    }

    function importedPayload(fileContent) {
        const parsed = JSON.parse(fileContent);

        if (Array.isArray(parsed)) {
            return {
                categories: [],
                groups: [],
                templates: parsed
            };
        }

        if (!parsed || typeof parsed !== "object") {
            throw new Error("Arquivo de modelos inválido.");
        }

        if (parsed.type && parsed.type !== "document-templates") {
            throw new Error(
                "O arquivo selecionado não é um pacote de modelos."
            );
        }

        if (!Array.isArray(parsed.templates)) {
            throw new Error(
                "O arquivo não contém uma lista válida de modelos."
            );
        }

        return {
            categories: Array.isArray(parsed.categories)
                ? parsed.categories
                : [],
            groups: Array.isArray(parsed.groups)
                ? parsed.groups
                : [],
            templates: parsed.templates
        };
    }

    async function importModels(event) {
        const input = event.currentTarget;
        const file = input?.files?.[0];

        if (!file) return;

        try {
            const payload = importedPayload(await file.text());

            if (!payload.templates.length) {
                setFeedback(
                    "O arquivo não contém modelos para importar.",
                    "error"
                );
                return;
            }

            const imported = payload.templates.map(normalizeImportedTemplate);
            const current = loadTemplates();
            const usedIds = new Set(current.map((item) => item.id));
            const exactFingerprints = new Set(
                current.map((item) => JSON.stringify([
                    item.title,
                    item.category,
                    normalizeGroup(item.group),
                    item.content
                ]))
            );

            let added = 0;
            let skipped = 0;
            let adjustedIds = 0;
            const additions = [];

            imported.forEach((template) => {
                const fingerprint = JSON.stringify([
                    template.title,
                    template.category,
                    normalizeGroup(template.group),
                    template.content
                ]);

                if (exactFingerprints.has(fingerprint)) {
                    skipped += 1;
                    return;
                }

                const originalId = template.id;
                const id = createUniqueTemplateId(originalId, usedIds);

                if (originalId && id !== originalId) {
                    adjustedIds += 1;
                }

                additions.push({
                    ...template,
                    id
                });

                exactFingerprints.add(fingerprint);
                added += 1;
            });

            const importedCategories = payload.categories
                .map(normalizeCategory)
                .filter(Boolean);

            const templateCategories = additions
                .map((template) => normalizeCategory(template.category))
                .filter(Boolean);

            saveCategories([
                ...allCategories(),
                ...importedCategories,
                ...templateCategories
            ]);

            const importedGroups = payload.groups
                .map(normalizeGroup)
                .filter(Boolean);

            const templateGroups = additions
                .map((template) => normalizeGroup(template.group))
                .filter(Boolean);

            saveGroups([
                ...allGroups(),
                ...importedGroups,
                ...templateGroups
            ]);

            if (additions.length) {
                saveTemplates([
                    ...additions,
                    ...current
                ]);
            }

            selectedId = null;
            variableValues = {};
            setEditorVisible(false);
            renderFiltersAndModels();

            const details = [
                `${added} ${
                    added === 1
                        ? "modelo importado"
                        : "modelos importados"
                }`
            ];

            if (skipped) {
                details.push(
                    `${skipped} ${
                        skipped === 1
                            ? "duplicado ignorado"
                            : "duplicados ignorados"
                    }`
                );
            }

            if (adjustedIds) {
                details.push(
                    `${adjustedIds} ${
                        adjustedIds === 1
                            ? "ID ajustado"
                            : "IDs ajustados"
                    }`
                );
            }

            setFeedback(`${details.join("; ")}.`, "success");

            if (typeof showToast === "function" && added) {
                showToast("Importação de modelos concluída.");
            }
        } catch (error) {
            setFeedback(
                error instanceof SyntaxError
                    ? "Não foi possível ler o arquivo JSON."
                    : error.message || "Não foi possível importar os modelos.",
                "error"
            );
        } finally {
            input.value = "";
        }
    }

    function deleteModel() {
        if (!selectedId) {
            setFeedback("Selecione um modelo para excluir.", "error");
            return;
        }

        const template = allTemplates().find((item) => item.id === selectedId);
        if (!template) {
            setFeedback("Modelo não encontrado.", "error");
            return;
        }

        const confirmed = window.confirm(
            `Excluir o modelo “${template.title}”? Esta ação removerá o modelo deste dispositivo.`
        );

        if (!confirmed) return;

        saveTemplates(
            loadTemplates().filter((item) => item.id !== selectedId)
        );

        selectedId = null;
        variableValues = {};

        $("#documentTitle").value = "";
        $("#documentEditorCategory").value = NO_CATEGORY;
        $("#documentEditorGroup").value = "";
        $("#documentTemplate").value = "";
        $("#documentPreview").value = "";
        $("#documentVariables").innerHTML = "";

        setEditorVisible(false);
        renderFiltersAndModels();
        setFeedback();

        if (typeof showToast === "function") {
            showToast("Modelo excluído.");
        }
    }

    function clearVariables() {
        variableValues = {};
        renderVariables();
        setFeedback("Campos de variáveis limpos.", "success");
    }

    async function copyPreview() {
        const text = $("#documentPreview").value.trim();

        if (!text) {
            setFeedback("Não há texto para copiar.", "error");
            return;
        }

        if (typeof copyText === "function") {
            await copyText(text);
        } else {
            await navigator.clipboard.writeText(text);
        }

        setFeedback("Texto copiado.", "success");
    }

    function exportTxt() {
        const text = $("#documentPreview").value.trim();

        if (!text) {
            setFeedback("Não há texto para exportar.", "error");
            return;
        }

        const blob = new Blob([text], {
            type: "text/plain;charset=utf-8"
        });
        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);
        link.download = ($("#documentTitle").value || "documento")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() + ".txt";

        link.click();
        URL.revokeObjectURL(link.href);
    }

    function clearFilters() {
        $("#documentSearch").value = "";
        $("#documentCategory").value = "todos";
        $("#documentGroupFilter").value = "todos";
        $("#documentOrder").value = "titulo";
        setSortOrder("titulo");

        selectedId = null;
        variableValues = {};

        const modelSelect = $("#documentModelSelect");
        if (modelSelect) modelSelect.value = "";

        setEditorVisible(false);
        renderModelSelect();
        setFeedback();
    }

    function renderCategoryList() {
        const host = $("#documentCategoryList");
        if (!host) return;

        const categories = allCategories();

        host.innerHTML = categories.length
            ? categories.map((category) => {
                const count = allTemplates().filter(
                    (template) =>
                        normalizeCategory(template.category) === category
                ).length;

                return `
                    <div class="document-group-item" data-document-category="${escapeHtml(category)}">
                        <div class="document-group-item-name">
                            <strong>${escapeHtml(category)}</strong>
                            <span>${count} ${count === 1 ? "modelo" : "modelos"}</span>
                        </div>
                        <div class="document-group-item-actions">
                            <button
                                class="text-button"
                                type="button"
                                data-category-action="rename"
                                data-category-name="${escapeHtml(category)}"
                            >Renomear</button>
                            <button
                                class="danger-button"
                                type="button"
                                data-category-action="delete"
                                data-category-name="${escapeHtml(category)}"
                            >Excluir</button>
                        </div>
                    </div>
                `;
            }).join("")
            : `
                <div class="document-group-empty">
                    <strong>Nenhuma categoria cadastrada.</strong>
                    <span>Crie a primeira categoria usando o campo acima.</span>
                </div>
            `;

        host.querySelectorAll("[data-category-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const category = button.dataset.categoryName;

                if (button.dataset.categoryAction === "rename") {
                    renameCategory(category);
                } else {
                    deleteCategory(category);
                }
            });
        });
    }

    function openCategoryManager() {
        const dialog = $("#documentCategoryDialog");
        if (!dialog) return;

        setCategoryFeedback();
        renderCategoryList();

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }

        window.setTimeout(
            () => $("#documentNewCategoryName")?.focus(),
            0
        );
    }

    function addCategory() {
        const input = $("#documentNewCategoryName");
        const name = normalizeCategory(input?.value);

        if (!name) {
            setCategoryFeedback(
                "Informe um nome para a categoria.",
                "error"
            );
            return;
        }

        const exists = allCategories().some(
            (category) =>
                category.toLocaleLowerCase("pt-BR")
                === name.toLocaleLowerCase("pt-BR")
        );

        if (exists) {
            setCategoryFeedback(
                "Já existe uma categoria com esse nome.",
                "error"
            );
            return;
        }

        saveCategories([...allCategories(), name]);
        input.value = "";

        refreshCategoryControls();
        renderCategoryList();
        renderModelSelect();
        setCategoryFeedback("Categoria adicionada.", "success");
    }

    function renameCategory(oldName) {
        const nextName = normalizeCategory(
            window.prompt("Novo nome da categoria:", oldName)
        );

        if (!nextName || nextName === oldName) return;

        const duplicate = allCategories().some(
            (category) =>
                category !== oldName
                && category.toLocaleLowerCase("pt-BR")
                    === nextName.toLocaleLowerCase("pt-BR")
        );

        if (duplicate) {
            setCategoryFeedback(
                "Já existe uma categoria com esse nome.",
                "error"
            );
            return;
        }

        const templates = loadTemplates().map((template) => ({
            ...template,
            category:
                normalizeCategory(template.category) === oldName
                    ? nextName
                    : normalizeCategory(template.category)
        }));

        const categories = allCategories()
            .filter((category) => category !== oldName)
            .concat(nextName);

        saveTemplates(templates);
        saveCategories(categories);

        refreshCategoryControls();
        renderCategoryList();
        renderModelSelect();

        if (selectedId) {
            const selected = templates.find(
                (template) => template.id === selectedId
            );

            if (selected) {
                $("#documentEditorCategory").value =
                    normalizeCategory(selected.category);
            }
        }

        setCategoryFeedback("Categoria renomeada.", "success");
    }

    function deleteCategory(categoryName) {
        const affected = loadTemplates().filter(
            (template) =>
                normalizeCategory(template.category) === categoryName
        ).length;

        const message = affected
            ? `Excluir a categoria “${categoryName}”? ${affected} ${
                affected === 1
                    ? "modelo será movido"
                    : "modelos serão movidos"
            } para “Sem categoria”.`
            : `Excluir a categoria “${categoryName}”?`;

        if (!window.confirm(message)) return;

        const templates = loadTemplates().map((template) => ({
            ...template,
            category:
                normalizeCategory(template.category) === categoryName
                    ? NO_CATEGORY
                    : normalizeCategory(template.category)
        }));

        saveTemplates(templates);
        saveCategories(
            allCategories().filter(
                (category) => category !== categoryName
            )
        );

        refreshCategoryControls();
        renderCategoryList();
        renderModelSelect();

        if (selectedId) {
            const selected = templates.find(
                (template) => template.id === selectedId
            );

            if (selected) {
                $("#documentEditorCategory").value =
                    normalizeCategory(selected.category);
            }
        }

        setCategoryFeedback(
            "Categoria excluída. Os modelos foram preservados.",
            "success"
        );
    }

    function renderGroupList() {
        const host = $("#documentGroupList");
        if (!host) return;

        const groups = allGroups();

        host.innerHTML = groups.length
            ? groups.map((group) => {
                const count = allTemplates().filter(
                    (template) => normalizeGroup(template.group) === group
                ).length;

                return `
                    <div class="document-group-item" data-document-group="${escapeHtml(group)}">
                        <div class="document-group-item-name">
                            <strong>${escapeHtml(group)}</strong>
                            <span>${count} ${count === 1 ? "modelo" : "modelos"}</span>
                        </div>
                        <div class="document-group-item-actions">
                            <button
                                class="text-button"
                                type="button"
                                data-group-action="rename"
                                data-group-name="${escapeHtml(group)}"
                            >Renomear</button>
                            <button
                                class="danger-button"
                                type="button"
                                data-group-action="delete"
                                data-group-name="${escapeHtml(group)}"
                            >Excluir</button>
                        </div>
                    </div>
                `;
            }).join("")
            : `
                <div class="document-group-empty">
                    <strong>Nenhum grupo cadastrado.</strong>
                    <span>Crie o primeiro grupo usando o campo acima.</span>
                </div>
            `;

        host.querySelectorAll("[data-group-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const group = button.dataset.groupName;

                if (button.dataset.groupAction === "rename") {
                    renameGroup(group);
                } else {
                    deleteGroup(group);
                }
            });
        });
    }

    function openGroupManager() {
        const dialog = $("#documentGroupDialog");
        if (!dialog) return;

        setGroupFeedback();
        renderGroupList();

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }

        window.setTimeout(() => $("#documentNewGroupName")?.focus(), 0);
    }

    function addGroup() {
        const input = $("#documentNewGroupName");
        const name = normalizeGroup(input?.value);

        if (!name) {
            setGroupFeedback("Informe um nome para o grupo.", "error");
            return;
        }

        const exists = allGroups().some(
            (group) => group.toLocaleLowerCase("pt-BR")
                === name.toLocaleLowerCase("pt-BR")
        );

        if (exists) {
            setGroupFeedback("Já existe um grupo com esse nome.", "error");
            return;
        }

        saveGroups([...allGroups(), name]);
        input.value = "";

        refreshGroupControls();
        renderGroupList();
        renderModelSelect();
        setGroupFeedback("Grupo adicionado.", "success");
    }

    function renameGroup(oldName) {
        const nextName = normalizeGroup(
            window.prompt("Novo nome do grupo:", oldName)
        );

        if (!nextName || nextName === oldName) return;

        const duplicate = allGroups().some(
            (group) => group !== oldName
                && group.toLocaleLowerCase("pt-BR")
                    === nextName.toLocaleLowerCase("pt-BR")
        );

        if (duplicate) {
            setGroupFeedback("Já existe um grupo com esse nome.", "error");
            return;
        }

        const templates = loadTemplates().map((template) => ({
            ...template,
            group: normalizeGroup(template.group) === oldName
                ? nextName
                : normalizeGroup(template.group)
        }));

        const groups = allGroups()
            .filter((group) => group !== oldName)
            .concat(nextName);

        saveTemplates(templates);
        saveGroups(groups);

        refreshGroupControls();
        renderGroupList();
        renderModelSelect();

        if (selectedId) {
            const selected = templates.find((template) => template.id === selectedId);
            if (selected) $("#documentEditorGroup").value = selected.group;
        }

        setGroupFeedback("Grupo renomeado.", "success");
    }

    function deleteGroup(groupName) {
        const affected = loadTemplates().filter(
            (template) => normalizeGroup(template.group) === groupName
        ).length;

        const message = affected
            ? `Excluir o grupo “${groupName}”? ${affected} ${
                affected === 1 ? "modelo será movido" : "modelos serão movidos"
            } para “Sem grupo”.`
            : `Excluir o grupo “${groupName}”?`;

        if (!window.confirm(message)) return;

        const templates = loadTemplates().map((template) => ({
            ...template,
            group: normalizeGroup(template.group) === groupName
                ? NO_GROUP
                : normalizeGroup(template.group)
        }));

        saveTemplates(templates);
        saveGroups(allGroups().filter((group) => group !== groupName));

        refreshGroupControls();
        renderGroupList();
        renderModelSelect();

        if (selectedId) {
            const selected = templates.find((template) => template.id === selectedId);
            if (selected) $("#documentEditorGroup").value = selected.group;
        }

        setGroupFeedback("Grupo excluído. Os modelos foram preservados.", "success");
    }

    function refreshFromStorage() {
        const templates = allTemplates();
        const selected = templates.find((item) => item.id === selectedId);

        renderFiltersAndModels();

        if (selected) {
            $("#documentTitle").value = selected.title;

            refreshCategoryControls();
            $("#documentEditorCategory").value =
                normalizeCategory(selected.category);

            $("#documentEditorGroup").value = normalizeGroup(selected.group);
            $("#documentTemplate").value = selected.content;

            variableValues = {};
            setEditorVisible(true);
            updateEditorHeading();
            renderVariables();
            $("#documentModelSelect").value = selected.id;
            return;
        }

        selectedId = null;
        setEditorVisible(false);
    }

    window.refreshDocumentTemplates = refreshFromStorage;
    window.refreshDocumentCentral = refreshFromStorage;
    window.DocumentosModule = Object.freeze({
        refresh: refreshFromStorage
    });

    function init() {
        if (!$("#central-documentos")) return;

        $("#documentSearch").addEventListener("input", renderModelSelect);
        $("#documentCategory").addEventListener("change", renderModelSelect);
        $("#documentGroupFilter").addEventListener("change", renderModelSelect);

        const order = $("#documentOrder");
        if (order) {
            order.value = getSortOrder();
            order.addEventListener("change", () => {
                setSortOrder(order.value);
                renderModelSelect();
            });
        }

        $("#documentModelSelect").addEventListener("change", (event) => {
            if (event.target.value) selectTemplate(event.target.value);
        });

        $("#documentTemplate").addEventListener("input", () => {
            renderVariables();
            updateEditorHeading();
        });

        $("#documentTitle").addEventListener("input", updateEditorHeading);
        $("#documentNewModel").addEventListener("click", newModel);
        $("#documentClearFilters").addEventListener("click", clearFilters);
        $("#documentManageCategories").addEventListener(
            "click",
            openCategoryManager
        );
        $("#documentAddCategory").addEventListener("click", addCategory);
        $("#documentNewCategoryName").addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory();
                }
            }
        );

        $("#documentManageGroups").addEventListener("click", openGroupManager);
        $("#documentAddGroup").addEventListener("click", addGroup);
        $("#documentNewGroupName").addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                addGroup();
            }
        });

        $("#documentClear").addEventListener("click", clearVariables);
        $("#documentSave").addEventListener("click", saveModel);
        $("#documentDuplicate").addEventListener("click", duplicateModel);
        $("#documentDelete").addEventListener("click", deleteModel);
        $("#documentCopy").addEventListener("click", copyPreview);
        $("#documentExportTxt").addEventListener("click", exportTxt);
        $("#documentExportModels").addEventListener("click", exportModels);
        $("#documentImportModels").addEventListener("click", () => {
            $("#documentImportModelsInput").click();
        });
        $("#documentImportModelsInput").addEventListener(
            "change",
            importModels
        );

        renderFiltersAndModels();
        setEditorVisible(false);
    }

    document.readyState === "loading"
        ? document.addEventListener("DOMContentLoaded", init)
        : init();
})();
