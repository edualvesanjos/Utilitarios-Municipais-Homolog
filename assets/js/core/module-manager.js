/* Versão 3: gerenciador de módulos e ciclo de vida. */
const ModuleManager = (()=>{
    const modules=new Map();
    return Object.freeze({
        register(id,definition={}){ modules.set(id,{id,...definition}); return modules.get(id); },
        get(id){ return modules.get(id) || null; },
        list(){ return [...modules.values()]; },
        initializeAll(){ modules.forEach(module=>{ if(typeof module.init==="function" && !module.initialized){ module.init(); module.initialized=true; } }); },
        activate(id){ const module=modules.get(id); if(module && typeof module.onActivate==="function") module.onActivate(); }
    });
})();
