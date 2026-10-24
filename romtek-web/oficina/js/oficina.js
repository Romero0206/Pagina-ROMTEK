import { THREE, scene, camara, controles, renderer, lienzo, CENTRO, construirMundo, colocarEtiquetas, actualizarMundo, etiqueta } from "./escena.js";
import { SALAS, DESPACHO, RECEPCION, JUNTAS, CAFE, API_BASE } from "./datos.js";
import { personas, crearPersonas, actualizarGente, animar, interaccion } from "./gente.js";
import { iniciarChat, elegirChat, setAlElegir, aFeed, marcarTrabajo, iniciarPipeline } from "./ui.js";

construirMundo(); crearPersonas();

/* ===== Nombres de las salas (se ven de lejos; las personas, solo de cerca o cuando hacen algo) ===== */
const salasEtq = [];
const sala = (html, cls, x, y, z) => salasEtq.push(etiqueta(html, "etq-sala " + cls, new THREE.Vector3(x, y, z)));
SALAS.forEach((r) => sala(`${r.etapa && r.etapa !== "Coordina" ? `<span class="n">${r.etapa}</span>` : ""}${r.nombre}`, "", r.x + r.w / 2, 1.3, r.z + 0.7));
sala("Recepción", "", RECEPCION.x + RECEPCION.w / 2, 1.3, 7.6);
sala("Sala de juntas", "", JUNTAS.x + JUNTAS.w / 2, 1.3, JUNTAS.z + 1.2);
sala("Café", "", CAFE.x + CAFE.w / 2, 1.3, CAFE.z + 3.6);
sala("Despacho del jefe", "oro", DESPACHO.x + DESPACHO.w / 2, 1.8, 9.2);
sala("Parqueadero", "", 41.1, 1.8, -9.6);

const MODOS = ["auto", "todos", "ocultos"], TEXTO_MODO = { auto: "Nombres: auto", todos: "Nombres: todos", ocultos: "Nombres: ocultos" };
let modo = "auto"; try { modo = localStorage.getItem("oficina-nombres") || "auto"; } catch (e) { /* sin almacenamiento */ }
function cambiarModo() { modo = MODOS[(MODOS.indexOf(modo) + 1) % MODOS.length]; try { localStorage.setItem("oficina-nombres", modo); } catch (e) { /* ok */ } document.getElementById("b-nombres").textContent = TEXTO_MODO[modo]; }
document.getElementById("b-nombres").textContent = TEXTO_MODO[modo];
document.getElementById("b-nombres").addEventListener("click", cambiarModo);
function visibilidadEtiquetas(ahora) {
  const z = camara.zoom;
  personas.forEach((p, id) => {
    if (!p.etq) return;
    const activo = (p.trabajando && !p.espera) || (p.habla && ahora < p.habla.hasta) || interaccion.seleccionado === id || interaccion.hover === id;
    p.etq.style.opacity = modo === "todos" || activo || (modo === "auto" && z >= 1.5) ? 1 : 0;
  });
  const verSalas = modo !== "ocultos" && z <= 2.3 ? 1 : 0;
  salasEtq.forEach((e) => { e.style.opacity = verSalas; });
}

/* ===== Cámara con foco ===== */
let objetivo = { t: CENTRO.clone(), zoom: 1, hasta: 0 };
function enfocar(id) {
  interaccion.seleccionado = id;
  personas.forEach((p, k) => p.etq && p.etq.classList.toggle("sel", k === id));
  if (id) { const p = personas.get(id); objetivo = { t: new THREE.Vector3(p.grupo.position.x, 1, p.grupo.position.z), zoom: 2.2, hasta: performance.now() + 1800 }; }
  else objetivo = { t: CENTRO.clone(), zoom: 1, hasta: performance.now() + 1800 };
}
iniciarChat(); iniciarPipeline();
setAlElegir((id) => enfocar(id));

/* ===== Teclado, como en un juego: W A S D mover · Q E girar · Mayús rápido · R centrar · N nombres ===== */
const teclas = new Set();
const escribiendo = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.getElementById("pipeline").classList.contains("on");
addEventListener("keydown", (e) => {
  if (escribiendo() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === "KeyN") return cambiarModo();
  if (e.code === "KeyR") { camara.position.copy(CENTRO).add(new THREE.Vector3(46, 40, 46)); controles.target.copy(CENTRO); camara.zoom = 1; camara.updateProjectionMatrix(); enfocar(null); return; }
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) { teclas.add(e.code); e.preventDefault(); }
});
addEventListener("keyup", (e) => setTimeout(() => teclas.delete(e.code), 90));   // un toque corto también cuenta
addEventListener("blur", () => teclas.clear());
const f = new THREE.Vector3(), r = new THREE.Vector3(), delta = new THREE.Vector3();
const lim = (v, a, b) => Math.min(b, Math.max(a, v));
function moverCamara(dt, shift) {
  const k = (...c) => c.some((x) => teclas.has(x));
  const ax = (k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0), az = (k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0), giro = (k("KeyE") ? 1 : 0) - (k("KeyQ") ? 1 : 0);
  if (ax || az) {
    objetivo.hasta = 0;
    f.subVectors(controles.target, camara.position); f.y = 0; f.normalize(); r.set(-f.z, 0, f.x);
    delta.set(0, 0, 0).addScaledVector(r, ax).addScaledVector(f, az).normalize().multiplyScalar((shift ? 2.4 : 1) * 24 / camara.zoom * dt);
    const nuevo = controles.target.clone().add(delta); nuevo.x = lim(nuevo.x, -6, 54); nuevo.z = lim(nuevo.z, -18, 38);
    delta.subVectors(nuevo, controles.target); controles.target.add(delta); camara.position.add(delta);
  }
  if (giro) {
    objetivo.hasta = 0; const o = camara.position.clone().sub(controles.target), a = -giro * dt * 1.5 * (shift ? 1.8 : 1), c = Math.cos(a), s = Math.sin(a);
    camara.position.set(controles.target.x + o.x * c - o.z * s, camara.position.y, controles.target.z + o.x * s + o.z * c);
  }
}

/* ===== Clic y paso del ratón sobre las personas ===== */
const rayo = new THREE.Raycaster(), ptr = new THREE.Vector2(); let abajo = null;
function bajo(ev) {
  const rc = lienzo.getBoundingClientRect(); ptr.set(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1);
  rayo.setFromCamera(ptr, camara);
  const hit = rayo.intersectObjects([...personas.values()].filter((p) => p.zona.userData.id).map((p) => p.zona))[0];
  return hit ? hit.object.userData.id : null;
}
lienzo.addEventListener("pointerdown", (e) => { abajo = { x: e.clientX, y: e.clientY }; lienzo.focus(); });
lienzo.addEventListener("pointerup", (e) => {
  if (abajo && Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) < 5) {
    const id = bajo(e);
    if (id && id !== "_jefe") { elegirChat(id, false); enfocar(id); } else enfocar(id === interaccion.seleccionado ? null : id);
  }
  abajo = null;
});
lienzo.addEventListener("pointermove", (e) => { interaccion.hover = bajo(e); lienzo.style.cursor = interaccion.hover ? "pointer" : "grab"; });

/* ===== Sincronía con el servidor ===== */
let cursor = 0, primera = true;
async function sondear() {
  try {
    const j = await (await fetch(API_BASE + "/estado?desde=" + cursor)).json();
    personas.forEach((p, id) => { const a = j.agentes[id]; const t = !!a; if (p.trabajando !== t) marcarTrabajo(id, t); p.trabajando = t; if (a) p.tarea = a.tarea; });
    if (primera) { primera = false; } else j.eventos.forEach((ev) => { aFeed(ev); animar(ev); });
    cursor = j.ultimo;
  } catch (e) { /* servidor apagado: la vista queda quieta */ }
  setTimeout(sondear, 1000);
}

/* ===== Animación ===== */
const reloj = new THREE.Clock();
function bucle() {
  const dt = Math.min(reloj.getDelta(), .05), t = reloj.elapsedTime, ahora = performance.now();
  actualizarGente(t, dt, ahora); actualizarMundo(t, dt, ahora);
  moverCamara(dt, teclas.has("ShiftLeft") || teclas.has("ShiftRight") || shiftAbajo);
  if (ahora < objetivo.hasta) { controles.target.lerp(objetivo.t, .07); camara.zoom += (objetivo.zoom - camara.zoom) * .07; camara.updateProjectionMatrix(); }
  controles.update(); renderer.render(scene, camara); visibilidadEtiquetas(ahora); colocarEtiquetas();
  requestAnimationFrame(bucle);
}
let shiftAbajo = false;
addEventListener("keydown", (e) => { if (e.key === "Shift") shiftAbajo = true; }); addEventListener("keyup", (e) => { if (e.key === "Shift") shiftAbajo = false; });
window.oficina = { controles, camara, teclas, personas };   // para revisar la vista desde la consola del navegador
sondear(); bucle();
