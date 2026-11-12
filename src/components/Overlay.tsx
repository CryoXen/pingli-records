import { useEffect, useRef, type Ref } from "react";
import { site } from "@/config/site";
import { entered } from "@/lib/audio/entry";
import { mountWordmarkMutante } from "@/lib/wordmark-mutante";
import VolumeSlider from "./VolumeSlider";
import { formatClock } from "@/lib/ciclo";

export type HudRefs = {
  x: Ref<HTMLSpanElement>;
  y: Ref<HTMLSpanElement>;
  z: Ref<HTMLSpanElement>;
};

/**
 * Texto en las esquinas, sobre el lienzo. No recibe eventos: todo pasa
 * al lienzo de abajo (salvo el volumen). data-intro marca el orden de aparición.
 *
 * Arriba: volumen a la izquierda, coordenadas a la derecha.
 * Abajo: el nombre a la izquierda (muta en el logo y regresa:
 * src/lib/wordmark-mutante.ts), la cuenta regresiva a la derecha.
 */
export function Overlay({ hud, cuenta }: { hud: HudRefs; /** Segundos de la cuenta regresiva. */ cuenta: number }) {
  const nombre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const h1 = nombre.current;
    if (!h1 || !site.wordmark.enabled) return;
    // con "reducir movimiento" no se deforma: el texto y el logo se funden uno en el otro
    const calmado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return mountWordmarkMutante(h1, { ...site.wordmark, estilo: calmado ? "fundido" : site.wordmark.estilo }, entered);
  }, []);

  return (
    <div className="overlay">
      <header className="overlay-top">
        <VolumeSlider />
        <p className="hud" data-intro="4" aria-hidden="true">
          x <span ref={hud.x}>0</span> y <span ref={hud.y}>0</span> z <span ref={hud.z}>1.00</span>
        </p>
      </header>
      <h1 className="wordmark" data-intro="1" ref={nombre} aria-label={site.name}>
        <span className="wordmark-letras">{site.name}</span>
      </h1>
      {site.cycle.enabled ? (
        // cuenta regresiva de la visita; la mueve src/lib/ciclo.ts
        <p className="clock" data-intro="5" data-cycle-clock role="timer" aria-label="tiempo de la visita">
          {formatClock(cuenta)}
        </p>
      ) : null}
    </div>
  );
}
