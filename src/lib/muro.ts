/**
 * El muro: donde se cuelgan los carteles leídos.
 *
 * Es un objeto del plano, lejos del centro (por defecto en x −3333,
 * y 3333 del HUD: arriba a la izquierda). Nadie lo anuncia; dos carteles dan
 * la pista. Se mueve y crece con el lienzo: de lejos es solo un rectángulo,
 * más cerca aparecen los 120 huecos y, de cerca, se leen los carteles.
 *
 * Arriba los 60 del lado claro, abajo los 60 del oscuro. Cada cartel leído
 * ocupa su hueco con su dibujo y su frase; los que faltan son marcos vacíos
 * con su número, como los lanzamientos que todavía no cargan.
 */
import type { Cartel } from "@/config/carteles";
import { icono } from "@/config/iconos";
import { CARTEL_EVENT, collected } from "./carteles-store";
import type { CameraLike } from "./phrases";

export type WallSettings = {
  readonly enabled: boolean;
  /** Centro del muro en coordenadas del HUD. */
  readonly x: number;
  readonly y: number;
};

export type WallCopy = { readonly title: string; readonly claro: string; readonly oscuro: string };

/** Medidas en unidades del mundo (a zoom 1 son px). */
const COLS = 12;
const CELL_W = 120;
const CELL_H = 150;
const GAP = 12;

/** Ancho del muro en unidades del mundo. */
export const WALL_WIDTH = COLS * CELL_W + (COLS - 1) * GAP;
/** Ancho de un hueco, para decidir cuánto detalle mostrar. */
export const WALL_CELL = CELL_W;

/** Nivel de detalle según el tamaño en pantalla de un hueco (px). */
export const wallLod = (cellPx: number) => (cellPx < 6 ? "far" : cellPx < 48 ? "mid" : "near");

/**
 * Arma el muro (encabezado, los huecos del lado claro y los del oscuro) y lo
 * mantiene al día: cada cartel leído ocupa su hueco. Lo usan el muro del
 * plano y la zona dentro de la imagen.
 */
export function buildWall(
  claro: readonly Cartel[],
  oscuro: readonly Cartel[],
  copy: WallCopy,
  /** Imagen para todos los carteles; null = los dibujos de iconos.ts. */
  signImage: string | null = null,
): { el: HTMLElement; destroy(): void } {
  const total = claro.length + oscuro.length;
  const wall = document.createElement("div");
  wall.className = "muro";
  wall.style.width = `${WALL_WIDTH}px`;
  const head = document.createElement("div");
  head.className = "muro-head";
  const title = document.createElement("span");
  title.textContent = copy.title;
  const count = document.createElement("span");
  count.className = "muro-count";
  head.append(title, count);
  wall.append(head);

  const cells = new Map<string, { el: HTMLElement; c: Cartel }>();
  const counts: HTMLElement[] = [];
  const lists = [claro, oscuro] as const;
  for (const [name, list] of [
    [copy.claro, claro],
    [copy.oscuro, oscuro],
  ] as const) {
    const label = document.createElement("div");
    label.className = "muro-label";
    const n = document.createElement("span");
    label.append(document.createTextNode(name), n);
    counts.push(n);
    const grid = document.createElement("div");
    grid.className = "muro-grid";
    for (const c of list) {
      const el = document.createElement("div");
      el.className = "muro-cell";
      el.dataset.id = c.id;
      cells.set(c.id, { el, c });
      grid.append(el);
    }
    wall.append(label, grid);
  }

  const pad3 = (n: number) => String(n).padStart(3, "0");
  function paint() {
    const have = collected();
    for (const { el, c } of cells.values()) {
      if (have.has(c.id) && !el.dataset.found) {
        el.dataset.found = "";
        el.innerHTML = `${signImage ? '<img class="muro-img" alt="">' : icono(c.icono, "muro-icon")}<p></p><span class="muro-id"></span>`;
        if (signImage) el.querySelector("img")!.src = signImage;
        el.querySelector("p")!.textContent = c.texto;
        el.querySelector(".muro-id")!.textContent = c.id;
      } else if (!el.dataset.found) {
        el.textContent = c.id; // hueco: solo su número
      }
    }
    const inList = (list: readonly Cartel[]) => list.filter((c) => have.has(c.id)).length;
    count.textContent = `${pad3(inList(claro) + inList(oscuro))}/${total}`;
    lists.forEach((list, i) => (counts[i].textContent = `${inList(list)}/${list.length}`));
  }
  paint();
  const onCollect = () => paint();
  window.addEventListener(CARTEL_EVENT, onCollect);

  return {
    el: wall,
    destroy() {
      window.removeEventListener(CARTEL_EVENT, onCollect);
      wall.remove();
    },
  };
}

export function mountWall(
  layer: HTMLElement,
  s: WallSettings,
  claro: readonly Cartel[],
  oscuro: readonly Cartel[],
  copy: WallCopy,
  /** Imagen para todos los carteles; null = los dibujos de iconos.ts. */
  signImage: string | null = null,
): { camera(c: CameraLike): void; destroy(): void } {
  if (!s.enabled) return { camera() {}, destroy() {} };

  const built = buildWall(claro, oscuro, copy, signImage);
  const wall = built.el;
  layer.append(wall);

  // tamaño real del muro (en unidades del mundo), para colocarlo centrado en (x, y)
  const W = WALL_WIDTH;
  let H = 0;
  let cam: CameraLike | null = null;

  function place() {
    if (!cam) return;
    if (!H) H = wall.offsetHeight;
    const wx = s.x - W / 2;
    const wy = -s.y - H / 2; // el HUD muestra la y invertida
    const x = (wx - cam.x) * cam.scale + cam.w / 2;
    const y = (wy - cam.y) * cam.scale + cam.h / 2;
    const w = W * cam.scale;
    const h = H * cam.scale;
    const off = x > cam.w || y > cam.h || x + w < 0 || y + h < 0 || w < 2;
    wall.style.visibility = off ? "hidden" : "";
    if (off) return;
    wall.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${cam.scale.toFixed(5)})`;
    wall.dataset.lod = wallLod(CELL_W * cam.scale);
  }

  return {
    camera(c: CameraLike) {
      cam = c;
      place();
    },
    destroy: built.destroy,
  };
}
