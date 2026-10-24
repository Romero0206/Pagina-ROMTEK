import { AGENTES, API_BASE } from "./datos.js";
import { personas } from "./gente.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const iniciales = (n) => { const p = n.split(" "); return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase(); };
const nombreDe = (id) => id === "_jefe" ? "Sebastian" : id === "_recepcion" ? "Recepción" : (AGENTES.find((a) => a.id === id)?.nombre ?? id);
const TONOS = ["#0B2D5B", "#007BFF", "#1c7c54", "#b9791c", "#c2452b", "#13839a", "#5c7c9e", "#a8472f", "#2f6fb5", "#7a6a1e"];
const tono = (id) => TONOS[Math.max(0, AGENTES.findIndex((a) => a.id === id)) % TONOS.length];
const api = async (ruta, cuerpo, metodo) => {
  const r = await fetch(API_BASE + ruta.slice(4), { method: metodo || (cuerpo ? "POST" : "GET"), headers: cuerpo ? { "Content-Type": "application/json" } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Error del servidor"); return j;
};

/* ===== Chat con cualquier agente ===== */
let chatCon = "romtek", pendiente = null;
export let alElegir = () => {};
export const setAlElegir = (f) => { alElegir = f; };

export function iniciarChat() {
  const chips = $("#chips");
  AGENTES.forEach((a) => {
    const b = document.createElement("button"); b.className = "chip"; b.dataset.id = a.id; b.title = a.nombre + " · " + a.rol;
    b.style.background = tono(a.id); b.innerHTML = esc(iniciales(a.nombre)) + "<i></i>";
    b.addEventListener("click", () => elegirChat(a.id, true)); chips.appendChild(b);
  });
  $("#enviar").addEventListener("click", enviar);
  $("#texto").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } });
  $("#texto").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; });
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
    $("#v-chat").style.display = t.dataset.t === "chat" ? "flex" : "none"; $("#feed").style.display = t.dataset.t === "act" ? "flex" : "none";
  }));
  elegirChat("romtek", false);
}

export async function elegirChat(id, avisar = true) {
  if (!AGENTES.some((a) => a.id === id)) return;
  chatCon = id; pendiente = null;
  const a = AGENTES.find((x) => x.id === id);
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.id === id));
  $("#q-nombre").textContent = a.nombre; $("#q-rol").textContent = id === "romtek" ? "Director de la oficina · delega en el equipo y te entrega el informe" : a.rol + " · conversación directa";
  $("#texto").placeholder = id === "romtek" ? "Escríbele a Harvey…" : "Escríbele a " + a.nombre.split(" ")[0] + "…";
  if (avisar) alElegir(id);
  await pintarMensajes();
}

async function pintarMensajes() {
  const caja = $("#mensajes"), id = chatCon;
  let lista = []; try { lista = (await api("/api/chat/" + id)).mensajes; } catch (e) { /* sin servidor */ }
  if (id !== chatCon) return;
  caja.replaceChildren();
  if (!lista.length) { const v = document.createElement("div"); v.className = "vacio"; v.textContent = id === "romtek" ? "Escríbele a Harvey. Él decide quién del equipo lo hace y te entrega el informe." : "Aún no han hablado. Escribe tu primer mensaje."; caja.appendChild(v); }
  lista.forEach((m) => globo(m.rol === "yo" ? "yo" : "ag", m.texto));
  if (pendiente && pendiente.agente === id) globo("ag pensando", "Trabajando en ello…").id = "pensando";
  caja.scrollTop = caja.scrollHeight; $("#enviar").disabled = !!(pendiente && pendiente.agente === id);
}
function globo(cls, texto) { const d = document.createElement("div"); d.className = "m " + cls; d.textContent = texto; $("#mensajes").appendChild(d); $("#mensajes").scrollTop = 1e9; return d; }

async function enviar() {
  const ta = $("#texto"), texto = ta.value.trim(); if (!texto || pendiente) return;
  ta.value = ""; ta.style.height = "auto"; $("#mensajes .vacio")?.remove();
  globo("yo", texto); const agente = chatCon;
  try {
    const j = await api("/api/chat", { agente, mensaje: texto });
    pendiente = { agente, job: j.id }; globo("ag pensando", "Trabajando en ello…").id = "pensando"; $("#enviar").disabled = true; seguir(j.id, agente);
  } catch (e) { globo("ag err", "No se pudo enviar: " + e.message); }
}
function seguir(job, agente) {
  const paso = async () => {
    try {
      const j = await api("/api/encargo/" + job);
      if (j.estado === "en_cola" || j.estado === "trabajando") return setTimeout(paso, 1500);
      if (pendiente && pendiente.job === job) pendiente = null;
      if (chatCon === agente) { $("#pensando")?.remove(); globo(j.estado === "listo" ? "ag" : "ag err", j.resultado || "(sin respuesta)"); $("#enviar").disabled = false; }
      refrescarTareas();
    } catch (e) { setTimeout(paso, 3000); }
  };
  paso();
}

export function marcarTrabajo(id, trabajando) { document.querySelector(`.chip[data-id="${id}"]`)?.classList.toggle("t", trabajando); }

/* ===== Actividad ===== */
export function aFeed(ev) {
  const txt = { entrada: ev.de === "_jefe" ? `<b>Sebastian</b> → <b>Harvey</b>: ${esc(ev.texto)}` : `Llegó un encargo por Telegram → <b>Harvey</b>`,
    delega: `<b>Harvey</b> → <b>${esc(nombreDe(ev.a))}</b>: ${esc(ev.texto)}`,
    reporta: `<b>${esc(nombreDe(ev.de))}</b> entregó su informe a <b>Harvey</b>`,
    entrega: `<b>Harvey</b> le entregó el informe a <b>Sebastian</b>`,
    chat: `<b>Sebastian</b> → <b>${esc(nombreDe(ev.a))}</b>: ${esc(ev.texto)}`,
    chatfin: `<b>${esc(nombreDe(ev.de))}</b> respondió a <b>Sebastian</b>` }[ev.tipo];
  if (!txt) return;
  const ul = $("#feed"); ul.querySelector(".vacio")?.remove();
  const li = document.createElement("li"); li.innerHTML = `<span class="pt ${["entrega", "chatfin"].includes(ev.tipo) ? "" : "t"}"></span><span>${txt}</span>`;
  ul.prepend(li); while (ul.children.length > 40) ul.lastChild.remove();
}

/* ===== Pipeline ===== */
let tareas = [], filtro = "todos";
const hace = (t) => { const s = (Date.now() / 1000 - t) | 0; return s < 60 ? "ahora" : s < 3600 ? Math.floor(s / 60) + " min" : s < 86400 ? Math.floor(s / 3600) + " h" : Math.floor(s / 86400) + " d"; };
/* ----- Historial: todo lo que se pidió, venga de Claude Code, Telegram o la oficina ----- */
let hist = [], filtroOrigen = "todos", textoBuscar = "";
const ORIGEN = (o) => /claude code/i.test(o) ? ["Claude Code", "cc"] : /telegram/i.test(o) ? ["Telegram", "tg"] : /pipeline/i.test(o) ? ["Pipeline", "pl"] : /^romtek/.test(o) ? ["Delegado por Harvey", "de"] : ["Oficina", "of"];
const fecha = (t) => new Date(t * 1000).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
async function refrescarHistorial() { try { hist = (await api("/api/historial")).historial; pintarHistorial(); } catch (e) { /* sin servidor */ } }
function pintarHistorial() {
  const lista = $("#hi-lista"); if (!lista) return;
  const q = textoBuscar.toLowerCase();
  const vis = hist.filter((t) => (filtroOrigen === "todos" || ORIGEN(t.origen)[1] === filtroOrigen) && (!q || (t.titulo + " " + (t.resultado || "")).toLowerCase().includes(q)));
  lista.innerHTML = vis.length ? vis.map((t, i) => { const [nom, cls] = ORIGEN(t.origen);
    return `<div class="hi" data-i="${i}" style="border-left-color:${tono(t.agente)}"><div class="cab"><span class="or ${cls}">${esc(nom)}</span><span>${esc(nombreDe(t.agente).split(" ")[0])}</span><span>· ${fecha(t.actualizada)}</span><span>· ${t.estado === "entregado" ? "entregado" : t.estado === "en_proceso" ? "en proceso" : "por hacer"}${t.error ? " (falló)" : ""}</span></div>
    <div class="ti">${esc(t.titulo)}</div><div class="re">${t.resultado ? esc(t.resultado) : '<span class="sr">Sin respuesta guardada.</span>'}</div></div>`; }).join("") : '<div class="vacio">Aún no hay nada en el historial.</div>';
  lista.querySelectorAll(".hi").forEach((el) => el.addEventListener("click", () => el.classList.toggle("abierto")));
}
function iniciarHistorial() {
  const f = $("#hi-origen"); const orig = [["todos", "Todos"], ["cc", "Claude Code"], ["tg", "Telegram"], ["of", "Oficina"], ["pl", "Pipeline"], ["de", "Delegados"]];
  f.innerHTML = orig.map(([k, n], i) => `<button class="f${i ? "" : " on"}" data-o="${k}" type="button">${n}</button>`).join("");
  f.addEventListener("click", (e) => { const b = e.target.closest(".f"); if (!b) return; filtroOrigen = b.dataset.o; f.querySelectorAll(".f").forEach((x) => x.classList.toggle("on", x === b)); pintarHistorial(); });
  $("#hi-buscar").addEventListener("input", (e) => { textoBuscar = e.target.value; pintarHistorial(); });
  const ver = (h) => { $("#historial").hidden = !h; $("#tablero").hidden = h; $("#pl-nueva").hidden = h; $("#pl-filtros").hidden = h; $("#v-historial").classList.toggle("on", h); $("#v-tablero").classList.toggle("on", !h); if (h) refrescarHistorial(); };
  $("#v-historial").addEventListener("click", () => ver(true)); $("#v-tablero").addEventListener("click", () => ver(false));
  setInterval(() => { if (!$("#historial").hidden && $("#pipeline").classList.contains("on")) refrescarHistorial(); }, 8000);
}

export function iniciarPipeline() {
  iniciarHistorial();
  $("#pl-agente").innerHTML = AGENTES.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join("");
  const f = $("#pl-filtros"); f.innerHTML = '<button class="f on" data-f="todos" type="button">Todos</button>' + AGENTES.map((a) => `<button class="f" data-f="${a.id}" type="button">${esc(a.nombre.split(" ")[0])}</button>`).join("");
  f.addEventListener("click", (e) => { const b = e.target.closest(".f"); if (!b) return; filtro = b.dataset.f; f.querySelectorAll(".f").forEach((x) => x.classList.toggle("on", x === b)); pintarTareas(); });
  $("#b-pipeline").addEventListener("click", () => abrirPipeline(true)); $("#b-oficina").addEventListener("click", () => abrirPipeline(false));
  $("#pl-cerrar").addEventListener("click", () => abrirPipeline(false));
  addEventListener("keydown", (e) => { if (e.key === "Escape") abrirPipeline(false); });
  $("#pl-nueva").addEventListener("submit", async (e) => {
    e.preventDefault(); const titulo = $("#pl-titulo").value.trim(); if (!titulo) return;
    try { await api("/api/tareas", { titulo, agente: $("#pl-agente").value }); $("#pl-titulo").value = ""; refrescarTareas(); } catch (er) { alert(er.message); }
  });
  $("#pipeline").addEventListener("click", async (e) => {
    if (e.target.id === "pipeline") return abrirPipeline(false);
    const b = e.target.closest("button[data-a]"); if (!b) return;
    try {
      if (b.dataset.a === "iniciar") { const j = await api(`/api/tareas/${b.dataset.id}/iniciar`, {}); const t = tareas.find((x) => x.id === b.dataset.id); if (t) { pendiente = { agente: t.agente, job: j.id }; seguir(j.id, t.agente); } }
      if (b.dataset.a === "borrar") await api("/api/tareas/" + b.dataset.id, null, "DELETE");
      refrescarTareas();
    } catch (er) { alert(er.message); }
  });
  refrescarTareas(); setInterval(refrescarTareas, 3000);
}
function abrirPipeline(on) { $("#pipeline").classList.toggle("on", on); $("#b-pipeline").classList.toggle("on", on); $("#b-oficina").classList.toggle("on", !on); if (on) refrescarTareas(); }
export async function refrescarTareas() { try { tareas = (await api("/api/tareas")).tareas; pintarTareas(); } catch (e) { /* sin servidor */ } }
function pintarTareas() {
  const vis = tareas.filter((t) => filtro === "todos" || t.agente === filtro).sort((a, b) => b.actualizada - a.actualizada);
  ["por_hacer", "en_proceso", "entregado"].forEach((est) => {
    const lista = vis.filter((t) => t.estado === est).slice(0, est === "entregado" ? 40 : 100);
    $("#n-" + est).textContent = vis.filter((t) => t.estado === est).length;
    $("#l-" + est).innerHTML = lista.length ? lista.map((t) => {
      const acc = est === "por_hacer" ? `<span class="acc"><button data-a="iniciar" data-id="${t.id}">Iniciar</button><button class="x" data-a="borrar" data-id="${t.id}" aria-label="Borrar">×</button></span>`
        : est === "entregado" ? `<span class="acc"><button class="x" data-a="borrar" data-id="${t.id}" aria-label="Borrar">×</button></span>` : "";
      return `<div class="card ${t.error ? "err" : est === "en_proceso" ? "en" : est === "entregado" ? "ok" : ""}" style="${t.error ? "" : `border-left-color:${tono(t.agente)}`}"><div class="t">${esc(t.titulo)}</div>
        <div class="p"><span class="av" style="background:${tono(t.agente)}">${esc(iniciales(nombreDe(t.agente)))}</span><span>${esc(nombreDe(t.agente).split(" ")[0])} · ${hace(t.actualizada)}${t.origen ? " · " + esc(t.origen) : ""}</span>${t.error ? '<span class="tag">falló</span>' : ""}${acc}</div></div>`;
    }).join("") : '<div class="vacio">Sin tareas</div>';
  });
}
