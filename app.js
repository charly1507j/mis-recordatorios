const KEY="recordatorios-v1-data";
let reminders=JSON.parse(localStorage.getItem(KEY)||"[]");
let filter="pending";
let deferredPrompt=null;

const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(KEY,JSON.stringify(reminders));
const pad=n=>String(n).padStart(2,"0");
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const formatDate=s=>new Date(s+"T00:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
const now=new Date();

$("today").textContent=now.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

function render(){
  const q=$("search").value.trim().toLowerCase();
  const today=dateKey(new Date());
  let arr=reminders.filter(r=>(r.title+" "+r.notes).toLowerCase().includes(q));
  if(filter==="pending")arr=arr.filter(r=>!r.done);
  if(filter==="today")arr=arr.filter(r=>r.date===today&&!r.done);
  if(filter==="done")arr=arr.filter(r=>r.done);
  arr.sort((a,b)=>(a.date+"T"+a.time).localeCompare(b.date+"T"+b.time));
  $("stats").textContent=`${reminders.filter(r=>!r.done).length} pendientes · ${reminders.filter(r=>r.done).length} completados`;
  $("list").innerHTML=arr.length?arr.map(card).join(""):`<div class="empty">No hay recordatorios en esta vista.<br><br>Pulsa <b>＋ Nuevo recordatorio</b> para crear uno.</div>`;
}
function card(r){
  const repeat={none:"",daily:" · Cada día",weekly:" · Cada semana",monthly:" · Cada mes"}[r.repeat];
  return `<article class="card ${r.done?"done":""}">
    <input class="check" type="checkbox" ${r.done?"checked":""} onchange="toggleDone('${r.id}')">
    <div class="card-main">
      <div class="card-title">${esc(r.title)}</div>
      <div class="meta">📅 ${formatDate(r.date)} · ⏰ ${r.time}${repeat}</div>
      ${r.notes?`<div class="notes">${esc(r.notes)}</div>`:""}
    </div>
    <div class="card-actions">
      <button class="small" onclick="editReminder('${r.id}')">✏️</button>
      <button class="small" onclick="deleteReminder('${r.id}')">🗑️</button>
    </div>
  </article>`;
}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function openModal(r=null){
  $("modal").classList.remove("hidden");
  $("modalTitle").textContent=r?"Editar recordatorio":"Nuevo recordatorio";
  $("rid").value=r?.id||"";
  $("title").value=r?.title||"";
  $("notes").value=r?.notes||"";
  $("date").value=r?.date||dateKey(new Date());
  $("time").value=r?.time||`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  $("repeat").value=r?.repeat||"none";
  $("title").focus();
}
function closeModal(){$("modal").classList.add("hidden")}
$("addBtn").onclick=()=>openModal();
$("closeModal").onclick=closeModal;
$("cancelBtn").onclick=closeModal;
$("modal").onclick=e=>{if(e.target===$("modal"))closeModal()};
$("form").onsubmit=e=>{
 e.preventDefault();
 const id=$("rid").value||crypto.randomUUID();
 const old=reminders.find(r=>r.id===id);
 const r={id,title:$("title").value.trim(),notes:$("notes").value.trim(),date:$("date").value,time:$("time").value,repeat:$("repeat").value,done:old?.done||false};
 if(old)Object.assign(old,r);else reminders.push(r);
 save();closeModal();render();
};
window.toggleDone=id=>{
 const r=reminders.find(x=>x.id===id); if(!r)return;
 r.done=!r.done;
 if(r.done&&r.repeat!=="none") createNext(r);
 save();render();
};
function createNext(r){
 const d=new Date(r.date+"T00:00:00");
 if(r.repeat==="daily")d.setDate(d.getDate()+1);
 if(r.repeat==="weekly")d.setDate(d.getDate()+7);
 if(r.repeat==="monthly")d.setMonth(d.getMonth()+1);
 reminders.push({...r,id:crypto.randomUUID(),date:dateKey(d),done:false});
}
window.editReminder=id=>openModal(reminders.find(r=>r.id===id));
window.deleteReminder=id=>{
 if(confirm("¿Eliminar este recordatorio?")){reminders=reminders.filter(r=>r.id!==id);save();render();}
};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");filter=b.dataset.filter;render();
});
$("search").oninput=render;
$("themeBtn").onclick=()=>{
 document.body.classList.toggle("dark");
 localStorage.setItem("dark",document.body.classList.contains("dark"));
 $("themeBtn").textContent=document.body.classList.contains("dark")?"☀️":"🌙";
};
if(localStorage.getItem("dark")==="true"){document.body.classList.add("dark");$("themeBtn").textContent="☀️"}

$("notifyBtn").onclick=async()=>{
 if(!("Notification"in window)){alert("Este navegador no permite notificaciones.");return}
 const p=await Notification.requestPermission();
 alert(p==="granted"?"Notificaciones activadas.":"No se concedió permiso.");
};
window.addEventListener("beforeinstallprompt",e=>{
 e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden");
});
$("installBtn").onclick=async()=>{
 if(!deferredPrompt)return;
 deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden");
};

if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

function checkDue(){
 const now=new Date(), today=dateKey(now), hm=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
 const last=JSON.parse(localStorage.getItem("recordatorios-notificados")||"{}");
 reminders.forEach(r=>{
   if(r.done||r.date!==today||r.time!==hm)return;
   const key=r.id+"-"+today+"-"+hm;
   if(last[key])return;
   last[key]=true;localStorage.setItem("recordatorios-notificados",JSON.stringify(last));
   if(Notification.permission==="granted"&&navigator.serviceWorker?.controller)
     navigator.serviceWorker.controller.postMessage({type:"NOTIFY",title:r.title,body:r.notes||"Es hora de tu recordatorio.",tag:r.id});
   else if(Notification.permission==="granted")new Notification(r.title,{body:r.notes||"Es hora de tu recordatorio."});
 });
}
setInterval(checkDue,15000);
render();