/**
 * Modo admin del plano: ajustar a mano un artista y sus proyectos.
 *
 * Con el modo admin encendido (evento "pingli:admin", que manda "editar" en el
 * menú del contador: src/lib/menu-admin.ts) aparece una barra abajo. Al abrir un artista, la barra ofrece "ajustar posición y tamaño", y
 * entonces:
 *  - el artista se arrastra a donde sea del plano (sus proyectos lo siguen);
 *  - los proyectos se arrastran libremente alrededor de él;
 *  - la esquina de abajo a la derecha de cada cuadro cambia su tamaño,
 *    proporcional (los cuadros son cuadrados).
 * "guardar" lo guarda (con la función que se registre en definirGuardado),
 * "cancelar" lo deja como estaba y "proyectos en abanico" los regresa a su
 * acomodo automático.
 */
import { type Cam, type Estado, type PlanoArtistas } from "@/lib/artistas";

export type CambioAjuste = {
  /** El artista se guarda por nombre (así se relaciona con sus lanzamientos). */
  artista: { id: string; nombre: string; x: number; y: number; size: number };
  proyectos: { catalog: string; size: number; offset: { x: number; y: number } | null }[];
};

type Guardar = (c: CambioAjuste) => Promise<void> | void;
let guardarCon: Guardar | null = null;

/** Dónde se guardan los ajustes (Supabase en el sitio; el navegador en la vista previa). */
export function definirGuardado(f: Guardar | null) {
  guardarCon = f;
}

/** Sin otro definido, Supabase (se descarga solo al guardar). */
async function guardador(): Promise<Guardar> {
  if (guardarCon) return guardarCon;
  const { guardarAjusteSupabase } = await import("@/lib/admin/ajuste-supabase");
  guardarCon = guardarAjusteSupabase;
  return guardarCon;
}

const LADO_MIN = 24;
const LADO_MAX = 1600;

export function mountAjuste(o: PlanoArtistas): () => void {
  const io = o.interno;
  let admin = false;
  let ajustando = -1;
  let copia: { x: number; y: number; size: number; proyectos: { size: number; offset: { x: number; y: number } | null | undefined }[] } | null = null;
  let estado = "";

  // ——— la barra
  const barra = document.createElement("div");
  barra.className = "ajuste-barra";
  barra.hidden = true;
  barra.setAttribute("role", "toolbar");
  barra.setAttribute("aria-label", "modo admin");
  document.body.append(barra);

  // ——— las esquinas de tamaño
  const capa = document.createElement("div");
  capa.className = "ajuste";
  capa.hidden = true;
  io.layer.append(capa);
  let esquinas: { el: HTMLElement; de: "artista" | number }[] = [];

  const actual = (): Estado | undefined => io.estados[ajustando];

  // ——— coordenadas
  const mundo = (ev: PointerEvent) => {
    const c = io.cam()!;
    const r = io.layer.getBoundingClientRect();
    return { x: c.x + (ev.clientX - r.left - c.w / 2) / c.scale, y: c.y + (ev.clientY - r.top - c.h / 2) / c.scale };
  };

  /** Arrastre de algo del ajuste: el plano de abajo no se mueve. */
  function arrastre(el: HTMLElement, ev: PointerEvent, mover: (p: { x: number; y: number }) => void) {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      /* puntero sintético */
    }
    el.dataset.arrastrando = "";
    const mueve = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      e.stopPropagation();
      mover(mundo(e));
    };
    const suelta = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      delete el.dataset.arrastrando;
      el.removeEventListener("pointermove", mueve);
      el.removeEventListener("pointerup", suelta);
      el.removeEventListener("pointercancel", suelta);
    };
    el.addEventListener("pointermove", mueve);
    el.addEventListener("pointerup", suelta);
    el.addEventListener("pointercancel", suelta);
  }

  // arrastrar al artista y a sus proyectos por donde sea
  const alPresionar = (ev: PointerEvent) => {
    if (ajustando < 0) return;
    const t = (ev.target as Element).closest<HTMLElement>("[data-artista],[data-release]");
    const e = actual();
    if (!t || !e) return;
    if (t.dataset.artista !== undefined) {
      if (Number(t.dataset.artista) !== ajustando) return;
      const p0 = mundo(ev);
      const agarre = { x: p0.x - e.x, y: p0.y - e.y };
      arrastre(t, ev, (p) => {
        e.x = Math.round(p.x - agarre.x);
        e.y = Math.round(p.y - agarre.y);
        pintar();
      });
      return;
    }
    const j = Number(t.dataset.release);
    if (!e.proyectos.includes(j)) return;
    const r = io.releases[j];
    const p0 = mundo(ev);
    const agarre = { x: p0.x - (r.x ?? e.x), y: p0.y - (r.y ?? e.y) };
    arrastre(t, ev, (p) => {
      r.offset = { x: Math.round(p.x - agarre.x - e.x), y: Math.round(p.y - agarre.y - e.y) };
      pintar();
    });
  };
  io.layer.addEventListener("pointerdown", alPresionar);
  // mientras se ajusta, tocar un cuadro no abre ni cierra nada
  const sinClic = (ev: MouseEvent) => {
    if (ajustando < 0) return;
    if ((ev.target as Element).closest("[data-artista],[data-release]")) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };
  io.layer.addEventListener("click", sinClic, true);

  function hacerEsquinas(e: Estado) {
    esquinas.forEach((q) => q.el.remove());
    esquinas = [];
    const nueva = (de: "artista" | number) => {
      const q = document.createElement("span");
      q.className = "ajuste-esquina";
      q.title = "tamaño";
      capa.append(q);
      q.addEventListener("pointerdown", (ev) => {
        arrastre(q, ev, (p) => {
          const cx = de === "artista" ? e.x : io.releases[de].x ?? e.x;
          const cy = de === "artista" ? e.y : io.releases[de].y ?? e.y;
          const lado = Math.round(Math.min(LADO_MAX, Math.max(LADO_MIN, 2 * Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)))));
          if (de === "artista") e.size = lado;
          else io.releases[de].size = lado;
          pintar();
        });
      });
      esquinas.push({ el: q, de });
    };
    nueva("artista");
    e.proyectos.forEach((j) => {
      if (io.releases[j].size >= 10) nueva(j);
    });
  }

  // ——— en cada cuadro: las esquinas siguen a la cámara
  const colocarPunto = (el: HTMLElement, sx: number, sy: number, c: Cam) => {
    const fuera = sx < -40 || sy < -40 || sx > c.w + 40 || sy > c.h + 40;
    el.style.display = fuera ? "none" : "";
    if (!fuera) el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
  };
  const quitarCuadro = io.alCuadro((c) => {
    const e = actual();
    if (!e) return;
    for (const q of esquinas) {
      const r = q.de === "artista" ? null : io.releases[q.de];
      const x = r ? r.x ?? e.x : e.x;
      const y = r ? r.y ?? e.y : e.y;
      const h = (r ? r.size : e.size) / 2;
      colocarPunto(q.el, c.toScreenX(x + h), c.toScreenY(y + h), c);
    }
  });

  // ——— la barra
  const boton = (texto: string, accion: () => void, clase = "ajuste-boton") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = clase;
    b.textContent = texto;
    b.addEventListener("click", accion);
    return b;
  };
  const texto = (t: string, clase = "ajuste-texto") => {
    const s = document.createElement("span");
    s.className = clase;
    s.textContent = t;
    return s;
  };

  function pintar() {
    barra.hidden = !admin;
    if (!admin) return;
    barra.replaceChildren();
    const e = actual();
    const abierto = io.abierto();
    const fila = document.createElement("div");
    fila.className = "ajuste-fila";
    if (e) {
      fila.append(
        texto(`ajustando ${e.a.name}`, "ajuste-titulo"),
        texto(`lugar ${Math.round(e.x)}, ${Math.round(-e.y)} · cuadro ${Math.round(e.size)}`, "ajuste-datos"),
      );
      barra.append(fila);
      barra.append(texto("arrastra al artista y a sus proyectos donde quieras · esquina: tamaño", "ajuste-ayuda"));
      const acciones = document.createElement("div");
      acciones.className = "ajuste-fila";
      acciones.append(
        boton("guardar", () => void guardar(), "ajuste-boton ajuste-primario"),
        boton("cancelar", cancelar),
        boton("proyectos en abanico", () => {
          e.proyectos.forEach((j) => (io.releases[j].offset = null));
          pintar();
        }, "ajuste-link"),
      );
      if (estado) acciones.append(texto(estado, "ajuste-estado"));
      barra.append(acciones);
      return;
    }
    if (abierto >= 0) {
      const a = io.estados[abierto];
      fila.append(texto(`admin · ${a.a.name}`, "ajuste-titulo"), boton("ajustar posición y tamaño", () => empezar(abierto), "ajuste-boton ajuste-primario"));
    } else {
      fila.append(texto("admin · toca un artista para ajustarlo", "ajuste-titulo"));
    }
    if (estado) fila.append(texto(estado, "ajuste-estado"));
    fila.append(boton("dejar de editar", () => setAdmin(false), "ajuste-link"));
    barra.append(fila);
  }

  function empezar(i: number) {
    const e = io.estados[i];
    if (!e) return;
    ajustando = i;
    estado = "";
    io.setAjustando(true);
    copia = {
      x: e.x,
      y: e.y,
      size: e.size,
      proyectos: e.proyectos.map((j) => ({ size: io.releases[j].size, offset: io.releases[j].offset ? { ...io.releases[j].offset! } : io.releases[j].offset })),
    };
    document.documentElement.dataset.ajustando = "";
    capa.hidden = false;
    hacerEsquinas(e);
    pintar();
    // que se vea el artista con sus proyectos, por encima de la barra
    io.encuadrar(e, barra.getBoundingClientRect().height + 24);
  }

  function terminar() {
    ajustando = -1;
    copia = null;
    io.setAjustando(false);
    delete document.documentElement.dataset.ajustando;
    capa.hidden = true;
    esquinas.forEach((q) => q.el.remove());
    esquinas = [];
    pintar();
  }

  function cancelar() {
    const e = actual();
    if (e && copia) {
      e.x = copia.x;
      e.y = copia.y;
      e.size = copia.size;
      e.proyectos.forEach((j, k) => {
        io.releases[j].size = copia!.proyectos[k].size;
        io.releases[j].offset = copia!.proyectos[k].offset;
      });
    }
    estado = "";
    terminar();
  }

  async function guardar() {
    const e = actual();
    if (!e) return;
    const cambio: CambioAjuste = {
      artista: { id: e.a.id, nombre: e.a.name, x: Math.round(e.x), y: Math.round(e.y), size: Math.round(e.size) },
      proyectos: e.proyectos.map((j) => ({ catalog: io.releases[j].catalog, size: io.releases[j].size, offset: io.releases[j].offset ?? null })),
    };
    estado = "guardando…";
    pintar();
    try {
      await (await guardador())(cambio);
      estado = "guardado";
      terminar();
    } catch (err) {
      estado = err instanceof Error ? `no se pudo guardar: ${err.message}` : "no se pudo guardar";
      pintar();
    }
  }

  function setAdmin(on: boolean) {
    if (!on && ajustando >= 0) cancelar();
    admin = on;
    estado = "";
    if (on) document.documentElement.dataset.admin = "";
    else delete document.documentElement.dataset.admin;
    pintar();
  }

  const onAdmin = (ev: Event) => setAdmin(Boolean((ev as CustomEvent<{ on: boolean }>).detail?.on));
  const onArtista = () => {
    // si se cerró el artista que se ajustaba, se cancela
    if (ajustando >= 0 && io.abierto() !== ajustando) cancelar();
    else {
      estado = "";
      pintar();
    }
  };
  const onTecla = (ev: KeyboardEvent) => {
    // con el menú del contador abierto, Esc solo cierra el menú
    if (document.documentElement.hasAttribute("data-menu-admin")) return;
    if (ev.key === "Escape" && ajustando >= 0) {
      ev.stopPropagation();
      cancelar();
    }
  };
  window.addEventListener("pingli:admin", onAdmin);
  window.addEventListener("pingli:artista", onArtista);
  window.addEventListener("keydown", onTecla, true);

  return () => {
    quitarCuadro();
    window.removeEventListener("pingli:admin", onAdmin);
    window.removeEventListener("pingli:artista", onArtista);
    window.removeEventListener("keydown", onTecla, true);
    io.layer.removeEventListener("pointerdown", alPresionar);
    io.layer.removeEventListener("click", sinClic, true);
    barra.remove();
    capa.remove();
    delete document.documentElement.dataset.ajustando;
    delete document.documentElement.dataset.admin;
  };
}
