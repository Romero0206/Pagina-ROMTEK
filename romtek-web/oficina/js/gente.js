import { THREE, scene, caja, esfera, mat, C, silla, escritorio, camino, puntoLibre, etiqueta, viaje } from "./escena.js";
import { SALAS, JEFE, DESPACHO } from "./datos.js";
const CX = DESPACHO.x + DESPACHO.w / 2;

export const personas = new Map();   // id -> persona (agentes, el jefe y la recepcionista)
const camisa = (p) => p.traje ?? C.marino;

/* ===== Una persona con piernas, brazos que teclean o caminan, y carpeta en la mano ===== */
function persona(p, px, pz, giro = 0) {
  const g = new THREE.Group(); g.position.set(px, 0, pz); g.rotation.y = giro; scene.add(g);   // mira hacia -z
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  caja(.55, .6, .32, camisa(p), 0, 1.0, 0, cuerpo);
  if (p.traje) {
    caja(.24, .52, .02, 0xf4f6f8, 0, 1.02, -.165, cuerpo);                                   // camisa blanca
    caja(.07, .42, .02, p.corbata ?? C.electrico, 0, .98, -.18, cuerpo);                      // corbata
    [-1, 1].forEach((s) => { const sol = caja(.1, .5, .03, camisa(p), s * .13, 1.02, -.17, cuerpo); sol.rotation.z = s * .12; });
    if (p.pano) caja(.06, .05, .02, 0xf4f6f8, .17, 1.2, -.175, cuerpo);                       // pañuelo de bolsillo
  }
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.5, 0); cuerpo.add(cabeza);
  esfera(.19, p.piel, 0, 0, 0, cabeza); esfera(.2, p.pelo, 0, .05, .04, cabeza);
  if (p.largo) caja(.4, .42, .16, p.pelo, 0, -.1, .14, cabeza);
  const brazos = [-1, 1].map((s) => { const b = new THREE.Group(); b.position.set(s * .33, 1.22, -.02); cuerpo.add(b);
    caja(.14, .5, .14, camisa(p), 0, -.22, -.1, b); esfera(.08, p.piel, 0, -.48, -.1, b); return b; });
  const piernas = [-1, 1].map((s) => { const m = new THREE.Group(); m.position.set(s * .15, .68, 0); cuerpo.add(m);
    caja(.17, .44, .17, p.traje ? camisa(p) : C.oscuro, 0, -.22, 0, m);
    const r = new THREE.Group(); r.position.set(0, -.44, 0); m.add(r);
    caja(.16, .44, .16, p.traje ? camisa(p) : C.oscuro, 0, -.22, 0, r); caja(.18, .08, .26, 0x10151c, 0, -.46, -.05, r); return { m, r }; });
  const carpeta = new THREE.Group(); carpeta.position.set(.3, .9, -.45); carpeta.visible = false; cuerpo.add(carpeta);
  caja(.34, .05, .44, 0x4db3ff, 0, 0, 0, carpeta, { emissive: 0x4db3ff, emissiveIntensity: 1.5 });
  const anillo = new THREE.Mesh(new THREE.RingGeometry(.7, .85, 40), new THREE.MeshBasicMaterial({ color: 0x22a15b, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.set(0, .13, -.2); g.add(anillo);
  const zona = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 1.9, 8), new THREE.MeshBasicMaterial({ visible: false }));
  zona.position.y = 1; zona.userData.id = p.id; g.add(zona);
  return { datos: p, grupo: g, cuerpo, cabeza, brazos, piernas, carpeta, anillo, zona, pantalla: null, trabajando: false, tarea: "", fase: Math.random() * 6,
    silla: new THREE.Vector3(px, 0, pz), giroSilla: giro, lev: 0, levObj: 0, mov: null, giroObj: null, cam: false, lleva: false, espera: false,
    ubic: "silla", pend: 0, cadena: Promise.resolve(), habla: null, posEtq: new THREE.Vector3(), escritorio: new THREE.Vector3(),
    cima() { return this.grupo.position.clone().add(new THREE.Vector3(0, 2.3 + .32 * this.lev, 0)); } };
}

function ponerEtiqueta(p, esJefe) {
  const d = etiqueta('<span class="burbuja"></span><span class="nombre"><i class="punto"></i></span>', "etq-agente" + (esJefe ? " jefe" : ""), p.posEtq);
  d.querySelector(".nombre").append(p.datos.nombre); p.etq = d; p.burbuja = d.querySelector(".burbuja");
}

export function crearPersonas() {
  SALAS.forEach((r) => {
    const n = r.agentes.length;
    r.agentes.forEach((a, i) => {
      const dx = r.x + (r.w / n) * (i + .5), dz = r.z + r.d * .38;
      const pantalla = new THREE.MeshStandardMaterial({ color: 0x0e2a55, emissive: 0x2a8bff, emissiveIntensity: .25, roughness: .3 });
      escritorio(dx, dz, pantalla); silla(dx, dz + 1.35, 0, C.marino);
      const pr = persona(a, dx, dz + 1.3); pr.pantalla = pantalla; pr.escritorio.set(dx, 0, dz); personas.set(a.id, pr); ponerEtiqueta(pr);
    });
  });
  const j = persona(JEFE, CX, 2.5, Math.PI); j.escritorio.set(CX, 0, 3.7); personas.set(JEFE.id, j); ponerEtiqueta(j, true);
  const r = persona({ id: "_recepcion", nombre: "Recepción", piel: 0xe3b48c, pelo: 0x2b1a12, largo: true }, 5.6, 4.9);
  r.lev = r.levObj = 1; r.ubic = "recepcion"; r.zona.userData.id = null; personas.set("_recepcion", r);
}

/* ===== Movimiento (paso a paso por el mapa de obstáculos) ===== */
const V = (x, z) => new THREE.Vector3(x, 0, z);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const moverA = (p, v) => new Promise((res) => { p.mov = { v, res }; });
const irA = async (p, destino) => { for (const w of camino(p.grupo.position, destino)) await moverA(p, w); };
const girarA = (p, ang) => { p.giroObj = ang; return esperar(350); };
const mirarA = (p, v) => girarA(p, Math.atan2(-(v.x - p.grupo.position.x), -(v.z - p.grupo.position.z)));
const encolar = (p, fn) => { p.cadena = p.cadena.then(fn).catch(console.error); };
export const habla = (p, txt, ms = 2500) => { if (p) p.habla = { txt, hasta: performance.now() + ms }; };
const levantar = async (p) => { p.levObj = 1; await esperar(450); };
const sentar = async (p) => { await irA(p, p.silla); await girarA(p, p.giroSilla); p.levObj = 0; await esperar(500); p.ubic = "silla"; };
const hasta = async (cond, ms) => { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms) await esperar(200); };
const pasar = (de, a) => viaje(de.cima(), a.cima(), 0xffffff, .8, 1.2);
const primero = (p) => p.datos.nombre.split(" ")[0];
const get = (id) => personas.get(id);

/* Junto al escritorio de cada persona (a un lado), siempre en una celda libre */
const visita = (p, lado = 1) => puntoLibre(p.escritorio.x + lado * 1.9, p.escritorio.z + .9);
const junto = (id) => { const p = get(id); return visita(p, p.escritorio.x < 20 ? 1 : -1); };

function entrante(ev) {
  const h = get("romtek");
  if (ev.de === "_jefe") { const j = get("_jefe"); habla(j, "Harvey, tengo un encargo", 2800); viaje(j.cima(), h.cima(), 0xffd166, 1.4); habla(h, "Enseguida, jefe", 2800); return; }
  const r = get("_recepcion");
  encolar(r, async () => {
    r.lleva = true; habla(r, "Mensaje para Harvey", 2500);
    await irA(r, visita(h, -1)); await mirarA(r, h.grupo.position); pasar(r, h); await esperar(700);
    r.lleva = false; habla(h, "Recibido, lo reviso", 3000);
    await irA(r, r.silla); await girarA(r, 0);
  });
}
let reportesPend = 0;
function delegar(ev) {
  const h = get("romtek"), ag = get(ev.a);
  if (!ag || !ag.escritorio) return;
  ag.espera = true; h.pend++;
  encolar(h, async () => {
    habla(h, "Le paso el encargo a " + primero(ag), 4000);
    if (h.ubic === "silla") await levantar(h);
    h.lleva = true;
    await irA(h, junto(ev.a)); h.ubic = ev.a;
    await mirarA(h, ag.grupo.position); pasar(h, ag); await esperar(800);
    h.lleva = false; ag.espera = false; habla(ag, "Recibido", 1800); h.pend--;
    if (h.pend === 0) await sentar(h);
  });
}
function reportar(ev) {
  const ag = get(ev.de), h = get("romtek");
  if (!ag || !ag.escritorio) return;
  reportesPend++;
  encolar(ag, async () => {
    await hasta(() => !ag.espera, 30000);
    habla(ag, "Llevo mi informe a Harvey", 3500); await levantar(ag); ag.lleva = true;
    await irA(ag, visita(h, 1));
    await hasta(() => h.ubic === "silla" && h.pend === 0, 15000);
    await mirarA(ag, h.grupo.position); pasar(ag, h); await esperar(800);
    ag.lleva = false; reportesPend--; habla(h, "Gracias, " + primero(ag), 2500);
    await sentar(ag);
  });
}
function entregar() {
  const h = get("romtek"), j = get("_jefe");
  encolar(h, async () => {
    await hasta(() => reportesPend === 0 && h.pend === 0, 60000);
    habla(h, "Sebastian, el informe está listo", 3000);
    if (h.ubic === "silla") await levantar(h);
    h.lleva = true; await irA(h, puntoLibre(CX, 6.3)); h.ubic = "jefe";
    await mirarA(h, j.grupo.position); pasar(h, j); await esperar(900);
    h.lleva = false; habla(j, "Gracias, Harvey", 3000);
    await esperar(900); await sentar(h);
  });
}
export function animar(ev) {
  const j = get("_jefe");
  if (ev.tipo === "entrada") entrante(ev);
  else if (ev.tipo === "delega") delegar(ev);
  else if (ev.tipo === "reporta") reportar(ev);
  else if (ev.tipo === "entrega") entregar();
  else if (ev.tipo === "chat" && get(ev.a)) { habla(j, "Una consulta para " + primero(get(ev.a)), 2500); viaje(j.cima(), get(ev.a).cima(), 0xffd166, 1.4); }
  else if (ev.tipo === "chatfin" && get(ev.de)) { viaje(get(ev.de).cima(), j.cima(), 0x6ee7a1, 1.4); habla(j, "Gracias, " + primero(get(ev.de)), 2500); }
}

/* ===== Cuadro a cuadro ===== */
const dif = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
export const interaccion = { hover: null, seleccionado: null };
export function actualizarGente(t, dt, ahora) {
  personas.forEach((p) => {
    const g = p.grupo, trab = p.trabajando && !p.espera && p.datos.id !== "_recepcion";
    p.lev += (p.levObj - p.lev) * Math.min(1, dt * 6);
    p.cam = false;
    if (p.mov) {
      const d = p.mov.v.clone().sub(g.position); d.y = 0; const l = d.length();
      if (l < .08) { const r = p.mov.res; p.mov = null; r(); }
      else { g.position.addScaledVector(d, Math.min(l, 2.6 * dt) / l); p.cam = true; p.fase += dt * 8;
        g.rotation.y += dif(g.rotation.y, Math.atan2(-d.x, -d.z)) * Math.min(1, dt * 10); }
    } else if (p.giroObj !== null) g.rotation.y += dif(g.rotation.y, p.giroObj) * Math.min(1, dt * 8);
    const sentado = 1 - p.lev, sw = p.cam ? Math.sin(p.fase) * .7 : 0;
    p.cuerpo.position.y = .32 * p.lev + Math.sin(t * 1.6 + p.fase) * .008 * sentado + (p.cam ? Math.abs(Math.sin(p.fase)) * .04 : 0);
    p.piernas.forEach(({ m, r }, i) => { const sg = i ? -1 : 1, base = sentado * Math.PI / 2, sp = sg * sw * p.lev;
      m.rotation.x = base + sp; r.rotation.x = -base - Math.max(0, sp) * .9; });
    p.cabeza.rotation.y = p.cam ? 0 : Math.sin(t * .5 + p.fase) * (trab ? .12 : .35); p.cabeza.rotation.x = trab && sentado > .5 ? -.18 : 0;
    p.brazos.forEach((b, i) => {
      const tecleo = -1.1 + (trab && sentado > .5 ? Math.sin(t * 14 + i * 1.7 + p.fase) * .13 : Math.sin(t * .9 + p.fase) * .02);
      const pie = p.lleva && i === 1 ? -.95 : p.cam ? (i ? 1 : -1) * sw * .8 * -1 : Math.sin(t * .9 + p.fase) * .02;
      b.rotation.x = tecleo * sentado + pie * p.lev;
    });
    p.carpeta.visible = p.lleva;
    if (p.pantalla) p.pantalla.emissiveIntensity += ((trab && sentado > .5 ? 1.1 + Math.sin(t * 7 + p.fase) * .35 : .25) - p.pantalla.emissiveIntensity) * .15;
    p.anillo.material.opacity += ((trab ? .55 + Math.sin(t * 4) * .3 : (interaccion.hover === p.datos.id || interaccion.seleccionado === p.datos.id) ? .5 : 0) - p.anillo.material.opacity) * .2;
    p.anillo.material.color.set(trab ? 0x22a15b : 0x007bff);
    p.posEtq.copy(g.position); p.posEtq.y = 2.9 + .32 * p.lev;
    if (p.etq) {
      p.etq.classList.toggle("trabajando", trab);
      const dicho = p.habla && ahora < p.habla.hasta ? p.habla.txt : trab ? (p.tarea.length > 70 ? p.tarea.slice(0, 68) + "…" : p.tarea) : "";
      p.burbuja.classList.toggle("on", !!dicho); if (dicho) p.burbuja.textContent = dicho;
    }
  });
}
