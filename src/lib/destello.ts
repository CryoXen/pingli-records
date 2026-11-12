/**
 * El destello de palabras de la previsión: arriba de la pantalla, palabras
 * sueltas al azar de los libros del proyecto (src/config/palabras.json: las
 * más usadas de los cuatro libros en español), una a la vez y a toda
 * velocidad; cada palabra sale en una fuente distinta
 * (src/config/fuentes-destello.ts; cuáles, se elige en el admin).
 *
 * Las palabras y las fuentes se descargan antes, junto con la previsión
 * (prepararDestello); si alguna fuente no llega, esa palabra sale en la
 * tipografía del sitio.
 */
import {
  fuentesElegidas,
  type FuenteDestello,
} from "@/config/fuentes-destello";

export type DestelloSettings = {
  readonly enabled: boolean;
  /** Segundos que dura cada palabra en pantalla. */
  readonly cada: number;
  /** Ids de las fuentes que pueden salir (null = todas). */
  readonly fuentes?: readonly string[] | null;
};

let palabras: string[] | null = null;
let preparando: Promise<void> | null = null;

const css = (f: FuenteDestello) => `${f.peso ?? 400} 16px ${f.familia}`;

/** Descarga las palabras y las fuentes elegidas (una sola vez). */
export function prepararDestello(s: DestelloSettings): Promise<void> {
  preparando ??= (async () => {
    const m = await import("@/config/palabras.json");
    palabras = (m.default ?? m) as string[];
    if (document.fonts)
      await Promise.allSettled(
        fuentesElegidas(s.fuentes).map((f) =>
          document.fonts.load(css(f), "añ"),
        ),
      );
  })().catch(() => {});
  return preparando;
}

/** Arranca el destello dentro de la previsión; devuelve cómo detenerlo. */
export function mountDestello(
  overlay: HTMLElement,
  s: DestelloSettings,
): () => void {
  if (!s.enabled) return () => {};
  const fuentes = fuentesElegidas(s.fuentes);
  const p = document.createElement("p");
  p.className = "prevision-palabras";
  overlay.append(p);
  let vivo = true;
  let raf = 0;
  let ultima = 0;
  let fuente = -1;
  void prepararDestello(s);

  const paso = (ahora: number) => {
    if (!vivo) return;
    raf = requestAnimationFrame(paso);
    if (!palabras || ahora - ultima < s.cada * 1000) return;
    ultima = ahora;
    // nunca la misma fuente dos veces seguidas (si hay más de una)
    let i = Math.floor(Math.random() * Math.max(1, fuentes.length - 1));
    if (fuentes.length > 1 && i >= fuente) i++;
    fuente = i % fuentes.length;
    const f = fuentes[fuente];
    p.style.fontFamily = `${f.familia}, "Archivo", sans-serif`;
    p.style.fontWeight = String(f.peso ?? 400);
    p.style.fontStretch = f.ancho ?? "100%";
    // las cursivas son más chicas a la vista: salen un poco más grandes (destello.css)
    p.dataset.grupo = f.grupo;
    p.textContent = palabras[Math.floor(Math.random() * palabras.length)];
  };
  raf = requestAnimationFrame(paso);

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    p.remove();
  };
}
