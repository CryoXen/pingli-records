/**
 * El menú del contador: aparece encima de la cuenta 3:33 cuando se mantiene
 * presionada (src/lib/acceso-secreto.ts).
 *
 *  - Sin sesión: "login". Al tocarlo, el menú se vuelve un formulario
 *    (correo y contraseña) y te quedas en el plano.
 *  - Con sesión: tu nombre (chris, henry), "ingresar a panel" (va a /admin,
 *    ya con la sesión abierta), "editar" (enciende el modo de ajuste del plano:
 *    evento "pingli:admin") y "salir" (cierra la sesión y apaga el modo de ajuste).
 *
 * Se cierra con Esc, tocando fuera o cuando llega la previsión.
 */
import { PREVISION_EVENT } from "@/lib/ciclo";
import { obtenerSesion, type ProveedorSesion, type Sesion } from "@/lib/sesion";

type Estado = "cargando" | "fuera" | "form" | "dentro";

export function mountMenuAdmin(s: { readonly path: string }) {
  const menu = document.createElement("div");
  menu.className = "menu-admin";
  menu.hidden = true;
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "acceso");
  document.body.append(menu);

  let abierto = false;
  let ancla: HTMLElement | null = null;
  let estado: Estado = "cargando";
  let sesion: Sesion | null = null;
  let proveedor: ProveedorSesion | null = null;
  let error = "";
  let ocupado = false;
  let correo = "";
  /** Cada apertura cuenta: si se cerró mientras cargaba, no se pinta nada viejo. */
  let vez = 0;

  // ——— piezas
  const boton = (texto: string, accion: () => void, clase = "menu-admin-opcion") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = clase;
    b.textContent = texto;
    b.addEventListener("click", accion);
    return b;
  };
  const texto = (t: string, clase: string) => {
    const p = document.createElement("p");
    p.className = clase;
    p.textContent = t;
    return p;
  };

  function pintar(enfocar = false) {
    menu.replaceChildren();
    if (estado === "cargando") {
      menu.append(texto("…", "menu-admin-nota"));
      return;
    }
    if (estado === "fuera") {
      const b = boton("login", () => {
        estado = "form";
        error = "";
        pintar(true);
      });
      menu.append(b);
      if (error) menu.append(texto(error, "menu-admin-error"));
      if (enfocar) b.focus({ preventScroll: true });
      return;
    }
    if (estado === "form") {
      const form = document.createElement("form");
      form.className = "menu-admin-form";
      form.noValidate = true;
      const campo = (etiqueta: string, tipo: string, auto: string, valor = "") => {
        const l = document.createElement("label");
        l.className = "menu-admin-campo";
        const span = document.createElement("span");
        span.textContent = etiqueta;
        const i = document.createElement("input");
        i.type = tipo;
        i.setAttribute("autocomplete", auto);
        i.value = valor;
        i.spellcheck = false;
        i.autocapitalize = "none";
        l.append(span, i);
        form.append(l);
        return i;
      };
      const iCorreo = campo("correo", "email", "username", correo);
      const iClave = campo("contraseña", "password", "current-password");
      const enviar = document.createElement("button");
      enviar.type = "submit";
      enviar.className = "menu-admin-boton";
      enviar.textContent = ocupado ? "entrando…" : "entrar";
      enviar.disabled = ocupado;
      form.append(enviar);
      if (error) form.append(texto(error, "menu-admin-error"));
      if (proveedor?.nota) form.append(texto(proveedor.nota, "menu-admin-nota"));
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        correo = iCorreo.value.trim();
        if (!correo || !iClave.value) {
          error = "escribe tu correo y tu contraseña.";
          pintar();
          (correo ? menu.querySelector<HTMLInputElement>("input[type=password]") : menu.querySelector<HTMLInputElement>("input"))?.focus();
          return;
        }
        void entrar(correo, iClave.value);
      });
      menu.append(form);
      if (enfocar) (correo ? iClave : iCorreo).focus({ preventScroll: true });
      return;
    }
    // con sesión
    if (!sesion) return;
    menu.append(texto(sesion.nombre, "menu-admin-nombre"));
    let primero: HTMLButtonElement | null = null;
    if (sesion.admin) {
      primero = boton("ingresar a panel", () => {
        const aviso = proveedor?.irAlPanel?.();
        if (typeof aviso === "string") {
          error = aviso;
          pintar(true);
          return;
        }
        if (!proveedor?.irAlPanel) window.location.assign(s.path);
      });
      menu.append(
        primero,
        boton("editar", () => {
          window.dispatchEvent(new CustomEvent("pingli:admin", { detail: { on: true } }));
          cerrar();
        }),
      );
    } else {
      menu.append(texto("esta cuenta no es admin.", "menu-admin-nota"));
    }
    const salir = boton("salir", () => void cerrarSesion());
    menu.append(salir);
    if (error) menu.append(texto(error, "menu-admin-error"));
    if (enfocar) (primero ?? salir).focus({ preventScroll: true });
  }

  async function entrar(c: string, clave: string) {
    if (!proveedor || ocupado) return;
    ocupado = true;
    error = "";
    pintar();
    try {
      sesion = await proveedor.entrar(c, clave);
      estado = "dentro";
      ocupado = false;
      pintar(true);
    } catch (e) {
      ocupado = false;
      error = e instanceof Error ? e.message : "no se pudo entrar.";
      pintar(true);
    }
  }

  async function cerrarSesion() {
    if (!proveedor) return;
    try {
      await proveedor.salir();
    } catch {
      /* igual se olvida aquí */
    }
    sesion = null;
    estado = "fuera";
    error = "";
    window.dispatchEvent(new CustomEvent("pingli:admin", { detail: { on: false } }));
    cerrar();
  }

  // ——— dónde va: encima de la cuenta, alineado a su derecha
  function colocar() {
    if (!abierto || !ancla) return;
    const r = ancla.getBoundingClientRect();
    // con el teclado del teléfono abierto, lo que se ve es más chico
    const vv = window.visualViewport;
    const tapado = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    const abajo = Math.max(window.innerHeight - r.top + 10, tapado + 12);
    menu.style.right = `${Math.max(12, window.innerWidth - r.right)}px`;
    menu.style.bottom = `${abajo}px`;
  }

  async function abrir(cuenta: HTMLElement) {
    ancla = cuenta;
    const esta = ++vez;
    abierto = true;
    menu.hidden = false;
    // mientras está abierto, Esc es solo suyo (artistas.ts, artistas-ajuste.ts y el panel lo respetan)
    document.documentElement.dataset.menuAdmin = "";
    error = "";
    estado = sesion ? "dentro" : "cargando";
    pintar(true);
    colocar();
    try {
      proveedor = await obtenerSesion();
      const s = await proveedor.actual();
      if (esta !== vez || !abierto) return;
      sesion = s;
    } catch (e) {
      if (esta !== vez || !abierto) return;
      sesion = null;
      error = e instanceof Error ? e.message.toLowerCase() : "sin conexión.";
    }
    // si ya estaba escribiendo, no se le borra el formulario
    if ((estado as Estado) === "form") return;
    estado = sesion ? "dentro" : "fuera";
    pintar(true);
    colocar();
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;
    vez++;
    menu.hidden = true;
    delete document.documentElement.dataset.menuAdmin;
    ocupado = false;
    error = "";
    if (estado === "form") estado = sesion ? "dentro" : "fuera";
  }

  // ——— cerrar: Esc, tocar fuera, la previsión
  const onTecla = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !abierto) return;
    ev.preventDefault();
    cerrar();
  };
  const onFuera = (ev: PointerEvent) => {
    if (!abierto) return;
    const t = ev.target as Element | null;
    if (t && (menu.contains(t) || t.closest("[data-cycle-clock]"))) return;
    cerrar();
  };
  // las teclas escritas en el menú no mueven el plano
  const onTeclaDentro = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") ev.stopPropagation();
  };
  const onCambio = () => colocar();
  menu.addEventListener("keydown", onTeclaDentro);
  window.addEventListener("keydown", onTecla);
  document.addEventListener("pointerdown", onFuera, { capture: true });
  window.addEventListener(PREVISION_EVENT, cerrar);
  window.addEventListener("resize", onCambio);
  window.visualViewport?.addEventListener("resize", onCambio);
  window.visualViewport?.addEventListener("scroll", onCambio);

  return {
    abrir: (cuenta: HTMLElement) => void abrir(cuenta),
    cerrar,
    destroy() {
      menu.removeEventListener("keydown", onTeclaDentro);
      window.removeEventListener("keydown", onTecla);
      delete document.documentElement.dataset.menuAdmin;
      document.removeEventListener("pointerdown", onFuera, { capture: true });
      window.removeEventListener(PREVISION_EVENT, cerrar);
      window.removeEventListener("resize", onCambio);
      window.visualViewport?.removeEventListener("resize", onCambio);
      window.visualViewport?.removeEventListener("scroll", onCambio);
      menu.remove();
    },
  };
}
