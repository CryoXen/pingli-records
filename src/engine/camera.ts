/**
 * Cámara del lienzo infinito.
 * (x, y) es el punto del mundo que está en el centro de la pantalla.
 * scale = píxeles de pantalla por unidad del mundo.
 */
export class Camera {
  x = 0;
  y = 0;
  scale = 1;
  w = 1;
  h = 1;

  constructor(
    public minScale: number,
    public maxScale: number,
  ) {}

  setViewport(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  toScreenX(wx: number) {
    return (wx - this.x) * this.scale + this.w / 2;
  }
  toScreenY(wy: number) {
    return (wy - this.y) * this.scale + this.h / 2;
  }
  toWorldX(sx: number) {
    return (sx - this.w / 2) / this.scale + this.x;
  }
  toWorldY(sy: number) {
    return (sy - this.h / 2) / this.scale + this.y;
  }

  clampScale(s: number) {
    return Math.min(this.maxScale, Math.max(this.minScale, s));
  }

  /** Desplaza la vista en píxeles de pantalla. */
  panBy(dx: number, dy: number) {
    this.x -= dx / this.scale;
    this.y -= dy / this.scale;
  }

  /** Zoom manteniendo fijo el punto del mundo que está bajo (sx, sy). */
  zoomAt(sx: number, sy: number, factor: number) {
    const wx = this.toWorldX(sx);
    const wy = this.toWorldY(sy);
    this.scale = this.clampScale(this.scale * factor);
    this.x = wx - (sx - this.w / 2) / this.scale;
    this.y = wy - (sy - this.h / 2) / this.scale;
  }
}
