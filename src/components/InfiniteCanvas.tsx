"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { site } from "@/config/site";
import { cartelesSegun } from "@/config/carteles";
import { Engine } from "@/engine/engine";
import { entered } from "@/lib/audio/entry";
import type { Contenido } from "@/lib/contenido/tipos";
import { mountWall } from "@/lib/muro";
import { mountPhrases } from "@/lib/phrases";
import { connectCamera } from "@/lib/release-panel";
import { currentSide, setSide } from "@/lib/side";
import { mountZone } from "@/lib/zona";
import AudioGate from "./AudioGate";
import { Overlay } from "./Overlay";
import ReleasePanel from "./ReleasePanel";
import { Releases } from "./Releases";
import { formatCoord, formatScale } from "./format";

/**
 * Portada: el lienzo infinito con el objeto ASCII, los lanzamientos, los
 * carteles que brotan del plano y la interfaz en las esquinas. El contenido
 * (lanzamientos, carteles, frases, sonidos) llega de page.tsx: de Supabase o,
 * sin él, de src/config.
 */
export default function InfiniteCanvas({ contenido }: { contenido: Contenido }) {
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const phraseRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const hx = useRef<HTMLSpanElement>(null);
  const hy = useRef<HTMLSpanElement>(null);
  const hz = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    if (!stage || !canvas || !layer) return;

    let alive = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // los carteles que pueden brotar (sin las pistas del muro mientras esté apagado)
    const leibles = cartelesSegun(site.wall.enabled, contenido.carteles);
    // la zona: el cuarto dentro de la imagen de los carteles, con los que ya se leyeron
    const zone = phraseRef.current
      ? mountZone(
          phraseRef.current,
          site.zone,
          Object.values(leibles.claro).flat(),
          Object.values(leibles.oscuro).flat(),
          site.copy.zone,
          site.phrases.signImage,
          {
            // al salir, la cámara vuelve al cartel por el que entraste
            fly: (x, y, scale) => engineRef.current?.flyTo(x, y, scale, 1.2),
            // mientras la zona está abierta no brota nada
            pause: (on) => field?.pause(on),
          },
        )
      : null;
    const field = phraseRef.current
      ? mountPhrases(phraseRef.current, site.phrases, { frases: contenido.frases, carteles: leibles }, entered, {
          releases: contenido.releases,
          dive: site.zone.dive,
          onDive: (d) => zone?.enter(d),
        })
      : null;
    // el muro (camino secreto; apagado por ahora en site.wall)
    const wall = phraseRef.current
      ? mountWall(
          phraseRef.current,
          site.wall,
          Object.values(contenido.carteles.claro).flat(),
          Object.values(contenido.carteles.oscuro).flat(),
          site.copy.wall,
          site.phrases.signImage,
        )
      : null;

    const engine = new Engine(stage, canvas, layer, {
      config: { ...site, releases: [...contenido.releases] },
      reducedMotion,
      onCamera: (cam) => {
        field?.camera(cam);
        wall?.camera(cam);
        if (hx.current) hx.current.textContent = formatCoord(cam.x, cam.scale);
        if (hy.current) hy.current.textContent = formatCoord(-cam.y, cam.scale);
        if (hz.current) hz.current.textContent = formatScale(cam.scale);
      },
      onCross: () => {
        const next = currentSide() === "dark" ? "light" : "dark";
        setSide(next);
        engine.setTheme(next);
      },
    });
    engine.setTheme(currentSide());
    engineRef.current = engine;
    // el panel encuadra con esta cámara los lanzamientos de una etiqueta
    connectCamera((x, y, scale) => engine.flyTo(x, y, scale));

    // entrada: primero el plano y la figura, luego el texto pieza por pieza
    const items = Array.from(stage.querySelectorAll<HTMLElement>("[data-intro]")).sort(
      (a, b) => Number(a.dataset.intro) - Number(b.dataset.intro),
    );
    const tl = gsap.timeline({ paused: true });
    if (reducedMotion) {
      tl.set(engine, { presence: 1 }).set([...items, layer], { opacity: 1 });
    } else {
      tl.set([...items, layer], { opacity: 0 })
        .to(engine, { presence: 1, duration: 2.4, ease: "power1.inOut" }, 0)
        .to(items, { opacity: 1, duration: 0.9, stagger: 0.24, ease: "power1.out" }, 1.1)
        .to(layer, { opacity: 1, duration: 1.2, ease: "power1.out" }, 1.8);
    }

    // el ASCII se dibuja con Courier Prime: esperar la fuente (máx. 1.5 s)
    // y a que el visitante pulse "entrar"
    const font = document.fonts
      ? Promise.race([
          document.fonts.load('16px "Courier Prime"'),
          new Promise((r) => setTimeout(r, 1500)),
        ])
      : Promise.resolve();
    Promise.all([font.catch(() => {}), entered]).then(() => {
      if (!alive) return;
      document.documentElement.classList.remove("intro");
      engine.start();
      tl.play();
    });

    return () => {
      alive = false;
      field?.destroy();
      zone?.destroy();
      wall?.destroy();
      connectCamera(null);
      tl.kill();
      engine.destroy();
      engineRef.current = null;
    };
  }, [contenido]);

  return (
    <main className="stage" ref={stageRef}>
      <canvas
        ref={canvasRef}
        className="canvas"
        role="img"
        aria-label="Lienzo infinito con una figura de caracteres al centro. Arrastra para moverte, usa la rueda para acercarte."
      />
      <Releases releases={contenido.releases} layerRef={layerRef} engineRef={engineRef} />
      <div className="phrase-layer" ref={phraseRef} aria-hidden="true" />
      <Overlay hud={{ x: hx, y: hy, z: hz }} />
      <AudioGate sonidos={contenido.sonidos} />
      <ReleasePanel releases={contenido.releases} />
    </main>
  );
}
