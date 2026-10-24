import { API_BASE } from "./datos.js";

/* En el computador (127.0.0.1) no hay contraseña. En la web, la oficina no se construye hasta iniciar sesión. */
export async function asegurarAcceso() {
  const hay = async () => { try { return (await fetch(API_BASE + "/sesion", { cache: "no-store" })).ok; } catch (e) { return false; } };
  if (await hay()) return;
  const caja = document.getElementById("acceso"), form = document.getElementById("acceso-form"), err = document.getElementById("acceso-error");
  caja.hidden = false; document.getElementById("acceso-usuario").focus();
  await new Promise((listo) => form.addEventListener("submit", async (e) => {
    e.preventDefault(); err.textContent = ""; const btn = form.querySelector("button"); btn.disabled = true;
    try {
      const r = await fetch(API_BASE + "/entrar", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: document.getElementById("acceso-usuario").value, clave: document.getElementById("acceso-clave").value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo entrar");
      caja.hidden = true; listo();
    } catch (er) { err.textContent = er.message; btn.disabled = false; }
  }));
}
