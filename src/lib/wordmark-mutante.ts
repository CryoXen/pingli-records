/**
 * El nombre que muta: "pingli records" (abajo a la izquierda) se deforma
 * hasta dibujar el logo y regresa, en ciclo.
 *
 * El texto y el logo están trazados como contornos emparejados punto por
 * punto (src/lib/logo-datos.json, hecho con scripts/logo/). Al mutar, cada
 * punto viaja de su lugar en la letra a su lugar en el logo, con un temblor
 * que crece a la mitad del camino; los contornos salen escalonados de
 * izquierda a derecha. En reposo como texto se ve el texto de verdad (el h1);
 * el dibujo solo aparece mientras muta y mientras es logo.
 *
 * Con "reducir movimiento" no se monta: queda el texto.
 */

type Datos = { linea: number; pares: { t: number[]; l: number[] }[] };

export type MutanteSettings = {
  /** Segundos como texto, como logo y lo que dura cada mutación. */
  readonly texto: number;
  readonly logo: number;
  readonly mutacion: number;
};

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Cuánto se escalonan los contornos (fracción de la mutación). */
const ESCALON = 0.38;
/** Temblor máximo, en milésimas de em. */
const TEMBLOR = 85;

export function mountWordmarkMutante(h1: HTMLElement, s: MutanteSettings, listo: Promise<unknown>): () => void {
  let vivo = true;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let svg: SVGSVGElement | null = null;
  let quitarVisible = () => {};

  // el texto de verdad: se esconde sin mover nada mientras se ve el dibujo
  const letras = h1.querySelector<HTMLElement>(".wordmark-letras");
  if (!letras) return () => {};

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

    /** Dibuja la figura a `T` del camino (0 texto, 1 logo); `reloj` mueve el temblor. */
    function dibujar(T: number, reloj: number) {
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
      path.setAttribute("d", d);
    }

    const mostrar = (dibujo: boolean) => {
      if (svg) svg.style.visibility = dibujo ? "visible" : "hidden";
      letras.style.visibility = dibujo ? "hidden" : "";
    };

    /** Muta de `desde` a `hasta` (0 texto, 1 logo) y luego reposa. */
    function mutar(desde: number, hasta: number) {
      const t0 = performance.now();
      mostrar(true);
      const paso = (ahora: number) => {
        if (!vivo) return;
        const u = Math.min(1, (ahora - t0) / (s.mutacion * 1000));
        dibujar(desde + (hasta - desde) * u, ahora / 1000);
        if (u < 1) {
          raf = requestAnimationFrame(paso);
          return;
        }
        if (hasta === 0) mostrar(false);
        reposar(hasta);
      };
      raf = requestAnimationFrame(paso);
    }

    function reposar(en: number) {
      timer = setTimeout(() => esperarVisible(() => mutar(en, 1 - en)), (en ? s.logo : s.texto) * 1000);
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

    reposar(0);
  });

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    quitarVisible();
    svg?.remove();
    letras.style.visibility = "";
  };
}
