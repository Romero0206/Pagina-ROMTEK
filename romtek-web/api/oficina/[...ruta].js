// Puente autenticado: la web reenvía a La Oficina (el servidor del jefe) solo si hay sesión válida.
const { sesionValida } = require("../_lib/sesion");
const PERMITIDAS = /^(sesion|estado|historial|tareas(\/\w+(\/iniciar)?)?|chat(\/[\w-]+)?|encargo(\/\w+)?)$/;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await sesionValida(req))) return res.status(401).json({ error: "No autorizado" });
  const url = new URL(req.url, "https://x");
  const quitar = (t) => decodeURIComponent(t).replace(/^\/api\/oficina\/?/, "").replace(/\/+$/, "");
  let ruta = [].concat((req.query && (req.query.ruta ?? req.query["...ruta"])) || []).join("/");   // según cómo Vercel entregue el parámetro
  if (!ruta || ruta.startsWith("[")) ruta = quitar(url.pathname);                                  // si no, se lee de la dirección
  if (!PERMITIDAS.test(ruta)) return res.status(404).json({ error: "No existe" });
  if (ruta === "sesion") return res.status(200).json({ ok: true });
  const destino = (process.env.OFICINA_TUNEL || "").replace(/\/$/, "");
  if (!destino) return res.status(503).json({ error: "La oficina no está conectada" });
  const q = new URLSearchParams(url.search); q.delete("ruta"); q.delete("...ruta");
  const init = { method: req.method, headers: { "Content-Type": "application/json", "X-Oficina-Secreto": process.env.OFICINA_SECRETO_TUNEL || "" }, signal: AbortSignal.timeout(25000) };
  if (!["GET", "HEAD"].includes(req.method)) init.body = JSON.stringify(req.body && typeof req.body === "object" ? req.body : {});
  try {
    const r = await fetch(`${destino}/api/${ruta}${q.toString() ? "?" + q : ""}`, init);
    res.status(r.status).setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    return res.send(await r.text());
  } catch (e) {
    return res.status(502).json({ error: "La oficina está apagada o sin conexión" });
  }
};
