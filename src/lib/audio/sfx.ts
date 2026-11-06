/**
 * Efectos de sonido: uno al tocar un proyecto (un cuadro del plano) y otro
 * cada vez que aparece una frase o un cartel. Cada mundo tiene los suyos, y
 * todos comparten un volumen (el del admin, pestaña "sonidos"), aparte del
 * de la música.
 *
 * Suenan por el mismo motor que la música (también respetan el deslizador
 * "vol") y se descargan al entrar, para que suenen al instante. Los avisos
 * llegan como eventos del navegador, así que ni los cuadros ni las frases
 * necesitan saber nada del audio:
 *   "pingli:proyecto"  → lo manda el panel de lanzamiento al abrirse
 *   "pingli:frase"     → lo manda el plano cuando brota una frase (detail.mundo)
 */
import type { SonidoUI, SonidosUI } from "@/lib/contenido/tipos";
import { currentSide, type Ambient } from "./ambient";

export const PROYECTO_EVENT = "pingli:proyecto";
export const FRASE_EVENT = "pingli:frase";
/** Lo manda el ciclo al llegar a 00:00: desde ahí solo suena la canción de la previsión. */
const PREVISION_EVENT = "pingli:prevision";

type Mundo = "claro" | "oscuro";
const mundoActual = (): Mundo => (currentSide() === "dark" ? "oscuro" : "claro");

/** Volumen 0–1 → dB, con la misma curva que el deslizador de la música (0.5 ≈ −12 dB). */
export const volumenADb = (v: number) => (v <= 0 ? -Infinity : 40 * Math.log10(Math.min(1, v)));

export function mountSfx(ambient: Ambient, s: SonidosUI, entered: Promise<void>): () => void {
  let listo = false;
  const todos = [s.proyecto.claro, s.proyecto.oscuro, s.frase.claro, s.frase.oscuro].filter((x): x is SonidoUI => !!x);
  const global = volumenADb(s.volumen);

  // al entrar ya existe el audio: se descargan (son pocos KB)
  void entered.then(() => {
    listo = true;
    if (global > -Infinity) for (const x of todos) void ambient.loadCue(x.src);
  });

  let callado = false;
  const sonar = (x: SonidoUI | null) => {
    if (listo && !callado && x && global > -Infinity) ambient.playSfx(x.src, x.gainDb + global, x.inicio);
  };
  const onPrevision = () => {
    callado = true;
    ambient.stopShots(0.15);
  };
  const onProyecto = () => sonar(s.proyecto[mundoActual()]);
  const onFrase = (e: Event) => {
    const mundo = (e as CustomEvent<{ mundo?: Mundo }>).detail?.mundo ?? mundoActual();
    sonar(s.frase[mundo]);
  };

  window.addEventListener(PROYECTO_EVENT, onProyecto);
  window.addEventListener(FRASE_EVENT, onFrase);
  window.addEventListener(PREVISION_EVENT, onPrevision);
  return () => {
    window.removeEventListener(PROYECTO_EVENT, onProyecto);
    window.removeEventListener(FRASE_EVENT, onFrase);
    window.removeEventListener(PREVISION_EVENT, onPrevision);
  };
}
