// Cierra la sesión.
module.exports = (req, res) => {
  res.setHeader("Set-Cookie", "oficina=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true });
};
