/* Módulo: dashboard e tela inicial. */


function updateDashboardLastToolHighlight() {
    const lastTool = localStorage.getItem(LAST_TOOL_TAB_KEY);

    document.querySelectorAll(".dashboard-tool-card").forEach((card) => {
        card.classList.toggle(
            "is-last-used",
            Boolean(lastTool) && card.dataset.openTab === lastTool
        );
    });
}

function getDashboardArray(key) {
    const value = getJson(key, []);
    return Array.isArray(value) ? value : [];
}

function formatDashboardBackupDate(value) {
    return formatDateTime(value, "Não realizado");
}

function formatDashboardUvrmValue(value) {
    const text = String(value || "5,2151").trim();
    return `R$ ${text || "5,2151"}`;
}

function dashboardRecentText(item) {
    if (typeof item === "string") {
        return item;
    }

    if (!item || typeof item !== "object") {
        return "";
    }

    const preferredKeys = [
        "value",
        "name",
        "result",
        "formatted",
        "masked",
        "calculation",
        "text",
        "label"
    ];

    for (const key of preferredKeys) {
        if (item[key] !== undefined && item[key] !== null) {
            return String(item[key]);
        }
    }

    return Object.values(item)
        .filter((value) => ["string", "number"].includes(typeof value))
        .slice(0, 2)
        .join(" • ");
}

function collectDashboardRecentItems() {
    const sources = [
        {
            key: FILE_HISTORY_KEY,
            module: "Nome de arquivo",
            tab: "arquivo"
        },
        {
            key: REGISTRATION_HISTORY_KEY,
            module: "Inscrição imobiliária",
            tab: "inscricao"
        },
        {
            key: LOT_HISTORY_KEY,
            module: "Número de lote",
            tab: "lote"
        },
        {
            key: UVRM_HISTORY_KEY,
            module: "Calculadora UVRM",
            tab: "uvrm"
        },
        {
            key: PERCENTAGE_HISTORY_KEY,
            module: "Percentual",
            tab: "percentual"
        }
    ];

    return sources
        .flatMap((source) =>
            getDashboardArray(source.key)
                .slice(0, 2)
                .map((item, index) => ({
                    ...source,
                    index,
                    text: dashboardRecentText(item),
                    timestamp:
                        item && typeof item === "object"
                            ? item.timestamp || item.date || item.createdAt || ""
                            : ""
                }))
        )
        .filter((item) => item.text)
        .sort((left, right) => {
            const leftTime = Date.parse(left.timestamp) || 0;
            const rightTime = Date.parse(right.timestamp) || 0;
            return rightTime - leftTime || left.index - right.index;
        })
        .slice(0, 6);
}

function renderDashboardRecentItems() {
    const list = $("#dashboardRecentList");

    if (!list) {
        return;
    }

    const items = collectDashboardRecentItems();

    if (!items.length) {
        list.innerHTML =
            '<li class="empty-state">Nenhuma atividade registrada.</li>';
        return;
    }

    list.innerHTML = "";

    items.forEach((item) => {
        const row = document.createElement("li");
        const content = document.createElement("div");
        const module = document.createElement("strong");
        const text = document.createElement("span");
        const button = document.createElement("button");

        module.textContent = item.module;
        text.textContent = item.text;
        button.type = "button";
        button.className = "text-button";
        button.textContent = "Abrir";
        button.addEventListener("click", () => activateTab(item.tab));

        content.append(module, text);
        row.append(content, button);
        list.appendChild(row);
    });
}

function updateDashboardSummary() {
    updateDashboardLastToolHighlight();
    const metrics = {
        dashboardFileModels: getDashboardArray(FILE_MODELS_KEY).length,
        dashboardFileHistory: getDashboardArray(FILE_HISTORY_KEY).length,
        dashboardRegistrationHistory:
            getDashboardArray(REGISTRATION_HISTORY_KEY).length,
        dashboardLotHistory: getDashboardArray(LOT_HISTORY_KEY).length,
        dashboardUvrmHistory: getDashboardArray(UVRM_HISTORY_KEY).length,
        dashboardPercentageHistory:
            getDashboardArray(PERCENTAGE_HISTORY_KEY).length
    };

    Object.entries(metrics).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = String(value);
        }
    });

    const nextLot = $("#dashboardNextLotSequence");
    if (nextLot) {
        nextLot.textContent = String(getLastLotSequence() + 1);
    }

    const uvrmValue = $("#dashboardUvrmValue");
    if (uvrmValue) {
        uvrmValue.textContent = formatDashboardUvrmValue(
            localStorage.getItem(UVRM_VALUE_KEY)
        );
    }

    const lastBackup = $("#dashboardLastBackup");
    if (lastBackup) {
        lastBackup.textContent = formatDashboardBackupDate(
            localStorage.getItem(LAST_BACKUP_KEY)
        );
    }

    renderDashboardRecentItems();
}

const dashboardRefresh = $("#dashboardRefresh");

if (dashboardRefresh) {
    dashboardRefresh.addEventListener("click", () => {
        updateDashboardSummary();
        showToast("Resumo do dashboard atualizado.");
    });
}


function dashboardToolCardMarkup(tool, compact=false){
    return `<div class="dashboard-tool-wrapper${compact?" is-compact":""}" data-tool-id="${tool.id}"><button class="dashboard-tool-card" type="button" data-open-tab="${tool.id}">${toolIconMarkup(tool.icon,"dashboard-tool-icon")}<span class="dashboard-tool-content"><strong>${tool.name}</strong><small>${tool.description}</small></span><span class="dashboard-tool-action">Abrir</span></button><button class="favorite-toggle${isFavorite(tool.id)?" active":""}" type="button" data-favorite-tool="${tool.id}" aria-label="${isFavorite(tool.id)?"Remover":"Adicionar"} ${tool.name} ${isFavorite(tool.id)?"dos":"aos"} favoritos" title="Favorito">★</button></div>`;
}
function enhanceDashboardToolCards(){document.querySelectorAll("#dashboardAllTools > .dashboard-tool-card").forEach(card=>{const id=card.dataset.openTab,tool=TOOL_CATALOG.find(t=>t.id===id);if(!tool)return;const wrapper=document.createElement("div");wrapper.className="dashboard-tool-wrapper";wrapper.dataset.toolId=id;card.parentNode.insertBefore(wrapper,card);wrapper.appendChild(card);const favorite=document.createElement("button");favorite.type="button";favorite.className=`favorite-toggle${isFavorite(id)?" active":""}`;favorite.dataset.favoriteTool=id;favorite.textContent="★";favorite.title="Favorito";wrapper.appendChild(favorite);});}
function renderDashboardFavorites(){const section=$("#dashboardFavoritesSection"),container=$("#dashboardFavoriteTools");if(!section||!container)return;const favorites=getFavorites().map(id=>TOOL_CATALOG.find(t=>t.id===id)).filter(Boolean);section.hidden=!favorites.length;container.innerHTML=favorites.map(t=>dashboardToolCardMarkup(t,true)).join("");document.querySelectorAll("[data-favorite-tool]").forEach(button=>button.classList.toggle("active",isFavorite(button.dataset.favoriteTool)));}
function normalizeSearchText(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function searchDashboardTools(query){const terms=normalizeSearchText(query).split(/\s+/).filter(Boolean);if(!terms.length)return [];return TOOL_CATALOG.filter(tool=>{const haystack=normalizeSearchText([tool.name,tool.description,...tool.keywords].join(" "));return terms.every(term=>haystack.includes(term));});}
function renderDashboardSearch(){const input=$("#dashboardToolSearch"),results=$("#dashboardSearchResults");if(!input||!results)return;const found=searchDashboardTools(input.value);if(!input.value.trim()){results.innerHTML="";results.hidden=true;return;}results.hidden=false;results.innerHTML=found.length?found.map((tool,index)=>`<button type="button" class="dashboard-search-result${index===0?" is-first":""}" data-open-tab="${tool.id}"><span><strong>${tool.name}</strong><small>${tool.description}</small></span><em>Abrir</em></button>`).join(""):'<p class="empty-state">Nenhuma ferramenta encontrada.</p>';}
function updateDashboardUsageIndicators(){const summary=getUsageSummary();const values={dashboardTotalAccesses:summary.totalAccesses,dashboardTotalActions:summary.totalActions,dashboardFavoriteCount:summary.favoriteCount,dashboardMostUsedTool:summary.mostUsed};Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=String(value);});}
document.addEventListener("click",event=>{const favorite=event.target.closest("[data-favorite-tool]");if(favorite){event.preventDefault();event.stopPropagation();toggleFavorite(favorite.dataset.favoriteTool);return;}const open=event.target.closest("[data-open-tab]");if(open)activateTab(open.dataset.openTab);});
const dashboardSearch=$("#dashboardToolSearch");if(dashboardSearch){dashboardSearch.addEventListener("input",renderDashboardSearch);dashboardSearch.addEventListener("keydown",event=>{if(event.key==="Enter"){const first=$("#dashboardSearchResults [data-open-tab]");if(first){event.preventDefault();activateTab(first.dataset.openTab);dashboardSearch.value="";renderDashboardSearch();}}});}
enhanceDashboardToolCards();renderDashboardFavorites();updateDashboardUsageIndicators();

function renderDashboardSmartTools(){
    const recentContainer=$("#dashboardRecentTools"), mostContainer=$("#dashboardMostUsedTools");
    if(recentContainer){const ids=getJson(RECENT_TOOLS_KEY,[]);const tools=(Array.isArray(ids)?ids:[]).map(id=>TOOL_CATALOG.find(t=>t.id===id)).filter(Boolean);recentContainer.innerHTML=tools.length?tools.map(t=>`<button type="button" data-open-tab="${t.id}">${toolIconMarkup(t.icon,"smart-tool-icon")}<strong>${t.name}</strong></button>`).join(""):'<p class="empty-state">Nenhuma ferramenta utilizada.</p>';}
    if(mostContainer){const tools=getUsageSummary().rows.filter(r=>r.accesses+r.actions>0).sort((a,b)=>(b.accesses+b.actions)-(a.accesses+a.actions)).slice(0,4);mostContainer.innerHTML=tools.length?tools.map(t=>`<button type="button" data-open-tab="${t.id}">${toolIconMarkup(t.icon,"smart-tool-icon")}<strong>${t.name}</strong><small>${t.accesses+t.actions} interações</small></button>`).join(""):'<p class="empty-state">As ferramentas mais utilizadas aparecerão aqui.</p>';}
}
const originalCollectDashboardRecentItems=collectDashboardRecentItems;
collectDashboardRecentItems=function(){const log=getJson(ACTIVITY_LOG_KEY,[]);if(Array.isArray(log)&&log.length)return log.slice(0,12).map(item=>({module:item.tool,tab:item.toolId,text:`${item.label} • ${formatDateTime(item.timestamp)}`,timestamp:item.timestamp}));return originalCollectDashboardRecentItems();};
renderDashboardSmartTools();
