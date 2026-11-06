import type { Camera } from "./camera";
import type { AsciiShape } from "@/config/site";

/**
 * Figura 3D dibujada con caracteres. Cada celda lanza un rayo (raymarching
 * sobre una función de distancia), calcula la luz y elige un carácter de la
 * rampa según la intensidad.
 *
 * Nivel de detalle según el zoom:
 *  - muy lejos: un solo punto (siempre sabes dónde está el origen)
 *  - lejos: retícula de puntos (como la referencia de Reboot)
 *  - cerca: caracteres
 *  - demasiado cerca: se disuelve y quedas dentro del vacío
 */

const CELL_W = 7.2; // unidades del mundo (Courier: ancho = 0.6 em)
const CELL_H = 12; // 1 em
const BOUND = 1.1; // radio de la esfera que envuelve la figura (unidades normalizadas)
const MAX_STEPS = 28;
const HIT_EPS = 0.003;

export type InkMode = "light" | "dark";

export class AsciiObject {
  radius: number;
  ramp: string;
  rpm: number;
  shape: AsciiShape;
  inkMode: InkMode = "light";
  font = '"Courier Prime", "Courier New", monospace';

  private time = 0;
  private lx = 0.35;
  private ly = -0.45;
  // matriz de rotación del cuadro actual
  private m = new Float64Array(9);
  private tiltBase = 0.42;
  private tilt = 0.42;

  constructor(opts: { radius: number; ramp: string; rpm: number; shape: AsciiShape }) {
    this.radius = opts.radius;
    this.ramp = opts.ramp;
    this.rpm = opts.rpm;
    this.shape = opts.shape;
  }

  /**
   * @param pointer posición del cursor en pantalla, o null si no hay cursor
   */
  update(dt: number, cam: Camera, pointer: { x: number; y: number } | null, speed: number) {
    this.time += dt * speed;
    const cx = cam.toScreenX(0);
    const cy = cam.toScreenY(0);
    const span = Math.max(80, Math.min(cam.w, cam.h) * 0.5);
    let tx: number;
    let ty: number;
    let tilt: number;
    if (pointer) {
      tx = Math.max(-1.6, Math.min(1.6, (pointer.x - cx) / span));
      ty = Math.max(-1.6, Math.min(1.6, (pointer.y - cy) / span));
      tilt = this.tiltBase + ty * 0.18;
    } else {
      // sin cursor (táctil): la luz orbita lento
      tx = Math.cos(this.time * 0.21) * 0.8;
      ty = Math.sin(this.time * 0.17) * 0.6 - 0.2;
      tilt = this.tiltBase;
    }
    const k = 1 - Math.exp(-dt * 2.2);
    this.lx += (tx - this.lx) * k;
    this.ly += (ty - this.ly) * k;
    this.tilt += (tilt - this.tilt) * k;
  }

  private buildRotation() {
    const a = this.time * ((this.rpm * Math.PI * 2) / 60);
    const cy = Math.cos(a);
    const sy = Math.sin(a);
    const cx = Math.cos(this.tilt);
    const sx = Math.sin(this.tilt);
    // R = Rx(tilt) · Ry(a)
    const m = this.m;
    m[0] = cy;
    m[1] = 0;
    m[2] = sy;
    m[3] = sx * sy;
    m[4] = cx;
    m[5] = -sx * cy;
    m[6] = -cx * sy;
    m[7] = sx;
    m[8] = cx * cy;
  }

  private sdf(px: number, py: number, pz: number) {
    const m = this.m;
    const qx = m[0] * px + m[1] * py + m[2] * pz;
    const qy = m[3] * px + m[4] * py + m[5] * pz;
    const qz = m[6] * px + m[7] * py + m[8] * pz;
    const t = this.time;
    const disp = 0.022 * Math.sin(6 * qx + t * 0.7) * Math.sin(6 * qy + 1.3) * Math.sin(6 * qz - t * 0.5);
    if (this.shape === "torus") {
      const r = Math.sqrt(qx * qx + qz * qz) - 0.66;
      return Math.sqrt(r * r + qy * qy) - 0.3 + disp;
    }
    // esfera con una ranura inclinada que gira con ella
    const d = Math.sqrt(qx * qx + qy * qy + qz * qz) - 1 + disp;
    const slab = Math.abs(qx * 0.55 + qy * 0.835) - 0.13;
    return Math.max(d, -slab);
  }

  /** Intensidad de luz en (u, v) normalizado, o -1 si el rayo no toca la figura. */
  private sample(u: number, v: number, lx: number, ly: number, lz: number) {
    const r2 = u * u + v * v;
    if (r2 >= BOUND * BOUND) return -1;
    const half = Math.sqrt(BOUND * BOUND - r2);
    let z = -half;
    for (let i = 0; i < MAX_STEPS; i++) {
      const d = this.sdf(u, v, z);
      if (d < HIT_EPS) {
        // normal por diferencias (tetraedro)
        const e = 0.01;
        const a = this.sdf(u + e, v - e, z - e);
        const b = this.sdf(u - e, v - e, z + e);
        const c = this.sdf(u - e, v + e, z - e);
        const f = this.sdf(u + e, v + e, z + e);
        let nx = a - b - c + f;
        let ny = -a - b + c + f;
        let nz = -a + b - c + f;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const lambert = Math.max(0, nx * lx + ny * ly + nz * lz);
        return 0.06 + 0.94 * lambert;
      }
      z += d * 0.85;
      if (z > half) break;
    }
    return -1;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, color: string, presence: number) {
    if (presence <= 0) return;
    this.buildRotation();
    const R = this.radius;
    const s = cam.scale;
    const ox = cam.toScreenX(0);
    const oy = cam.toScreenY(0);
    const screenR = R * s;

    ctx.fillStyle = color;

    // 1) muy lejos: un punto
    if (screenR < 2) {
      ctx.globalAlpha = presence * 0.9;
      ctx.fillRect(Math.round(ox) - 1, Math.round(oy) - 1, 2, 2);
      ctx.globalAlpha = 1;
      return;
    }

    // vector de luz (hacia el espectador y hacia el cursor)
    let lx = this.lx;
    let ly = this.ly;
    let lz = -1;
    const ll = Math.hypot(lx, ly, lz);
    lx /= ll;
    ly /= ll;
    lz /= ll;

    const n = this.ramp.length;
    const span = BOUND * R;
    const cellWs = CELL_W * s;

    // 2) lejos: puntos, muestreados con un paso que nunca baja de ~2.5 px
    if (cellWs < 2.5) {
      const stride = Math.max(1, Math.ceil(2.5 / cellWs));
      const stepW = CELL_W * stride;
      const stepH = CELL_H * stride;
      const cols = Math.ceil((2 * span) / stepW);
      const rows = Math.ceil((2 * span) / stepH);
      const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (let r = 0; r <= rows; r++) {
        const wy = -span + r * stepH;
        const sy = oy + wy * s;
        if (sy < -2 || sy > cam.h + 2) continue;
        for (let c = 0; c <= cols; c++) {
          const wx = -span + c * stepW;
          const sx = ox + wx * s;
          if (sx < -2 || sx > cam.w + 2) continue;
          const val = this.sample(wx / R, wy / R, lx, ly, lz);
          if (val < 0) continue;
          const dens = this.inkMode === "dark" ? val : 1 - val * 0.85;
          const b = Math.min(3, Math.floor(dens * 4));
          buckets[b].rect(Math.round(sx), Math.round(sy), 1.2, 1.2);
        }
      }
      for (let b = 0; b < 4; b++) {
        ctx.globalAlpha = presence * (0.3 + b * 0.23);
        ctx.fill(buckets[b]);
      }
      ctx.globalAlpha = 1;
      return;
    }

    // 3) cerca: caracteres. Se disuelven cuando cada celda es enorme.
    const fade = 1 - Math.min(1, Math.max(0, (cellWs - 240) / 420));
    if (fade <= 0) return;

    const cols = Math.ceil((2 * span) / CELL_W);
    const rows = Math.ceil((2 * span) / CELL_H);
    // solo las celdas visibles
    const c0 = Math.max(0, Math.floor(((-ox) / s + span) / CELL_W) - 1);
    const c1 = Math.min(cols, Math.ceil(((cam.w - ox) / s + span) / CELL_W) + 1);
    const r0 = Math.max(0, Math.floor(((-oy) / s + span) / CELL_H) - 1);
    const r1 = Math.min(rows, Math.ceil(((cam.h - oy) / s + span) / CELL_H) + 1);
    if (c0 > c1 || r0 > r1) return;

    const fontPx = CELL_H * s * 0.98;
    ctx.font = `${fontPx.toFixed(2)}px ${this.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = presence * fade;
    for (let r = r0; r <= r1; r++) {
      const wy = -span + (r + 0.5) * CELL_H;
      const sy = oy + wy * s;
      for (let c = c0; c <= c1; c++) {
        const wx = -span + (c + 0.5) * CELL_W;
        const val = this.sample(wx / R, wy / R, lx, ly, lz);
        if (val < 0) continue;
        const v = this.inkMode === "dark" ? val : 1 - val;
        const idx = 1 + Math.min(n - 2, Math.floor(v * (n - 1)));
        ctx.fillText(this.ramp[idx], ox + wx * s, sy);
      }
    }
    ctx.globalAlpha = 1;
  }
}
