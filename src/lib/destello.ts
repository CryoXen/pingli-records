/**
 * El destello de palabras de la previsión: arriba de la pantalla, palabras
 * sueltas al azar de los cinco libros del proyecto (src/config/palabras.json:
 * las más usadas de cada libro, en su idioma), una a la vez y a toda
 * velocidad; cada palabra sale en una fuente distinta (src/app/destello.css).
 *
 * Las palabras y las fuentes se descargan antes, junto con la previsión
 * (prepararDestello); si alguna fuente no llega, esa palabra sale en la
 * tipografía del sitio.
 */

export type DestelloSettings = {
  readonly enabled: boolean;
  /** Segundos que dura cada palabra en pantalla. */
  readonly cada: number;
};

/** Las fuentes del destello (las de destello.css) y las dos del sitio. */
export const FUENTES = [
  "Orbitron",
  "Michroma",
  "Major Mono Display",
  "Megrim",
  "Wallpoet",
  "Zen Dots",
  "Tourney",
  "Turret Road",
  "Syncopate",
  "VT323",
  "DotGothic16",
  "Silkscreen",
  "Doto",
  "Sixtyfour",
  "Bungee Hairline",
  "Rubik Glitch",
  "Monoton",
  "Gruppo",
  "Archivo",
  "Courier Prime",
] as const;

let palabras: string[] | null = null;
let preparando: Promise<void> | null = null;

/** Descarga las palabras y las fuentes (una sola vez). */
export function prepararDestello(): Promise<void> {
  preparando ??= (async () => {
    const m = await import("@/config/palabras.json");
    palabras = (m.default ?? m) as string[];
    if (document.fonts) await Promise.allSettled(FUENTES.map((f) => document.fonts.load(`16px "${f}"`, "añ")));
  })().catch(() => {});
  return preparando;
}

/** Arranca el destello dentro de la previsión; devuelve cómo detenerlo. */
export function mountDestello(overlay: HTMLElement, s: DestelloSettings): () => void {
  if (!s.enabled) return () => {};
  const p = document.createElement("p");
  p.className = "prevision-palabras";
  overlay.append(p);
  let vivo = true;
  let raf = 0;
  let ultima = 0;
  let fuente = -1;
  void prepararDestello();

  const paso = (ahora: number) => {
    if (!vivo) return;
    raf = requestAnimationFrame(paso);
    if (!palabras || ahora - ultima < s.cada * 1000) return;
    ultima = ahora;
    // nunca la misma fuente dos veces seguidas
    let f = Math.floor(Math.random() * (FUENTES.length - 1));
    if (f >= fuente) f++;
    fuente = f % FUENTES.length;
    p.style.fontFamily = `"${FUENTES[fuente]}", "Archivo", sans-serif`;
    p.textContent = palabras[Math.floor(Math.random() * palabras.length)];
  };
  raf = requestAnimationFrame(paso);

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
    p.remove();
  };
}
