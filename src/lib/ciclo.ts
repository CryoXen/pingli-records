/**
 * El ciclo de 3:33.
 *
 * Cada visita dura 3 minutos 33 segundos, contados desde que el visitante
 * pulsa "entrar". Al cumplirse, aparece de golpe una imagen de la carpeta
 * "previsiones" y se queda 10 segundos, con su canción (la música de fondo
 * se corta). La imagen se ve completa, centrada, con aire alrededor y su
 * marco de 1 px; está quieta: no se puede mover, ampliar ni tocar, solo
 * desaparece cuando se acaba el tiempo. Después todo se detiene y el sitio
 * vuelve a la pantalla de entrada, desde cero: la portada se recarga.
 *
 * La cuenta se mide con el reloj del sistema y se revisa 5 veces por segundo
 * y cada vez que la página vuelve a estar a la vista. Así funciona aunque el
 * teléfono duerma la página un rato (bloqueo, otra app, ahorro de batería):
 * los temporizadores largos se atrasan ahí, el reloj no.
 *
 * Qué imagen sale:
 *  - Solo imágenes que de verdad cargan. La elegida (y la canción) se
 *    descarga 90 s antes; si no existe o falla, se elige otra. Si al llegar a
 *    00:00 todavía no termina de bajar (datos lentos), se la espera hasta 15 s
 *    y entonces aparece. Si ninguna carga (o no hay), no se muestra nada: el
 *    sitio se detiene y vuelve a "entrar" directamente.
 *  - Por rareza: común 60 %, rara 25 %, muy rara 12 %, única 3 % (pesos en
 *    site.cycle.rareza; si una rareza no tiene imágenes, se reparte).
 *  - Nunca la misma que la última que vio este visitante, y nunca dos del
 *    mismo tipo seguidas (si hay de otro tipo).
 *
 * Si la pestaña está oculta cuando se cumple el tiempo, la previsión espera
 * a que el visitante regrese, para que no pase sin verse.
 *
 * La cuenta regresiva se ve abajo a la derecha (el elemento con
 * data-cycle-clock): 03:33 → 00:00, con el mismo reloj que dispara la
 * previsión. Es la misma en los dos mundos y no se reinicia al cruzar.
 */
import type { Prevision, Rareza } from "@/lib/contenido/tipos";

export type CycleSettings = {
  readonly enabled: boolean;
  /** Segundos que dura cada visita (213 = 3:33). */
  readonly duration: number;
  /** Segundos que se ve la previsión. */
  readonly hold: number;
  /** "contain": la imagen se ve completa; "cover": llena la pantalla y recorta. */
  readonly fit: "contain" | "cover";
  /** Peso de cada rareza. */
  readonly rareza: Readonly<Record<Rareza, number>>;
};

const LAST_KEY = "pingli:prevision";

/** 213 → "03:33" */
export function formatClock(seconds: number): string {
  const t = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/** Con cuánta anticipación se descarga la imagen elegida (y la canción). */
const PRELOAD_S = 90;
/** Si al cumplirse el tiempo la imagen todavía no cargó, cuánto se la espera. */
const LATE_WAIT_MS = 15000;

/** Aviso a todo el sitio: empieza la previsión (se callan las frases y los sonidos de la interfaz). */
export const PREVISION_EVENT = "pingli:prevision";
/** La imagen no pasa de este ancho (px) ni de esta fracción del alto de la pantalla. */
const MAX_W = 1400;
const MAX_H = 0.8;
/** Espacio entre la imagen y su nombre (px). */
const CAPTION_GAP = 10;

/** Lo que el ciclo avisa para que suene la canción de la previsión. */
export type CycleHooks = {
  /** Al empezar a descargar la imagen: descargar también la canción. */
  readonly prepare?: () => void;
  /** Justo cuando aparece la imagen. */
  readonly show?: () => void;
};

type Last = { src: string; tipo: string };

function readLast(): Last | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    // antes se guardaba solo la ruta
    return raw.startsWith("{") ? (JSON.parse(raw) as Last) : { src: raw, tipo: "" };
  } catch {
    return null;
  }
}

function writeLast(p: Prevision) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ src: p.src, tipo: p.tipo }));
  } catch {
    /* almacenamiento bloqueado */
  }
}

/**
 * Elige una previsión: primero la rareza (por peso, entre las que tienen
 * imágenes), luego una imagen de esa rareza al azar. Sin repetir la última
 * imagen ni su tipo, mientras haya otras opciones.
 */
export function pickPrevision(
  images: readonly Prevision[],
  weights: Readonly<Record<Rareza, number>>,
  last: Last | null,
  random: () => number = Math.random,
): Prevision | null {
  if (!images.length) return null;
  let pool = images.filter((p) => p.src !== last?.src);
  if (!pool.length) pool = [...images];
  if (last?.tipo) {
    const otherType = pool.filter((p) => p.tipo !== last.tipo);
    if (otherType.length) pool = otherType;
  }
  const tiers = (Object.keys(weights) as Rareza[]).filter((r) => weights[r] > 0 && pool.some((p) => p.rareza === r));
  if (!tiers.length) return pool[Math.floor(random() * pool.length)];
  const total = tiers.reduce((a, r) => a + weights[r], 0);
  let t = random() * total;
  let tier = tiers[tiers.length - 1];
  for (const r of tiers) {
    t -= weights[r];
    if (t < 0) {
      tier = r;
      break;
    }
  }
  const inTier = pool.filter((p) => p.rareza === tier);
  return inTier[Math.floor(random() * inTier.length)];
}

export function mountCycle(
  s: CycleSettings,
  images: readonly (Prevision | string)[],
  entered: Promise<void>,
  stopAll: () => void,
  hooks: CycleHooks = {},
): () => void {
  if (!s.enabled) return () => {};
  let alive = true;
  let fired = false;
  const timers: number[] = [];
  let overlay: HTMLElement | null = null;
  const all: Prevision[] = images.map((i) => (typeof i === "string" ? { src: i, tipo: "", rareza: "comun" } : i));

  /** La imagen ya descargada, lista para mostrarse. */
  let ready: { p: Prevision; img: HTMLImageElement } | null = null;
  let loading: Promise<void> | null = null;

  /** Elige y descarga; si una imagen no carga, prueba con otra. */
  function preload(): Promise<void> {
    if (loading) return loading;
    if (all.length) hooks.prepare?.();
    loading = (async () => {
      const failed = new Set<string>();
      const last = readLast();
      for (;;) {
        const p = pickPrevision(all.filter((i) => !failed.has(i.src)), s.rareza, last);
        if (!p || !alive) return;
        const img = new Image();
        img.decoding = "async";
        img.alt = "";
        const ok = await new Promise<boolean>((done) => {
          img.onload = () => done(img.naturalWidth > 0);
          img.onerror = () => done(false);
          img.src = p.src;
        });
        if (ok) {
          // decodificada de una vez: así aparece entera, sin pintarse por partes
          await img.decode?.().catch(() => {});
          ready = { p, img };
          return;
        }
        failed.add(p.src); // no existe o no carga: no se muestra
      }
    })();
    return loading;
  }

  /** Mientras se ve la previsión no se puede hacer nada: ni mover, ni ampliar, ni teclas. */
  const block = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const BLOCKED = ["wheel", "touchstart", "touchmove", "gesturestart", "gesturechange", "contextmenu", "dragstart", "dblclick", "keydown", "pointerdown"] as const;
  const unblock = () => BLOCKED.forEach((ev) => window.removeEventListener(ev, block, { capture: true }));

  let caption: HTMLElement | null = null;

  /**
   * El tamaño de la imagen, calculado: completa, centrada exacto en lo que
   * deja libre el margen (que respeta la muesca y la barra del teléfono), sin
   * pasar de MAX_W ni de MAX_H del alto, y dejando lugar para su nombre arriba
   * y abajo (así la imagen queda en el centro y el nombre cabe debajo). Las
   * chicas también crecen hasta llenar ese espacio; si crecen 2× o más, sin
   * suavizar (se ven sus pixeles).
   */
  function layout() {
    if (!overlay || !ready || s.fit === "cover") return;
    const img = ready.img;
    const cs = getComputedStyle(overlay);
    const W = overlay.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = overlay.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const cap = caption ? caption.offsetHeight + CAPTION_GAP : 0;
    const maxW = Math.max(40, Math.min(W, MAX_W));
    const maxH = Math.max(40, Math.min(H - 2 * cap, overlay.clientHeight * MAX_H));
    const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    img.style.width = `${Math.floor(img.naturalWidth * k)}px`;
    img.style.height = `${Math.floor(img.naturalHeight * k)}px`;
    if (k >= 2) overlay.dataset.ampliada = "";
    else delete overlay.dataset.ampliada;
  }

  function show() {
    if (!ready) return;
    writeLast(ready.p);
    overlay = document.createElement("div");
    overlay.className = "prevision";
    overlay.dataset.fit = s.fit;
    overlay.dataset.rareza = ready.p.rareza;
    overlay.setAttribute("aria-hidden", "true");
    ready.img.draggable = false;
    // la imagen y, debajo, solo el nombre del archivo
    const obra = document.createElement("div");
    obra.className = "prevision-obra";
    obra.append(ready.img);
    const nombre = ready.p.nombre ?? decodeURIComponent(ready.p.src.split("/").pop() ?? "");
    if (nombre && s.fit !== "cover") {
      caption = document.createElement("p");
      caption.className = "prevision-nombre";
      caption.textContent = nombre;
      obra.append(caption);
    }
    overlay.append(obra);
    document.body.append(overlay);
    layout();
    window.addEventListener("resize", layout);
    // quieta hasta que se acaba el tiempo
    BLOCKED.forEach((ev) => window.addEventListener(ev, block, { capture: true, passive: false }));
    (document.activeElement as HTMLElement | null)?.blur?.();
    hooks.show?.();
  }

  function end() {
    if (!alive) return;
    stopAll();
    // de vuelta a "entrar", desde cero
    timers.push(window.setTimeout(() => window.location.reload(), 160));
  }

  /** Se cumplió el tiempo: la previsión (cuando la página esté a la vista). */
  async function fire() {
    if (!alive || fired || document.visibilityState !== "visible") return;
    fired = true;
    stopTicking();
    // desde aquí no brota ninguna frase ni suena nada de la interfaz: solo la canción de la previsión
    window.dispatchEvent(new CustomEvent(PREVISION_EVENT));
    if (!ready && all.length) await Promise.race([preload(), new Promise((r) => setTimeout(r, LATE_WAIT_MS))]);
    if (!alive) return;
    if (ready) {
      show();
      timers.push(window.setTimeout(end, s.hold * 1000));
    } else {
      end(); // ninguna imagen cargó: sin previsión
    }
  }

  // la cuenta en pantalla
  const clock = () => document.querySelector<HTMLElement>("[data-cycle-clock]");
  let ticker = 0;
  let shown = "";

  const paint = (left: number) => {
    const el = clock();
    const text = formatClock(left);
    if (!el || text === shown) return;
    shown = text;
    el.dataset.time = text;
    // mientras alguien la mantiene presionada (acceso al admin), la cuenta se deshace: no se pinta encima
    if (!("holding" in el.dataset)) el.textContent = text;
  };
  paint(s.duration);

  // la hora del sistema en que se cumple la visita
  let deadline = 0;
  const check = () => {
    if (!alive || fired || !deadline) return;
    const left = (deadline - Date.now()) / 1000;
    paint(left);
    if (left <= PRELOAD_S) void preload();
    if (left <= 0) void fire();
  };
  const watch = ["visibilitychange", "pageshow", "focus"] as const;
  function stopTicking() {
    window.clearInterval(ticker);
    watch.forEach((ev) => (ev === "visibilitychange" ? document : window).removeEventListener(ev, check));
  }

  /** Arranca la cuenta al entrar. */
  function run() {
    if (!alive || fired) return;
    deadline = Date.now() + s.duration * 1000;
    ticker = window.setInterval(check, 200);
    watch.forEach((ev) => (ev === "visibilitychange" ? document : window).addEventListener(ev, check));
    check();
  }

  entered.then(run);

  return () => {
    alive = false;
    stopTicking();
    unblock();
    window.removeEventListener("resize", layout);
    timers.forEach((t) => window.clearTimeout(t));
    overlay?.remove();
  };
}
