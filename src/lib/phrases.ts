/**
 * Frases que brotan del plano.
 *
 * En momentos al azar, una frase aparece en algún punto visible del lienzo y
 * queda plantada ahí: se mueve y crece con el plano, como los lanzamientos.
 * Solo ciertos segmentos del plano "hablan" (los demás guardan silencio) y
 * cada segmento tiende a hablar de un mismo tema.
 *
 * Cada lado del sitio tiene su propio banco: el claro habla con una voz
 * vitalista; el oscuro, con la de la técnica y lo críptico.
 *
 * Cuando el visitante se enfoca en una (la tiene cerca del centro, a un
 * tamaño legible, o le pone el cursor encima), empieza una cuenta de 10 s.
 * Al llegar a cero se desvanece: sus letras se degradan en los caracteres de
 * la figura ASCII (* + ^ ; : , .) hasta quedar en blanco. Si nadie la mira,
 * se va sola después de un rato, sin cuenta.
 *
 * Devenir: a veces, al terminar la cuenta, la frase no se apaga. Se deshace
 * en caracteres y se rehace en otra frase del mismo tema, en el mismo lugar,
 * que puede volver a mirarse.
 *
 * Aparece al revés de como se va: de caracteres sueltos a texto.
 */

import { icono } from "@/config/iconos";
import { collect, collected } from "./carteles-store";

export type PhraseSettings = {
  readonly enabled: boolean;
  /** Qué brota: "carteles" (dibujo + frase, se coleccionan en el muro) o "frases" (las anteriores, solo texto). */
  readonly source: "carteles" | "frases";
  /** Imagen para todos los carteles (en lugar de los dibujos de iconos.ts). null = usar los dibujos. */
  readonly signImage: string | null;
  /** Segundos entre apariciones: al azar dentro de este rango. */
  readonly every: readonly [number, number];
  /** Segundos después de entrar antes de la primera frase. */
  readonly startAfter: number;
  /** Cuántas frases a la vez, como máximo. */
  readonly maxVisible: number;
  /** Qué parte del plano habla (0–1). El resto de los segmentos guarda silencio. */
  readonly fertility: number;
  /** Tamaño de un segmento del plano, en px de pantalla, al nivel de zoom en que estés. */
  readonly segment: number;
  /** Segundos de atención para que empiece la cuenta. */
  readonly attention: number;
  /** La cuenta: segundos hasta que se desvanece. */
  readonly timer: number;
  /** Mostrar la cuenta junto a la frase. */
  readonly showTimer: boolean;
  /** Si nadie la mira, se va sola después de estos segundos. */
  readonly idle: number;
  /** Tamaño del texto al aparecer, en px. Luego crece o se encoge con el zoom. */
  readonly size: number;
  /** Probabilidad (0–1) de que, al terminar la cuenta, la frase devenga otra en vez de apagarse. */
  readonly becoming: number;
  /** Cuántas veces seguidas puede devenir una misma frase. */
  readonly maxBecomings: number;
  /** Dónde no brota nada, en unidades del plano (a zoom 1 son px), a cualquier zoom. */
  readonly keepOut: {
    /** Radio alrededor del núcleo (0, 0): la zona principal. La figura mide 230 de radio. */
    readonly core: number;
    /** Margen alrededor de cada lanzamiento, como fracción de su tamaño (0.75 = tres cuartos de cuadro por lado). */
    readonly releases: number;
  };
};

/** Una frase suelta, o un cartel: dibujo + frase, con un id que se colecciona. */
export type PhraseItem = string | { readonly id: string; readonly icono: string; readonly texto: string };
export type PhraseBank = { readonly [theme: string]: readonly PhraseItem[] };
const textOf = (it: PhraseItem) => (typeof it === "string" ? it : it.texto);
const signOf = (it: PhraseItem) => (typeof it === "string" ? null : it);
/** Un banco por lado del sitio. */
export type PhraseWorlds = { readonly claro: PhraseBank; readonly oscuro: PhraseBank };
type World = keyof PhraseWorlds;

/** Lo que el motor del lienzo sabe de la cámara. */
export type CameraLike = { x: number; y: number; scale: number; w: number; h: number };

/** Un zoom muy profundo sobre la imagen de un cartel: la puerta a la zona. */
export type DiveInfo = {
  /** Dónde está la imagen en pantalla en ese momento. */
  readonly rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** A dónde regresar la cámara al salir (coordenadas del mundo y zoom en que el cartel se lee). */
  readonly back: { readonly x: number; readonly y: number; readonly scale: number };
};

/** Un lanzamiento del plano: centro en coordenadas del mundo y tamaño (como en site.releases). */
export type ReleaseSpot = { readonly x: number; readonly y: number; readonly size: number };

export type PhraseOptions = {
  /** Lanzamientos: no brota nada en el área alrededor de ellos (ver keepOut.releases). */
  readonly releases?: readonly ReleaseSpot[];
  /** Qué tanto de la pantalla (0–1, el lado corto) tiene que llenar la imagen del cartel para entrar a la zona. */
  readonly dive?: number;
  /** Zoom muy profundo sobre la imagen de un cartel: abre la zona. */
  readonly onDive?: (d: DiveInfo) => void;
};

/** Densidad de la figura ASCII, de más a menos: las letras se degradan por aquí. */
const DECAY = "*+^;:,. ";
const IN_MS = 1400;
const OUT_MS = 2400;
/** Tamaño de la imagen del cartel cuando el texto mide `size` (igual que .phrase-icon en phrases.css). */
const ICON_PX = 20;
/** Fuera de este rango de tamaño (px) la frase no se ve; muy fuera, se borra. */
const MIN_PX = 5;
const MAX_PX = 700;

type State = "in" | "idle" | "counting" | "out";

type Phrase = {
  el: HTMLElement;
  world: World;
  theme: string;
  /** Cuántas veces ha devenido. */
  gen: number;
  /** La frase en que se va a convertir (si deviene). */
  next: PhraseItem | null;
  item: PhraseItem;
  icon: HTMLElement;
  text: HTMLElement;
  timer: HTMLElement;
  chars: string[];
  /** Orden en que cada letra se resuelve o se degrada (0–1). */
  order: number[];
  wx: number;
  wy: number;
  /** Tamaño del texto en unidades del mundo. */
  k: number;
  state: State;
  born: number;
  since: number;
  attention: number;
  shown: string;
};

/** Ruido determinista por segmento: el mismo lugar siempre dice lo mismo. */
function hash(a: number, b: number, c: number, salt: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2246822519) ^ Math.imul(salt, 3266489917);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const LOG4 = Math.log(4);

type Box = { l: number; t: number; r: number; b: number };
const overlaps = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const boxOf = (r: DOMRect, pad = 0): Box => ({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad });

export function mountPhrases(
  layer: HTMLElement,
  s: PhraseSettings,
  banks: { readonly frases: PhraseWorlds; readonly carteles: PhraseWorlds },
  started: Promise<void>,
  /** Opcional: los lanzamientos (para no brotar cerca) y la entrada a la zona. */
  hooks: PhraseOptions = {},
): { camera(c: CameraLike): void; pause(on: boolean): void; destroy(): void } {
  const worlds = banks[s.source] ?? banks.frases;
  const worldNow = (): World => (document.documentElement.dataset.side === "dark" ? "oscuro" : "claro");
  const themesOf = (w: World) => Object.keys(worlds[w]).filter((t) => worlds[w][t].length);
  let cam: CameraLike | null = null;
  let live: Phrase[] = [];
  let raf = 0;
  let last = 0;
  let nextSpawn = Infinity;
  let pointer: { x: number; y: number } | null = null;
  let alive = true;
  /** Mientras la zona está abierta no brota nada ni se puede volver a entrar. */
  let paused = false;
  let diveAfter = 0;
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // un mazo por mundo y tema: no se repite hasta que salieron todas;
  // los carteles que el visitante todavía no lee salen primero
  const decks: Record<string, PhraseItem[]> = {};
  const draw = (world: World, theme: string): PhraseItem | null => {
    const key = `${world}:${theme}`;
    if (!decks[key]?.length) {
      const read = collected();
      const unread = (it: PhraseItem) => (signOf(it) && read.has(signOf(it)!.id) ? 1 : 0);
      decks[key] = [...(worlds[world][theme] ?? [])].sort(() => Math.random() - 0.5).sort((a, b) => unread(a) - unread(b));
    }
    const onScreen = new Set(live.flatMap((p) => [textOf(p.item), p.next ? textOf(p.next) : ""]));
    const deck = decks[key];
    const i = deck.findIndex((t) => !onScreen.has(textOf(t)));
    return i < 0 ? null : deck.splice(i, 1)[0];
  };

  const onPointer = (e: PointerEvent) => {
    pointer = e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : null;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  // la previsión (3:33): ya no brota nada más; las que están se quedan detrás de la imagen
  const onPrevision = () => {
    paused = true;
    diveAfter = Infinity;
  };
  window.addEventListener("pingli:prevision", onPrevision);

  /** Zonas donde no debe brotar nada: la interfaz, la figura, los cuadros, el panel, otras frases. */
  function blocked(c: CameraLike): Box[] {
    const out: Box[] = [
      { l: -1e9, t: -1e9, r: 1e9, b: 64 }, // línea de arriba
      { l: -1e9, t: c.h - 96, r: 1e9, b: 1e9 }, // nombre abajo
    ];
    const ox = (0 - c.x) * c.scale + c.w / 2;
    const oy = (0 - c.y) * c.scale + c.h / 2;
    const or = 230 * c.scale * 1.15;
    out.push({ l: ox - or, t: oy - or, r: ox + or, b: oy + or });
    // el área alrededor de cada lanzamiento, en el mundo: vale igual de lejos que
    // de muy cerca (aunque el cuadro ya no se vea por ser enorme)
    for (const r of hooks.releases ?? []) {
      const half = (r.size / 2 + r.size * s.keepOut.releases) * c.scale + 24;
      const x = (r.x - c.x) * c.scale + c.w / 2;
      const y = (r.y - c.y) * c.scale + c.h / 2;
      out.push({ l: x - half, t: y - half, r: x + half, b: y + half });
    }
    document.querySelectorAll<HTMLElement>('[data-release]:not([data-lod="hidden"]), [data-artista]:not([data-lod="hidden"])').forEach((el) => {
      out.push(boxOf(el.getBoundingClientRect(), 28));
    });
    const panel = document.querySelector<HTMLElement>(".panel[data-open]");
    if (panel) out.push(boxOf(panel.getBoundingClientRect(), 24));
    const wall = document.querySelector<HTMLElement>(".muro:not(.zona-muro)");
    if (wall && wall.style.visibility !== "hidden") out.push(boxOf(wall.getBoundingClientRect(), 24));
    for (const p of live) out.push(boxOf(p.el.getBoundingClientRect(), 40));
    return out;
  }

  /** ¿La caja (en pantalla) toca el círculo de la zona principal alrededor del núcleo? */
  function nearCore(c: CameraLike, b: Box): boolean {
    const r = s.keepOut.core * c.scale;
    if (r <= 0) return false;
    const ox = (0 - c.x) * c.scale + c.w / 2;
    const oy = (0 - c.y) * c.scale + c.h / 2;
    const dx = ox - Math.max(b.l, Math.min(ox, b.r));
    const dy = oy - Math.max(b.t, Math.min(oy, b.b));
    return dx * dx + dy * dy < r * r;
  }

  function spawn(c: CameraLike, now: number): boolean {
    if (live.filter((p) => p.state !== "out").length >= s.maxVisible) return false;
    const avoid = blocked(c);
    const W = Math.min(300, c.w * 0.7);
    const H = s.source === "carteles" ? 110 : 70;
    const level = Math.round(Math.log(c.scale) / LOG4);
    const cell = s.segment / Math.pow(4, level);
    for (let attempt = 0; attempt < 16; attempt++) {
      const sx = rand(24 + W / 2, c.w - 24 - W / 2);
      const sy = rand(80 + H / 2, c.h - 110 - H / 2);
      const box = { l: sx - W / 2, t: sy - H / 2, r: sx + W / 2, b: sy + H / 2 };
      if (avoid.some((a) => overlaps(a, box)) || nearCore(c, box)) continue;
      const wx = (sx - c.w / 2) / c.scale + c.x;
      const wy = (sy - c.h / 2) / c.scale + c.y;
      const ix = Math.floor(wx / cell);
      const iy = Math.floor(wy / cell);
      if (hash(ix, iy, level, 1) >= s.fertility) continue; // segmento en silencio
      const world = worldNow();
      const themes = themesOf(world);
      if (!themes.length) return false;
      const theme = themes[Math.floor(hash(ix, iy, level, 2) * themes.length)];
      const item = draw(world, theme);
      if (!item) continue;
      plant(item, world, theme, wx, wy, s.size / c.scale, now);
      return true;
    }
    return false;
  }

  /** El dibujo del cartel (vacío si es una frase suelta). */
  function drawIcon(holder: HTMLElement, item: PhraseItem) {
    const sign = signOf(item);
    holder.replaceChildren();
    holder.hidden = !sign;
    if (!sign) return;
    if (s.signImage) {
      const img = document.createElement("img");
      img.className = "phrase-img";
      img.src = s.signImage;
      img.alt = "";
      holder.append(img);
    } else holder.innerHTML = icono(sign.icono, "phrase-svg");
  }

  function plant(item: PhraseItem, world: World, theme: string, wx: number, wy: number, k: number, now: number) {
    const el = document.createElement("p");
    el.className = "phrase";
    el.dataset.world = world;
    el.dataset.theme = theme;
    const sign = signOf(item);
    if (sign) el.dataset.id = sign.id;
    const ic = document.createElement("span");
    ic.className = "phrase-icon";
    drawIcon(ic, item);
    const t = document.createElement("span");
    t.className = "phrase-text";
    const timer = document.createElement("span");
    timer.className = "phrase-timer";
    el.append(ic, t, timer);
    layer.append(el);
    const chars = [...textOf(item)];
    live.push({
      el,
      world,
      theme,
      gen: 0,
      next: null,
      item,
      icon: ic,
      text: t,
      timer,
      chars,
      order: chars.map(() => Math.random()),
      wx,
      wy,
      k,
      state: "in",
      born: now,
      since: now,
      attention: 0,
      shown: "",
    });
    // aviso para el sonido de la frase (src/lib/audio/sfx.ts), según el mundo
    window.dispatchEvent(new CustomEvent("pingli:frase", { detail: { mundo: world, id: sign?.id ?? null } }));
  }

  /** Texto con cada letra resuelta (1) o degradada (0) según su orden. */
  function render(p: Phrase, progress: number, resolving: boolean) {
    let out = "";
    for (let i = 0; i < p.chars.length; i++) {
      const ch = p.chars[i];
      if (ch === " ") {
        out += " ";
        continue;
      }
      // cuánto le falta a esta letra: <0 ya es texto, >1 ya es espacio
      const local = (progress - p.order[i] * 0.7) / 0.3;
      if (resolving) {
        if (local >= 1) out += ch;
        else if (local <= 0) out += " ";
        else out += DECAY[Math.floor((1 - local) * (DECAY.length - 1))];
      } else {
        if (local <= 0) out += ch;
        else if (local >= 1) out += " ";
        else out += DECAY[Math.min(DECAY.length - 1, Math.floor(local * DECAY.length))];
      }
    }
    if (out !== p.shown) {
      p.text.textContent = out;
      p.shown = out;
    }
  }

  function place(p: Phrase, c: CameraLike) {
    const px = p.k * c.scale;
    const x = (p.wx - c.x) * c.scale + c.w / 2;
    const y = (p.wy - c.y) * c.scale + c.h / 2;
    // fuera de la pantalla si toda la frase (no solo su centro) quedó lejos:
    // así, al acercarte mucho a la imagen del cartel, el cartel sigue ahí
    const f = px / s.size;
    const hw = ((p.el.offsetWidth || 300) * f) / 2;
    const hh = ((p.el.offsetHeight || 80) * f) / 2;
    const off = px < MIN_PX || px > MAX_PX || x + hw < -c.w / 2 || x - hw > c.w * 1.5 || y + hh < -c.h / 2 || y - hh > c.h * 1.5;
    p.el.style.visibility = off ? "hidden" : "";
    if (!off) p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(px / s.size).toFixed(4)}) translate(-50%, -50%)`;
    // muy de cerca, que el navegador lo vuelva a dibujar: la imagen se ve en pixeles nítidos, no borrosa
    const near = f > 2.5 ? "auto" : "";
    if (p.el.style.willChange !== near) p.el.style.willChange = near;
    return { px, x, y, off };
  }

  function focused(p: Phrase, c: CameraLike, at: { px: number; x: number; y: number; off: boolean }) {
    if (at.off || at.px < 10 || at.px > 160) return false;
    // cerca del centro de lo que se ve
    const panel = document.querySelector<HTMLElement>(".panel[data-open]");
    const w = panel && window.innerWidth > 720 ? panel.getBoundingClientRect().left : c.w;
    const dx = (at.x - w / 2) / (w * 0.3);
    const dy = (at.y - c.h / 2) / (c.h * 0.3);
    if (dx * dx + dy * dy < 1) return true;
    // o con el cursor encima
    if (pointer) {
      const r = p.el.getBoundingClientRect();
      return pointer.x > r.left - 12 && pointer.x < r.right + 12 && pointer.y > r.top - 12 && pointer.y < r.bottom + 12;
    }
    return false;
  }

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const c = cam;
    if (!c) return;
    const calm = reduce();

    if (now >= nextSpawn && !paused) {
      const ok = document.visibilityState === "visible" && spawn(c, now);
      // si no hubo lugar (o el segmento calla), se vuelve a intentar pronto
      nextSpawn = now + (ok ? rand(s.every[0], s.every[1]) : rand(2.5, 4.5)) * 1000;
    }

    live = live.filter((p) => {
      const at = place(p, c);
      const age = (now - p.since) / 1000;

      if (p.state === "in") {
        const k = Math.min(1, (now - p.since) / IN_MS);
        if (calm) p.text.textContent = p.chars.join("");
        else render(p, k, true);
        // al devenir ya está a la vista: solo cambian las letras
        p.el.style.opacity = p.gen > 0 && !calm ? "1" : String(Math.min(1, k * 1.6));
        if (k >= 1) {
          p.text.textContent = p.shown = p.chars.join("");
          p.state = "idle";
          p.since = now;
        }
      } else if (p.state === "idle") {
        p.attention = focused(p, c, at) ? p.attention + dt : Math.max(0, p.attention - dt * 0.5);
        if (p.attention >= s.attention) {
          p.state = "counting";
          p.since = now;
          p.el.dataset.counting = "";
        } else if (age >= s.idle) {
          p.state = "out";
          p.since = now;
        }
      } else if (p.state === "counting") {
        const left = Math.max(0, s.timer - age);
        if (s.showTimer) {
          const n = String(Math.ceil(left)).padStart(2, "0");
          if (p.timer.textContent !== n) p.timer.textContent = n;
        }
        if (left <= 0) {
          p.state = "out";
          p.since = now;
          // leído: el cartel se va al muro
          const sign = signOf(p.item);
          if (sign) collect(sign.id);
          // ¿deviene otra?
          if (p.gen < s.maxBecomings && Math.random() < s.becoming) p.next = draw(p.world, p.theme);
        }
      } else {
        const k = Math.min(1, (now - p.since) / OUT_MS);
        if (!calm) render(p, k, false);
        p.el.style.opacity = p.next && !calm ? "1" : String(k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
        p.timer.style.opacity = String(Math.max(0, 1 - k * 2));
        p.icon.style.opacity = String(Math.max(0, 1 - k * 1.4));
        if (k >= 1) {
          if (p.next) {
            // devenir: del blanco que dejó, se rehace en otra frase
            p.item = p.next;
            p.chars = [...textOf(p.next)];
            drawIcon(p.icon, p.next);
            p.icon.style.opacity = "";
            const nextSign = signOf(p.next);
            if (nextSign) p.el.dataset.id = nextSign.id;
            p.order = p.chars.map(() => Math.random());
            p.next = null;
            p.gen++;
            p.state = "in";
            p.since = now;
            p.attention = 0;
            p.timer.textContent = "";
            p.timer.style.opacity = "";
            delete p.el.dataset.counting;
            p.el.dataset.gen = String(p.gen);
          } else {
            p.el.remove();
            return false;
          }
        }
      }

      // zoom muy profundo sobre la imagen del cartel: se abre la zona
      if (hooks.onDive && hooks.dive && !paused && now >= diveAfter && p.state !== "out" && !at.off && signOf(p.item) && !p.icon.hidden) {
        const short = Math.min(c.w, c.h);
        const iconPx = (ICON_PX * at.px) / s.size;
        if (iconPx >= hooks.dive * short) {
          const r = p.icon.getBoundingClientRect();
          const inside = (q: { x: number; y: number }) => q.x >= r.left && q.x <= r.right && q.y >= r.top && q.y <= r.bottom;
          if (inside({ x: c.w / 2, y: c.h / 2 }) || (pointer && inside(pointer))) {
            diveAfter = now + 1500;
            hooks.onDive({ rect: { left: r.left, top: r.top, width: r.width, height: r.height }, back: { x: p.wx, y: p.wy, scale: s.size / p.k } });
          }
        }
      }

      // perdida en la escala o muy lejos: se borra en silencio
      if (p.state !== "counting" && (at.px < MIN_PX / 4 || at.px > MAX_PX * 4)) {
        p.el.remove();
        return false;
      }
      return true;
    });
  }

  if (s.enabled && (themesOf("claro").length || themesOf("oscuro").length)) {
    started.then(() => {
      if (!alive) return;
      nextSpawn = performance.now() + s.startAfter * 1000;
      raf = requestAnimationFrame(tick);
    });
  }

  return {
    camera(c: CameraLike) {
      cam = c;
    },
    pause(on: boolean) {
      paused = on;
      // al salir de la zona, un momento antes de que se pueda volver a entrar
      if (on) return;
      const now = performance.now();
      diveAfter = now + 1500;
      if (nextSpawn < now + 4000) nextSpawn = now + rand(4, 8) * 1000;
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pingli:prevision", onPrevision);
      for (const p of live) p.el.remove();
      live = [];
    },
  };
}
