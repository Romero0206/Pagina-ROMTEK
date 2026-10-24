// Sesión de La Oficina: cookie firmada (HMAC-SHA256) con caducidad. Solo usa Web Crypto, sin dependencias.
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function firmar(texto, secreto) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(texto)));
}
async function hashear(texto) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(String(texto)))); }
function iguales(a, b) {                       // comparación en tiempo constante
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function crearCookie(secreto, dias = 7) {
  const exp = Math.floor(Date.now() / 1000) + dias * 86400;
  return `oficina=${exp}.${await firmar("oficina." + exp, secreto)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${dias * 86400}`;
}
async function sesionValida(req) {
  const secreto = process.env.OFICINA_SECRETO;
  if (!secreto || secreto.length < 24) return false;          // sin secreto configurado, nadie entra
  const m = /(?:^|;\s*)oficina=(\d+)\.([0-9a-f]{64})/.exec(req.headers.cookie || "");
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  return iguales(await firmar("oficina." + m[1], secreto), m[2]);
}
module.exports = { crearCookie, sesionValida, iguales, hashear };
