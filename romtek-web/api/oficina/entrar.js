// POST { usuario, clave } -> cookie de sesión. El usuario y la clave viven en las variables de Vercel, nunca en el repositorio.
const { crearCookie, iguales, hashear } = require("../_lib/sesion");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const clave = process.env.OFICINA_CLAVE, secreto = process.env.OFICINA_SECRETO;
  if (!clave || !secreto || secreto.length < 24) return res.status(503).json({ error: "El acceso aún no está configurado" });
  const usuario = (process.env.OFICINA_USUARIO || "sebastian").toLowerCase();
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const okU = iguales(await hashear(String(b.usuario || "").trim().toLowerCase()), await hashear(usuario));
  const okC = iguales(await hashear(String(b.clave || "")), await hashear(clave));
  if (!(okU && okC)) { await new Promise((r) => setTimeout(r, 900)); return res.status(401).json({ error: "Usuario o contraseña incorrectos" }); }
  res.setHeader("Set-Cookie", await crearCookie(secreto));
  return res.status(200).json({ ok: true });
};
