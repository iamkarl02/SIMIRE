/* ============================================================
   CONSTANTES
   ============================================================ */
const DIAS_ORDEN = ["Lunes","Martes","Miércoles","Jueves","Viernes"];

let horario = [];
let dias = [];
let diaActualMovil = null;

let HOUR_START = 8;
let HOUR_END = 16;
let PX_PER_HOUR = 60;

/* Paleta desaturada por asignatura */
const PALETA = [
  "#7c8fb8","#7fa88f","#b89a6a","#a87f9c",
  "#6fa3b0","#8b7fb8","#b08572","#8a8f9c",
];
function colorAsignatura(nombre){
  let h=0;for(let i=0;i<nombre.length;i++)h=(h*31+nombre.charCodeAt(i))>>>0;
  return PALETA[h%PALETA.length];
}

/* ============================================================
   MENÚ OVERLAY
   ============================================================ */
const menuBtn = document.getElementById("menuBtn");
const menuOverlay = document.getElementById("menuOverlay");
const menuClock = document.getElementById("menuClock");

function abrirMenu(){
  document.body.classList.add("menu-open");
  menuOverlay.hidden = false;
  menuBtn.setAttribute("aria-expanded","true");
  menuBtn.setAttribute("aria-label","Cerrar menú");
  // foco al primer item
  const first = menuOverlay.querySelector(".menu-item");
  if(first) first.focus({preventScroll:true});
  actualizarRelojMenu();
}
function cerrarMenu(){
  document.body.classList.remove("menu-open");
  menuBtn.setAttribute("aria-expanded","false");
  menuBtn.setAttribute("aria-label","Abrir menú");
  // esperar a la transición para ocultar
  setTimeout(()=>{ menuOverlay.hidden = true; }, 300);
}
function toggleMenu(){
  if(document.body.classList.contains("menu-open")) cerrarMenu();
  else abrirMenu();
}

menuBtn.addEventListener("click", toggleMenu);

// Cerrar con Escape
document.addEventListener("keydown", e=>{
  if(e.key === "Escape" && document.body.classList.contains("menu-open")){
    cerrarMenu();
  }
});

// Cerrar al hacer clic fuera de los items (en el overlay)
menuOverlay.addEventListener("click", e=>{
  if(e.target === menuOverlay) cerrarMenu();
});

// Asignar índice escalonado a cada item
document.querySelectorAll(".menu-item").forEach((el,i)=>{
  el.style.setProperty("--i", i);
});

// Acciones del menú
document.querySelectorAll(".menu-item").forEach(item=>{
  item.addEventListener("click", e=>{
    e.preventDefault();
    const action = item.dataset.action;
    cerrarMenu();
    setTimeout(()=>{
      switch(action){
        case "hoy":
          irAHoy();
          break;
        case "semana":
          // en PC no hace nada especial; en móvil cambia a vista de hoy de lunes
          // (la vista de semana solo existe en PC)
          if(window.matchMedia("(max-width:900px)").matches){
            diaActualMovil = 0;
            render();
          }
          break;
        case "recargar":
          cargarHorario();
          break;
        case "tema":
          alternarTema();
          break;
        case "acerca":
          mostrarAcerca();
          break;
      }
    }, 320);
  });
});

function actualizarRelojMenu(){
  if(!menuClock) return;
  const ahora = new Date();
  menuClock.textContent = ahora.toLocaleTimeString("es-ES",{
    hour:"2-digit",minute:"2-digit",second:"2-digit"
  });
}
setInterval(()=>{
  if(!menuOverlay.hidden) actualizarRelojMenu();
}, 1000);

/* Acciones concretas */
function irAHoy(){
  const hoyNombre = nombreDiaHoy();
  if(!hoyNombre) return;
  const idx = dias.indexOf(hoyNombre);
  if(idx === -1) return;
  // Móvil: cambiar día
  diaActualMovil = idx;
  render();
  // PC: scroll horizontal no aplica (5 columnas fijas)
}
function alternarTema(){
  const root = document.documentElement;
  const actual = root.style.colorScheme || "";
  let nuevo;
  if(actual === "light") nuevo = "dark";
  else if(actual === "dark") nuevo = "light";
  else {
    // detectar preferencia
    const prefiereClaro = window.matchMedia("(prefers-color-scheme: light)").matches;
    nuevo = prefiereClaro ? "dark" : "light";
  }
  root.style.colorScheme = nuevo;
  localStorage.setItem("horario-tema", nuevo);
}
// restaurar tema guardado
(function(){
  const guardado = localStorage.getItem("horario-tema");
  if(guardado) document.documentElement.style.colorScheme = guardado;
})();

function mostrarAcerca(){
  alert("Horario · Portal del empleado\n\nCarga automática desde horario/horario.txt\nLos colores se asignan por asignatura.");
}

/* ============================================================
   PARSEO Y AGRUPACIÓN
   ============================================================ */
function parsearHorario(texto){
  const bloques = texto.split(/---+/).map(b=>b.trim()).filter(Boolean);
  const res = [];
  for(const bloque of bloques){
    let item={dia:"",hora:"",asignatura:"",profesor:""};
    for(const linea of bloque.split(/\r?\n/)){
      const m=linea.match(/^([^:]+):\s*(.*)$/); if(!m) continue;
      const k=m[1].trim().toLowerCase(), v=m[2].trim();
      if(k==="dia"||k==="día") item.dia=v;
      else if(k==="hora") item.hora=v;
      else if(k==="asignatura") item.asignatura=v;
      else if(k==="profesor") item.profesor=v;
    }
    if(item.dia && item.hora && item.asignatura) res.push(item);
  }
  return res;
}
function agruparPorDia(lista){
  const mapa=new Map();
  for(const it of lista){
    if(!mapa.has(it.dia)) mapa.set(it.dia,[]);
    mapa.get(it.dia).push(it);
  }
  const ds=Array.from(mapa.keys()).sort((a,b)=>{
    const ia=DIAS_ORDEN.indexOf(a), ib=DIAS_ORDEN.indexOf(b);
    if(ia===-1&&ib===-1)return a.localeCompare(b);
    if(ia===-1)return 1; if(ib===-1)return -1; return ia-ib;
  });
  for(const d of ds) mapa.get(d).sort((a,b)=>a.hora.localeCompare(b.hora));
  return {dias:ds, mapa};
}

/* ============================================================
   FECHAS
   ============================================================ */
function parseHora(str){
  const m=str.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if(!m) return null;
  const hoy=new Date();
  const s=new Date(hoy); s.setHours(+m[1],+m[2],0,0);
  const e=new Date(hoy); e.setHours(+m[3],+m[4],0,0);
  return {start:s, end:e};
}
function fmtHHMM(d){
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtMMSS(ms){
  if(ms<0)ms=0;
  const tot=Math.floor(ms/1000), mm=Math.floor(tot/60), ss=tot%60;
  return `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}
function calcularRango(){
  let min=24, max=0;
  for(const it of horario){
    const t=parseHora(it.hora); if(!t) continue;
    const s=t.start.getHours() + t.start.getMinutes()/60;
    const e=t.end.getHours() + t.end.getMinutes()/60;
    if(s<min) min=s;
    if(e>max) max=e;
  }
  if(min===24){ min=8; max=16; }
  HOUR_START = Math.floor(min);
  HOUR_END = Math.ceil(max);
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  const week=document.getElementById("weekView");
  const mobile=document.getElementById("mobileView");
  const nav=document.getElementById("daysNav");

  if(!horario.length){
    const msg=`<div class="empty"><div><h3>Horario no disponible</h3>
      <p>No se ha podido cargar <code>horario/horario.txt</code>.</p></div></div>`;
    week.innerHTML=msg; mobile.innerHTML=msg; nav.innerHTML="";
    return;
  }

  calcularRango();
  const {dias:ds, mapa} = agruparPorDia(horario);
  dias = ds;
  const hoyNombre = nombreDiaHoy();

  /* ---------- PC ---------- */
  week.innerHTML="";
  const totalHoras = HOUR_END - HOUR_START;
  const weekHeight = week.clientHeight - 44;
  PX_PER_HOUR = Math.max(28, weekHeight / totalHoras);

  const hoursCol=document.createElement("div");
  hoursCol.className="week-hours";
  for(let h=HOUR_START; h<=HOUR_END; h++){
    const el=document.createElement("div");
    el.className="week-hour";
    el.style.top=((h-HOUR_START)*PX_PER_HOUR)+"px";
    el.textContent=`${String(h).padStart(2,"0")}:00`;
    hoursCol.appendChild(el);
  }
  week.appendChild(hoursCol);

  DIAS_ORDEN.forEach(dia=>{
    const col=document.createElement("div");
    col.className="week-col";

    const head=document.createElement("div");
    head.className="week-col-head";
    const esHoy=dia===hoyNombre;
    head.innerHTML=`
      <span class="dow">${dia.slice(0,3)}</span>
      ${esHoy?'<span class="today">Hoy</span>':''}
    `;
    col.appendChild(head);

    const body=document.createElement("div");
    body.className="week-col-body";

    for(let h=HOUR_START; h<=HOUR_END; h++){
      const line=document.createElement("div");
      line.className="hour-line";
      line.style.top=((h-HOUR_START)*PX_PER_HOUR)+"px";
      body.appendChild(line);
    }

    const items = mapa.get(dia) || [];
    const {idxActual, idxSiguiente} = calcularEstados(items);

    items.forEach((it,i)=>{
      const t=parseHora(it.hora); if(!t) return;
      const top=((t.start.getHours()-HOUR_START) + t.start.getMinutes()/60)*PX_PER_HOUR;
      const height=((t.end-t.start)/3600000)*PX_PER_HOUR;
      body.appendChild(crearEvento(it, t, i, esHoy, idxActual, idxSiguiente, height, top));
    });

    if(esHoy){
      const nowLine=document.createElement("div");
      nowLine.className="now-line";
      nowLine.id="nowLinePC";
      body.appendChild(nowLine);
    }

    col.appendChild(body);
    week.appendChild(col);
  });

  /* ---------- Selector días ---------- */
  nav.innerHTML="";
  dias.forEach((dia,idx)=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.innerHTML=`<span class="dow">${dia.slice(0,3)}</span><span class="dnum">${diaNro(dia)}</span>`;
    btn.setAttribute("aria-current", idx===diaActualMovil?"true":"false");
    btn.onclick=()=>cambiarDiaMovil(idx);
    nav.appendChild(btn);
  });
  if(diaActualMovil===null || diaActualMovil>=dias.length) diaActualMovil=elegirDiaPorDefecto();
  Array.from(nav.children).forEach((b,i)=>{
    b.setAttribute("aria-current", i===diaActualMovil?"true":"false");
  });

  /* ---------- Móvil ---------- */
  mobile.innerHTML="";
  if(dias.length && diaActualMovil!==null){
    mobile.appendChild(crearDiaMovil(dias[diaActualMovil], mapa.get(dias[diaActualMovil]), dias[diaActualMovil]===hoyNombre));
  }

  actualizarEstadoTiempo();
}

function crearEvento(it, t, i, esHoy, idxActual, idxSiguiente, height, top){
  const ev=document.createElement("div");
  const esRecreo = it.asignatura.toUpperCase()==="RECREO";
  ev.className="event" + (esRecreo?" is-recreo":"");
  if(height<36) ev.classList.add("is-tiny");
  if(esHoy && i===idxActual) ev.classList.add("is-now");
  if(esHoy && i===idxSiguiente) ev.classList.add("is-next");
  if(!esRecreo) ev.style.setProperty("--ev-color", colorAsignatura(it.asignatura));
  ev.style.top=top+"px";
  ev.style.height=Math.max(height-2,14)+"px";

  if(esRecreo){
    ev.innerHTML=`<span class="e-name">Recreo</span>`;
  }else{
    ev.innerHTML=`
      <div class="e-head">
        <span class="start">${fmtHHMM(t.start)}</span>
        <span class="sep"></span>
        <span class="end">${fmtHHMM(t.end)}</span>
      </div>
      <span class="e-name">${esc(it.asignatura)}</span>
      ${it.profesor?`<span class="e-prof">${esc(it.profesor)}</span>`:""}
    `;
  }
  return ev;
}

function diaNro(dia){
  const idx=DIAS_ORDEN.indexOf(dia);
  if(idx===-1) return "";
  const hoy=new Date();
  const lunes=new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay()+6)%7));
  lunes.setDate(lunes.getDate()+idx);
  return lunes.getDate();
}
function calcularEstados(items){
  const ahora=new Date();
  let idxActual=-1, idxSiguiente=-1;
  items.forEach((it,i)=>{
    if(it.asignatura.toUpperCase()==="RECREO") return;
    const t=parseHora(it.hora); if(!t) return;
    if(ahora>=t.start && ahora<t.end) idxActual=i;
    if(ahora<t.start && idxSiguiente===-1) idxSiguiente=i;
  });
  return {idxActual, idxSiguiente};
}

/* ---------- Vista móvil ---------- */
function crearDiaMovil(dia, items, esHoy){
  const wrap=document.createElement("div");
  wrap.className="day-scroll";

  const header=document.createElement("div");
  header.className="day-header";
  header.innerHTML=`
    <h2>${esc(dia)}</h2>
    ${esHoy?'<span class="today-badge">Hoy</span>':''}
  `;
  wrap.appendChild(header);

  const tl=document.createElement("div");
  tl.className="day-timeline";

  const totalHoras = HOUR_END - HOUR_START;
  const available = tl.clientHeight || (window.innerHeight - 64 - 80);
  const pxh = Math.max(28, available / totalHoras);

  for(let h=HOUR_START; h<=HOUR_END; h++){
    const row=document.createElement("div");
    row.className="day-hour";
    row.style.top=((h-HOUR_START)*pxh)+"px";
    row.innerHTML=`<span class="label">${String(h).padStart(2,"0")}:00</span>`;
    tl.appendChild(row);
  }

  const evs=document.createElement("div");
  evs.className="day-events";
  const {idxActual, idxSiguiente} = calcularEstados(items);

  items.forEach((it,i)=>{
    const t=parseHora(it.hora); if(!t) return;
    const top=((t.start.getHours()-HOUR_START) + t.start.getMinutes()/60)*pxh;
    const height=((t.end-t.start)/3600000)*pxh;
    evs.appendChild(crearEvento(it, t, i, esHoy, idxActual, idxSiguiente, height, top));
  });

  if(esHoy){
    const nowLine=document.createElement("div");
    nowLine.className="now-line";
    nowLine.id="nowLineMobile";
    evs.appendChild(nowLine);
  }

  tl.appendChild(evs);
  wrap.appendChild(tl);

  requestAnimationFrame(()=>{
    const available2 = wrap.clientHeight - header.offsetHeight;
    const pxh2 = Math.max(28, available2 / totalHoras);
    if(Math.abs(pxh2 - pxh) < 1) return;
    tl.style.height = (pxh2 * totalHoras) + "px";
    tl.querySelectorAll(".day-hour").forEach((row,i)=>{
      row.style.top = (i*pxh2)+"px";
    });
    evs.innerHTML="";
    items.forEach((it,i)=>{
      const t=parseHora(it.hora); if(!t) return;
      const top=((t.start.getHours()-HOUR_START) + t.start.getMinutes()/60)*pxh2;
      const height=((t.end-t.start)/3600000)*pxh2;
      evs.appendChild(crearEvento(it, t, i, esHoy, idxActual, idxSiguiente, height, top));
    });
    if(esHoy){
      const nowLine=document.createElement("div");
      nowLine.className="now-line";
      nowLine.id="nowLineMobile";
      evs.appendChild(nowLine);
    }
    actualizarEstadoTiempo();
  });

  return wrap;
}

function cambiarDiaMovil(idx){
  if(!document.startViewTransition){diaActualMovil=idx;render();return;}
  document.startViewTransition(()=>{diaActualMovil=idx;render();});
}

function nombreDiaHoy(){
  const d=new Date().getDay();
  return (d>=1&&d<=5)?DIAS_ORDEN[d-1]:null;
}
function elegirDiaPorDefecto(){
  if(!dias.length)return null;
  const hoy=nombreDiaHoy();
  if(hoy){const i=dias.indexOf(hoy);if(i!==-1)return i;}
  return 0;
}
function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ============================================================
   ESTADO DE TIEMPO
   ============================================================ */
let tickInterval=null;
function actualizarEstadoTiempo(){
  const nowLabel=document.getElementById("nowLabel");
  const timeLabel=document.getElementById("timeLabel");
  const ringLabel=document.getElementById("ringLabel");
  const ring=document.getElementById("ring");

  const ahora=new Date();
  const hoyNombre=nombreDiaHoy();

  const posPct = (()=>{
    const h = ahora.getHours() + ahora.getMinutes()/60;
    if(h<HOUR_START || h>HOUR_END) return -1;
    return (h-HOUR_START)/(HOUR_END-HOUR_START);
  })();

  const linePC=document.getElementById("nowLinePC");
  if(linePC){
    const body=linePC.parentElement;
    if(posPct>=0) linePC.style.top = (posPct*body.clientHeight)+"px";
    else linePC.style.display="none";
  }
  const lineMob=document.getElementById("nowLineMobile");
  if(lineMob){
    const body=lineMob.parentElement;
    if(posPct>=0) lineMob.style.top = (posPct*body.clientHeight)+"px";
    else lineMob.style.display="none";
  }

  if(!hoyNombre){
    nowLabel.textContent="Fin de semana";
    timeLabel.textContent="";
    ringLabel.textContent="—";
    ring.style.setProperty("--pct",0);
    return;
  }

  const items = horario
    .filter(x=>x.dia===hoyNombre && x.asignatura.toUpperCase()!=="RECREO")
    .map(x=>({...x, t:parseHora(x.hora)}))
    .filter(x=>x.t)
    .sort((a,b)=>a.t.start-b.t.start);

  if(!items.length){
    nowLabel.textContent="Sin clases programadas";
    timeLabel.textContent="";
    ringLabel.textContent="—";
    ring.style.setProperty("--pct",0);
    return;
  }

  let actual=null, siguiente=null;
  for(const it of items){
    if(ahora>=it.t.start && ahora<it.t.end){actual=it;break;}
  }
  siguiente = items.find(it=>ahora<it.t.start) || null;

  if(actual){
    const total=actual.t.end-actual.t.start;
    const pas=ahora-actual.t.start;
    const pct=Math.min(100,Math.max(0,(pas/total)*100));
    ring.style.setProperty("--pct", pct.toFixed(1));
    ringLabel.textContent=Math.round(pct)+"%";
    nowLabel.innerHTML=`<span class="dot"></span>${esc(actual.asignatura)}`;
    timeLabel.textContent=`quedan ${fmtMMSS(actual.t.end-ahora)}`;
  } else if(siguiente){
    ring.style.setProperty("--pct",0);
    ringLabel.textContent="—";
    nowLabel.textContent=`Próxima · ${siguiente.asignatura}`;
    timeLabel.textContent=`en ${fmtMMSS(siguiente.t.start-ahora)}`;
  } else {
    ring.style.setProperty("--pct",100);
    ringLabel.textContent="100%";
    nowLabel.textContent="Jornada finalizada";
    timeLabel.textContent="";
  }
}

/* ============================================================
   CARGA AUTOMÁTICA
   ============================================================ */
async function cargarHorario(){
  try{
    const res=await fetch("horario/horario.txt",{cache:"no-store"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    const texto=await res.text();
    horario=parsearHorario(texto);
    if(!horario.length) throw new Error("Formato inválido o vacío");
    diaActualMovil=null;
    render();
    if(tickInterval) clearInterval(tickInterval);
    tickInterval=setInterval(actualizarEstadoTiempo,1000);
  }catch(err){
    console.error(err);
    horario=[];
    render();
    document.getElementById("nowLabel").textContent="Sin horario";
    document.getElementById("timeLabel").textContent="";
    document.getElementById("ringLabel").textContent="—";
  }
}

/* ============================================================
   RESIZE
   ============================================================ */
let resizeTimer=null;
window.addEventListener("resize", ()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    if(horario.length) render();
  }, 150);
});

/* ============================================================
   INICIO
   ============================================================ */
cargarHorario();