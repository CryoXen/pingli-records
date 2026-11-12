"use client";

import { useEffect, useState } from "react";
import { descifrar } from "@/lib/cifrado";
import type { Contenido } from "@/lib/contenido/tipos";
import Ciclo from "./Ciclo";
import InfiniteCanvas from "./InfiniteCanvas";

/**
 * La portada recibe el contenido como un blob opaco y lo abre ya en el
 * navegador, después de montar. Mientras tanto muestra solo el lienzo vacío,
 * así nada del contenido viaja dentro del HTML.
 */
export default function Portada({ blob }: { blob: string }) {
  const [contenido, setContenido] = useState<Contenido | null>(null);

  useEffect(() => {
    try {
      setContenido(JSON.parse(descifrar(blob)) as Contenido);
    } catch {
      setContenido(null);
    }
  }, [blob]);

  if (!contenido) {
    return (
      <main className="stage" aria-hidden="true">
        <canvas className="canvas" />
      </main>
    );
  }

  return (
    <>
      <InfiniteCanvas contenido={contenido} />
      <Ciclo
        images={contenido.previsiones}
        final={contenido.musica.final}
        prevision={contenido.prevision}
      />
    </>
  );
}
