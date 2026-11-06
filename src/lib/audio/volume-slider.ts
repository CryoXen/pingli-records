/**
 * Deslizador de volumen.
 *
 * Se dibuja en un canvas con el lenguaje del lienzo: la etiqueta en
 * monoespaciada, una fila de puntos y un marco vacío de 1 px como los
 * lanzamientos. Cada vez que pierde el foco se pixelea por pasos hasta
 * quedar como un bitmap de baja resolución; al pasar el cursor, tocarlo o
 * llegar con el teclado, se resuelve nítido.
 *
 * Accesible: role="slider" con flechas, Inicio/Fin y Re Pág/Av Pág.
 */
import type { Ambient } from "./ambient";

/** Tamaño en px CSS. */
const W = 112;
const H = 16;
/** Tamaño de bloque (px CSS) de cada paso del pixelado. 0 = nítido; el último es el reposo. */
const STEPS = [0, 1.5, 2.5, 4];
/** Milisegundos por paso al desenfocarse y al enfocarse. */
const BLUR_STEP_MS = 75;
const FOCUS_STEP_MS = 40;
/** Espera antes de empezar a pixelearse (evita parpadeos al pasar rápido). */
const REST_DELAY_MS = 350;
const KEY_STEP = 0.05;
const PAGE_STEP = 0.2;
const WHEEL_STEP = 0.03;
const DOT_PITCH = 4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type Palette = { ink: string; ink2: string; grid: string; link: string; paper: string; mono: string };

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--ink", "#000"),
    ink2: v("--ink-2", "#5d6067"),
    grid: v("--grid", "#9fa3aa"),
    link: v("--link", "#0000ee"),
    paper: v("--paper", "#ecedef"),
    mono: v("--font-mono", "monospace"),
  };
}

export function mountVolumeSlider(host: HTMLElement, ambient: Ambient, label: string): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => canvas.remove();

  host.tabIndex = 0;
  host.setAttribute("role", "slider");
  host.setAttribute("aria-label", "volumen");
  host.setAttribute("aria-valuemin", "0");
  host.setAttribute("aria-valuemax", "100");
  host.setAttribute("aria-orientation", "horizontal");

  let value = ambient.getVolume();
  let hover = false;
  let focused = false;
  let dragging = false;
  let level = STEPS.length - 1; // empieza en reposo: pixelado
  let target = level;
  let stepTimer = 0;
  let restTimer = 0;
  let pal = readPalette();
  let labelW = 24;

  const track = () => ({ x0: Math.ceil(labelW) + 9, x1: W - 5 });

  function scene(c: CanvasRenderingContext2D) {
    c.clearRect(0, 0, W, H);
    c.font = `13px ${pal.mono}`;
    c.textBaseline = "middle";
    labelW = c.measureText(label).width;
    c.fillStyle = pal.ink2;
    c.fillText(label, 0, H / 2 + 1);

    const { x0, x1 } = track();
    const pos = x0 + value * (x1 - x0);
    for (let x = x0; x <= x1 + 0.01; x += DOT_PITCH) {
      c.fillStyle = x <= pos ? pal.ink : pal.grid;
      c.fillRect(Math.round(x) - 1, H / 2 - 1, 2, 2);
    }

    // el marco: un cuadro vacío de 1 px, como los lanzamientos del lienzo
    const live = hover || focused || dragging;
    const tx = Math.round(pos) - 3;
    c.fillStyle = pal.paper;
    c.fillRect(tx, 3, 7, 10);
    c.fillStyle = live ? pal.link : pal.ink;
    c.fillRect(tx, 3, 7, 1);
    c.fillRect(tx, 12, 7, 1);
    c.fillRect(tx, 3, 1, 10);
    c.fillRect(tx + 6, 3, 1, 10);
  }

  function render() {
    const b = STEPS[level];
    if (b === 0) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    } else {
      // pocos píxeles, estirados sin suavizado: el bitmap se ve en bloques
      canvas.width = Math.ceil(W / b);
      canvas.height = Math.ceil(H / b);
    }
    ctx!.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    scene(ctx!);
    host.dataset.pixel = String(b);
  }

  function stepTo(t: number) {
    target = t;
    window.clearTimeout(stepTimer);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = () => {
      if (level === target) return;
      level = reduce ? target : level + Math.sign(target - level);
      render();
      if (level !== target) stepTimer = window.setTimeout(step, target === 0 ? FOCUS_STEP_MS : BLUR_STEP_MS);
    };
    step();
  }

  /** Nítido mientras hay atención; pixelado al perderla. */
  function settle() {
    window.clearTimeout(restTimer);
    if (hover || focused || dragging) stepTo(0);
    else restTimer = window.setTimeout(() => stepTo(STEPS.length - 1), REST_DELAY_MS);
    render();
  }

  function set(v: number) {
    value = clamp01(v);
    ambient.setVolume(value);
    const pct = Math.round(value * 100);
    host.setAttribute("aria-valuenow", String(pct));
    host.setAttribute("aria-valuetext", `${pct} %`);
    render();
  }

  function fromPointer(clientX: number) {
    const r = canvas.getBoundingClientRect();
    const { x0, x1 } = track();
    set((clientX - r.left - x0) / (x1 - x0));
  }

  // el lienzo de abajo no debe enterarse: ni arrastre, ni zoom, ni flechas
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    host.dataset.pointer = ""; // con mouse o dedo no se dibuja el recuadro de foco
    host.focus({ preventScroll: true });
    dragging = true;
    host.setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
    settle();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    fromPointer(e.clientX);
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    dragging = false;
    if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    settle();
  };
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    hover = true;
    settle();
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    hover = false;
    settle();
  };
  const onFocus = () => {
    focused = true;
    settle();
  };
  const onBlur = () => {
    focused = false;
    delete host.dataset.pointer;
    settle();
  };
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowLeft: value - KEY_STEP,
      ArrowDown: value - KEY_STEP,
      ArrowRight: value + KEY_STEP,
      ArrowUp: value + KEY_STEP,
      PageDown: value - PAGE_STEP,
      PageUp: value + PAGE_STEP,
      Home: 0,
      End: 1,
    };
    delete host.dataset.pointer;
    if (!(e.key in map)) return;
    e.preventDefault();
    e.stopPropagation();
    set(map[e.key]);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? -e.deltaY : e.deltaX;
    if (d) set(value + Math.sign(d) * WHEEL_STEP);
  };
  const swallow = (e: Event) => e.stopPropagation();
  // un clic en el lienzo no siempre quita el foco: se quita a mano
  const onOutside = (e: PointerEvent) => {
    if (document.activeElement === host && !host.contains(e.target as Node)) host.blur();
  };
  const theme = new MutationObserver(() => {
    pal = readPalette();
    render();
  });

  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);
  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("focus", onFocus);
  host.addEventListener("blur", onBlur);
  host.addEventListener("keydown", onKey);
  host.addEventListener("wheel", onWheel, { passive: false });
  host.addEventListener("click", swallow);
  host.addEventListener("dblclick", swallow);
  document.addEventListener("pointerdown", onOutside, true);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-side"] });
  document.fonts?.ready.then(render);

  set(value);

  return () => {
    window.clearTimeout(stepTimer);
    window.clearTimeout(restTimer);
    theme.disconnect();
    document.removeEventListener("pointerdown", onOutside, true);
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onUp);
    host.removeEventListener("pointerenter", onEnter);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("focus", onFocus);
    host.removeEventListener("blur", onBlur);
    host.removeEventListener("keydown", onKey);
    host.removeEventListener("wheel", onWheel);
    host.removeEventListener("click", swallow);
    host.removeEventListener("dblclick", swallow);
    canvas.remove();
  };
}
