import type { Camera } from "./camera";

/**
 * Plano de puntos autosimilar: cada nivel es BASE veces más fino que el
 * anterior, y los niveles aparecen y desaparecen con suavidad según la escala.
 * Por eso el zoom nunca "llega" a ningún lado: siempre hay otro nivel.
 */
const BASE = 4;
const WORLD_SPACING = 48; // separación del nivel 0 en unidades del mundo
const MIN_SCREEN_SPACING = 18; // px: los puntos nunca están más juntos que esto

const LOG_BASE = Math.log(BASE);

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Nivel de un índice del retículo fino: 0, 1 o 2 (2 = el más grueso). */
function levelOf(i: number) {
  const a = Math.abs(i);
  if (a % (BASE * BASE) === 0) return 2;
  if (a % BASE === 0) return 1;
  return 0;
}

export function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, color: string, presence: number) {
  if (presence <= 0) return;
  const s = cam.scale;
  const k = Math.ceil(Math.log(MIN_SCREEN_SPACING / (WORLD_SPACING * s)) / LOG_BASE);
  const spW = WORLD_SPACING * Math.pow(BASE, k);
  const spS = spW * s;
  // t ∈ [0,1): qué tan avanzado va el nivel fino dentro de su ciclo
  const t = Math.log(spS / MIN_SCREEN_SPACING) / LOG_BASE;

  const ix0 = Math.floor(cam.toWorldX(0) / spW) - 1;
  const ix1 = Math.ceil(cam.toWorldX(cam.w) / spW) + 1;
  const iy0 = Math.floor(cam.toWorldY(0) / spW) - 1;
  const iy1 = Math.ceil(cam.toWorldY(cam.h) / spW) + 1;

  const paths = [new Path2D(), new Path2D(), new Path2D()];
  const sizes = [0, 0, 0];
  const alphas = [0, 0, 0];
  for (let lv = 0; lv < 3; lv++) {
    const a = lv + t;
    const weight = Math.min(a, 2) / 2;
    sizes[lv] = 0.9 + 1.1 * weight;
    alphas[lv] = smoothstep(0, 0.8, a) * (0.3 + 0.7 * weight);
  }

  for (let iy = iy0; iy <= iy1; iy++) {
    const sy = Math.round((iy * spW - cam.y) * s + cam.h / 2);
    const ly = levelOf(iy);
    for (let ix = ix0; ix <= ix1; ix++) {
      const lv = Math.min(ly, levelOf(ix));
      if (alphas[lv] <= 0.01) continue;
      const sx = Math.round((ix * spW - cam.x) * s + cam.w / 2);
      const z = sizes[lv];
      paths[lv].rect(sx - z / 2, sy - z / 2, z, z);
    }
  }

  ctx.fillStyle = color;
  for (let lv = 0; lv < 3; lv++) {
    if (alphas[lv] <= 0.01) continue;
    ctx.globalAlpha = alphas[lv] * presence;
    ctx.fill(paths[lv]);
  }
  ctx.globalAlpha = 1;
}
