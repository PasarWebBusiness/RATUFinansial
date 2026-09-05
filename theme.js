(()=>{
  const key="ratu-theme",root=document.documentElement,meta=document.querySelector('meta[name="theme-color"]');
  const stored=()=>{try{return localStorage.getItem(key)}catch(_){return null}};
  const persist=value=>{try{localStorage.setItem(key,value)}catch(_){}};
  function apply(value){
    const theme=value||stored()||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
    root.dataset.theme=theme;
    meta?.setAttribute("content",theme==="dark"?"#081522":"#0b4f93");
    document.querySelectorAll("[data-theme-toggle]").forEach(button=>{
      button.textContent=theme==="dark"?"☀️":"🌙";
      button.setAttribute("aria-label",theme==="dark"?"Gunakan mode terang":"Gunakan mode gelap");
    });
  }
  window.RATUTheme={apply,toggle(){const next=root.dataset.theme==="dark"?"light":"dark";persist(next);apply(next)}};
  apply();
  addEventListener("DOMContentLoaded",()=>{
    apply();
    document.querySelectorAll("[data-theme-toggle]").forEach(button=>button.addEventListener("click",RATUTheme.toggle));
  });
})();
