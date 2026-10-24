/* ===== DATOS EDITABLES =====
   Cada sala: posición y tamaño en metros sobre el plano (x derecha, z hacia el frente), etapa del
   proceso y paredes de vidrio (lados: N, S, E, O). Para sumar una persona, agrégala a una sala:
   id = nombre del archivo en .claude/agents/. largo = pelo largo. */
export const EDIFICIO = { w: 48, d: 30.6 };

export const SALAS = [
  { nombre: "Dirección", etapa: "Coordina", color: 0xdde8f6, x: 11.8, z: 0.5, w: 9, d: 7.2, lados: "OES", agentes: [
    { id: "romtek", nombre: "Harvey Specter", rol: "Director de la oficina", piel: 0xd9a77f, pelo: 0x1b1b1d, traje: 0x08203f, corbata: 0x007bff } ] },
  { nombre: "Estrategia", etapa: "1", color: 0xe0f0f7, x: 0.6, z: 11, w: 9.6, d: 8, lados: "E", agentes: [
    { id: "romtek-mike", nombre: "Mike Ross", rol: "Mercado y competencia", piel: 0xe8bd98, pelo: 0x3b2a1c },
    { id: "romtek-katrina", nombre: "Katrina Bennett", rol: "Plan de negocio", piel: 0xe3b48c, pelo: 0x6b3d1f, largo: true } ] },
  { nombre: "Finanzas y legal", etapa: "2", color: 0xe4ecf6, x: 0.6, z: 20.8, w: 9.6, d: 8.2, lados: "E", agentes: [
    { id: "romtek-louis", nombre: "Louis Litt", rol: "Finanzas", piel: 0xe8bd98, pelo: 0x4a3a2c },
    { id: "romtek-jessica", nombre: "Jessica Pearson", rol: "Legal", piel: 0x8d5a3b, pelo: 0x14100d, largo: true } ] },
  { nombre: "Comercial y marca", etapa: "3", color: 0xe9eef5, x: 12.4, z: 23.2, w: 11.6, d: 6.4, lados: "", agentes: [
    { id: "romtek-rachel", nombre: "Rachel Zane", rol: "Comercial y marketing", piel: 0xe1ac84, pelo: 0x23160f, largo: true },
    { id: "romtek-donna", nombre: "Donna Paulsen", rol: "Marca y diseño", piel: 0xe8bd98, pelo: 0x9a3b1f, largo: true } ] },
  { nombre: "Operaciones", etapa: "4", color: 0xe3efe9, x: 26, z: 23.2, w: 10, d: 6.4, lados: "O", agentes: [
    { id: "romtek-samantha", nombre: "Samantha Wheeler", rol: "Procesos y proveedores", piel: 0xc58c5f, pelo: 0x2a1a12, largo: true } ] },
  { nombre: "Digital", etapa: "5", color: 0xe2eef5, x: 38.2, z: 12, w: 9.4, d: 8.6, lados: "O", agentes: [
    { id: "romtek-alex", nombre: "Alex Williams", rol: "Sitio web", piel: 0xc58c5f, pelo: 0x1d140e },
    { id: "romtek-gretchen", nombre: "Gretchen Bodinski", rol: "Imagen y video", piel: 0xf0cfae, pelo: 0xc9a24a, largo: true } ] }
];

export const RECEPCION = { x: 0.6, z: 0.6, w: 10, d: 8.2 };
export const JUNTAS = { nombre: "Sala de juntas", x: 22.4, z: 0.5, w: 10, d: 8.2, lados: "OES" };
export const DESPACHO = { nombre: "Despacho del jefe", x: 34.4, z: 0.5, w: 13.2, d: 9.8, lados: "O" };
export const PLAZA = { x: 23.8, z: 16 };             // centro de la plaza, donde gira el isotipo
export const CAFE = { x: 38.2, z: 22.6, w: 9.4, d: 7 };

/* El jefe. Está sentado tras su escritorio, de cara a la oficina, con el parqueadero a su espalda. */
export const JEFE = { id: "_jefe", nombre: "Sebastian", rol: "El jefe", piel: 0xd9a77f, pelo: 0x14100d, traje: 0x2b2f38, corbata: 0x0b2d5b, pano: true };

export const AGENTES = SALAS.flatMap((s) => s.agentes);

/* Desde la web (/oficina) la API pasa por el acceso con contraseña; en el computador va directo al servidor. */
export const API_BASE = location.pathname.startsWith("/oficina") ? "/api/oficina" : "/api";
