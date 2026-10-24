import { asegurarAcceso } from "./acceso.js";

/* Primero el acceso (en la web pide usuario y contraseña); solo después se construye la oficina. */
await asegurarAcceso();
await import("./oficina.js");
