/**
 * El nombre que muta: "pingli records" (abajo a la izquierda) se vuelve el
 * logo y regresa. Con modo "clic" (el de ahora) cambia cada vez que se toca
 * el nombre o el logo (también con Enter o espacio); con "ciclo", solo, cada
 * tantos segundos.
 *
 * El texto y el logo están trazados como contornos emparejados punto por
 * punto (src/lib/logo-datos.json, hecho con scripts/logo/). Dos estilos:
 *
 *  - "ascii": el texto se deshace en caracteres de la rampa de la figura
 *    central (. , : ; ^ + *), que parpadean y se reacomodan celda por celda
 *    hasta dibujar el logo; luego el logo se aclara en líneas limpias.
 *  - "trazos": cada punto viaja de su lugar en la letra a su lugar en el
 *    logo, con un temblor que crece a la mitad del camino.
 *
 * En reposo como texto se ve el texto de verdad (el h1); en reposo como logo,
 * el dibujo nítido. Se ve siempre, también con "reducir movimiento".
 */

type Datos = { linea: number; pares: { t: number[]; l: number[] }[] };

export type MutanteSettings = {
  /** "clic": cambia al tocarlo; "ciclo": cambia solo (texto y logo, en segundos). */
  readonly modo: "clic" | "ciclo";
  /** "fundido": sin deformar, uno se apaga y el otro aparece (no se usa por ahora). */
  readonly estilo: "ascii" | "trazos" | "fundido";
  /** Segundos como texto y como logo (solo en "ciclo") y lo que dura cada mutación. */
  readonly texto: number;
  readonly logo: number;
  readonly mutacion: number;
};

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const entre = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
/** Cuánto se escalonan los contornos (fracción de la mutación), en "trazos". */
const ESCALON = 0.38;
/** Temblor máximo, en milésimas de em. */
const TEMBLOR = 85;

// —— ascii: la rejilla de caracteres, en em del nombre
const RAMPA = " .:;^+**";
const CELDA_ALTO = 0.25;
const CELDA_ANCHO = 0.15;
/** El área que cubre la rejilla (em, desde la esquina de arriba a la izquierda del h1). */
const AREA = { x: -0.06, y: -2.42, w: 7.8, h: 3.42 };
/** Cuántas veces por segundo cambian los caracteres. */
const PARPADEO = 14;

export function mountWordmarkMutante(h1: HTMLElement, s: MutanteSettings, listo: Promise<unknown>): () => void {
  let vivo = true;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let svg: SVGSVGElement | null = null;
  let lienzo: HTMLCanvasElement | null = null;
  let quitarVisible = () => {};

  // el texto de verdad: se esconde sin mover nada mientras se ve el dibujo
  const letras = h1.querySelector<HTMLElement>(".wordmark-letras");
  if (!letras) return () => {};

  // —— modo "clic": tocar el nombre (o el logo) lo cambia; el plano no se entera
  let alternar: (() => void) | null = null;
  const quitarClic: Array<() => void> = [];
  if (s.modo === "clic") {
    h1.dataset.clic = "";
    h1.tabIndex = 0;
    const on = <K extends keyof HTMLElementEventMap>(ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      h1.addEventListener(ev, fn);
      quitarClic.push(() => h1.removeEventListener(ev, fn));
    };
    // sin arrastrar el plano, sin acercarse con doble clic, sin cerrar al artista abierto
    on("pointerdown", (e) => e.stopPropagation());
    on("dblclick", (e) => e.stopPropagation());
    on("click", (e) => {
      e.stopPropagation();
      alternar?.();
    });
    on("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      alternar?.();
    });
  }

  Promise.all([import("@/lib/logo-datos.json"), listo]).then(([m]) => {
    if (!vivo) return;
    const datos = (m.default ?? m) as Datos;
    const pares = datos.pares.map((p, i) => {
      const n = p.t.length / 2;
      // el contorno arranca según qué tan a la izquierda está (entre texto y logo)
      let cx = 0;
      for (let k = 0; k < n; k++) cx += p.t[2 * k] + p.l[2 * k];
      return { ...p, n, cx: cx / (2 * n), semilla: i * 1.7, retraso: 0 };
    });
    const xs = pares.map((p) => p.cx);
    const min = Math.min(...xs);
    const rango = Math.max(...xs) - min || 1;
    for (const p of pares) p.retraso = ((p.cx - min) / rango) * ESCALON;

    const NS = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "wordmark-mutante");
    svg.setAttribute("viewBox", `0 0 1000 ${datos.linea * 1000}`);
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("fill-rule", "evenodd");
    svg.append(path);
    svg.style.visibility = "hidden";
    h1.append(svg);
    const dibujo = svg;

    /** La figura a `T` del camino (0 texto, 1 logo), como trazo SVG; `reloj` mueve el temblor. */
    function trazo(T: number, reloj: number) {
      let d = "";
      for (const p of pares) {
        const local = Math.min(1, Math.max(0, (T - p.retraso) / (1 - ESCALON)));
        const k = suave(local);
        const amp = TEMBLOR * Math.sin(Math.PI * local);
        const { t, l, n, semilla } = p;
        for (let i = 0; i < n; i++) {
          const x = t[2 * i] + (l[2 * i] - t[2 * i]) * k + amp * Math.sin(i * 0.21 + reloj * 5.5 + semilla);
          const y = t[2 * i + 1] + (l[2 * i + 1] - t[2 * i + 1]) * k + amp * Math.cos(i * 0.17 - reloj * 4.3 + semilla * 1.7);
          d += (i ? "L" : "M") + Math.round(x) + " " + Math.round(y);
        }
        d += "Z";
      }
      return d;
    }

    // ———————————————————————————— estilo "trazos"
    function mutarTrazos(desde: number, hasta: number, alTerminar: () => void) {
      const t0 = performance.now();
      dibujo.style.visibility = "visible";
      dibujo.style.opacity = "";
      letras!.style.visibility = "hidden";
      const paso = (ahora: number) => {
        if (!vivo) return;
        const u = Math.min(1, (ahora - t0) / (s.mutacion * 1000));
        path.setAttribute("d", trazo(desde + (hasta - desde) * u, ahora / 1000));
        if (u < 1) {
          raf = requestAnimationFrame(paso);
          return;
        }
        if (hasta === 0) {
          dibujo.style.visibility = "hidden";
          letras!.style.visibility = "";
        }
        alTerminar();
      };
      raf = requestAnimationFrame(paso);
    }

    // ———————————————————————————— estilo "ascii"
    const cols = Math.ceil(AREA.w / CELDA_ANCHO);
    const filas = Math.ceil(AREA.h / CELDA_ALTO);
    /** Cuánta tinta hay en cada celda (0–1) para el texto (0) y para el logo (1). */
    function cobertura(cual: "t" | "l"): Float32Array {
      const M = 4; // muestras por celda, por lado
      const c = document.createElement("canvas");
      c.width = cols * M;
      c.height = filas * M;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      // de milésimas de em a muestras
      g.scale(M / (CELDA_ANCHO * 1000), M / (CELDA_ALTO * 1000));
      g.translate(-AREA.x * 1000, -AREA.y * 1000);
      g.beginPath();
      for (const p of pares) {
        const a = p[cual];
        for (let i = 0; i < p.n; i++) (i ? g.lineTo : g.moveTo).call(g, a[2 * i], a[2 * i + 1]);
        g.closePath();
      }
      g.fill("evenodd");
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const out = new Float32Array(cols * filas);
      for (let f = 0; f < filas; f++)
        for (let k = 0; k < cols; k++) {
          let suma = 0;
          for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) suma += px[((f * M + y) * c.width + k * M + x) * 4 + 3];
          // las líneas delgadas del logo también deben pesar: se sube el contraste
          out[f * cols + k] = Math.pow(suma / (M * M * 255), 0.5);
        }
      return out;
    }
    let cubre: { t: Float32Array; l: Float32Array; retraso: Float32Array; fase: Float32Array } | null = null;
    function prepararAscii() {
      if (cubre) return cubre;
      const n = cols * filas;
      const retraso = new Float32Array(n);
      const fase = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        // cada celda cambia a su tiempo: en general de izquierda a derecha, con desorden
        retraso[i] = Math.min(0.62, ((i % cols) / cols) * 0.34 + Math.random() * 0.3);
        fase[i] = Math.random() * 1000;
      }
      cubre = { t: cobertura("t"), l: cobertura("l"), retraso, fase };
      return cubre;
    }

    function mutarAscii(desde: number, hasta: number, alTerminar: () => void) {
      const c = prepararAscii();
      const em = parseFloat(getComputedStyle(h1).fontSize) || 36;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (!lienzo) {
        lienzo = document.createElement("canvas");
        lienzo.className = "wordmark-ascii";
        lienzo.setAttribute("aria-hidden", "true");
        h1.append(lienzo);
      }
      const lz = lienzo;
      lz.width = Math.round(AREA.w * em * dpr);
      lz.height = Math.round(AREA.h * em * dpr);
      const g = lz.getContext("2d")!;
      const cw = CELDA_ANCHO * em * dpr;
      const ch = CELDA_ALTO * em * dpr;
      g.font = `${(ch * 1.18).toFixed(2)}px "Courier Prime", "Courier New", monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = getComputedStyle(h1).color;

      // el logo nítido, listo para aclararse (o para deshacerse)
      path.setAttribute("d", trazo(1, 0));
      const deTexto = desde === 0;
      const sale = deTexto ? letras! : (dibujo as unknown as HTMLElement);
      const llega = deTexto ? (dibujo as unknown as HTMLElement) : letras!;
      const de = deTexto ? c.t : c.l;
      const a = deTexto ? c.l : c.t;
      dibujo.style.visibility = "visible";
      letras!.style.visibility = "";
      llega.style.opacity = "0";
      lz.style.visibility = "visible";

      const t0 = performance.now();
      const paso = (ahora: number) => {
        if (!vivo) return;
        const u = Math.min(1, (ahora - t0) / (s.mutacion * 1000));
        // lo nítido se va al principio y llega al final; en medio, solo caracteres
        sale.style.opacity = String(1 - entre(u, 0, 0.2));
        llega.style.opacity = String(entre(u, 0.8, 1));
        lz.style.opacity = String(Math.min(entre(u, 0, 0.12), 1 - entre(u, 0.86, 1)));
        const T = entre(u, 0.1, 0.9);
        const tic = Math.floor((ahora / 1000) * PARPADEO);
        g.clearRect(0, 0, lz.width, lz.height);
        for (let i = 0; i < c.retraso.length; i++) {
          const k = suave(entre(T, c.retraso[i], c.retraso[i] + 0.38));
          // ruido que solo existe mientras la celda cambia (y un poco alrededor, como chispas)
          const r = Math.sin((c.fase[i] + tic * 7.13) * 12.9898) * 43758.5453;
          const azar = r - Math.floor(r);
          const enCamino = Math.sin(Math.PI * k);
          let v = de[i] + (a[i] - de[i]) * k;
          v += (azar - 0.42) * enCamino * 0.75;
          if (v <= 0.06) continue;
          const idx = Math.min(RAMPA.length - 1, Math.round(v * (RAMPA.length - 1) + (enCamino > 0.05 ? (azar - 0.5) * 2 : 0)));
          if (idx <= 0) continue;
          g.fillText(RAMPA[idx], ((i % cols) + 0.5) * cw, (Math.floor(i / cols) + 0.5) * ch);
        }
        if (u < 1) {
          raf = requestAnimationFrame(paso);
          return;
        }
        lz.style.visibility = "hidden";
        sale.style.opacity = "";
        llega.style.opacity = "";
        dibujo.style.visibility = hasta === 1 ? "visible" : "hidden";
        letras!.style.visibility = hasta === 1 ? "hidden" : "";
        alTerminar();
      };
      raf = requestAnimationFrame(paso);
    }

    // ———————————————————————————— "fundido": sin deformar, uno se apaga y el otro aparece
    function mutarFundido(desde: number, hasta: number, alTerminar: () => void) {
      path.setAttribute("d", trazo(1, 0));
      dibujo.style.visibility = "visible";
      letras!.style.visibility = "";
      const t0 = performance.now();
      const paso = (ahora: number) => {
        if (!vivo) return;
        const u = Math.min(1, (ahora - t0) / 1400);
        const T = desde + (hasta - desde) * u;
        dibujo.style.opacity = String(entre(T, 0.5, 1));
        letras!.style.opacity = String(1 - entre(T, 0, 0.5));
        if (u < 1) {
          raf = requestAnimationFrame(paso);
          return;
        }
        alTerminar();
      };
      raf = requestAnimationFrame(paso);
    }

    const mutar = s.estilo === "ascii" ? mutarAscii : s.estilo === "fundido" ? mutarFundido : mutarTrazos;

    function reposar(en: number) {
      timer = setTimeout(() => esperarVisible(() => mutar(en, 1 - en, () => reposar(1 - en))), (en ? s.logo : s.texto) * 1000);
    }

    // con la pestaña escondida no muta: espera a que vuelva
    function esperarVisible(f: () => void) {
      if (!document.hidden) return f();
      const al = () => {
        if (document.hidden) return;
        quitarVisible();
        f();
      };
      document.addEventListener("visibilitychange", al);
      quitarVisible = () => document.removeEventListener("visibilitychange", al);
    }

    if (s.modo === "ciclo") {
      reposar(0);
      return;
    }

    // el área del logo también se puede tocar (no solo sus líneas)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pares)
      for (let i = 0; i < p.n; i++) {
        x0 = Math.min(x0, p.l[2 * i]);
        x1 = Math.max(x1, p.l[2 * i]);
        y0 = Math.min(y0, p.l[2 * i + 1]);
        y1 = Math.max(y1, p.l[2 * i + 1]);
      }
    const area = document.createElementNS(NS, "rect");
    area.setAttribute("x", String(x0));
    area.setAttribute("y", String(y0));
    area.setAttribute("width", String(x1 - x0));
    area.setAttribute("height", String(y1 - y0));
    area.setAttribute("fill", "transparent");
    area.setAttribute("class", "wordmark-area");
    dibujo.prepend(area);

    let estado = 0;
    let mutando = false;
    alternar = () => {
      if (mutando) return;
      mutando = true;
      const hasta = 1 - estado;
      mutar(estado, hasta, () => {
        estado = hasta;
        mutando = false;
      });
    };
  });

  return () => {
    vivo = false;
    quitarClic.forEach((f) => f());
    delete h1.dataset.clic;
    h1.removeAttribute("tabindex");
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    quitarVisible();
    svg?.remove();
    lienzo?.remove();
    letras.style.visibility = "";
    letras.style.opacity = "";
  };
}
