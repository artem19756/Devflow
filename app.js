/* DEVFLOW v1.0 — browser-only developer toolkit. */
"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STORAGE_KEY = "devflow-v1";
  const DEFAULT_FILES = {
    html: `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Мой первый проект</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="card">
    <span class="eyebrow">МОЙ ПЕРВЫЙ ПРОЕКТ</span>
    <h1>Привет, мир<span>!</span></h1>
    <p>Измени этот код и нажми «Запустить».</p>
    <button id="hello">Нажми меня</button>
    <p id="message" aria-live="polite"></p>
  </main>
  <script src="script.js"></script>
</body>
</html>`,
    css: `* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #101014;
  color: #f4f4f7;
  font-family: system-ui, sans-serif;
}
.card {
  width: min(90%, 520px);
  padding: 36px;
  border: 1px solid #34343d;
  border-radius: 24px;
  background: linear-gradient(145deg, #202027, #121216);
  box-shadow: 0 24px 70px #0008;
}
.eyebrow { color: #a1a1b0; font-size: 11px; letter-spacing: .15em; }
h1 { font-size: clamp(32px, 8vw, 54px); letter-spacing: -.06em; }
h1 span { color: #a3a3ff; }
p { color: #a7a7b3; line-height: 1.7; }
button { border: 0; border-radius: 10px; padding: 12px 18px; background: #e5e5ed; color: #17171b; font-weight: 700; cursor: pointer; }
button:hover { background: #fff; }`,
    js: `const button = document.querySelector("#hello");
const message = document.querySelector("#message");

button?.addEventListener("click", () => {
  message.textContent = "Отлично! JavaScript работает.";
});`
  };
  const TOOL_DATA = [
    {id:"json", icon:"{}", name:"JSON Formatter", desc:"Форматирование, проверка и минификация JSON.", tag:"CODE", category:"code", mode:"format-json"},
    {id:"html", icon:"</>", name:"HTML Formatter", desc:"Приведи HTML-разметку к читаемому виду.", tag:"CODE", category:"code", mode:"format-html"},
    {id:"minify", icon:"⇣", name:"Text Minifier", desc:"Убери лишние пробелы и пустые строки.", tag:"TEXT", category:"text", mode:"minify-text"},
    {id:"base64", icon:"64", name:"Base64 Converter", desc:"Кодируй и декодируй текст локально.", tag:"TEXT", category:"text", mode:"base64-encode"},
    {id:"url", icon:"↗", name:"URL Encoder", desc:"Кодируй параметры ссылок и декодируй их.", tag:"TEXT", category:"text", mode:"url-encode"},
    {id:"counter", icon:"≡", name:"Text Counter", desc:"Символы, слова, строки и размер текста.", tag:"TEXT", category:"text", mode:"count-text"},
    {id:"diff", icon:"⇄", name:"Diff Checker", desc:"Сравни две версии текста или кода.", tag:"CODE", category:"code", mode:"diff-text"},
    {id:"palette", icon:"◈", name:"Color Palette", desc:"HEX, RGB и HSL для любого цвета.", tag:"DESIGN", category:"code", page:"visual-lab"},
    {id:"gradient", icon:"◒", name:"CSS Gradient", desc:"Создай градиент и скопируй CSS.", tag:"DESIGN", category:"code", page:"visual-lab"},
    {id:"shadow", icon:"▱", name:"Shadow Generator", desc:"Настрой тень для любого элемента.", tag:"DESIGN", category:"code", page:"visual-lab"},
    {id:"qr", icon:"▦", name:"QR Generator", desc:"Создай QR-код из текста или ссылки.", tag:"UTILITY", category:"text", page:"visual-lab"},
    {id:"playground", icon:"⌘", name:"Live Playground", desc:"Пиши HTML, CSS и JS с предпросмотром.", tag:"EDITOR", category:"code", page:"playground"}
  ];
  let state = {projects:[], lastAction:null, lightMode:false, currentProjectId:null};
  let editorFiles = {...DEFAULT_FILES};
  let currentFile = "html";
  let editorDirty = false;
  let currentUtility = "json";
  let currentFilter = "all";
  let currentQrCanvas = null;
  let modalEditingId = null;
  let lastEditorSaved = null;

  function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : "p-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)); }
  function safeText(s){ return String(s ?? ""); }
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ const parsed = JSON.parse(raw); state = {...state,...parsed}; if(!Array.isArray(state.projects)) state.projects=[]; }
    } catch(e){ toast("Не удалось прочитать локальные данные. Можно восстановить резервную копию.", "error"); }
    if(state.lightMode) document.body.classList.add("light-mode");
    refreshAll();
  }
  function persist(){
    state.lastAction = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ toast("Хранилище заполнено. Экспортируй резервную копию и удали ненужные проекты.", "error"); return false; }
    refreshCounts();
    return true;
  }
  function toast(message, type=""){
    const node=document.createElement("div"); node.className="toast "+type; node.textContent=message; $("#toastRegion").append(node);
    setTimeout(()=>node.remove(),3600);
  }
  function fmtDate(value){
    if(!value) return "—";
    const d=new Date(value); if(Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ru-RU",{day:"2-digit",month:"short",year:"numeric"});
  }
  function formatSize(bytes){
    if(!Number.isFinite(bytes)) return "—";
    if(bytes<1024) return bytes+" Б";
    if(bytes<1024*1024) return (bytes/1024).toFixed(1)+" КБ";
    return (bytes/1024/1024).toFixed(2)+" МБ";
  }
  function escapeHTML(s){return safeText(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function iconCard(tool){
    return `<article class="tool-card" tabindex="0" role="button" data-tool="${tool.id}"><div class="tool-card-top"><span class="tool-icon">${escapeHTML(tool.icon)}</span><span class="tool-arrow">↗</span></div><h3>${escapeHTML(tool.name)}</h3><p>${escapeHTML(tool.desc)}</p><span class="tool-tag">${escapeHTML(tool.tag)}</span></article>`;
  }
  function renderToolCards(){
    $("#dashboardTools").innerHTML = TOOL_DATA.filter(t=>["json","html","base64","palette"].includes(t.id)).map(iconCard).join("");
    renderAllTools();
  }
  function renderAllTools(){
    const q=($("#toolSearch")?.value||"").trim().toLowerCase();
    const tools=TOOL_DATA.filter(t=>(currentFilter==="all"||t.category===currentFilter)&&(`${t.name} ${t.desc} ${t.tag}`.toLowerCase().includes(q)));
    $("#allTools").innerHTML=tools.map(iconCard).join("") || `<div class="empty-state show"><h3>Ничего не найдено</h3><p>Попробуй другое название.</p></div>`;
  }
  function refreshCounts(){
    $("#projectCount").textContent=state.projects.length;
    $("#statProjects").textContent=state.projects.length;
    $("#backupProjectCount").textContent=state.projects.length;
    $("#storageProjectNum").textContent=state.projects.length;
    $("#statLast").textContent=state.lastAction ? new Date(state.lastAction).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : "—";
    const dataSize=new Blob([JSON.stringify(state)]).size;
    $("#storageSize").textContent=formatSize(dataSize);
    $("#storageLastSave").textContent=fmtDate(state.lastAction);
    renderExportSelect();
  }
  function refreshAll(){renderToolCards();renderProjects();refreshCounts();updateStorageStatus();}
  function updateStorageStatus(){const count=state.projects.length;$("#projectCount").textContent=count;}
  const PAGE_NAMES={dashboard:"Главная",playground:"Live Playground",projects:"Мои проекты","code-tools":"Code Tools","visual-lab":"Visual Lab",export:"Export Center"};
  function navigate(page){
    if(!PAGE_NAMES[page]) return;
    $$(".page").forEach(el=>el.classList.toggle("active",el.id===`page-${page}`));
    $$(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
    $("#pageCrumb").textContent=PAGE_NAMES[page];
    $("#sidebar").classList.remove("open");
    window.scrollTo({top:0,behavior:"smooth"});
    if(page==="projects") renderProjects();
    if(page==="export") refreshCounts();
  }
  function gotoTool(id){
    const tool=TOOL_DATA.find(t=>t.id===id);
    if(!tool) return;
    if(tool.page){navigate(tool.page);return;}
    navigate("code-tools");
    $("#utilityMode").value=tool.mode;
    selectUtility(tool.id);
    $("#utilityPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function selectUtility(id){
    const tool=TOOL_DATA.find(t=>t.id===id);
    if(!tool) return;
    currentUtility=id;
    $("#utilityTitle").textContent=tool.name;
    $("#utilityDescription").textContent=tool.desc;
    $("#utilityMode").value=tool.mode;
    if(id==="diff") $("#utilityInput").placeholder="Вставь два текста, разделив их строкой: ---";
    else $("#utilityInput").placeholder="Вставь сюда код или текст…";
    $("#utilityStatus").textContent="Обработка выполняется локально";
  }
  function runUtility(){
    const mode=$("#utilityMode").value, input=$("#utilityInput").value;
    let output="", status="Готово";
    try{
      switch(mode){
        case "format-json": output=JSON.stringify(JSON.parse(input),null,2);status="JSON корректен";break;
        case "minify-json": output=JSON.stringify(JSON.parse(input));status="JSON корректен · минифицирован";break;
        case "format-html": output=formatHTML(input);status="Базовое форматирование завершено";break;
        case "minify-text": output=input.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join("\n").replace(/[ \t]{2,}/g," ");status="Лишние пробелы удалены";break;
        case "base64-encode": output=btoa(unescape(encodeURIComponent(input)));status="Текст закодирован";break;
        case "base64-decode": output=decodeURIComponent(escape(atob(input.trim())));status="Текст декодирован";break;
        case "url-encode": output=encodeURIComponent(input);status="Текст закодирован для URL";break;
        case "url-decode": output=decodeURIComponent(input);status="URL декодирован";break;
        case "count-text": {
          const words=input.trim()?input.trim().split(/\s+/u).length:0;
          output=`Символов (с пробелами): ${input.length}\nСимволов (без пробелов): ${input.replace(/\s/g,"").length}\nСлов: ${words}\nСтрок: ${input.length?input.split(/\r\n|\r|\n/).length:0}\nБайт UTF-8: ${new Blob([input]).size}`;
          status="Статистика рассчитана";break;
        }
        case "diff-text": {
          const parts=input.split(/^\s*---\s*$/m);
          if(parts.length<2) throw new Error("Для сравнения раздели два текста отдельной строкой с тремя дефисами: ---");
          const a=parts[0].split(/\r?\n/),b=parts.slice(1).join("\n").split(/\r?\n/),max=Math.max(a.length,b.length),lines=[];
          for(let i=0;i<max;i++){if(a[i]===b[i]) lines.push("  "+(a[i]??""));else{if(a[i]!==undefined)lines.push("- "+a[i]);if(b[i]!==undefined)lines.push("+ "+b[i]);}}
          output=lines.join("\n");status="Сравнение по строкам завершено";break;
        }
        default: throw new Error("Выбери режим обработки.");
      }
    }catch(e){output="";status="Ошибка: "+e.message;$("#utilityOutput").value=output;$("#utilityStatus").textContent=status;toast(status,"error");return;}
    $("#utilityOutput").value=output;$("#utilityStatus").textContent=status;toast(status);
  }
  function formatHTML(input){
    const tokens=input.replace(/>\s*</g,">\n<").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    let depth=0;const voidTags=/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i;
    return tokens.map(line=>{
      if(/^<\/(body|div|main|section|article|header|footer|nav|ul|ol|li|p|h[1-6]|form|button|script|style|head|html|table|tr|td|th)\b/i.test(line))depth=Math.max(0,depth-1);
      const out="  ".repeat(depth)+line;
      if(/^<(body|div|main|section|article|header|footer|nav|ul|ol|li|p|h[1-6]|form|button|script|style|head|html|table|tr|td|th)\b/i.test(line)&&!/^<\//.test(line)&&!voidTags.test(line)&&!/\/>$/.test(line))depth++;
      return out;
    }).join("\n");
  }
  function setEditorFile(file){
    currentFile=file;
    $$(".editor-tab").forEach(t=>t.classList.toggle("active",t.dataset.file===file));
    $("#currentFileName").textContent={html:"index.html",css:"style.css",js:"script.js"}[file];
    $("#editorLanguage").textContent={html:"HTML",css:"CSS",js:"JAVASCRIPT"}[file];
    $("#codeEditor").value=editorFiles[file];
    $("#unsavedDot").hidden=!editorDirty;
    updateLineNumbers();
  }
  function updateLineNumbers(){
    const text=$("#codeEditor").value;
    const count=Math.max(1,text.split("\n").length);
    $("#lineNumbers").textContent=Array.from({length:count},(_,i)=>i+1).join("\n");
    $("#lineCount").textContent=`${count} ${count===1?"строка":count<5?"строки":"строк"}`;
  }
  function runPreview(){
    editorFiles[currentFile]=$("#codeEditor").value;
    const html=editorFiles.html;
    const css=editorFiles.css.replace(/<\/style/gi,"<\\/style");
    const js=editorFiles.js.replace(/<\/script/gi,"<\\/script");
    const withoutLinkedFiles=html.replace(/<link\b[^>]*href=["']style\.css["'][^>]*>/gi,"").replace(/<script\b[^>]*src=["']script\.js["'][^>]*><\/script>/gi,"");
    const documentContent=withoutLinkedFiles.includes("</head>")
      ? withoutLinkedFiles.replace("</head>",`<style>${css}</style></head>`).replace("</body>",`<script>${js}<\/script></body>`)
      : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${withoutLinkedFiles}<script>${js}<\/script></body></html>`;
    $("#previewFrame").srcdoc=documentContent;
    $("#previewState").textContent="Обновлено "+new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
    editorDirty=false;$("#unsavedDot").hidden=true;
  }
  function saveCurrentEditorAsProject(){
    editorFiles[currentFile]=$("#codeEditor").value;
    const existing=state.projects.find(p=>p.id===state.currentProjectId);
    const name=existing?.name || "Мой проект";
    const project={...(existing||{}),id:existing?.id||uid(),name,description:existing?.description||"Проект из Live Playground",html:editorFiles.html,css:editorFiles.css,js:editorFiles.js,updatedAt:new Date().toISOString(),createdAt:existing?.createdAt||new Date().toISOString()};
    const idx=state.projects.findIndex(p=>p.id===project.id);if(idx>=0)state.projects[idx]=project;else state.projects.unshift(project);
    state.currentProjectId=project.id;
    if(persist()){editorDirty=false;$("#unsavedDot").hidden=true;renderProjects();toast("Проект сохранён в Project Vault.");}
  }
  function openNewProjectDialog(project=null){
    modalEditingId=project?.id||null;
    $("#projectDialogTitle").textContent=project?"Редактировать проект":"Новый проект";
    $("#projectName").value=project?.name||"";
    $("#projectDescription").value=project?.description||"";
    $("#projectHtml").value=project?.html||`<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Новый проект</title><link rel="stylesheet" href="style.css"></head>
<body>
  <h1>Привет, мир!</h1>
  <script src="script.js"></script>
</body>
</html>`;
    $("#projectCss").value=project?.css||"body { font-family: system-ui, sans-serif; padding: 2rem; }";
    $("#projectJs").value=project?.js||"console.log('Проект запущен');";
    $("#projectDialog").showModal();
  }
  function saveDialogProject(event){
    if(event)event.preventDefault();
    const name=$("#projectName").value.trim();if(!name){toast("Введи название проекта.","error");return;}
    const old=state.projects.find(p=>p.id===modalEditingId);
    const project={...(old||{}),id:old?.id||uid(),name,description:$("#projectDescription").value.trim(),html:$("#projectHtml").value,css:$("#projectCss").value,js:$("#projectJs").value,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(old)state.projects=state.projects.map(p=>p.id===old.id?project:p);else state.projects.unshift(project);
    if(persist()){$("#projectDialog").close();renderProjects();toast(old?"Проект обновлён.":"Проект создан.");}
  }
  function renderProjects(){
    const q=($("#projectSearch")?.value||"").trim().toLowerCase(),sort=$("#projectSort")?.value||"updated";
    let list=state.projects.filter(p=>(p.name+" "+(p.description||"")).toLowerCase().includes(q));
    list.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"ru"):sort==="created"?new Date(a.createdAt)-new Date(b.createdAt):new Date(b.updatedAt)-new Date(a.updatedAt));
    $("#projectGrid").innerHTML=list.map(p=>`<article class="project-card"><div class="project-card-head"><span class="project-symbol">⌘</span><button class="project-menu" data-action="delete" data-id="${escapeHTML(p.id)}" title="Удалить проект" aria-label="Удалить проект">⋯</button></div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||"Без описания")}</p><div class="project-meta"><span>HTML · CSS · JS</span><span>${fmtDate(p.updatedAt)}</span></div><div class="project-card-actions"><button class="small-button" data-action="open" data-id="${escapeHTML(p.id)}">Открыть</button><button class="small-button" data-action="edit" data-id="${escapeHTML(p.id)}">Изменить</button><button class="small-button" data-action="zip" data-id="${escapeHTML(p.id)}">ZIP ↓</button></div></article>`).join("");
    $("#projectsEmpty").classList.toggle("show",state.projects.length===0);
    $("#projectGrid").style.display=list.length?"grid":"none";
    if(state.projects.length>0&&list.length===0){$("#projectsEmpty").classList.add("show");$("#projectsEmpty h3").textContent="Ничего не найдено";$("#projectsEmpty p").textContent="Измени запрос поиска.";}else{$("#projectsEmpty h3").textContent="Здесь пока пусто";$("#projectsEmpty p").textContent="Создай проект или сохрани код из редактора — он появится здесь.";}
    refreshCounts();
  }
  function openProject(id){
    const p=state.projects.find(x=>x.id===id);if(!p)return;
    state.currentProjectId=p.id;editorFiles={html:p.html||"",css:p.css||"",js:p.js||""};editorDirty=false;setEditorFile("html");navigate("playground");runPreview();toast(`Открыт проект «${p.name}».`);
  }
  async function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function filenameSafe(s){return safeText(s).normalize("NFKD").replace(/[^\wа-яё-]+/gi,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"devflow-project";}
  async function projectZip(project){
    if(!project){toast("Сначала выбери проект.","error");return;}
    if(!window.JSZip){toast("Библиотека ZIP не загружена. Проверь подключение к интернету или vendor/jszip.min.js.","error");return;}
    const zip=new JSZip();zip.file("index.html",project.html||"");zip.file("style.css",project.css||"");zip.file("script.js",project.js||"");
    zip.file("README.md",`# ${project.name}\n\n${project.description||"Проект создан в DEVFLOW."}\n\n## Запуск\nОткройте \`index.html\` в браузере. Для публикации загрузите файлы на статический хостинг.\n`);
    try{const blob=await zip.generateAsync({type:"blob"});await downloadBlob(blob,filenameSafe(project.name)+".zip");toast("ZIP-архив подготовлен.");}
    catch(e){toast("Не удалось собрать ZIP: "+e.message,"error");}
  }
  function renderExportSelect(){
    const select=$("#exportProjectSelect");if(!select)return;
    const previous=select.value;
    select.innerHTML=state.projects.length?state.projects.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join(""):`<option value="">Нет сохранённых проектов</option>`;
    if(state.projects.some(p=>p.id===previous))select.value=previous;
    $("#downloadProjectZip").disabled=!state.projects.length;
  }
  function downloadBackup(){
    const backup={format:"devflow-backup",version:1,exportedAt:new Date().toISOString(),data:state};
    downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),`devflow-backup-${new Date().toISOString().slice(0,10)}.json`);
    toast("Резервная копия создана.");
  }
  async function restoreBackup(file){
    try{
      const parsed=JSON.parse(await file.text());
      const data=parsed?.format==="devflow-backup"?parsed.data:parsed;
      if(!data||!Array.isArray(data.projects))throw new Error("В файле нет списка проектов DEVFLOW.");
      const byId=new Map(state.projects.map(p=>[p.id,p]));
      data.projects.forEach(p=>{if(p&&p.id&&p.name)byId.set(p.id,{...p});});
      state.projects=[...byId.values()];
      if(typeof data.lightMode==="boolean")state.lightMode=data.lightMode;
      if(state.lightMode)document.body.classList.add("light-mode");else document.body.classList.remove("light-mode");
      persist();renderProjects();refreshAll();toast(`Восстановлено проектов: ${data.projects.length}.`);
    }catch(e){toast("Не удалось восстановить копию: "+e.message,"error");}
    $("#restoreBackup").value="";
  }
  async function importFiles(files){
    if(!files.length)return;
    const project={id:uid(),name:files.length===1?files[0].name.replace(/\.[^.]+$/,""):"Импортированный проект",description:`Импортировано файлов: ${files.length}`,html:"",css:"",js:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),extraFiles:{}};
    for(const file of files){
      if(file.size>2*1024*1024){toast(`${file.name} больше 2 МБ и пропущен.`,"error");continue;}
      const content=await file.text(),ext=file.name.split(".").pop().toLowerCase();
      if(["html","htm"].includes(ext))project.html=content;
      else if(ext==="css")project.css=content;
      else if(["js","mjs"].includes(ext))project.js=content;
      else (project.extraFiles ||= {})[file.name]=content;
    }
    if(!project.html&&!project.css&&!project.js&&Object.keys(project.extraFiles||{}).length===0){toast("Не удалось импортировать текстовые файлы.","error");return;}
    state.projects.unshift(project);if(persist()){renderProjects();$("#importStatus").textContent=`Импортировано: ${files.length} файл(ов). Проект «${project.name}» добавлен.`;toast("Файлы импортированы в Project Vault.");}
    $("#importFiles").value="";
  }
  function clearAll(){
    if(!confirm("Удалить все проекты и настройки DEVFLOW из этого браузера? Это действие нельзя отменить без резервной копии."))return;
    state={projects:[],lastAction:null,lightMode:false,currentProjectId:null};localStorage.removeItem(STORAGE_KEY);document.body.classList.remove("light-mode");refreshAll();toast("Локальные данные очищены.");
  }
  function rgbFromHex(hex){const clean=hex.replace("#","");if(!/^[0-9a-f]{6}$/i.test(clean))throw new Error("Нужен HEX-код формата #RRGGBB");return{r:parseInt(clean.slice(0,2),16),g:parseInt(clean.slice(2,4),16),b:parseInt(clean.slice(4,6),16)};}
  function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0,l=(max+min)/2;if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h/=6;}return{h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};}
  function updateColor(){
    let hex=$("#colorHex").value.trim();if(!/^#[0-9a-f]{6}$/i.test(hex))return;
    $("#colorPicker").value=hex;$("#colorStage").style.background=hex;
    const {r,g,b}=rgbFromHex(hex),hsl=rgbToHsl(r,g,b);
    $("#hexValue").textContent=hex.toUpperCase();$("#rgbValue").textContent=`${r}, ${g}, ${b}`;$("#hslValue").textContent=`${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
  }
  function updateGradient(){
    const a=$("#gradientA").value,b=$("#gradientB").value,angle=$("#gradientAngle").value;
    $("#angleValue").textContent=angle+"°";$("#gradientPreview").style.background=`linear-gradient(${angle}deg, ${a}, ${b})`;
    $("#gradientCode").textContent=`background: linear-gradient(${angle}deg, ${a}, ${b});`;
  }
  function updateShadow(){
    const x=+$("#shadowX").value,y=+$("#shadowY").value,blur=+$("#shadowBlur").value,opacity=+$("#shadowOpacity").value/100;
    $("#shadowXValue").textContent=x+"px";$("#shadowYValue").textContent=y+"px";$("#shadowBlurValue").textContent=blur+"px";$("#shadowOpacityValue").textContent=Math.round(opacity*100)+"%";
    const code=`box-shadow: ${x}px ${y}px ${blur}px rgba(0,0,0,${opacity.toFixed(2)});`;
    $("#shadowObject").style.boxShadow=code.replace("box-shadow: ","").replace(";","");$("#shadowCode").textContent=code;
  }
  async function copyText(text){
    try{await navigator.clipboard.writeText(text);toast("Скопировано в буфер обмена.");}
    catch(e){const ta=document.createElement("textarea");ta.value=text;document.body.append(ta);ta.select();const ok=document.execCommand("copy");ta.remove();toast(ok?"Скопировано в буфер обмена.":"Не удалось скопировать. Выдели текст вручную.",ok?"":"error");}
  }
  async function makeQr(){
    const text=$("#qrText").value.trim();if(!text){toast("Введи текст или ссылку для QR-кода.","error");return;}
    if(!window.QRCode){toast("Библиотека QR не загружена. Проверь vendor/qrcode.min.js.","error");return;}
    const host=$("#qrOutput");host.innerHTML="";
    try{
      const canvas=document.createElement("canvas");
      await QRCode.toCanvas(canvas,text,{width:220,margin:2,errorCorrectionLevel:"M",color:{dark:"#111111",light:"#ffffff"}});
      host.append(canvas);currentQrCanvas=canvas;$("#downloadQr").disabled=false;toast("QR-код готов.");
    }catch(e){host.textContent="Не удалось создать QR-код.";toast("Ошибка QR: "+e.message,"error");}
  }
  function initEvents(){
    document.addEventListener("click",e=>{
      const pageBtn=e.target.closest("[data-page]");if(pageBtn){e.preventDefault();navigate(pageBtn.dataset.page);return;}
      const toolCard=e.target.closest("[data-tool]");if(toolCard){gotoTool(toolCard.dataset.tool);return;}
      const action=e.target.closest("[data-action]");if(action){
        const p=state.projects.find(x=>x.id===action.dataset.id);if(!p)return;
        if(action.dataset.action==="open")openProject(p.id);
        if(action.dataset.action==="edit")openNewProjectDialog(p);
        if(action.dataset.action==="zip")projectZip(p);
        if(action.dataset.action==="delete"){if(confirm(`Удалить проект «${p.name}»?`)){state.projects=state.projects.filter(x=>x.id!==p.id);if(state.currentProjectId===p.id)state.currentProjectId=null;persist();renderProjects();toast("Проект удалён.");}}
      }
    });
    $$(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
    $("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
    document.addEventListener("click",e=>{if(window.innerWidth<=760&&!e.target.closest("#sidebar")&&!e.target.closest("#menuToggle"))$("#sidebar").classList.remove("open");});
    $("#themeToggle").addEventListener("click",()=>{state.lightMode=!state.lightMode;document.body.classList.toggle("light-mode",state.lightMode);persist();toast(state.lightMode?"Включена светлая тема.":"Включена тёмная тема.");});
    $("#noticeClose").addEventListener("click",()=>$(".notice").remove());
    $("#globalSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){const q=e.target.value.trim().toLowerCase();const tool=TOOL_DATA.find(t=>(t.name+" "+t.desc).toLowerCase().includes(q));if(tool)gotoTool(tool.id);else{navigate("code-tools");$("#toolSearch").value=e.target.value;renderAllTools();}}});
    $("#globalSearch").addEventListener("focus",()=>{if(window.innerWidth<=760)$("#globalSearch").classList.add("expanded");});
    $("#globalSearch").addEventListener("blur",()=>$("#globalSearch").classList.remove("expanded"));
    document.addEventListener("keydown",e=>{if(e.key==="/"&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)&&!e.ctrlKey&&!e.metaKey){e.preventDefault();$("#globalSearch").focus();}if(e.key==="Escape")$("#sidebar").classList.remove("open");});
    $$(".editor-tab").forEach(t=>t.addEventListener("click",()=>{editorFiles[currentFile]=$("#codeEditor").value;setEditorFile(t.dataset.file);}));
    $("#codeEditor").addEventListener("input",()=>{editorFiles[currentFile]=$("#codeEditor").value;editorDirty=true;$("#unsavedDot").hidden=false;updateLineNumbers();});
    $("#codeEditor").addEventListener("keydown",e=>{
      if(e.key==="Tab"){e.preventDefault();const t=e.target,start=t.selectionStart,end=t.selectionEnd;t.setRangeText("  ",start,end,"end");t.dispatchEvent(new Event("input"));}
      if(e.key==="s"&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveCurrentEditorAsProject();}
    });
    $("#runCode").addEventListener("click",runPreview);$("#refreshPreview").addEventListener("click",runPreview);
    $("#resetEditor").addEventListener("click",()=>{if(editorDirty&&!confirm("Сбросить изменения редактора?"))return;editorFiles={...DEFAULT_FILES};state.currentProjectId=null;editorDirty=false;setEditorFile("html");runPreview();toast("Редактор сброшен.");});
    $("#savePlayground").addEventListener("click",()=>{if(state.currentProjectId){saveCurrentEditorAsProject();return;}openNewProjectDialog({name:"Мой проект",description:"Проект из Live Playground",...editorFiles});modalEditingId=null;});
    $("#projectForm").addEventListener("submit",saveDialogProject);
    $("#newProject").addEventListener("click",()=>openNewProjectDialog());$("#emptyNewProject").addEventListener("click",()=>openNewProjectDialog());
    $("#projectSearch").addEventListener("input",renderProjects);$("#projectSort").addEventListener("change",renderProjects);
    $("#toolSearch").addEventListener("input",renderAllTools);
    $$(".filter-pill").forEach(b=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter;$$(".filter-pill").forEach(x=>x.classList.toggle("active",x===b));renderAllTools();}));
    $("#utilityMode").addEventListener("change",()=>{const mode=$("#utilityMode").value;const t=TOOL_DATA.find(x=>x.mode===mode);if(t)selectUtility(t.id);else{$("#utilityTitle").textContent="Инструмент";$("#utilityDescription").textContent="Обработка текста локально."; }});
    $("#processUtility").addEventListener("click",runUtility);$("#clearUtility").addEventListener("click",()=>{$("#utilityInput").value="";$("#utilityOutput").value="";$("#utilityStatus").textContent="Очищено";});
    $("#copyUtilityOutput").addEventListener("click",()=>copyText($("#utilityOutput").value));
    $("#colorPicker").addEventListener("input",()=>{$("#colorHex").value=$("#colorPicker").value;updateColor();});
    $("#colorHex").addEventListener("input",updateColor);
    $$("[data-color-value]").forEach(b=>b.addEventListener("click",()=>copyText($("#"+({hex:"hexValue",rgb:"rgbValue",hsl:"hslValue"}[b.dataset.colorValue])).textContent)));
    ["gradientA","gradientB","gradientAngle"].forEach(id=>$("#"+id).addEventListener("input",updateGradient));
    ["shadowX","shadowY","shadowBlur","shadowOpacity"].forEach(id=>$("#"+id).addEventListener("input",updateShadow));
    $("#copyGradient").addEventListener("click",()=>copyText($("#gradientCode").textContent));$("#copyShadow").addEventListener("click",()=>copyText($("#shadowCode").textContent));
    $("#makeQr").addEventListener("click",makeQr);$("#downloadQr").addEventListener("click",()=>{if(!currentQrCanvas)return;currentQrCanvas.toBlob(blob=>blob&&downloadBlob(blob,"devflow-qr.png"));});
    $("#downloadProjectZip").addEventListener("click",()=>projectZip(state.projects.find(p=>p.id===$("#exportProjectSelect").value)));
    $("#downloadBackup").addEventListener("click",downloadBackup);
    $("#restoreBackup").addEventListener("change",e=>{const file=e.target.files?.[0];if(file)restoreBackup(file);});
    $("#importFiles").addEventListener("change",e=>importFiles([...e.target.files||[]]));
    $("#clearAllData").addEventListener("click",clearAll);
  }
  function init(){
    loadState();initEvents();setEditorFile("html");runPreview();updateColor();updateGradient();updateShadow();selectUtility("json");
    $("#utilityInput").value='{\n  "name": "DEVFLOW",\n  "ready": true,\n  "tools": 12\n}';
    $("#utilityOutput").value="";
  }
  init();
})();
