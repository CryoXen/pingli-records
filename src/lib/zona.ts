/**
 * La zona: el cuarto que hay dentro de la imagen rota de los carteles.
 *
 * Si haces zoom sobre la imagen de un cartel hasta que llena la pantalla,
 * entras. Adentro están todos los carteles que ya leíste, en sus huecos (los
 * que faltan son marcos vacíos con su número). Adentro también hay zoom y se
 * arrastra para moverse. Para salir, aléjate: el zoom se detiene en el
 * encuadre completo y, si sigues alejándote, sales al plano, frente al cartel
 * por el que entraste.
 *
 * Teclado: + / − acercan y alejan (− en el encuadre completo sale), 0 encuadra,
 * flechas mueven, Esc sale.
 */
import type { Cartel } from "@/config/carteles";
import { buildWall, WALL_CELL, WALL_WIDTH, wallLod, type WallCopy } from "./muro";
import type { DiveInfo } from "./phrases";
import { closeRelease } from "./release-panel";

export type ZoneSettings = {
  /** false = no hay zona: hacer zoom a la imagen no abre nada. */
  readonly enabled: boolean;
  /** Qué tanto de la pantalla (0–1, el lado corto) tiene que llenar la imagen del cartel para entrar. */
  readonly dive: number;
  /** Desde el encuadre completo, hasta dónde hay que alejarse para salir (0.8 = al 80 %). */
  readonly exit: number;
};

export type ZoneCopy = WallCopy & {
  /** Nombre de la zona para lectores de pantalla. */
  readonly label: string;
};

type Hooks = {
  /** Mueve la cámara del plano (al salir). */
  readonly fly: (x: number, y: number, scale: number) => void;
  /** Detiene o reanuda los carteles del plano mientras la zona está abierta. */
  readonly pause: (on: boolean) => void;
};

/** Lo más cerca que se puede llegar: un hueco a 2/5 del lado corto de la pantalla (o 4 veces el encuadre). */
const maxZoom = (fit: number) => Math.max(fit * 4, (Math.min(window.innerWidth, window.innerHeight) * 0.4) / WALL_CELL);
/** Una pausa así de larga en la rueda separa un gesto de otro (ms). */
const GESTURE_GAP = 220;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function mountZone(
  /** La capa de carteles: la zona se pone justo encima de ella (debajo de la interfaz). */
  after: HTMLElement,
  s: ZoneSettings,
  claro: readonly Cartel[],
  oscuro: readonly Cartel[],
  copy: ZoneCopy,
  signImage: string | null,
  hooks: Hooks,
): { enter(d: DiveInfo): void; isOpen(): boolean; destroy(): void } {
  if (!s.enabled) return { enter() {}, isOpen: () => false, destroy() {} };

  const zone = document.createElement("div");
  zone.className = "zona";
  zone.hidden = true;
  zone.tabIndex = -1;
  zone.setAttribute("role", "dialog");
  zone.setAttribute("aria-modal", "true");
  zone.setAttribute("aria-label", copy.label);
  const wall = buildWall(claro, oscuro, copy, signImage);
  const content = wall.el;
  content.classList.add("zona-muro");
  // el umbral: la imagen del cartel, que se abre al entrar
  const door = document.createElement("img");
  door.className = "zona-umbral";
  door.alt = "";
  if (signImage) door.src = signImage;
  zone.append(content, door);
  after.after(zone);

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let open = false;
  /** Ya terminó de entrar: responde a los gestos. */
  let ready = false;
  let back: DiveInfo["back"] | null = null;
  let returnFocus: HTMLElement | null = null;

  // cámara de la zona: el muro se dibuja en (x, y) de pantalla, a escala k
  const cam = { x: 0, y: 0, k: 1 };
  let fit = 1;
  let H = 0;
  let box = { l: 0, t: 0, w: 1, h: 1 };
  let anim = 0;

  function measure() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // lo que deja libre la interfaz: la línea de arriba y el nombre de abajo
    const top = document.querySelector<HTMLElement>(".overlay-top")?.getBoundingClientRect().bottom ?? 56;
    const mark = document.querySelector<HTMLElement>(".overlay .wordmark")?.getBoundingClientRect().top ?? h - 72;
    const side = w > 720 ? 40 : 16;
    box = { l: side, t: top + 24, w: w - side * 2, h: Math.max(120, mark - top - 48) };
    H = content.offsetHeight || H;
    fit = Math.min(box.w / WALL_WIDTH, box.h / H);
  }

  /** Centra el muro si cabe; si no, no deja que se salga del todo. */
  function clamp() {
    const cw = WALL_WIDTH * cam.k;
    const ch = H * cam.k;
    const span = (pos: number, size: number, start: number, room: number) =>
      size <= room ? start + (room - size) / 2 : Math.min(start, Math.max(start + room - size, pos));
    cam.x = span(cam.x, cw, box.l, box.w);
    cam.y = span(cam.y, ch, box.t, box.h);
  }

  function paint() {
    content.style.transform = `translate3d(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px, 0) scale(${cam.k.toFixed(5)})`;
    content.dataset.lod = wallLod(WALL_CELL * cam.k);
    // alejándote del encuadre completo, el muro se aleja también: estás saliendo
    const pull = cam.k < fit ? (fit - cam.k) / (fit - fit * s.exit) : 0;
    content.style.opacity = String(1 - Math.min(1, pull) * 0.6);
  }

  function zoomAt(px: number, py: number, f: number, floor: number) {
    const k = Math.min(maxZoom(fit), Math.max(floor, cam.k * f));
    cam.x = px - (px - cam.x) * (k / cam.k);
    cam.y = py - (py - cam.y) * (k / cam.k);
    cam.k = k;
    clamp();
    paint();
    if (cam.k <= fit * s.exit + 1e-6) leave();
  }

  /** Lleva la cámara de la zona a `k` (y al centro, si es el encuadre completo) en `ms`. */
  function glide(k: number, ms: number, around?: { x: number; y: number }) {
    cancelAnimationFrame(anim);
    const from = { ...cam };
    const p = around ?? { x: box.l + box.w / 2, y: box.t + box.h / 2 };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = reduce() ? 1 : Math.min(1, (now - t0) / ms);
      const kk = from.k + (k - from.k) * ease(t);
      cam.k = kk;
      cam.x = p.x - (p.x - from.x) * (kk / from.k);
      cam.y = p.y - (p.y - from.y) * (kk / from.k);
      clamp();
      paint();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  // —— gestos ——
  // Un gesto que empieza acercado se detiene en el encuadre completo; para
  // salir hace falta otro gesto (así la inercia de la rueda no te saca sin querer).
  let floor = 0;
  let lastWheel = 0;
  let springTimer = 0;
  const gestureFloor = () => (cam.k > fit * 1.001 ? fit : fit * s.exit);
  const springBack = () => {
    if (open && cam.k < fit) glide(fit, 220);
  };

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!ready) return;
    const now = performance.now();
    if (now - lastWheel > GESTURE_GAP) floor = gestureFloor();
    lastWheel = now;
    cancelAnimationFrame(anim);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    if (e.shiftKey && !e.ctrlKey) {
      cam.x -= e.deltaY * unit;
      cam.y -= e.deltaX * unit;
      clamp();
      paint();
    } else {
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.012 : 0.0018)), floor);
    }
    window.clearTimeout(springTimer);
    springTimer = window.setTimeout(springBack, GESTURE_GAP);
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const mid = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  function onDown(e: PointerEvent) {
    e.stopPropagation(); // el plano de atrás no se entera
    if (!ready || (e.pointerType === "mouse" && e.button !== 0)) return;
    cancelAnimationFrame(anim);
    window.clearTimeout(springTimer);
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      /* puntero que ya no existe: se sigue igual */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinch = mid().d;
      floor = gestureFloor();
    }
    zone.dataset.dragging = "";
  }

  function onMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!ready || !prev) return;
    if (pointers.size === 1) {
      cam.x += e.clientX - prev.x;
      cam.y += e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clamp();
      paint();
    } else if (pointers.size === 2) {
      const before = mid();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const after = mid();
      cam.x += after.x - before.x;
      cam.y += after.y - before.y;
      if (pinch > 0) zoomAt(after.x, after.y, after.d / pinch, floor);
      pinch = after.d;
    }
  }

  function onUp(e: PointerEvent) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) {
      delete zone.dataset.dragging;
      springBack();
    }
  }

  function onDouble(e: MouseEvent) {
    e.stopPropagation();
    if (!ready) return;
    if (e.shiftKey) {
      if (cam.k <= fit * 1.001) leave();
      else glide(Math.max(fit, cam.k / 2), 450, { x: e.clientX, y: e.clientY });
    } else glide(Math.min(maxZoom(fit), cam.k * 2), 450, { x: e.clientX, y: e.clientY });
  }

  function onKey(e: KeyboardEvent) {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!ready) {
      // entrando: ninguna tecla le llega al plano, pero todavía no se mueve nada
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const c = { x: box.l + box.w / 2, y: box.t + box.h / 2 };
    const step = e.shiftKey ? 320 : 90;
    switch (e.key) {
      case "Escape":
        leave();
        break;
      case "-":
      case "_":
        if (cam.k <= fit * 1.001) leave();
        else glide(Math.max(fit, cam.k / 1.6), 300, c);
        break;
      case "+":
      case "=":
        glide(Math.min(maxZoom(fit), cam.k * 1.6), 300, c);
        break;
      case "0":
      case "Home":
        glide(fit, 300);
        break;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown":
        cam.x += e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0;
        cam.y += e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
        clamp();
        paint();
        break;
      case "Tab":
        // nada que enfocar adentro: el foco se queda en la zona
        e.preventDefault();
        break;
      default:
        return;
    }
    e.preventDefault();
    // la tecla no le llega al plano de atrás
    e.stopPropagation();
  }

  const onResize = () => {
    if (!open) return;
    const wasFit = cam.k <= fit * 1.001;
    measure();
    if (wasFit) cam.k = fit;
    clamp();
    paint();
  };

  zone.addEventListener("wheel", onWheel, { passive: false });
  zone.addEventListener("pointerdown", onDown);
  zone.addEventListener("pointermove", onMove);
  zone.addEventListener("pointerup", onUp);
  zone.addEventListener("pointercancel", onUp);
  zone.addEventListener("dblclick", onDouble);
  // en captura: antes que el teclado del plano
  window.addEventListener("keydown", onKey, { capture: true });
  window.addEventListener("resize", onResize);

  // —— entrar y salir ——
  function enter(d: DiveInfo) {
    if (open) return;
    open = true;
    back = d.back;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hooks.pause(true);
    closeRelease();
    zone.hidden = false;
    measure();
    cam.k = fit;
    clamp();
    paint();
    zone.focus({ preventScroll: true });
    if (reduce()) {
      zone.dataset.state = "open";
      ready = true;
      return;
    }
    // el muro crece desde la imagen, y la imagen se abre y se va
    const target = { ...cam };
    const r = d.rect;
    const k0 = Math.min(r.width / WALL_WIDTH, r.height / H) * 0.6;
    cam.k = k0;
    cam.x = r.left + (r.width - WALL_WIDTH * k0) / 2;
    cam.y = r.top + (r.height - H * k0) / 2;
    paint();
    door.style.left = `${r.left}px`;
    door.style.top = `${r.top}px`;
    door.style.width = `${r.width}px`;
    door.style.height = `${r.height}px`;
    zone.dataset.state = "entering";
    const t0 = performance.now();
    const from = { ...cam };
    cancelAnimationFrame(anim);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 760);
      const e = ease(t);
      cam.k = from.k + (target.k - from.k) * e;
      cam.x = from.x + (target.x - from.x) * e;
      cam.y = from.y + (target.y - from.y) * e;
      paint();
      content.style.opacity = String(Math.min(1, t * 1.8));
      door.style.transform = `scale(${(1 + 5 * e).toFixed(3)})`;
      door.style.opacity = String(1 - Math.min(1, t * 1.4));
      if (t < 1) anim = requestAnimationFrame(step);
      else {
        zone.dataset.state = "open";
        ready = true;
        door.style.transform = "";
        door.style.opacity = "";
      }
    };
    anim = requestAnimationFrame(step);
  }

  function leave() {
    if (!open) return;
    open = false;
    ready = false;
    pointers.clear();
    pinch = 0;
    window.clearTimeout(springTimer);
    cancelAnimationFrame(anim);
    const done = () => {
      zone.hidden = true;
      delete zone.dataset.state;
      delete zone.dataset.dragging;
      content.style.opacity = "";
      hooks.pause(false);
      // de vuelta al plano, frente al cartel por el que entraste
      if (back) hooks.fly(back.x, back.y, back.scale);
      returnFocus?.focus?.({ preventScroll: true });
      returnFocus = null;
    };
    if (reduce()) return done();
    // el muro se encoge y la zona se desvanece: detrás sigue la imagen, enorme
    zone.dataset.state = "leaving";
    const from = { ...cam };
    const c = { x: box.l + box.w / 2, y: box.t + box.h / 2 };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 420);
      const e = ease(t);
      const k = from.k * (1 - 0.45 * e);
      cam.k = k;
      cam.x = c.x - (c.x - from.x) * (k / from.k);
      cam.y = c.y - (c.y - from.y) * (k / from.k);
      content.style.transform = `translate3d(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px, 0) scale(${k.toFixed(5)})`;
      zone.style.opacity = String(1 - e);
      if (t < 1) anim = requestAnimationFrame(step);
      else {
        zone.style.opacity = "";
        done();
      }
    };
    anim = requestAnimationFrame(step);
  }

  return {
    enter,
    isOpen: () => open,
    destroy() {
      cancelAnimationFrame(anim);
      window.clearTimeout(springTimer);
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("resize", onResize);
      wall.destroy();
      zone.remove();
    },
  };
}
