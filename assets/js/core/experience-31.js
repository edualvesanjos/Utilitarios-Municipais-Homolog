/* Versão 3.1 — experiência do usuário */
(function(){
"use strict";
const UX_PREFIX=(window.APP_CONFIG?.storagePrefix||"utilitariosMunicipais:")+"ux31:";
const HELP={
 inicio:{title:"Dashboard",text:"Use a pesquisa, os favoritos, os recentes e os filtros para abrir ferramentas. Personalize o layout e as seções exibidas em Configurações > Aparência e Dashboard.",tips:["Ctrl + Espaço abre a paleta de comandos.","Enter abre o primeiro resultado da pesquisa."]},
 arquivo:{title:"Nome de arquivo",text:"Ative os blocos desejados, defina a ordem e copie exatamente o conteúdo mostrado na pré-visualização.",tips:["Salve modelos para reutilizar combinações.","O histórico fica armazenado neste navegador."]},
 inscricao:{title:"Inscrição imobiliária",text:"Digite ou cole a inscrição para normalização automática. O módulo identifica formatos urbanos e rurais.",tips:["Use o botão de copiar para levar o resultado ao sistema."]},
 lote:{title:"Número de lote",text:"Defina setor, quadra, sequência e separador para gerar um ou vários números de lote.",tips:["A última sequência é salva automaticamente."]},
 uvrm:{title:"Calculadora UVRM",text:"Adicione vários lançamentos em UVRM ou reais. Em UVRM, a quantidade funciona como multiplicador de dias, parcelas ou ocorrências.",tips:["Copie cada lançamento individualmente.","Finalize a operação para arquivá-la no histórico."]},
 percentual:{title:"Percentual",text:"Calcule percentual simples, acréscimo, desconto e variação entre valores.",tips:["Os cálculos anteriores aparecem no histórico lateral."]},
 configuracoes:{title:"Configurações",text:"Gerencie backup, persistência, estatísticas e preferências visuais da aplicação.",tips:["O backup completo preserva históricos, favoritos e configurações."]},
 sobre:{title:"Sobre",text:"Consulte versão, arquitetura, módulos e histórico de evolução do aplicativo.",tips:[]}
};
const get=(k,f)=>{try{const v=localStorage.getItem(UX_PREFIX+k);return v===null?f:JSON.parse(v)}catch{return f}};
const set=(k,v)=>localStorage.setItem(UX_PREFIX+k,JSON.stringify(v));
function normalizeDisplayName(value) {
    const name = String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
    return name || "Usuário";
}

function applyDisplayName(prefs) {
    const name = normalizeDisplayName(prefs?.displayName);
    const greeting = document.getElementById("dashboardGreeting");
    if (greeting) greeting.textContent = `Olá, ${name}!`;
}

function refreshDisplayNamePreference() {
    const prefs = get("prefs", {});
    const input = document.getElementById("uxDisplayName");
    if (input && document.activeElement !== input) {
        input.value = String(prefs.displayName || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40);
    }
    applyDisplayName(prefs);
}

window.refreshUxPreferences = function refreshUxPreferences() {
    const prefs = get("prefs", {});
    applyPrefs();
    refreshDisplayNamePreference();

    const theme = document.getElementById("uxTheme");
    const font = document.getElementById("uxFont");
    const accent = document.getElementById("uxAccent");
    const layout = document.getElementById("uxLayout");

    if (theme && document.activeElement !== theme) theme.value = prefs.theme || "light";
    if (font && document.activeElement !== font) font.value = prefs.font || "normal";
    if (accent && document.activeElement !== accent) accent.value = prefs.accent || "#0f4c81";
    if (layout && document.activeElement !== layout) layout.value = prefs.layout || "grid";

    document.querySelectorAll("[data-ux-widget]").forEach((input) => {
        if (document.activeElement !== input) {
            input.checked = prefs.widgets?.[input.dataset.uxWidget] !== false;
        }
    });
};

function applyPrefs(){const p=get("prefs",{theme:"light",compact:false,font:"normal",layout:"grid",displayName:"",widgets:{favorites:true,smart:true,indicators:true,summary:true,recent:true}});applyDisplayName(p);document.body.dataset.theme=p.theme;document.body.classList.toggle("ux-compact",!!p.compact);document.body.classList.toggle("ux-font-large",p.font==="large");document.documentElement.style.setProperty("--ux-accent",p.accent||"#0f4c81");document.documentElement.style.setProperty("--primary-color",p.accent||"#0f4c81");const all=document.getElementById("dashboardAllTools");if(all)all.dataset.layout=p.layout||"grid";const map={favorites:"dashboardFavoritesSection",smart:null,indicators:null,summary:null,recent:null};document.getElementById("dashboardFavoritesSection")?.classList.toggle("ux-hidden-widget",p.widgets?.favorites===false);document.querySelector(".dashboard-smart-grid")?.classList.toggle("ux-hidden-widget",p.widgets?.smart===false);document.querySelector(".dashboard-usage-indicators")?.classList.toggle("ux-hidden-widget",p.widgets?.indicators===false);document.querySelector(".dashboard-summary-grid")?.classList.toggle("ux-hidden-widget",p.widgets?.summary===false);document.querySelector(".dashboard-recent-card")?.classList.toggle("ux-hidden-widget",p.widgets?.recent===false)}
function createToolbar(){const target=document.querySelector("#inicio .dashboard-hero");if(!target||document.getElementById("uxDashboardToolbar"))return;const wrap=document.createElement("section");wrap.id="uxDashboardToolbar";wrap.className="card";wrap.innerHTML=`<div class="section-heading"><div><span class="eyebrow">Personalização</span><h3>Experiência do Dashboard</h3></div></div><div class="ux-toolbar"><label>Layout <select id="uxLayout"><option value="grid">Grade</option><option value="list">Lista</option><option value="compact">Compacto</option></select></label><button id="uxOpenCommands" type="button" class="secondary">Paleta de comandos</button></div><div class="ux-personalize"><label><input data-ux-widget="favorites" type="checkbox"> Favoritos</label><label><input data-ux-widget="smart" type="checkbox"> Recentes e mais usadas</label><label><input data-ux-widget="indicators" type="checkbox"> Indicadores</label><label><input data-ux-widget="summary" type="checkbox"> Resumo</label><label><input data-ux-widget="recent" type="checkbox"> Atividades recentes</label></div>`;target.after(wrap);const p=get("prefs",{layout:"grid",widgets:{favorites:true,smart:true,indicators:true,summary:true,recent:true}});document.getElementById("uxLayout").value=p.layout||"grid";document.querySelectorAll("[data-ux-widget]").forEach(i=>i.checked=p.widgets?.[i.dataset.uxWidget]!==false);document.getElementById("uxLayout").onchange=e=>{const x=get("prefs",{});x.layout=e.target.value;set("prefs",x);applyPrefs()};document.querySelectorAll("[data-ux-widget]").forEach(i=>i.onchange=()=>{const x=get("prefs",{});x.widgets={...(x.widgets||{}),[i.dataset.uxWidget]:i.checked};set("prefs",x);applyPrefs()});document.getElementById("uxOpenCommands").onclick=openPalette}
function addSettings(){
    const root=document.querySelector("#configuracoes .settings-list")||document.querySelector("#configuracoes .generator-main")||document.querySelector("#configuracoes .builder-panel");
    if(!root||document.getElementById("uxAppearanceSettings"))return;
    const sec=document.createElement("section");
    sec.id="uxAppearanceSettings";
    sec.className="settings-card ux-settings-panel";
    sec.innerHTML=`
        <div class="section-heading">
            <div>
                <span class="eyebrow">Personalização</span>
                <h3>Aparência e Dashboard</h3>
                <p class="help-text">Defina a apresentação da interface e as informações exibidas na página inicial.</p>
            </div>
        </div>
        <div class="ux-settings-groups">
            <fieldset class="ux-settings-group">
                <legend>Dashboard</legend>
                <label class="ux-setting-field">
                    <span>Layout das ferramentas</span>
                    <select id="uxLayout">
                        <option value="grid">Grade</option>
                        <option value="list">Lista</option>
                        <option value="compact">Compacto</option>
                    </select>
                </label>
                <div class="ux-setting-block">
                    <span class="ux-setting-title">Seções exibidas</span>
                    <div class="ux-widget-options">
                        <label class="checkbox-row"><input data-ux-widget="favorites" type="checkbox"><span>Favoritos</span></label>
                        <label class="checkbox-row"><input data-ux-widget="smart" type="checkbox"><span>Recentes e mais utilizadas</span></label>
                        <label class="checkbox-row"><input data-ux-widget="indicators" type="checkbox"><span>Indicadores</span></label>
                        <label class="checkbox-row"><input data-ux-widget="summary" type="checkbox"><span>Resumo</span></label>
                        <label class="checkbox-row"><input data-ux-widget="recent" type="checkbox"><span>Atividades recentes</span></label>
                    </div>
                </div>
            </fieldset>
            <fieldset class="ux-settings-group">
                <legend>Interface</legend>
                <label class="ux-setting-field ux-display-name-field">
                    <span>Como gostaria de ser chamado?</span>
                    <input id="uxDisplayName" type="text" maxlength="40" autocomplete="name" placeholder="Usuário">
                    <small class="help-text">Usado na saudação e na identificação da conta no cabeçalho.</small>
                </label>
                <div class="ux-interface-grid">
                    <label class="ux-setting-field"><span>Tema</span><select id="uxTheme"><option value="light">Claro</option><option value="dark">Escuro</option><option value="contrast">Alto contraste</option></select></label>
                    <label class="ux-setting-field"><span>Tamanho da fonte</span><select id="uxFont"><option value="normal">Normal</option><option value="large">Ampliada</option></select></label>
                    <div class="ux-setting-field ux-color-field">
                        <span>Cor principal</span>
                        <div class="ux-color-apply-row">
                            <input id="uxAccent" type="color" value="#0f4c81" aria-label="Selecionar cor principal">
                            <button id="uxInterfaceApply" class="secondary" type="button">Aplicar</button>
                        </div>
                        <small id="uxInterfaceFeedback" class="help-text" aria-live="polite"></small>
                    </div>
                </div>
            </fieldset>
        </div>`;
    root.prepend(sec);
    const p=get("prefs",{layout:"grid",widgets:{favorites:true,smart:true,indicators:true,summary:true,recent:true}});
    document.getElementById("uxLayout").value=p.layout||"grid";
    document.querySelectorAll("[data-ux-widget]").forEach(i=>i.checked=p.widgets?.[i.dataset.uxWidget]!==false);
    document.getElementById("uxDisplayName").value=p.displayName||"";
    document.getElementById("uxTheme").value=p.theme||"light";
    document.getElementById("uxFont").value=p.font||"normal";
    document.getElementById("uxAccent").value=p.accent||"#0f4c81";
    document.getElementById("uxLayout").addEventListener("change",e=>{const x=get("prefs",{});x.layout=e.target.value;set("prefs",x);applyPrefs()});
    document.querySelectorAll("[data-ux-widget]").forEach(i=>i.addEventListener("change",()=>{const x=get("prefs",{});x.widgets={...(x.widgets||{}),[i.dataset.uxWidget]:i.checked};set("prefs",x);applyPrefs()}));
    document.getElementById("uxInterfaceApply").addEventListener("click",()=>{
        const x=get("prefs",{});
        x.theme=document.getElementById("uxTheme").value;
        x.font=document.getElementById("uxFont").value;
        x.accent=document.getElementById("uxAccent").value;
        set("prefs",x);
        applyPrefs();
        const feedback=document.getElementById("uxInterfaceFeedback");
        if(feedback){feedback.textContent="Configurações de interface aplicadas com sucesso!";feedback.classList.add("success")}
        if(typeof showToast==="function")showToast("Configurações de interface aplicadas com sucesso!");
        else if(window.NotificationService?.success)window.NotificationService.success("Configurações de interface aplicadas com sucesso!");
    });
    const displayNameInput=document.getElementById("uxDisplayName");
    const saveDisplayName = () => {
        const x = get("prefs", {});
        x.displayName = String(displayNameInput.value || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40);
        displayNameInput.value = x.displayName;
        set("prefs", x);
        applyPrefs();
        window.dispatchEvent(new CustomEvent("um:display-name-changed", {
            detail: { displayName: normalizeDisplayName(x.displayName) }
        }));
    };
    displayNameInput.addEventListener("change",saveDisplayName);
    displayNameInput.addEventListener("blur",saveDisplayName);
    displayNameInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();saveDisplayName();displayNameInput.blur()}});
}

function closeToolsMenu(){
    const button=document.getElementById("uxToolsMenuButton");
    const dropdown=document.getElementById("uxToolsMenuDropdown");
    if(!button||!dropdown)return;
    dropdown.hidden=true;
    button.setAttribute("aria-expanded","false");
}
function updatePrimaryNavigation(activeId) {
    document.querySelectorAll(".ux-nav-primary.tab-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === activeId);
    });
}
function installToolsMenu() {
    const button = document.getElementById("uxToolsMenuButton");
    const dropdown = document.getElementById("uxToolsMenuDropdown");

    if (!button || !dropdown) return;
    button.addEventListener("click",event=>{
        event.stopPropagation();
        const willOpen=dropdown.hidden;
        dropdown.hidden=!willOpen;
        button.setAttribute("aria-expanded",String(willOpen));
        if(willOpen) dropdown.querySelector(".tab-button")?.focus();
    });
    dropdown.addEventListener("click",event=>{
        if(event.target.closest(".tab-button[data-tab]"))closeToolsMenu();
    });
    document.addEventListener("click",event=>{
        if(!event.target.closest(".ux-tools-menu"))closeToolsMenu();
    });
    dropdown.addEventListener("keydown",event=>{
        const items=[...dropdown.querySelectorAll(".tab-button")];
        const current=items.indexOf(document.activeElement);
        if(event.key==="ArrowDown"){
            event.preventDefault();
            items[(current+1+items.length)%items.length]?.focus();
        }
        if(event.key==="ArrowUp"){
            event.preventDefault();
            items[(current-1+items.length)%items.length]?.focus();
        }
        if(event.key==="Escape"){
            event.preventDefault();closeToolsMenu();button.focus();
        }
    });
    updatePrimaryNavigation(document.querySelector(".tab-panel.active")?.id||"inicio");
}
function installNavigation() {
    if (typeof window.activateTab !== "function") return;

    const original = window.activateTab;

    localStorage.removeItem(UX_PREFIX + "openedTabs");
    document.getElementById("uxTabsBar")?.remove();

    window.activateTab = function(id, opt = {}) {
        original(id, opt);
        updatePrimaryNavigation(id);
        closeToolsMenu();
    };

    updatePrimaryNavigation(
        document.querySelector(".tab-panel.active")?.id || "inicio"
    );
}
const commands=[{name:"Ir para o Dashboard",detail:"Navegação",run:()=>activateTab("inicio")},{name:"Abrir Configurações",detail:"Navegação",run:()=>activateTab("configuracoes")},{name:"Abrir Sobre",detail:"Navegação",run:()=>activateTab("sobre")},{name:"Alternar modo compacto",detail:"Aparência",run:()=>{const p=get("prefs",{});p.compact=!p.compact;set("prefs",p);applyPrefs()}},{name:"Alternar tema claro/escuro",detail:"Aparência",run:()=>{const p=get("prefs",{});p.theme=p.theme==="dark"?"light":"dark";set("prefs",p);applyPrefs()}}];
function paletteItems(q){const tools=(window.getRegisteredTools?.()||[]).map(t=>({name:`Abrir ${t.name}`,detail:t.category,search:[t.name,t.description,...t.keywords].join(" "),run:()=>activateTab(t.id)}));return [...tools,...commands].filter(x=>(x.search||x.name).toLowerCase().includes(q.toLowerCase())).slice(0,12)}
function createPalette(){if(document.getElementById("uxCommandOverlay"))return;const el=document.createElement("div");el.id="uxCommandOverlay";el.className="ux-command-overlay";el.hidden=true;el.innerHTML=`<div class="ux-command" role="dialog" aria-modal="true" aria-label="Paleta de comandos"><input id="uxCommandInput" autocomplete="off" placeholder="Digite uma ferramenta ou comando…"><div id="uxCommandResults" class="ux-command-results"></div></div>`;document.body.append(el);el.addEventListener("click",e=>{if(e.target===el)closePalette()});document.getElementById("uxCommandInput").addEventListener("input",renderPalette);document.getElementById("uxCommandInput").addEventListener("keydown",e=>{if(e.key==="Enter"){document.querySelector(".ux-command-item")?.click()}if(e.key==="Escape")closePalette()})}
function renderPalette(){const q=document.getElementById("uxCommandInput").value||"";document.getElementById("uxCommandResults").innerHTML=paletteItems(q).map((x,i)=>`<button type="button" class="ux-command-item ${i===0?'selected':''}" data-ux-command="${i}"><span>${x.name}</span><small>${x.detail||""}</small></button>`).join("")||`<div class="empty-state">Nenhum comando encontrado.</div>`;document.querySelectorAll("[data-ux-command]").forEach(b=>b.onclick=()=>{paletteItems(q)[+b.dataset.uxCommand]?.run();closePalette()})}
function openPalette(){createPalette();const el=document.getElementById("uxCommandOverlay");el.hidden=false;const input=document.getElementById("uxCommandInput");input.value="";renderPalette();setTimeout(()=>input.focus(),0)}function closePalette(){const el=document.getElementById("uxCommandOverlay");if(el)el.hidden=true}
function createHelp(){if(document.getElementById("uxHelpDialog"))return;const d=document.createElement("div");d.id="uxHelpDialog";d.className="ux-help-dialog";d.hidden=true;d.innerHTML=`<article class="ux-help-card"><header><div><span class="eyebrow">Ajuda integrada</span><h2 id="uxHelpTitle"></h2></div><button id="uxHelpClose" type="button" class="secondary">Fechar</button></header><p id="uxHelpText"></p><ul id="uxHelpTips"></ul></article>`;document.body.append(d);document.getElementById("uxHelpClose").onclick=()=>d.hidden=true;d.onclick=e=>{if(e.target===d)d.hidden=true};document.querySelectorAll(".tab-panel").forEach(panel=>{const heading=panel.querySelector(".main-heading")||panel.querySelector(".dashboard-hero");if(!heading||heading.querySelector(".ux-help-button"))return;const b=document.createElement("button");b.type="button";b.className="secondary ux-help-button";b.textContent="?";b.title="Ajuda deste módulo";b.onclick=()=>openHelp(panel.id);heading.append(b)})}
function openHelp(id){const h=HELP[id]||{title:"Ajuda",text:"Consulte os campos e ações disponíveis neste módulo.",tips:[]};document.getElementById("uxHelpTitle").textContent=h.title;document.getElementById("uxHelpText").textContent=h.text;document.getElementById("uxHelpTips").innerHTML=h.tips.map(x=>`<li>${x}</li>`).join("");document.getElementById("uxHelpDialog").hidden=false}
function shortcuts(e){if((e.ctrlKey&&e.code==="Space")||(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="p")){e.preventDefault();openPalette()}if(e.key==="F1"){e.preventDefault();openHelp(document.querySelector(".tab-panel.active")?.id)}if(e.key==="Escape"){closePalette();const h=document.getElementById("uxHelpDialog");if(h)h.hidden=true}}
function init(){applyPrefs();document.getElementById("uxDashboardToolbar")?.remove();addSettings();installToolsMenu();installNavigation();createPalette();createHelp();document.addEventListener("keydown",shortcuts)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
