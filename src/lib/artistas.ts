/**
 * Los artistas en el plano.
 *
 * Cada artista es un cuadro fijo alrededor de la esfera central (lugar y
 * tamaño en site.artists). Al tocar uno:
 *  - sus proyectos salen de él y se despliegan alrededor, en abanico hacia
 *    afuera (lejos de la esfera) o donde el admin los haya puesto (offset),
 *    unidos a él con líneas de 1 px;
 *  - la cámara encuadra al artista con sus proyectos.
 * Tocar un proyecto abre su panel (como siempre). El artista se cierra
 * tocándolo otra vez, con Esc (si el panel está cerrado), tocando el plano
 * vacío o abriendo otro artista.
 *
 * Los proyectos solo existen alrededor de su artista: cerrados, quedan
 * recogidos dentro de él (su posición es la del artista, así el panel y las
 * etiquetas encuadran al artista).
 *
 * Todo se calcula en cada cuadro del motor (onFrame) y se coloca en pantalla
 * igual que el motor colocaba los lanzamientos. Los lugares y los tamaños son
 * copias que se pueden cambiar en vivo (modo admin: src/lib/artistas-ajuste.ts).
 */
import type { Artist, Release } from "@/config/site";

export type Cam = {
  x: number;
  y: number;
  scale: number;
  w: number;
  h: number;
  toScreenX(x: number): number;
  toScreenY(y: number): number;
};

export type DespliegueSettings = {
  readonly open: number;
  readonly close: number;
  readonly gap: number;
  readonly spread: number;
  readonly fan: number;
};

/** Un lugar ocupado en el mundo (para que los carteles no broten encima). */
export type Spot = { x: number; y: number; size: number };

export type ArtistasHooks = {
  /** Mueve la cámara. */
  fly: (x: number, y: number, scale: number) => void;
  /** Cuánto tapa el panel por la derecha (px). */
  panelInset: () => number;
  /** ¿El último gesto fue un arrastre? */
  wasDrag: () => boolean;
  /** ¿Está abierto el panel de un proyecto? */
  panelOpen: () => boolean;
  closePanel: () => void;
};

export type Estado = {
  readonly a: Artist;
  readonly el: HTMLElement | null;
  /** Lugar y lado del cuadro, en vivo (se pueden ajustar). */
  x: number;
  y: number;
  size: number;
  /** Despliegue de los proyectos: 0 recogidos, 1 desplegados. */
  abre: number;
  abreFrom: number;
  abreTo: number;
  abreT0: number;
  abreDur: number;
  readonly proyectos: number[];
};

const RAD = Math.PI / 180;
/** Proyectos más chicos que esto son secretos: no cuentan para el espacio del abanico. */
export const SECRETO = 10;

const sale = (t: number) => 1 - Math.pow(1 - t, 3); // power3.out
const entra = (t: number) => t * t; // power2.in

export function mountArtistas(
  layer: HTMLElement,
  lineas: SVGSVGElement,
  artists: readonly Artist[],
  releases: Release[],
  s: DespliegueSettings,
  reducedMotion: boolean,
  hooks: ArtistasHooks,
) {
  let reloj = 0;
  let abierto = -1;
  let cam: Cam | null = null;
  /** Mientras se ajusta, el plano vacío no cierra al artista ni se abren paneles. */
  let ajustando = false;
  const spots: Spot[] = [];
  const alCuadro: Array<(c: Cam) => void> = [];

  const estados: Estado[] = artists.map((a, i) => ({
    a,
    el: layer.querySelector<HTMLElement>(`[data-artista="${i}"]`),
    x: a.x,
    y: a.y,
    size: a.size,
    abre: 0,
    abreFrom: 0,
    abreTo: 0,
    abreT0: 0,
    abreDur: s.open,
    proyectos: releases.map((r, j) => (r.artistId === a.id ? j : -1)).filter((j) => j >= 0),
  }));
  const relEls = new Map<number, HTMLElement>();
  layer.querySelectorAll<HTMLElement>("[data-release]").forEach((el) => relEls.set(Number(el.dataset.release), el));

  // una línea por proyecto
  const NS = "http://www.w3.org/2000/svg";
  const lineaDe = new Map<number, SVGLineElement>();
  for (const e of estados) {
    for (const j of e.proyectos) {
      const l = document.createElementNS(NS, "line");
      l.setAttribute("class", "artista-linea");
      l.style.display = "none";
      lineas.append(l);
      lineaDe.set(j, l);
    }
  }

  /** Dónde queda cada proyecto desplegado: donde lo puso el admin, o en abanico hacia afuera. */
  function lugares(e: Estado) {
    const { x, y } = e;
    const n = e.proyectos.length;
    const tam = e.proyectos.map((j) => releases[j].size).filter((z) => z >= SECRETO);
    const maxP = tam.length ? Math.max(...tam) : e.size * 0.8;
    const gap = s.gap * e.size;
    const paso = n > 1 ? Math.min(s.spread, s.fan / (n - 1)) * RAD : 0;
    const R = Math.max(e.size / 2 + maxP / 2 + gap, n > 1 ? (maxP + gap * 0.6) / (2 * Math.sin(paso / 2)) : 0);
    const afuera = Math.hypot(x, y) > 1 ? Math.atan2(y, x) : -Math.PI / 2;
    return e.proyectos.map((j, k) => {
      const off = releases[j].offset;
      if (off) return { j, x: x + off.x, y: y + off.y };
      const ang = afuera + (k - (n - 1) / 2) * paso;
      return { j, x: x + R * Math.cos(ang), y: y + R * Math.sin(ang) };
    });
  }

  /** Coloca un cuadro en pantalla (igual que el motor); devuelve si se ve. */
  function colocar(el: HTMLElement, cx: number, cy: number, size: number, c: Cam): boolean {
    const side = size * c.scale;
    const sx = c.toScreenX(cx) - side / 2;
    const sy = c.toScreenY(cy) - side / 2;
    const maxSide = Math.max(c.w, c.h);
    const off = sx > c.w + 200 || sy > c.h + 200 || sx + side < -200 || sy + side < -200;
    if (side < 3 || side > maxSide * 3 || off) {
      if (el.dataset.lod !== "hidden") el.dataset.lod = "hidden";
      return false;
    }
    const lod = side < 56 ? "small" : "full";
    if (el.dataset.lod !== lod) el.dataset.lod = lod;
    el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
    el.style.width = `${side.toFixed(1)}px`;
    el.style.height = `${side.toFixed(1)}px`;
    return true;
  }

  function ocultar(el: HTMLElement | undefined | null) {
    if (el && el.dataset.lod !== "hidden") el.dataset.lod = "hidden";
  }

  /** Línea de borde a borde entre dos cuadros (centros y lados en el mundo). */
  function unir(l: SVGLineElement, ax: number, ay: number, aSize: number, px: number, py: number, pSize: number, alpha: number, c: Cam) {
    const dx = px - ax;
    const dy = py - ay;
    const len = Math.hypot(dx, dy);
    const ux = dx / (len || 1);
    const uy = dy / (len || 1);
    const m = Math.max(Math.abs(ux), Math.abs(uy)) || 1;
    const tA = aSize / 2 / m;
    const tP = pSize / 2 / m;
    if (alpha <= 0.001 || tA + tP >= len) {
      l.style.display = "none";
      return;
    }
    l.style.display = "";
    l.setAttribute("x1", c.toScreenX(ax + ux * tA).toFixed(1));
    l.setAttribute("y1", c.toScreenY(ay + uy * tA).toFixed(1));
    l.setAttribute("x2", c.toScreenX(px - ux * tP).toFixed(1));
    l.setAttribute("y2", c.toScreenY(py - uy * tP).toFixed(1));
    l.style.opacity = alpha >= 1 ? "" : alpha.toFixed(3);
  }

  function frame(c: Cam, dt: number) {
    cam = c;
    reloj += dt;
    spots.length = 0;
    for (const e of estados) {
      // el despliegue
      const ta = Math.min(1, (reloj - e.abreT0) / Math.max(0.01, reducedMotion ? 0.01 : e.abreDur));
      const k = e.abreTo > e.abreFrom ? sale(ta) : entra(ta);
      e.abre = e.abreFrom + (e.abreTo - e.abreFrom) * k;

      if (e.el) colocar(e.el, e.x, e.y, e.size, c);
      spots.push({ x: e.x, y: e.y, size: e.size });

      const slots = e.abre > 0.001 ? lugares(e) : null;
      let marcado: string | undefined;
      for (const [k2, j] of e.proyectos.entries()) {
        const el = relEls.get(j);
        const r = releases[j];
        const l = lineaDe.get(j);
        const tg = el?.dataset.tagged;
        if (tg) marcado = tg;
        if (!slots) {
          // recogido dentro del artista
          r.x = e.x;
          r.y = e.y;
          ocultar(el);
          if (el && el.tabIndex !== -1) el.tabIndex = -1;
          if (l) l.style.display = "none";
          continue;
        }
        const slot = slots[k2];
        const px = e.x + (slot.x - e.x) * e.abre;
        const py = e.y + (slot.y - e.y) * e.abre;
        const size = r.size * (0.25 + 0.75 * e.abre);
        r.x = px;
        r.y = py;
        spots.push({ x: px, y: py, size: r.size });
        if (el) {
          colocar(el, px, py, size, c);
          el.style.opacity = e.abre >= 0.999 ? "" : e.abre.toFixed(3);
          const t = e.abre > 0.5 ? 0 : -1;
          if (el.tabIndex !== t) el.tabIndex = r.size < SECRETO ? -1 : t;
        }
        if (l) unir(l, e.x, e.y, e.size, px, py, size, e.abre, c);
      }
      // si una etiqueta del panel enciende alguno de sus proyectos, el artista también se marca
      if (e.el) {
        if (marcado) e.el.dataset.tagged = marcado;
        else if (e.el.dataset.tagged) delete e.el.dataset.tagged;
      }
    }
    for (const f of alCuadro) f(c);
  }

  function desplegar(e: Estado, abre: number) {
    e.abreFrom = e.abre;
    e.abreTo = abre;
    e.abreT0 = reloj;
    e.abreDur = abre ? s.open : s.close;
  }

  /**
   * Encuadra al artista con sus proyectos desplegados. `abajo`: píxeles que
   * tapa algo por abajo (la barra del modo admin).
   */
  function encuadrar(e: Estado, abajo = 0) {
    if (!cam) return;
    let l = e.x - e.size / 2;
    let r = e.x + e.size / 2;
    let t = e.y - e.size / 2;
    let b = e.y + e.size / 2;
    for (const sl of lugares(e)) {
      const h = Math.max(releases[sl.j].size, SECRETO) / 2;
      l = Math.min(l, sl.x - h);
      r = Math.max(r, sl.x + h);
      t = Math.min(t, sl.y - h);
      b = Math.max(b, sl.y + h);
    }
    // el panel solo cuenta si está abierto
    const inset = hooks.panelOpen() ? hooks.panelInset() : 0;
    const pad = 90; // márgenes y espacio para los nombres
    const scale = Math.min(2.2, Math.max(40, cam.w - inset - pad * 2) / (r - l), Math.max(40, cam.h - abajo - pad * 2) / (b - t));
    hooks.fly((l + r) / 2 + inset / 2 / scale, (t + b) / 2 + (12 + abajo / 2) / scale, scale);
  }

  const avisar = () => window.dispatchEvent(new CustomEvent("pingli:artista", { detail: { index: abierto } }));

  function abrir(i: number) {
    const e = estados[i];
    if (!e) return;
    if (abierto >= 0 && abierto !== i) cerrar(false);
    abierto = i;
    desplegar(e, 1);
    if (e.el) {
      e.el.dataset.selected = "";
      e.el.setAttribute("aria-expanded", "true");
    }
    encuadrar(e);
    avisar();
  }

  function cerrar(cerrarPanel = true) {
    const e = estados[abierto];
    abierto = -1;
    if (!e) return;
    desplegar(e, 0);
    if (e.el) {
      delete e.el.dataset.selected;
      e.el.setAttribute("aria-expanded", "false");
    }
    if (cerrarPanel && hooks.panelOpen()) hooks.closePanel();
    avisar();
  }

  function toggle(i: number) {
    if (ajustando) return;
    if (abierto === i) cerrar();
    else abrir(i);
  }

  // ——— entrada
  const quitar: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
    t.addEventListener(ev, fn as EventListener, o);
    quitar.push(() => t.removeEventListener(ev, fn as EventListener, o));
  };
  for (const [i, e] of estados.entries()) {
    const el = e.el;
    if (!el) continue;
    el.setAttribute("aria-expanded", "false");
    on(el, "click", () => {
      if (hooks.wasDrag()) return;
      toggle(i);
    });
    on(el, "focus", () => {
      if (ajustando || !el.matches(":focus-visible") || !cam) return;
      const target = (Math.min(cam.w - hooks.panelInset(), cam.h) * 0.42) / e.size;
      hooks.fly(e.x, e.y, target);
    });
  }
  // Esc cierra (si el panel está cerrado: primero se cierra el panel)
  on(
    window,
    "keydown",
    (ev) => {
      if (ev.key === "Escape" && abierto >= 0 && !ajustando && !hooks.panelOpen()) cerrar();
    },
    { capture: true },
  );
  // tocar el plano vacío también cierra
  const stage = layer.parentElement;
  if (stage) {
    on(stage, "click", (ev) => {
      if (abierto < 0 || ajustando || hooks.wasDrag()) return;
      const t = ev.target as Element;
      if (t.closest("[data-release],[data-artista],.phrase,.zona,.panel,.ajuste-barra,button,a,input")) return;
      cerrar();
    });
  }

  return {
    frame,
    spots,
    toggle,
    cerrar: () => cerrar(),
    destroy() {
      quitar.forEach((f) => f());
      lineaDe.forEach((l) => l.remove());
    },
    /** Para el modo admin (artistas-ajuste.ts). */
    interno: {
      estados,
      releases,
      layer,
      encuadrar,
      cam: () => cam,
      abierto: () => abierto,
      setAjustando(v: boolean) {
        ajustando = v;
      },
      /** Se llama en cada cuadro, después de colocar todo. */
      alCuadro(f: (c: Cam) => void) {
        alCuadro.push(f);
        return () => alCuadro.splice(alCuadro.indexOf(f), 1);
      },
    },
  };
}

export type PlanoArtistas = ReturnType<typeof mountArtistas>;
