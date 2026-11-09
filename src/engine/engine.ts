import { gsap } from "gsap";
import { Camera } from "./camera";
import { drawGrid } from "./grid";
import { AsciiObject, type InkMode } from "./ascii-object";
import type { SiteConfig } from "@/config/site";
import { releasePanelInset } from "@/lib/release-panel";

type Colors = { paper: string; ink: string; grid: string };

export type EngineOptions = {
  config: SiteConfig;
  reducedMotion: boolean;
  /** Se llama cuando cambia la cámara (para el HUD). */
  onCamera?: (cam: Camera) => void;
  /** Se llama a mitad del cruce al otro lado: aquí se cambia el tema. */
  onCross?: () => void;
  /**
   * Se llama en cada cuadro, después de dibujar (para lo que se mueve solo:
   * los artistas en órbita y sus proyectos).
   */
  onFrame?: (cam: Camera, dt: number) => void;
  /**
   * false: el motor no coloca los lanzamientos ([data-release]); los coloca
   * quien use onFrame (las órbitas).
   */
  placeReleases?: boolean;
};

/**
 * Motor del lienzo: ciclo de dibujo, entrada (ratón, rueda, táctil, teclado),
 * posicionamiento de los lanzamientos y el camino secreto.
 * No depende de React; la interfaz lo monta y lo destruye.
 */
export class Engine {
  readonly cam: Camera;
  readonly object: AsciiObject;
  /** 0 → 1 durante la entrada. Lo anima la interfaz con GSAP. */
  presence = 0;

  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private colors: Colors = { paper: "#ECEDEF", ink: "#000", grid: "#A1A4AB" };
  private raf = 0;
  private last = 0;
  private dirty = true;
  private pointer: { x: number; y: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private velocity = { x: 0, y: 0 };
  private lastMove = { x: 0, y: 0, t: 0 };
  private dragDistance = 0;
  private tween: gsap.core.Tween | gsap.core.Timeline | null = null;
  private crossing = false;
  private burst = 0;
  private locked = false;
  /** Pasa a true con la primera interacción: desde ahí la cámara es del visitante. */
  private touched = false;
  private releaseEls: HTMLElement[] = [];
  private cleanup: Array<() => void> = [];

  constructor(
    private stage: HTMLElement,
    private canvas: HTMLCanvasElement,
    private layer: HTMLElement,
    private opts: EngineOptions,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    const { camera, asciiObject } = opts.config;
    this.cam = new Camera(camera.minScale, camera.maxScale);
    this.object = new AsciiObject(asciiObject);
    this.releaseEls = Array.from(layer.querySelectorAll<HTMLElement>("[data-release]"));
    this.bind();
    this.resize();
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.tween?.kill();
    this.cleanup.forEach((fn) => fn());
  }

  /** Lee los colores de las variables CSS del tema actual. */
  setTheme(mode: InkMode) {
    const cs = getComputedStyle(document.documentElement);
    this.colors = {
      paper: cs.getPropertyValue("--paper").trim() || this.colors.paper,
      ink: cs.getPropertyValue("--ink").trim() || this.colors.ink,
      grid: cs.getPropertyValue("--grid").trim() || this.colors.grid,
    };
    this.object.inkMode = mode;
  }

  /** ¿El último gesto fue un arrastre? (para no abrir un lanzamiento al soltar) */
  wasDrag() {
    return this.dragDistance > 5;
  }

  flyTo(x: number, y: number, scale: number, duration = 1.4) {
    if (this.locked) return;
    this.stopMotion();
    const p = { x: this.cam.x, y: this.cam.y, ls: Math.log(this.cam.scale) };
    this.tween = gsap.to(p, {
      x,
      y,
      ls: Math.log(this.cam.clampScale(scale)),
      duration: this.opts.reducedMotion ? 0 : duration,
      ease: "power3.inOut",
      onUpdate: () => {
        this.cam.x = p.x;
        this.cam.y = p.y;
        this.cam.scale = Math.exp(p.ls);
        this.dirty = true;
      },
    });
  }

  /** Zoom animado alrededor de un punto de pantalla. */
  zoomAround(sx: number, sy: number, factor: number, duration = 0.9) {
    if (this.locked) return;
    this.stopMotion();
    const wx = this.cam.toWorldX(sx);
    const wy = this.cam.toWorldY(sy);
    const p = { ls: Math.log(this.cam.scale) };
    this.tween = gsap.to(p, {
      ls: Math.log(this.cam.clampScale(this.cam.scale * factor)),
      duration: this.opts.reducedMotion ? 0 : duration,
      ease: "power2.out",
      onUpdate: () => {
        this.cam.scale = Math.exp(p.ls);
        this.cam.x = wx - (sx - this.cam.w / 2) / this.cam.scale;
        this.cam.y = wy - (sy - this.cam.h / 2) / this.cam.scale;
        this.dirty = true;
      },
    });
  }

  flyToRelease(index: number) {
    const r = this.opts.config.releases[index];
    if (!r) return;
    // el panel tapa la derecha: el cuadro se centra en el espacio que queda libre
    const inset = releasePanelInset();
    const target = (Math.min(this.cam.w - inset, this.cam.h) * 0.42) / r.size;
    this.flyTo(r.x + inset / 2 / target, r.y + r.size * 0.08, target);
  }

  /** Escala de la vista inicial: la figura ocupa ~60 % del lado corto, sin pasar de 1. */
  homeScale() {
    const R = this.opts.config.asciiObject.radius;
    return Math.min(1, (Math.min(this.cam.w, this.cam.h) * 0.6) / (2 * R));
  }

  home() {
    this.flyTo(0, 0, this.homeScale());
  }

  // ───────────────────────── ciclo ─────────────────────────

  private frame(dt: number) {
    const { cam, ctx } = this;

    // inercia del arrastre
    if (!this.pointers.size && (this.velocity.x || this.velocity.y)) {
      cam.panBy(this.velocity.x * dt * 1000, this.velocity.y * dt * 1000);
      const decay = Math.exp(-dt / 0.22);
      this.velocity.x *= decay;
      this.velocity.y *= decay;
      if (Math.hypot(this.velocity.x, this.velocity.y) < 0.01) this.velocity = { x: 0, y: 0 };
      this.dirty = true;
    }

    this.checkSecret();

    const speed = this.opts.reducedMotion ? 0.25 : 1;
    this.object.update(dt, cam, this.pointer, speed);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.colors.paper;
    ctx.fillRect(0, 0, cam.w, cam.h);
    drawGrid(ctx, cam, this.colors.grid, this.presence);
    this.object.draw(ctx, cam, this.colors.ink, this.presence);
    if (this.burst > 0) this.drawBurst();

    if (this.dirty) {
      if (this.opts.placeReleases !== false) this.placeReleases();
      this.opts.onCamera?.(cam);
      this.dirty = false;
    }
    this.opts.onFrame?.(cam, dt);
  }

  /** Ruido de caracteres a pantalla completa (el cruce). */
  private drawBurst() {
    const { ctx, cam } = this;
    const ramp = this.object.ramp;
    const cw = 11;
    const ch = 18;
    ctx.font = `16px ${this.object.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.colors.ink;
    const amount = this.burst;
    for (let y = ch / 2; y < cam.h; y += ch) {
      for (let x = cw / 2; x < cam.w; x += cw) {
        if (Math.random() > amount) continue;
        ctx.globalAlpha = 0.25 + Math.random() * 0.75 * amount;
        ctx.fillText(ramp[1 + Math.floor(Math.random() * (ramp.length - 1))], x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  private placeReleases() {
    const { cam } = this;
    const releases = this.opts.config.releases;
    const maxSide = Math.max(cam.w, cam.h);
    for (let i = 0; i < this.releaseEls.length; i++) {
      const el = this.releaseEls[i];
      const r = releases[Number(el.dataset.release)];
      if (!r) continue;
      const side = r.size * cam.scale;
      const sx = cam.toScreenX(r.x) - side / 2;
      const sy = cam.toScreenY(r.y) - side / 2;
      const off = sx > cam.w + 200 || sy > cam.h + 200 || sx + side < -200 || sy + side < -200;
      if (side < 3 || side > maxSide * 3 || off) {
        if (el.dataset.lod !== "hidden") el.dataset.lod = "hidden";
        continue;
      }
      el.dataset.lod = side < 56 ? "small" : "full";
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      el.style.width = `${side.toFixed(1)}px`;
      el.style.height = `${side.toFixed(1)}px`;
    }
  }

  // ───────────────────── camino secreto ─────────────────────

  private checkSecret() {
    const cfg = this.opts.config.secrets.darkSide;
    if (!cfg.enabled || this.crossing) return;
    const coreR = this.opts.config.asciiObject.radius * cfg.coreRadius;
    if (this.cam.scale >= cfg.depth && Math.hypot(this.cam.x, this.cam.y) <= coreR) {
      this.cross();
    }
  }

  /** Atravesar: ruido, cambio de tema y salir desde muy lejos hacia el origen. */
  private cross() {
    this.crossing = true;
    this.locked = true;
    this.stopMotion();
    const rm = this.opts.reducedMotion;
    const tl = gsap.timeline();
    this.tween = tl;
    tl.to(this, { burst: 1, duration: rm ? 0 : 0.45, ease: "power2.in" });
    tl.add(() => {
      this.opts.onCross?.();
      this.cam.x = 0;
      this.cam.y = 0;
      this.cam.scale = 0.004;
      this.velocity = { x: 0, y: 0 };
      this.dirty = true;
    });
    tl.to(this, { burst: 0, duration: rm ? 0 : 0.6, ease: "power2.out" });
    const p = { ls: Math.log(0.004) };
    tl.to(
      p,
      {
        ls: Math.log(this.homeScale()),
        duration: rm ? 0 : 2.6,
        ease: "power3.out",
        onUpdate: () => {
          this.cam.x = 0;
          this.cam.y = 0;
          this.cam.scale = Math.exp(p.ls);
          this.dirty = true;
        },
      },
      "<",
    );
    // la entrada queda bloqueada hasta emerger: el scroll que venías
    // haciendo no te saca del camino
    tl.add(() => {
      this.crossing = false;
      this.locked = false;
    });
  }

  // ───────────────────────── entrada ─────────────────────────

  private stopMotion() {
    this.touched = true;
    this.tween?.kill();
    this.tween = null;
    this.burst = 0;
    this.velocity = { x: 0, y: 0 };
  }

  private resize() {
    const rect = this.stage.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.cam.setViewport(rect.width, rect.height);
    if (!this.touched) this.cam.scale = this.homeScale();
    this.dirty = true;
  }

  private local(e: PointerEvent | WheelEvent | MouseEvent) {
    const rect = this.stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn as EventListener, options);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, options));
  }

  private bind() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.stage);
    this.cleanup.push(() => ro.disconnect());

    this.on(this.stage, "pointerdown", (e) => {
      if (this.locked) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.stopMotion();
      const p = this.local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) this.dragDistance = 0;
      this.lastMove = { x: p.x, y: p.y, t: performance.now() };
      if (this.pointers.size === 2) this.pinchDist = this.pinchSpan();
      this.stage.dataset.dragging = "true";
    });

    this.on(this.stage, "pointermove", (e) => {
      const p = this.local(e);
      if (e.pointerType === "mouse") this.pointer = p;
      const prev = this.pointers.get(e.pointerId);
      if (!prev || this.locked) return;

      if (this.pointers.size === 1) {
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        this.cam.panBy(dx, dy);
        this.dragDistance += Math.hypot(dx, dy);
        // capturar solo al empezar a arrastrar, para que un clic simple
        // siga llegando a los lanzamientos
        if (this.wasDrag() && !this.stage.hasPointerCapture(e.pointerId)) {
          this.stage.setPointerCapture(e.pointerId);
        }
        const now = performance.now();
        const dtm = Math.max(1, now - this.lastMove.t);
        // velocidad suavizada en px/ms
        this.velocity.x = this.velocity.x * 0.6 + (dx / dtm) * 0.4;
        this.velocity.y = this.velocity.y * 0.6 + (dy / dtm) * 0.4;
        this.lastMove = { x: p.x, y: p.y, t: now };
      }
      this.pointers.set(e.pointerId, p);

      if (this.pointers.size === 2) {
        const [a, b] = Array.from(this.pointers.values());
        const span = this.pinchSpan();
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (this.pinchDist > 0) this.cam.zoomAt(mid.x, mid.y, span / this.pinchDist);
        this.pinchDist = span;
        this.dragDistance += 10;
      }
      this.dirty = true;
    });

    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.pointers.size === 0) {
        delete this.stage.dataset.dragging;
        const idle = performance.now() - this.lastMove.t > 80;
        if (idle || this.opts.reducedMotion) this.velocity = { x: 0, y: 0 };
      }
    };
    this.on(this.stage, "pointerup", end);
    this.on(this.stage, "pointercancel", end);
    this.on(this.stage, "pointerleave", (e) => {
      if (e.pointerType === "mouse") this.pointer = null;
    });

    this.on(
      this.stage,
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.locked) return;
        this.stopMotion();
        const p = this.local(e);
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.cam.h : 1;
        if (e.shiftKey && !e.ctrlKey) {
          this.cam.panBy(-e.deltaY * unit, -e.deltaX * unit);
        } else {
          const k = e.ctrlKey ? 0.012 : 0.0018; // ctrl = gesto de pellizco del trackpad
          this.cam.zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit * k));
        }
        this.dirty = true;
      },
      { passive: false },
    );

    this.on(this.stage, "dblclick", (e) => {
      if (this.locked || (e.target as Element).closest("[data-release],[data-artista]")) return;
      const p = this.local(e);
      const f = this.opts.config.camera.diveFactor;
      this.zoomAround(p.x, p.y, e.shiftKey ? 1 / f : f);
    });

    this.on(window, "keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (this.locked || e.metaKey || e.ctrlKey || e.altKey) return;
      const step = e.shiftKey ? 320 : 90;
      const { w, h } = this.cam;
      switch (e.key) {
        case "ArrowLeft":
          this.flyBy(step, 0);
          break;
        case "ArrowRight":
          this.flyBy(-step, 0);
          break;
        case "ArrowUp":
          this.flyBy(0, step);
          break;
        case "ArrowDown":
          this.flyBy(0, -step);
          break;
        case "+":
        case "=":
          this.zoomAround(w / 2, h / 2, 1.6, 0.5);
          break;
        case "-":
        case "_":
          this.zoomAround(w / 2, h / 2, 1 / 1.6, 0.5);
          break;
        case "0":
        case "Home":
          this.home();
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  }

  private flyBy(dxScreen: number, dyScreen: number) {
    const x = this.cam.x - dxScreen / this.cam.scale;
    const y = this.cam.y - dyScreen / this.cam.scale;
    this.flyTo(x, y, this.cam.scale, 0.45);
  }

  private pinchSpan() {
    const [a, b] = Array.from(this.pointers.values());
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
