/**
 * El ciclo de 3:33.
 *
 * Cada visita dura 3 minutos 33 segundos, contados desde que el visitante
 * pulsa "entrar". Al cumplirse, aparece de golpe una previsión de la carpeta
 * "previsiones": una foto (se queda los segundos que diga el admin, con la
 * canción final; la música de fondo se corta) o un video (dura lo que dura,
 * hasta 30 s, con su propio sonido). Se ve completa, centrada, con aire
 * alrededor y su marco de 1 px; está quieta: no se puede mover, ampliar ni
 * tocar, solo desaparece cuando se acaba. Después todo se detiene y el sitio
 * vuelve a la pantalla de entrada, desde cero: la portada se recarga.
 *
 * La cuenta se mide con el reloj del sistema y se revisa 5 veces por segundo
 * y cada vez que la página vuelve a estar a la vista. Así funciona aunque el
 * teléfono duerma la página un rato (bloqueo, otra app, ahorro de batería):
 * los temporizadores largos se atrasan ahí, el reloj no.
 *
 * Qué previsión sale:
 *  - Solo las que de verdad cargan. La elegida (y la canción) se descarga
 *    90 s antes, completa, con reintentos si la red falla (datos móviles); si
 *    no existe o no se puede ver, se elige otra. Si al llegar a 00:00
 *    todavía no está (datos lentos), se sigue intentando hasta 15 s y entonces
 *    aparece. Si ninguna carga (o no hay), no se muestra nada: el sitio se
 *    detiene y vuelve a "entrar" directamente.
 *  - Por rareza: común 60 %, rara 25 %, muy rara 12 %, única 3 % (pesos en
 *    site.cycle.rareza; si una rareza no tiene previsiones, se reparte).
 *  - Nunca la misma que la última que vio este visitante, y nunca dos del
 *    mismo tipo seguidas (si hay de otro tipo).
 *
 * El sonido de un video se separa al descargarlo y suena por el mismo motor
 * que la música (respeta "vol"); el video se reproduce en silencio, así
 * ningún navegador lo bloquea.
 *
 * Si la pestaña está oculta cuando se cumple el tiempo, la previsión espera
 * a que el visitante regrese, para que no pase sin verse.
 *
 * La cuenta regresiva se ve abajo a la derecha (el elemento con
 * data-cycle-clock): 03:33 → 00:00, con el mismo reloj que dispara la
 * previsión. Es la misma en los dos mundos y no se reinicia al cruzar.
 */
import type { Prevision, Rareza } from "@/lib/contenido/tipos";
import {
  activaDestello,
  extensionDe,
  mountDestello,
  prepararDestello,
  type DestelloSettings,
} from "@/lib/destello";

export type CycleSettings = {
  readonly enabled: boolean;
  /** Segundos que dura cada visita (213 = 3:33). */
  readonly duration: number;
  /** Segundos que se ve una foto (los videos duran lo que duran). */
  readonly hold: number;
  /** "contain": se ve completa; "cover": llena la pantalla y recorta. */
  readonly fit: "contain" | "cover";
  /** Peso de cada rareza. */
  readonly rareza: Readonly<Record<Rareza, number>>;
  /** El destello de palabras de arriba (src/lib/destello.ts). */
  readonly palabras?: DestelloSettings;
};

const LAST_KEY = "pingli:prevision";

/** 213 → "03:33" */
export function formatClock(seconds: number): string {
  const t = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/** Con cuánta anticipación se descarga la previsión elegida (y la canción). */
const PRELOAD_S = 90;
/** Si al cumplirse el tiempo la previsión todavía no está, cuánto se la sigue esperando. */
const LATE_WAIT_MS = 15000;
/** Intentos de descarga de un archivo (la red del teléfono puede fallar un momento). */
const RETRIES = 3;
/** Tiempo máximo de cada intento. */
const FETCH_TIMEOUT_MS = 25000;
/** Si una imagen no termina de decodificarse en este tiempo, se muestra igual. */
const DECODE_TIMEOUT_MS = 3000;
/** Si todas fallaron, cuánto esperar antes de volver a intentar (antes de 00:00). */
const RETRY_COOLDOWN_MS = 10000;
/** Un video nunca dura más que esto en pantalla. */
const VIDEO_MAX_S = 30.5;

/** Aviso a todo el sitio: empieza la previsión (se callan las frases y los sonidos de la interfaz). */
export const PREVISION_EVENT = "pingli:prevision";
/** La previsión no pasa de este ancho (px) ni de esta fracción del alto de la pantalla. */
const MAX_W = 1400;
const MAX_H = 0.8;
/** Espacio entre la previsión y su nombre (px). */
const CAPTION_GAP = 10;

/** Lo que el ciclo avisa para que suene lo que tiene que sonar. */
export type CycleHooks = {
  /** Al empezar a descargar: descargar también la canción final. */
  readonly prepare?: () => void;
  /** Aparece una foto: suena la canción final. */
  readonly show?: () => void;
  /** Separa el sonido de un video ya descargado (null = no tiene, o no se pudo). */
  readonly decodificar?: (data: ArrayBuffer) => Promise<AudioBuffer | null>;
  /** Aparece un video: la música de fondo se corta. */
  readonly silenciar?: () => void;
  /** Suena el sonido del video, desde `offset` segundos. */
  readonly sonar?: (audio: AudioBuffer, gainDb: number, offset: number) => void;
};

type Last = { src: string; tipo: string };

function readLast(): Last | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    // antes se guardaba solo la ruta
    return raw.startsWith("{")
      ? (JSON.parse(raw) as Last)
      : { src: raw, tipo: "" };
  } catch {
    return null;
  }
}

function writeLast(p: Prevision) {
  try {
    localStorage.setItem(
      LAST_KEY,
      JSON.stringify({ src: p.src, tipo: p.tipo }),
    );
  } catch {
    /* almacenamiento bloqueado */
  }
}

const esperar = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

/**
 * Elige una previsión: primero la rareza (por peso, entre las que tienen
 * previsiones), luego una de esa rareza al azar. Sin repetir la última ni su
 * tipo, mientras haya otras opciones.
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
  const tiers = (Object.keys(weights) as Rareza[]).filter(
    (r) => weights[r] > 0 && pool.some((p) => p.rareza === r),
  );
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

/** Una previsión ya descargada y lista para verse. */
type Listo = {
  p: Prevision;
  el: HTMLImageElement | HTMLVideoElement;
  /** URL local (blob) del archivo descargado. */
  url?: string;
  /** El sonido del video, aparte. */
  audio?: AudioBuffer | null;
  /** Segundos que se ve. */
  dur: number;
};

/** "red": no se pudo descargar (sin red, CORS, tiempo); null: no existe. */
type Descarga = Blob | null | "red";

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
  const all: Prevision[] = images.map((i) =>
    typeof i === "string" ? { src: i, tipo: "", rareza: "comun" } : i,
  );

  let ready: Listo | null = null;
  let loading: Promise<void> | null = null;
  /** Después de que todas fallaron, no se reintenta antes de esta hora (salvo a las 00:00). */
  let nextTry = 0;
  const urls: string[] = [];

  /** El archivo completo, con reintentos si la red falla. */
  async function descargar(src: string): Promise<Descarga> {
    for (let intento = 0; intento < RETRIES && alive; intento++) {
      if (intento) await esperar(1500 * intento);
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      try {
        const r = await fetch(src, { signal: ac.signal });
        if (
          r.status === 400 ||
          r.status === 403 ||
          r.status === 404 ||
          r.status === 410
        )
          return null; // no existe
        if (!r.ok) continue;
        return await r.blob();
      } catch {
        /* sin red, CORS o tardó demasiado: otro intento */
      } finally {
        window.clearTimeout(t);
      }
    }
    return "red";
  }

  /** Espera a que cargue (true) o falle (false), con tiempo límite. */
  function cargaDe(
    el: HTMLImageElement | HTMLVideoElement,
    ms: number,
  ): Promise<boolean> {
    return new Promise((done) => {
      const isVideo = el instanceof HTMLVideoElement;
      const listo = () =>
        isVideo
          ? (el as HTMLVideoElement).videoWidth > 0
          : (el as HTMLImageElement).naturalWidth > 0;
      const fin = (ok: boolean) => {
        window.clearTimeout(t);
        off();
        done(ok);
      };
      const onOk = () => fin(listo());
      const onMal = () => fin(false);
      const evs = isVideo
        ? ["loadedmetadata", "loadeddata", "canplay"]
        : ["load"];
      const off = () => {
        evs.forEach((e) => el.removeEventListener(e, onOk));
        el.removeEventListener("error", onMal);
      };
      evs.forEach((e) => el.addEventListener(e, onOk));
      el.addEventListener("error", onMal);
      const t = window.setTimeout(() => fin(listo()), ms);
      if (!isVideo && (el as HTMLImageElement).complete && listo()) fin(true);
      else if (isVideo && (el as HTMLVideoElement).readyState >= 1 && listo())
        fin(true);
    });
  }

  async function prepararImagen(p: Prevision): Promise<Listo | null | "red"> {
    const blob = await descargar(p.src);
    if (blob === null || !alive) return null;
    const img = new Image();
    img.decoding = "async";
    img.alt = "";
    let url: string | undefined;
    if (blob !== "red") {
      url = URL.createObjectURL(blob);
      urls.push(url);
      img.src = url;
    } else {
      img.src = p.src; // sin fetch (p. ej. otro servidor sin CORS): directo
    }
    if (!(await cargaDe(img, url ? 15000 : FETCH_TIMEOUT_MS)))
      return blob === "red" ? "red" : null;
    // decodificada de una vez, así aparece entera; si el teléfono se tarda, se muestra igual
    await Promise.race([
      img.decode?.().catch(() => {}),
      esperar(DECODE_TIMEOUT_MS),
    ]);
    return { p, el: img, url, dur: s.hold };
  }

  async function prepararVideo(p: Prevision): Promise<Listo | null | "red"> {
    const blob = await descargar(p.src);
    if (blob === null || !alive) return null;
    const v = document.createElement("video");
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    v.preload = "auto";
    v.controls = false;
    v.disablePictureInPicture = true;
    v.setAttribute("disableremoteplayback", "");
    let url: string | undefined;
    let audio: AudioBuffer | null = null;
    if (blob !== "red") {
      url = URL.createObjectURL(blob);
      urls.push(url);
      v.src = url;
      // el sonido, aparte: suena por el motor de audio (ya desbloqueado al entrar)
      if (hooks.decodificar) {
        const decodificar = hooks.decodificar;
        audio = await Promise.race([
          blob
            .arrayBuffer()
            .then((d) => decodificar(d))
            .catch(() => null),
          esperar(15000).then(() => null),
        ]);
      }
    } else {
      v.src = p.src;
    }
    v.load();
    if (!(await cargaDe(v, url ? 15000 : FETCH_TIMEOUT_MS)))
      return blob === "red" ? "red" : null;
    const d =
      Number.isFinite(v.duration) && v.duration > 0
        ? v.duration
        : (p.duracion ?? 10);
    return { p, el: v, url, audio, dur: Math.min(VIDEO_MAX_S, d) };
  }

  /** Elige y descarga; si una no carga, prueba con otra. */
  function preload(force = false): Promise<void> {
    if (loading) return loading;
    if (ready || !all.length || (!force && Date.now() < nextTry))
      return Promise.resolve();
    hooks.prepare?.();
    // las palabras, solo si alguna previsión las va a usar
    if (s.palabras?.enabled && all.some((i) => activaDestello(i.tipo)))
      void prepararDestello();
    loading = (async () => {
      const failed = new Set<string>();
      const last = readLast();
      while (alive && !ready) {
        const p = pickPrevision(
          all.filter((i) => !failed.has(i.src)),
          s.rareza,
          last,
        );
        if (!p) break;
        let r: Listo | null | "red" = null;
        try {
          r = await (p.medio === "video"
            ? prepararVideo(p)
            : prepararImagen(p));
        } catch {
          r = null;
        }
        if (r && r !== "red") ready = r;
        else failed.add(p.src); // no existe, no carga o sin red: se prueba con otra
      }
    })().finally(() => {
      loading = null;
      if (!ready) nextTry = Date.now() + RETRY_COOLDOWN_MS; // todas fallaron: se vuelve a intentar después
    });
    return loading;
  }

  /** Mientras se ve la previsión no se puede hacer nada: ni mover, ni ampliar, ni teclas. */
  const block = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const BLOCKED = [
    "wheel",
    "touchstart",
    "touchmove",
    "gesturestart",
    "gesturechange",
    "contextmenu",
    "dragstart",
    "dblclick",
    "keydown",
    "pointerdown",
  ] as const;
  const unblock = () =>
    BLOCKED.forEach((ev) =>
      window.removeEventListener(ev, block, { capture: true }),
    );

  let caption: HTMLElement | null = null;
  let pararDestello = () => {};

  /**
   * El tamaño de la previsión, calculado: completa, centrada exacto en lo que
   * deja libre el margen (que respeta la muesca y la barra del teléfono), sin
   * pasar de MAX_W ni de MAX_H del alto, y dejando lugar para su nombre arriba
   * y abajo (así queda en el centro y el nombre cabe debajo). Las chicas
   * también crecen hasta llenar ese espacio; si crecen 2× o más, sin suavizar
   * (se ven sus pixeles).
   */
  function layout() {
    if (!overlay || !ready || s.fit === "cover") return;
    const el = ready.el;
    const isVideo = el instanceof HTMLVideoElement;
    // un video que todavía no dice su tamaño: 16:9 mientras tanto
    const nw =
      (isVideo
        ? (el as HTMLVideoElement).videoWidth
        : (el as HTMLImageElement).naturalWidth) || 1600;
    const nh =
      (isVideo
        ? (el as HTMLVideoElement).videoHeight
        : (el as HTMLImageElement).naturalHeight) || 900;
    const cs = getComputedStyle(overlay);
    const vw = overlay.clientWidth || window.innerWidth;
    const vh = overlay.clientHeight || window.innerHeight;
    const W = vw - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = vh - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const cap = caption ? caption.offsetHeight + CAPTION_GAP : 0;
    const maxW = Math.max(40, Math.min(W, MAX_W));
    const maxH = Math.max(40, Math.min(H - 2 * cap, vh * MAX_H));
    const k = Math.min(maxW / nw, maxH / nh);
    el.style.width = `${Math.floor(nw * k)}px`;
    el.style.height = `${Math.floor(nh * k)}px`;
    if (k >= 2 && !isVideo) overlay.dataset.ampliada = "";
    else delete overlay.dataset.ampliada;
  }

  function show(r: Listo) {
    writeLast(r.p);
    overlay = document.createElement("div");
    overlay.className = "prevision";
    overlay.dataset.fit = s.fit;
    overlay.dataset.rareza = r.p.rareza;
    overlay.dataset.medio =
      r.el instanceof HTMLVideoElement ? "video" : "imagen";
    overlay.setAttribute("aria-hidden", "true");
    r.el.draggable = false;
    // la previsión y, debajo, solo el nombre del archivo
    const obra = document.createElement("div");
    obra.className = "prevision-obra";
    obra.append(r.el);
    const nombre =
      r.p.nombre ?? decodeURIComponent(r.p.src.split("/").pop() ?? "");
    if (nombre && s.fit !== "cover") {
      caption = document.createElement("p");
      caption.className = "prevision-nombre";
      caption.textContent = nombre;
      // tipo "previsión": en lugar del nombre, palabras de los libros con la extensión del archivo
      if (s.palabras?.enabled && activaDestello(r.p.tipo)) {
        caption.dataset.destello = "";
        pararDestello = mountDestello(
          caption,
          extensionDe(r.p.src),
          s.palabras,
        );
      }
      obra.append(caption);
    }
    overlay.append(obra);
    document.body.append(overlay);
    layout();
    window.addEventListener("resize", layout);
    // quieta hasta que se acaba el tiempo
    BLOCKED.forEach((ev) =>
      window.addEventListener(ev, block, { capture: true, passive: false }),
    );
    (document.activeElement as HTMLElement | null)?.blur?.();

    if (r.el instanceof HTMLVideoElement) mostrarVideo(r, r.el);
    else {
      hooks.show?.();
      timers.push(window.setTimeout(end, r.dur * 1000));
    }
  }

  /** El video, desde el inicio, en silencio; su sonido va aparte, sincronizado. */
  function mostrarVideo(r: Listo, v: HTMLVideoElement) {
    v.addEventListener("loadedmetadata", layout);
    hooks.silenciar?.();
    let sonando = false;
    const conSonido = () => {
      if (sonando || !r.audio || !hooks.sonar) return;
      sonando = true;
      hooks.sonar(r.audio, r.p.ganancia ?? 0, v.currentTime);
    };
    v.addEventListener("playing", conSonido, { once: true });
    v.addEventListener("ended", end, { once: true });
    try {
      v.currentTime = 0;
    } catch {
      /* sin datos todavía */
    }
    const play = (muted: boolean) => {
      v.muted = muted;
      return v.play();
    };
    if (r.audio) {
      void play(true).catch(() => {});
    } else {
      // sin sonido aparte (formato raro): el video suena solo, si el navegador lo deja
      play(false).catch(() => play(true).catch(() => {}));
    }
    // por si el video no avisa que terminó
    timers.push(window.setTimeout(end, (r.dur + 1.5) * 1000));
  }

  let ended = false;
  function end() {
    if (!alive || ended) return;
    ended = true;
    if (ready?.el instanceof HTMLVideoElement) ready.el.pause();
    stopAll();
    // de vuelta a "entrar", desde cero
    timers.push(window.setTimeout(() => window.location.reload(), 160));
  }

  /** ¿Sigue lista? (en teléfonos con poca memoria, mejor revisar) */
  const sigueLista = (r: Listo) =>
    r.el instanceof HTMLVideoElement
      ? !r.el.error
      : (r.el as HTMLImageElement).naturalWidth > 0;

  /** Se cumplió el tiempo: la previsión (cuando la página esté a la vista). */
  async function fire() {
    if (!alive || fired || document.visibilityState !== "visible") return;
    fired = true;
    stopTicking();
    // desde aquí no brota ninguna frase ni suena nada de la interfaz: solo lo de la previsión
    window.dispatchEvent(new CustomEvent(PREVISION_EVENT));
    if (ready && !sigueLista(ready)) ready = null;
    if (!ready && all.length) {
      // todavía no está: se sigue intentando, hasta LATE_WAIT_MS
      const hasta = Date.now() + LATE_WAIT_MS;
      while (alive && !ready && Date.now() < hasta) {
        await Promise.race([preload(true), esperar(hasta - Date.now())]);
        if (!ready) await esperar(400);
      }
    }
    if (!alive) return;
    if (ready) show(ready);
    else end(); // ninguna cargó: sin previsión
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
    watch.forEach((ev) =>
      (ev === "visibilitychange" ? document : window).removeEventListener(
        ev,
        check,
      ),
    );
  }

  /** Arranca la cuenta al entrar. */
  function run() {
    if (!alive || fired) return;
    deadline = Date.now() + s.duration * 1000;
    ticker = window.setInterval(check, 200);
    watch.forEach((ev) =>
      (ev === "visibilitychange" ? document : window).addEventListener(
        ev,
        check,
      ),
    );
    check();
  }

  entered.then(run);

  return () => {
    alive = false;
    stopTicking();
    unblock();
    window.removeEventListener("resize", layout);
    timers.forEach((t) => window.clearTimeout(t));
    if (ready?.el instanceof HTMLVideoElement) ready.el.pause();
    pararDestello();
    overlay?.remove();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}
