import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { EDIFICIO, SALAS, RECEPCION, DESPACHO, JUNTAS, PLAZA, CAFE } from "./datos.js";

export { THREE };

/* ===== Escena, cámara y luces ===== */
export const lienzo = document.getElementById("lienzo");
export const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
const MOVIL = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio, MOVIL ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene();

export const CENTRO = new THREE.Vector3(EDIFICIO.w / 2, 0, EDIFICIO.d / 2 - 5);
export const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 600);
camara.position.copy(CENTRO).add(new THREE.Vector3(46, 40, 46));
export const controles = new OrbitControls(camara, lienzo);
controles.target.copy(CENTRO); controles.enableDamping = true; controles.dampingFactor = 0.08;
controles.maxPolarAngle = 1.15; controles.minPolarAngle = 0.5;
controles.enableRotate = true;
controles.minZoom = 0.6; controles.maxZoom = 3.4; controles.screenSpacePanning = true;
controles.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0xaebfd8, 1.0));
const sol = new THREE.DirectionalLight(0xfff4e6, 1.9);
sol.position.set(CENTRO.x - 22, 52, CENTRO.z - 16); sol.target.position.copy(CENTRO); scene.add(sol, sol.target);
sol.castShadow = true; sol.shadow.mapSize.set(MOVIL ? 2048 : 4096, MOVIL ? 2048 : 4096); sol.shadow.bias = -0.0003; sol.shadow.normalBias = 0.03;
Object.assign(sol.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 140 });

/* ===== Materiales y ayudas ===== */
export const C = { marino: 0x0b2d5b, electrico: 0x007bff, blanco: 0xf4f6f8, madera: 0xcb9f69, nogal: 0x5a3a24, suelo: 0xefe7d8, gris: 0x7d8a9c, verde: 0x3f8f4f, oscuro: 0x1f2937, dorado: 0xc9a24a };
const mats = new Map();
export const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: .72, metalness: 0, ...o })); return mats.get(k); };
export function caja(w, h, d, c, x, y, z, padre = scene, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o instanceof THREE.Material ? o : mat(c, o));
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; padre.add(m); return m;
}
export function cilindro(rt, rb, h, c, x, y, z, padre = scene, seg = 24, o) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, o));
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; padre.add(m); return m;
}
export function esfera(r, c, x, y, z, padre = scene, o) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat(c, o)); m.position.set(x, y, z); m.castShadow = true; padre.add(m); return m;
}
function plano(w, d, c, x, y, z, padre = scene, o) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), o instanceof THREE.Material ? o : mat(c, o));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; padre.add(m); return m;
}
function lienzoTexto(w, h, dibujar) {   // textura dibujada con canvas; se redibuja cuando cargan las fuentes
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const pintar = () => { const g = cv.getContext("2d"); g.clearRect(0, 0, w, h); dibujar(g, w, h); tex.needsUpdate = true; };
  pintar(); document.fonts.load('700 40px "Montserrat"').then(() => document.fonts.load('600 40px "Inter"')).then(pintar);
  return tex;
}

/* ===== Mapa de obstáculos y búsqueda de caminos (A*) ===== */
const CELDA = 0.4, COLS = Math.ceil(EDIFICIO.w / CELDA), FILAS = Math.ceil(EDIFICIO.d / CELDA);
const libre = new Uint8Array(COLS * FILAS).fill(1);
for (let i = 0; i < COLS; i++) for (let j = 0; j < FILAS; j++) if (i < 1 || j < 1 || i >= COLS - 1 || j >= FILAS - 1) libre[j * COLS + i] = 0;
export function bloquear(cx, cz, w, d, margen = 0.3) {
  const x0 = Math.floor((cx - w / 2 - margen) / CELDA), x1 = Math.floor((cx + w / 2 + margen) / CELDA);
  const z0 = Math.floor((cz - d / 2 - margen) / CELDA), z1 = Math.floor((cz + d / 2 + margen) / CELDA);
  for (let i = Math.max(x0, 0); i <= Math.min(x1, COLS - 1); i++) for (let j = Math.max(z0, 0); j <= Math.min(z1, FILAS - 1); j++) libre[j * COLS + i] = 0;
}
const celda = (v) => [Math.min(COLS - 1, Math.max(0, Math.floor(v.x / CELDA))), Math.min(FILAS - 1, Math.max(0, Math.floor(v.z / CELDA)))];
const esLibre = (i, j) => i >= 0 && j >= 0 && i < COLS && j < FILAS && libre[j * COLS + i] === 1;
function celdaLibreCerca(i, j) {
  for (let r = 0; r < 12; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++)
    if (Math.max(Math.abs(di), Math.abs(dj)) === r && esLibre(i + di, j + dj)) return [i + di, j + dj];
  return [i, j];
}
export const puntoLibre = (x, z) => { const [i, j] = celdaLibreCerca(...celda({ x, z })); return new THREE.Vector3((i + .5) * CELDA, 0, (j + .5) * CELDA); };
const centro = (i, j) => new THREE.Vector3((i + .5) * CELDA, 0, (j + .5) * CELDA);
function lineaLibre(a, b) {
  const n = Math.ceil(a.distanceTo(b) / 0.15);
  for (let k = 0; k <= n; k++) { const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n; if (!esLibre(Math.floor(x / CELDA), Math.floor(z / CELDA))) return false; }
  return true;
}
export function camino(desde, hasta) {
  const [si, sj] = celdaLibreCerca(...celda(desde)), [ti, tj] = celdaLibreCerca(...celda(hasta));
  const g = new Float32Array(COLS * FILAS).fill(Infinity), prev = new Int32Array(COLS * FILAS).fill(-1), cerrado = new Uint8Array(COLS * FILAS);
  const abierto = [[0, sj * COLS + si]]; g[sj * COLS + si] = 0;
  const h = (i, j) => Math.hypot(i - ti, j - tj);
  const subir = (k) => { while (k > 0) { const p = (k - 1) >> 1; if (abierto[p][0] <= abierto[k][0]) break; [abierto[p], abierto[k]] = [abierto[k], abierto[p]]; k = p; } };
  const bajar = (k) => { for (;;) { let m = k; const l = 2 * k + 1, r = l + 1; if (l < abierto.length && abierto[l][0] < abierto[m][0]) m = l; if (r < abierto.length && abierto[r][0] < abierto[m][0]) m = r; if (m === k) break; [abierto[m], abierto[k]] = [abierto[k], abierto[m]]; k = m; } };
  let fin = -1;
  while (abierto.length) {
    const [, n] = abierto[0], ult = abierto.pop(); if (abierto.length) { abierto[0] = ult; bajar(0); }
    if (cerrado[n]) continue; cerrado[n] = 1;
    const i = n % COLS, j = (n / COLS) | 0;
    if (i === ti && j === tj) { fin = n; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const a = i + di, b = j + dj;
      if (!esLibre(a, b) || (di && dj && (!esLibre(i + di, j) || !esLibre(i, j + dj)))) continue;
      const k = b * COLS + a, c = g[n] + (di && dj ? 1.414 : 1);
      if (c < g[k]) { g[k] = c; prev[k] = n; abierto.push([c + h(a, b), k]); subir(abierto.length - 1); }
    }
  }
  if (fin < 0) return [hasta.clone()];
  const celdas = []; for (let n = fin; n >= 0; n = prev[n]) celdas.push(centro(n % COLS, (n / COLS) | 0));
  celdas.reverse(); const pts = [desde.clone().setY(0), ...celdas.slice(1, -1), hasta.clone().setY(0)];
  const out = []; let k = 0;                                  // suavizado: saltar a lo más lejos que se vea
  while (k < pts.length - 1) { let m = pts.length - 1; while (m > k + 1 && !lineaLibre(pts[k], pts[m])) m--; out.push(pts[m]); k = m; }
  return out;
}

/* ===== Mobiliario ===== */
export function planta(x, z, s = 1, bloq = true) {
  cilindro(.28 * s, .22 * s, .5 * s, C.blanco, x, .35 * s, z);
  [[0, 0, 0], [.14, .08, .08], [-.12, .05, -.1], [.02, .22, -.12]].forEach(([dx, dy, dz], i) => esfera((.3 - i * .03) * s, i % 2 ? 0x4c9a5a : C.verde, x + dx * s, (.9 + dy) * s, z + dz * s));
  if (bloq) bloquear(x, z, .6 * s, .6 * s, .1);
}
export function silla(x, z, giro = 0, c = C.marino) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = giro; scene.add(g);
  cilindro(.05, .05, .4, C.gris, 0, .3, 0, g); cilindro(.32, .32, .04, C.gris, 0, .1, 0, g);
  caja(.55, .1, .55, c, 0, .55, 0, g); caja(.55, .62, .09, c, 0, .92, .3, g);
}
export function escritorio(x, z, pantalla) {
  caja(2.6, .07, 1.1, C.madera, x, .78, z); caja(.08, .72, 1, C.blanco, x - 1.2, .4, z); caja(.08, .72, 1, C.blanco, x + 1.2, .4, z);
  caja(2.4, .5, .05, C.blanco, x, .5, z - .5); caja(.1, .3, .1, C.oscuro, x, .97, z - .15);
  caja(1.1, .62, .05, C.oscuro, x, 1.38, z - .17);
  const pant = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .52), pantalla); pant.position.set(x, 1.38, z - .17 + .03); scene.add(pant);
  caja(.7, .03, .24, C.blanco, x, .83, z + .25); bloquear(x, z, 2.6, 1.1);
}
export function sofa(x, z, w = 3, giro = 0, c = C.marino, bloq = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = giro; scene.add(g);
  caja(w, .45, 1.1, c, 0, .35, 0, g); caja(w, .75, .3, c, 0, .75, -.45, g);
  caja(.3, .6, 1.1, c, -w / 2 + .15, .55, 0, g); caja(.3, .6, 1.1, c, w / 2 - .15, .55, 0, g);
  if (bloq) { const c1 = Math.abs(Math.cos(giro)), s1 = Math.abs(Math.sin(giro)); bloquear(x, z, w * c1 + 1.1 * s1, w * s1 + 1.1 * c1, .15); }
}
export function estante(x, z, w = 2.2, giro = 0, alto = 1.9) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = giro; scene.add(g);
  caja(w, alto, .45, C.madera, 0, alto / 2, 0, g);
  for (let y = .45; y < alto - .2; y += .55) for (let k = 0; k < Math.floor(w / .45); k++)
    caja(.22, .38, .3, [C.marino, C.electrico, 0xdfe5ee, C.gris, 0x123e78][(k + Math.round(y * 3)) % 5], -w / 2 + .35 + k * .42, y + .13, .08, g);
  const c1 = Math.abs(Math.cos(giro)), s1 = Math.abs(Math.sin(giro)); bloquear(x, z, w * c1 + .45 * s1, w * s1 + .45 * c1, .15);
}
function mesaRedonda(x, z, r = 1.15, sillas = 6) {
  const t = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), mat(0x9fb2cc)); t.rotation.x = -Math.PI / 2; t.position.set(x, .13, z); t.receiveShadow = true; scene.add(t);
  cilindro(r, r, .06, C.madera, x, .82, z); cilindro(.1, .1, .75, C.gris, x, .42, z);
  for (let i = 0; i < sillas; i++) { const a = i * Math.PI * 2 / sillas + .4; silla(x + Math.cos(a) * (r + .75), z + Math.sin(a) * (r + .75), -a - Math.PI / 2 + Math.PI); }
  bloquear(x, z, r * 2, r * 2, .15);
}
function vidrio(x1, z1, x2, z2, puerta, alto = 2.5) {
  const largo = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
  const tramo = (a, b) => {
    const cx = x1 + (x2 - x1) * (a + b) / 2, cz = z1 + (z2 - z1) * (a + b) / 2, l = largo * (b - a);
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = -ang; scene.add(g);
    const v = caja(l, alto, 0.06, 0, 0, alto / 2 + .1, 0, g, new THREE.MeshPhysicalMaterial({ color: 0xa6d8ee, transparent: true, opacity: 0.2, roughness: .05, metalness: 0, transmission: 0 }));
    v.castShadow = false;
    caja(l, 0.1, 0.12, C.blanco, 0, alto + .15, 0, g); caja(l, 0.14, 0.12, C.marino, 0, 0.17, 0, g);
    caja(0.1, alto + .1, 0.12, C.blanco, -l / 2, alto / 2 + .1, 0, g); caja(0.1, alto + .1, 0.12, C.blanco, l / 2, alto / 2 + .1, 0, g);
    if (Math.abs(x2 - x1) < .01) bloquear(cx, cz, .3, l, .15); else bloquear(cx, cz, l, .3, .15);
  };
  if (puerta) { tramo(0, 0.38); tramo(0.62, 1); } else tramo(0, 1);
}

/* ===== Porsche 911 (cupé fastback con caderas anchas, cristales, escapes y llantas de 5 radios) ===== */
function porsche(color = 0x2f9be0) {
  const g = new THREE.Group();
  const pintura = new THREE.MeshPhysicalMaterial({ color, metalness: .6, roughness: .2, clearcoat: 1, clearcoatRoughness: .05 });
  const negro = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: .4, metalness: .3 });
  const cristal = new THREE.MeshPhysicalMaterial({ color: 0x0a1119, metalness: .9, roughness: .05 });
  const cromo = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, metalness: 1, roughness: .12 });
  const perfil = new THREE.Shape();
  perfil.moveTo(0.05, 0.22); perfil.lineTo(0.0, 0.5);
  perfil.bezierCurveTo(0.0, 0.78, 0.25, 0.92, 0.6, 0.98);
  perfil.bezierCurveTo(1.0, 1.04, 1.35, 1.22, 1.75, 1.31);
  perfil.bezierCurveTo(2.05, 1.35, 2.35, 1.33, 2.55, 1.25);
  perfil.bezierCurveTo(2.85, 1.12, 3.1, 0.98, 3.45, 0.9);
  perfil.bezierCurveTo(3.9, 0.84, 4.25, 0.78, 4.42, 0.6);
  perfil.bezierCurveTo(4.5, 0.52, 4.52, 0.4, 4.47, 0.3);
  perfil.lineTo(4.4, 0.22); perfil.lineTo(0.05, 0.22);
  const ext = new THREE.ExtrudeGeometry(perfil, { depth: 1.4, bevelEnabled: true, bevelSize: .17, bevelThickness: .17, bevelSegments: 5, curveSegments: 28 });
  ext.translate(0, 0, -.7);
  const cuerpo = new THREE.Mesh(ext, pintura); cuerpo.castShadow = cuerpo.receiveShadow = true; g.add(cuerpo);
  const elip = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 22), pintura); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
  [-1, 1].forEach((s) => { elip(.98, .3, .34, 1.0, .72, s * .62); elip(.8, .21, .3, 3.5, .74, s * .62); });          // caderas traseras y aletas delanteras
  const quad = (a, b, c, d) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); geo.computeVertexNormals(); return new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x0a1119, metalness: .9, roughness: .05, side: THREE.DoubleSide })); };
  g.add(quad([3.4, .945, -.62], [3.4, .945, .62], [2.62, 1.275, .54], [2.62, 1.275, -.54]));                           // parabrisas
  g.add(quad([1.15, 1.16, -.62], [1.15, 1.16, .62], [1.8, 1.335, .52], [1.8, 1.335, -.52]));                           // luneta
  const vent = new THREE.Shape(); vent.moveTo(1.3, 1.14); vent.lineTo(1.82, 1.3); vent.lineTo(2.5, 1.245); vent.lineTo(3.2, .965); vent.lineTo(2.45, .94); vent.closePath();
  [-1, 1].forEach((s) => { const v = new THREE.Mesh(new THREE.ExtrudeGeometry(vent, { depth: .03, bevelEnabled: false }), cristal); v.position.z = s > 0 ? .9 : -.93; g.add(v);
    caja(.16, .035, .05, 0, 2.3, .98, s * .91, g, cromo);                                                                // manija
    const esp = caja(.2, .12, .16, 0, 3.05, 1.04, s * 1.0, g, pintura); esp.castShadow = true; });
  [[.95], [3.5]].forEach(([x]) => [-1, 1].forEach((s) => {
    const rueda = new THREE.Group(); rueda.position.set(x, .37, s * .86); rueda.rotation.x = Math.PI / 2; g.add(rueda);
    const llanta = new THREE.Mesh(new THREE.CylinderGeometry(.37, .37, .28, 32), mat(0x14171c, { roughness: .9 })); llanta.castShadow = true; rueda.add(llanta);
    rueda.add(new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .3, 28), cromo));
    for (let k = 0; k < 5; k++) { const rad = new THREE.Mesh(new THREE.BoxGeometry(.07, .3, .5), negro); rad.rotation.y = k * Math.PI * 2 / 5; rueda.add(rad); }
    rueda.add(new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .32, 14), mat(C.dorado, { metalness: .9, roughness: .25 })));
    const pinza = new THREE.Mesh(new THREE.BoxGeometry(.14, .06, .22), mat(0xd62828)); pinza.position.set(.17, s * -.17 * 0, 0); rueda.add(pinza);
    const arco = new THREE.Mesh(new THREE.RingGeometry(.39, .5, 32), new THREE.MeshBasicMaterial({ color: 0x05080d, side: THREE.DoubleSide })); arco.position.set(x, .37, s * .885); g.add(arco);
  }));
  [-1, 1].forEach((s) => {
    const faro = new THREE.Mesh(new THREE.SphereGeometry(.15, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c4, emissiveIntensity: 2 }));
    faro.position.set(4.38, .72, s * .6); faro.scale.set(.6, .9, 1); g.add(faro);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(.16, .018, 10, 28), cromo); aro.position.set(4.4, .72, s * .6); aro.rotation.y = Math.PI / 2; aro.scale.set(1, .9, 1); g.add(aro);
    caja(.1, .06, .1, 0, 4.47, .36, s * .72, g, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe6a0, emissiveIntensity: 1.4 }));      // antiniebla
    const esc = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .2, 14), cromo); esc.rotation.z = Math.PI / 2; esc.position.set(-.22, .3, s * .38); g.add(esc);
  });
  caja(.1, .14, 1.05, 0, 4.5, .36, 0, g, negro);                                                                          // toma de aire delantera
  caja(.06, .13, 1.0, 0, -.1, .71, 0, g, negro);                                                                          // rejilla del motor
  caja(.06, .09, 1.18, 0, -.1, .6, 0, g, new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 2.6 }));
  caja(.52, .06, 1.3, 0, .12, .95, 0, g, pintura);                                                                        // cola de pato
  caja(4.3, .08, 1.4, 0, 2.2, .2, 0, g, negro);                                                                           // bajos
  const placa = lienzoTexto(256, 128, (c, w, h) => { c.fillStyle = "#f4f6f8"; c.fillRect(0, 0, w, h); c.strokeStyle = "#0b2d5b"; c.lineWidth = 6; c.strokeRect(5, 5, w - 10, h - 10); c.fillStyle = "#0b2d5b"; c.font = '700 54px "Montserrat",sans-serif'; c.textAlign = "center"; c.fillText("ROMTEK", w / 2, 82); });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(.5, .25), new THREE.MeshBasicMaterial({ map: placa })); pl.position.set(-.19, .43, 0); pl.rotation.y = -Math.PI / 2; g.add(pl);
  return g;
}
function cocheSimple(color, alto = 0.55, largo = 4.2) {      // vehículos de fondo para que el parqueadero se vea vivo
  const g = new THREE.Group(), p = new THREE.MeshPhysicalMaterial({ color, metalness: .5, roughness: .3, clearcoat: .8 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(largo, alto, 1.75), p); b.position.set(largo / 2, .35 + alto / 2, 0); b.castShadow = true; g.add(b);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(largo * .5, .46, 1.62), new THREE.MeshPhysicalMaterial({ color: 0x0f1822, metalness: .8, roughness: .1 })); cab.position.set(largo * .46, .35 + alto + .23, 0); cab.castShadow = true; g.add(cab);
  const techo = new THREE.Mesh(new THREE.BoxGeometry(largo * .46, .06, 1.58), p); techo.position.set(largo * .46, .35 + alto + .49, 0); techo.castShadow = true; g.add(techo);
  [[.85, 1], [largo - .85, 1]].forEach(([x]) => [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .26, 20), mat(0x14171c)); r.rotation.x = Math.PI / 2; r.position.set(x, .34, s * .82); g.add(r); }));
  return g;
}

/* ===== Mundo ===== */
const raiz = new THREE.Group(); scene.add(raiz);
export const animables = [];
const LED = (c = 0x7ec2ff, i = 2.4) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });

export function construirMundo() {
  const W = EDIFICIO.w, D = EDIFICIO.d, zMin = -14.6, zMax = D + 3.4;
  // base tipo maqueta: césped, edificio, parqueadero
  caja(W + 9, 1.0, zMax - zMin, C.marino, W / 2, -.52, (zMin + zMax) / 2);
  plano(W + 8.4, zMax - zMin - .6, 0x9ec8a4, W / 2, .0, (zMin + zMax) / 2);
  plano(W + 3, 2.8, 0xdadfe6, W / 2, .02, D + 2.0);
  plano(W + 1.2, D + 1.2, 0xefe7d8, W / 2, .03, D / 2);                                         // losa del edificio
  const suelo = lienzoTexto(1024, 1024, (c, w, h) => { c.fillStyle = "#f1e9da"; c.fillRect(0, 0, w, h); c.strokeStyle = "rgba(11,45,91,.07)"; c.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke(); } });
  suelo.wrapS = suelo.wrapT = THREE.RepeatWrapping; suelo.repeat.set(W / 4, D / 4);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: suelo, roughness: .5 }));
  piso.rotation.x = -Math.PI / 2; piso.position.set(W / 2, .06, D / 2); piso.receiveShadow = true; scene.add(piso);

  // ---------- parqueadero detrás del despacho del jefe ----------
  const px = 30.4, pw = W - px - .2, pz0 = -13.4, pz1 = -.7, xs = [33.9, 37.5, 41.1, 44.7], zc = -4.7;
  plano(pw, pz1 - pz0, 0x262b32, px + pw / 2, .05, (pz0 + pz1) / 2, scene, { roughness: .55, metalness: .1 });
  plano(pw, 1.0, 0xe6e9ee, px + pw / 2, .06, pz0 + .3);                                              // acera trasera
  caja(pw, .2, .3, 0xd6dbe2, px + pw / 2, .12, pz0);                                                 // bordillo
  for (let i = 0; i <= xs.length; i++) plano(.12, 6.0, 0xf1f3f6, i === 0 ? xs[0] - 1.8 : xs[i - 1] + 1.8, .07, zc - .3);
  plano(pw - 1.2, .12, 0xf1f3f6, px + pw / 2, .07, -1.1);
  plano(3.4, 5.9, 0x2a3647, xs[2], .075, zc - .3, scene, { roughness: .3, metalness: .25 });          // plaza del jefe
  [-1.7, 1.7].forEach((d) => plano(.08, 5.9, 0x7ec2ff, xs[2] + d, .09, zc - .3, scene, LED(0x4db3ff, 2.2)));
  plano(3.2, .08, 0x7ec2ff, xs[2], .09, zc - 3.3, scene, LED(0x4db3ff, 2.2));
  const cartel = lienzoTexto(256, 128, (c, w, h) => { c.fillStyle = "#0b2d5b"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a24a"; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = "#fff"; c.font = '700 30px "Montserrat",sans-serif'; c.textAlign = "center";
    c.fillText("RESERVADO", w / 2, 54); c.fillStyle = "#e2c677"; c.fillText("SEBASTIAN", w / 2, 96); });
  cilindro(.05, .05, 1.7, C.gris, xs[2] + 2.0, .85, zc - 5.2); const ct = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .55), new THREE.MeshBasicMaterial({ map: cartel })); ct.position.set(xs[2] + 2.0, 1.85, zc - 5.15); scene.add(ct);
  const coche = porsche(); coche.rotation.y = -Math.PI / 2 + .06; scene.add(coche);
  const cj = new THREE.Box3().setFromObject(coche), cen = cj.getCenter(new THREE.Vector3()); coche.position.set(xs[2] - cen.x, .08 - cj.min.y + .0, zc - cen.z);
  const suv = cocheSimple(0xe8ecf1, .75, 4.4); suv.rotation.y = -Math.PI / 2; scene.add(suv); suv.position.set(xs[0], .08, zc - 2.2);
  const sedan = cocheSimple(0x3b4452, .5, 4.3); sedan.rotation.y = -Math.PI / 2 - .04; scene.add(sedan); sedan.position.set(xs[3], .08, zc - 2.1);
  // marquesina de cristal sobre la plaza del jefe y cargador
  const marq = new THREE.MeshPhysicalMaterial({ color: 0xbfe3f5, transparent: true, opacity: .14, roughness: .05 });
  caja(3.9, .05, 6.6, 0, xs[2], 3.2, zc - .3, scene, marq).castShadow = false;
  [[-1.9, -3.4], [1.9, -3.4], [-1.9, 2.8], [1.9, 2.8]].forEach(([dx, dz]) => caja(.1, 3.2, .1, 0xdfe5ee, xs[2] + dx, 1.6, zc + dz));
  caja(3.9, .08, .1, 0, xs[2], 3.22, zc - 3.6, scene, LED(0x7ec2ff, 2.6));
  cilindro(.14, .16, 1.2, 0x1f2937, xs[2] - 2.6, .6, zc - 2.8); caja(.28, .3, .06, 0, xs[2] - 2.6, 1.0, zc - 2.67, scene, LED(0x4dffb0, 2.2));
  const foco = new THREE.SpotLight(0xdff0ff, 140, 16, .6, .5, 1.4); foco.position.set(xs[2] + 1.5, 6.5, zc + 3); foco.target.position.set(xs[2], .5, zc); scene.add(foco, foco.target);
  animables.push((t) => { foco.intensity = 135 + Math.sin(t * 1.3) * 8; });
  const lampara = (x, z) => { cilindro(.07, .09, 4.4, C.gris, x, 2.2, z); caja(1.0, .1, .38, 0, x, 4.45, z, scene, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 2 }));
    const l = new THREE.PointLight(0xfff0d0, 16, 11); l.position.set(x, 4.2, z + .3); scene.add(l); };
  lampara(px + 1.2, -11.4); lampara(W - 1.4, -11.4); lampara(39.3, -11.4);
  for (let i = 0; i < 9; i++) esfera(.5, 0x3f8f4f, px + 1.2 + i * 1.9, .6, pz0 + 1.5, scene).scale.set(1, .8, 1);   // seto
  const arbol = (x, z, s = 1) => { cilindro(.14 * s, .2 * s, 1.2 * s, 0x6b4a2f, x, .6 * s, z); [[0, 1.9, 0, 1.0], [.2, 2.6, .1, .75], [-.2, 3.1, -.1, .5]].forEach(([dx, y, dz, r]) => esfera(r * 1.15 * s, 0x4c9a5a, x + dx * s, y * s, z + dz * s)); };
  [[-1.5, -3], [-1.5, 12], [-1.5, 24], [W + 1.6, 14], [W + 1.6, 27], [27, -9], [20, -4], [8, -6], [3, -11], [14, -10]].forEach(([x, z], i) => arbol(x, z, .9 + (i % 3) * .1));
  for (let x = 6; x < W; x += 8) arbol(x, D + 3.0, .7);

  // ---------- paredes: altas al fondo y a la izquierda, bajas al frente y a la derecha ----------
  caja(DESPACHO.x, 3.5, 0.4, C.blanco, DESPACHO.x / 2, 1.75, -.2);
  caja(0.4, 3.5, D, C.blanco, -.2, 1.75, D / 2);
  caja(W, 0.7, 0.4, C.marino, W / 2, 0.35, D + .2); caja(0.4, 0.7, D, C.marino, W + .2, 0.35, D / 2);
  const cristalFondo = new THREE.MeshPhysicalMaterial({ color: 0x9bd3ee, transparent: true, opacity: .16, roughness: .04 });
  caja(W - DESPACHO.x, 3.5, .08, 0, (DESPACHO.x + W) / 2, 1.75, -.05, scene, cristalFondo).castShadow = false;
  for (let x = DESPACHO.x; x <= W + .01; x += 3.3) caja(.12, 3.6, .14, C.marino, x, 1.8, -.05);
  caja(W - DESPACHO.x, .14, .16, C.marino, (DESPACHO.x + W) / 2, 3.55, -.05);

  // ---------- recepción con el rótulo iluminado ----------
  const R = RECEPCION, rx = R.x + R.w / 2;
  caja(R.w + 1.2, 3.5, 0.45, C.marino, rx + .2, 1.75, -.18);
  const LOGO = new THREE.TextureLoader().load("assets/logo-negativo.svg"); LOGO.colorSpace = THREE.SRGBColorSpace; LOGO.anisotropy = 8;
  caja(9.2, 2.6, .1, 0x06204a, rx, 2.05, .1); [3.38, .78].forEach((y) => caja(9.4, .08, .14, 0, rx, y, .12, scene, LED(0x7ec2ff, 2.4)));
  [-4.66, 4.66].forEach((d) => caja(.08, 2.7, .14, 0, rx + d, 2.08, .12, scene, LED(0x7ec2ff, 2.4)));
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 7.8 * 1044 / 7170), new THREE.MeshBasicMaterial({ map: LOGO, transparent: true })); logo.position.set(rx, 2.55, .17); scene.add(logo);
  const lema = lienzoTexto(2048, 160, (c, w, h) => { c.fillStyle = "#cfe6ff"; c.font = '600 84px "Montserrat",sans-serif'; c.textAlign = "center"; c.fillText("Tecnología que protege, conecta y automatiza", w / 2, 112); });
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 8.2 * 160 / 2048), new THREE.MeshBasicMaterial({ map: lema, transparent: true })); lm.position.set(rx, 1.25, .17); scene.add(lm);
  const luzR = new THREE.PointLight(0x3da0ff, 18, 12); luzR.position.set(rx, 2.4, 2); scene.add(luzR); animables.push((t) => { luzR.intensity = 17 + Math.sin(t * 1.4) * 2.2; });
  plano(R.w, R.d, 0xe6edf6, R.x + R.w / 2, .08, R.z + R.d / 2);
  caja(6.6, 1.15, 1.5, C.blanco, rx, .65, 3.4); caja(6.8, .1, 1.7, C.madera, rx, 1.25, 3.4); caja(6.6, .12, .08, 0, rx, .75, 4.17, scene, LED(0x7ec2ff, 2.4));
  caja(.1, 1.15, 1.5, C.blanco, rx + 3.4, .65, 2.7); caja(1.9, 1.15, .1, C.blanco, rx + 2.5, .65, 2.05); bloquear(rx, 3.4, 6.8, 1.7); bloquear(rx + 3.1, 2.5, 1.3, 1.6);
  caja(.9, .6, .05, C.oscuro, rx - 2, 1.6, 3.1);
  sofa(2.6, 1.7, 3.4, 0); cilindro(.7, .7, .08, C.madera, 2.6, .5, 3.2); bloquear(2.6, 3.2, 1.4, 1.4, .1);
  sofa(9.0, 6.6, 2.6, -Math.PI / 2, 0x123e78); planta(1.3, 7.3, 1.5); planta(R.x + R.w - .7, 1.2, 1.4); planta(6.6, 7.2, 1.2);

  // ---------- salas por etapa del proceso ----------
  const paredes = (r) => { if (r.lados.includes("O")) vidrio(r.x, r.z, r.x, r.z + r.d, true); if (r.lados.includes("E")) vidrio(r.x + r.w, r.z, r.x + r.w, r.z + r.d, true);
    if (r.lados.includes("N")) vidrio(r.x, r.z, r.x + r.w, r.z, true); if (r.lados.includes("S")) vidrio(r.x, r.z + r.d, r.x + r.w, r.z + r.d, true); };
  SALAS.forEach((r) => { const ps = plano(r.w, r.d, r.color, r.x + r.w / 2, .1, r.z + r.d / 2); ps.material.roughness = .6; paredes(r);
    planta(r.x + .7, r.z + r.d - .7, 1.1); planta(r.x + r.w - .7, r.z + r.d - .7, 1); });
  estante(15.2, .45, 2.4); estante(3.6, 11.3, 2.6); estante(44.6, 12.4, 2.4);

  // sala de juntas (arriba, junto a Dirección y al despacho del jefe)
  const J = JUNTAS; plano(J.w, J.d, 0xdfe7f1, J.x + J.w / 2, .1, J.z + J.d / 2); paredes(J);
  const jx = J.x + J.w / 2;
  caja(6.0, .08, 2.0, C.nogal, jx, .86, 4.4, scene, { roughness: .3 }); caja(.5, .8, .5, 0x2a1d14, jx - 1.5, .42, 4.4); caja(.5, .8, .5, 0x2a1d14, jx + 1.5, .42, 4.4); bloquear(jx, 4.4, 6.0, 2.0, .1);
  for (let i = 0; i < 5; i++) { silla(jx - 2.4 + i * 1.2, 3.1, 0, 0x123e78); silla(jx - 2.4 + i * 1.2, 5.7, Math.PI, 0x123e78); }
  silla(jx - 3.5, 4.4, -Math.PI / 2, 0x123e78); silla(jx + 3.5, 4.4, Math.PI / 2, 0x123e78);
  caja(4.2, 2.1, .1, C.oscuro, jx, 1.75, .75, scene, new THREE.MeshStandardMaterial({ color: 0x0e2a55, emissive: 0x2a8bff, emissiveIntensity: .6 }));
  planta(J.x + .8, J.z + J.d - .8, 1.2); planta(J.x + J.w - .8, J.z + J.d - .8, 1.2);

  // plaza central: podio con luz, banca circular y el isotipo girando en el centro de la oficina
  const P = PLAZA;
  cilindro(3.5, 3.6, .22, C.marino, P.x, .2, P.z, scene, 48); cilindro(3.1, 3.1, .06, 0xdfe7f1, P.x, .34, P.z, scene, 48);
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(3.3, .06, 10, 80), LED(0x4db3ff, 2.4)); anillo.rotation.x = Math.PI / 2; anillo.position.set(P.x, .38, P.z); scene.add(anillo);
  const anillo2 = new THREE.Mesh(new THREE.TorusGeometry(5.2, .04, 10, 90), LED(0x2a8bff, 1.6)); anillo2.rotation.x = Math.PI / 2; anillo2.position.set(P.x, .12, P.z); scene.add(anillo2);
  animables.push((t) => { anillo.material.emissiveIntensity = 2.2 + Math.sin(t * 2) * .6; anillo2.material.emissiveIntensity = 1.4 + Math.sin(t * 1.3 + 1) * .5; });
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .52; sofa(P.x + Math.cos(a) * 4.5, P.z + Math.sin(a) * 4.5, 2.4, -a - Math.PI / 2, 0x123e78, false); }
  bloquear(P.x, P.z, 7.2, 7.2, .1);
  const luzP = new THREE.PointLight(0x4da8ff, 22, 14); luzP.position.set(P.x, 3.2, P.z); scene.add(luzP);
  const cargarIso = fetch("assets/isotipo.svg").then((r) => r.text()).then((txt) => {
    const datos = new SVGLoader().parse(txt), grupo = new THREE.Group();
    datos.paths.forEach((p) => { const color = p.color.getHex(); SVGLoader.createShapes(p).forEach((sh) => {
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 60, bevelEnabled: true, bevelThickness: 8, bevelSize: 6, bevelSegments: 2 });
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color === 0x0b2d5b ? 0x1650a8 : 0x2e91ff, metalness: .35, roughness: .3, emissive: color === 0x0b2d5b ? 0x072250 : 0x0a58b8, emissiveIntensity: .9 }));
      m.castShadow = true; grupo.add(m); }); });
    const cb = new THREE.Box3().setFromObject(grupo), tam = cb.getSize(new THREE.Vector3()), c = cb.getCenter(new THREE.Vector3());
    const e = 3.6 / tam.x; grupo.scale.set(e, -e, e); grupo.position.set(-c.x * e, c.y * e, -c.z * e);
    const pivote = new THREE.Group(); pivote.add(grupo); pivote.position.set(P.x, 2.9, P.z); scene.add(pivote);
    animables.push((t) => { pivote.rotation.y = t * .6; pivote.position.y = 2.9 + Math.sin(t * 1.1) * .12; });
  }).catch(() => {});
  [[13.4, 12.4], [34.6, 12.4], [13.4, 21.2], [34.6, 21.2], [18.6, 9.6], [29.6, 9.6]].forEach(([x, z]) => planta(x, z, 1.3));

  // café / zona de descanso (esquina inferior derecha)
  const K = CAFE; plano(K.w, K.d, 0xf1e6d4, K.x + K.w / 2, .1, K.z + K.d / 2);
  caja(5.6, 1.1, 1.0, C.marino, K.x + 3.4, .6, K.z + .9); caja(5.8, .08, 1.15, C.madera, K.x + 3.4, 1.16, K.z + .9); bloquear(K.x + 3.4, K.z + .9, 5.8, 1.2, .1);
  caja(.5, .5, .4, 0xd0d6de, K.x + 1.6, 1.45, K.z + .8); caja(.28, .28, .06, 0, K.x + 1.6, 1.5, K.z + 1.02, scene, LED(0x4dffb0, 2));
  [0, 1, 2].forEach((i) => { cilindro(.22, .22, .06, C.madera, K.x + 2.8 + i * 1.1, .72, K.z + 2.1); cilindro(.05, .05, .6, C.gris, K.x + 2.8 + i * 1.1, .38, K.z + 2.1); });
  sofa(K.x + 2, K.z + 5.4, 3, Math.PI, 0x7a5a3a); sofa(K.x + 6.6, K.z + 4.4, 2.6, Math.PI / 2, 0x7a5a3a); cilindro(.7, .7, .08, C.madera, K.x + 4.4, .5, K.z + 4.4); bloquear(K.x + 4.4, K.z + 4.4, 1.4, 1.4, .1);
  planta(K.x + .7, K.z + K.d - .7, 1.4); planta(K.x + K.w - .7, K.z + K.d - .7, 1.4);

  // ---------- despacho del jefe: nogal, alfombra, ventanal al parqueadero ----------
  const d = DESPACHO, cx = d.x + d.w / 2;
  const madera = lienzoTexto(1024, 512, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#5e3d27" : "#6a4630"; c.fillRect(0, i * h / 16, w, h / 16); c.strokeStyle = "rgba(0,0,0,.25)"; c.strokeRect(0, i * h / 16, w, h / 16); } });
  const pisoJefe = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.d), new THREE.MeshStandardMaterial({ map: madera, roughness: .35 })); pisoJefe.rotation.x = -Math.PI / 2; pisoJefe.position.set(d.x + d.w / 2, .11, d.z + d.d / 2); pisoJefe.receiveShadow = true; scene.add(pisoJefe);
  vidrio(d.x, d.z, d.x, d.z + d.d, true, 3.0);
  const alfombra = lienzoTexto(512, 384, (c, w, h) => { c.fillStyle = "#0b2d5b"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a24a"; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28); c.lineWidth = 3; c.strokeRect(34, 34, w - 68, h - 68); });
  const al = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 6.4), new THREE.MeshStandardMaterial({ map: alfombra, roughness: .95 })); al.rotation.x = -Math.PI / 2; al.position.set(cx, .13, 5.0); al.receiveShadow = true; scene.add(al);
  caja(4.2, .09, 1.7, C.nogal, cx, .95, 3.7, scene, { roughness: .3, metalness: .1 }); caja(3.9, .85, 1.5, 0x4a2f1c, cx, .5, 3.7); caja(4.4, .05, 1.85, C.dorado, cx, .895, 3.7, scene, { metalness: .8, roughness: .3 });
  [-.8, .9].forEach((dx) => { caja(.9, .55, .06, C.oscuro, cx + dx, 1.5, 3.4); caja(.1, .3, .1, C.oscuro, cx + dx, 1.15, 3.4); });
  caja(.7, .03, .26, C.blanco, cx, 1.01, 4.2);
  const placaMesa = lienzoTexto(512, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, "#d4b25a"); g.addColorStop(1, "#8a6a22"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = "#1a1308"; c.font = '700 44px "Montserrat",sans-serif'; c.textAlign = "center"; c.fillText("SEBASTIAN ROMERO", w / 2, 60); c.font = '600 28px "Inter",sans-serif'; c.fillText("Gerente General", w / 2, 100); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .275), new THREE.MeshStandardMaterial({ map: placaMesa, metalness: .5, roughness: .4 })); pm.position.set(cx, 1.06, 4.5); pm.rotation.x = -.45; scene.add(pm);
  bloquear(cx, 3.7, 4.4, 1.8);
  silla(cx, 2.45, Math.PI, 0x151a22); [[cx - 2.6, 6.0, .35], [cx + 2.6, 6.0, -.35]].forEach(([x, z, g]) => silla(x, z, g, 0x6b4a2f));
  estante(d.x + .7, 2.2, 3.4, Math.PI / 2, 2.8); estante(d.x + .7, 8.6, 2.6, Math.PI / 2, 2.8);
  sofa(d.x + d.w - 1.0, 7.6, 3.6, -Math.PI / 2 + Math.PI, 0x1b2a44); cilindro(.6, .6, .08, C.nogal, d.x + d.w - 2.7, .55, 7.6); bloquear(d.x + d.w - 2.7, 7.6, 1.3, 1.3, .1);
  planta(d.x + 1.8, 1.2, 1.8); planta(d.x + d.w - .8, 1.2, 1.8); planta(d.x + d.w - .8, 9.2, 1.5);
  cilindro(.5, .5, .9, 0x2a3a55, d.x + d.w - 2.4, .5, 2.4); esfera(.42, 0x2f6fb5, d.x + d.w - 2.4, 1.28, 2.4, scene, { metalness: .3, roughness: .3 }); bloquear(d.x + d.w - 2.4, 2.4, 1.1, 1.1, .1);
  const luzJefe = new THREE.PointLight(0xffe2b0, 10, 12); luzJefe.position.set(cx, 3.1, 4.5); scene.add(luzJefe);
  [-2.2, 2.2].forEach((dx) => cilindro(.4, .4, .06, 0xfff2d0, cx + dx, 3.4, 4.3, scene, 20, { emissive: 0xfff2d0, emissiveIntensity: 1.5 }));
  return { cargarIso };
}

/* ===== Etiquetas HTML sobre la escena ===== */
const cont = document.getElementById("etiquetas"), etqs = [];
export function etiqueta(html, cls, pos) { const d = document.createElement("div"); d.className = "etq " + cls; d.innerHTML = html; cont.appendChild(d); etqs.push({ d, pos }); return d; }
const tmp = new THREE.Vector3();
export function colocarEtiquetas() {
  const w = innerWidth, h = innerHeight;
  etqs.forEach(({ d, pos }) => { tmp.copy(pos).project(camara); d.style.left = ((tmp.x + 1) / 2 * w) + "px"; d.style.top = ((1 - tmp.y) / 2 * h) + "px"; });
}

/* ===== Paquetes de luz y ondas ===== */
const paquetes = [], ondas = [];
export function viaje(desde, hasta, color = 0x4db3ff, dur = 1.7, arco = 3.2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.55, .1, .38), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
  m.add(new THREE.PointLight(color, 6, 4)); scene.add(m);
  paquetes.push({ m, a: desde.clone(), b: hasta.clone(), t0: performance.now(), dur: dur * 1000, color, arco });
}
export function onda(pos, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.4, .55, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, .2, pos.z); scene.add(m); ondas.push({ m, t0: performance.now() });
}
export function actualizarMundo(t, dt, ahora) {
  animables.forEach((f) => f(t, dt));
  for (let i = paquetes.length - 1; i >= 0; i--) {
    const q = paquetes[i], u = Math.min((ahora - q.t0) / q.dur, 1), e = u * u * (3 - 2 * u);
    q.m.position.lerpVectors(q.a, q.b, e); q.m.position.y += Math.sin(u * Math.PI) * q.arco; q.m.rotation.y += dt * 6; q.m.scale.setScalar(.8 + Math.sin(u * Math.PI) * .5);
    if (u >= 1) { scene.remove(q.m); paquetes.splice(i, 1); onda(q.b, q.color); }
  }
  for (let i = ondas.length - 1; i >= 0; i--) {
    const o = ondas[i], u = (ahora - o.t0) / 900; o.m.scale.setScalar(1 + u * 4); o.m.material.opacity = Math.max(0, .9 - u);
    if (u >= 1) { scene.remove(o.m); ondas.splice(i, 1); }
  }
}

export function ajustar() {
  const w = innerWidth, h = innerHeight, asp = w / h;
  const panel = document.getElementById("panel"), r = panel ? panel.getBoundingClientRect() : null;
  let x0 = 0, x1 = w, y0 = 0, y1 = h;                               // zona de la pantalla que el panel y el encabezado no tapan
  if (r && r.width > 0 && r.height > 0) { if (r.width < w * 0.6 && r.left > w * 0.4) x1 = r.left - 8; else y1 = r.top - 8; }
  const cab = document.querySelector(".cabecera"); if (cab && w < 760) y0 = cab.getBoundingClientRect().bottom + 4;
  const bw = Math.max(120, x1 - x0), bh = Math.max(120, y1 - y0);
  const mitad = Math.max(17, 22 * h / bh, 33 * h / bw), W = 2 * mitad * asp, H = 2 * mitad;   // medio alto del plano visible, en metros
  const left = -((x0 + x1) / 2 / w) * W, top = ((y0 + y1) / 2 / h) * H;                          // el edificio se centra en la zona libre
  Object.assign(camara, { left, right: left + W, top, bottom: top - H });
  document.documentElement.style.setProperty("--sheet-h", (r && y1 < h ? r.height : 150) + "px");
  camara.updateProjectionMatrix(); renderer.setSize(w, h, false);
}
if (window.ResizeObserver && document.getElementById("panel")) new ResizeObserver(() => ajustar()).observe(document.getElementById("panel"));
addEventListener("resize", ajustar); ajustar();
