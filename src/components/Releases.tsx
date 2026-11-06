import type { RefObject } from "react";
import type { Release } from "@/config/site";
import type { Engine } from "@/engine/engine";
import { openRelease } from "@/lib/release-panel";

/** Marcos que se muestran por debajo de este tamaño no se alcanzan con Tab: son secretos. */
const SECRET_SIZE = 10;

/**
 * Lanzamientos en el lienzo. Sin foto son marcos vacíos que muestran el
 * nombre de archivo de su portada, como una imagen que no ha cargado; con
 * foto, la foto llena el cuadro. El motor los posiciona; aquí solo se definen.
 * Al tocar uno se abre su panel a la derecha.
 */
export function Releases({
  releases,
  layerRef,
  engineRef,
}: {
  releases: readonly Release[];
  layerRef: RefObject<HTMLDivElement | null>;
  engineRef: RefObject<Engine | null>;
}) {
  return (
    <div className="world-layer" ref={layerRef}>
      {releases.map((r, i) => (
        <button
          key={r.catalog}
          type="button"
          className="release"
          data-release={i}
          data-lod="hidden"
          tabIndex={r.size < SECRET_SIZE ? -1 : 0}
          aria-label={[r.catalog, r.title, r.artist].filter(Boolean).join(", ")}
          onClick={(e) => {
            if (engineRef.current?.wasDrag()) return;
            engineRef.current?.flyToRelease(i);
            // con teclado (Enter o espacio) el foco pasa al panel
            openRelease(i, { focus: e.detail === 0 });
          }}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) engineRef.current?.flyToRelease(i);
          }}
        >
          {r.image ? <img className="release-img" src={r.image} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
          <span className="release-alt" aria-hidden="true">
            {r.catalog}.jpg
          </span>
          <span className="release-caption" aria-hidden="true">
            {r.title}
            {r.artist ? (
              <>
                <br />
                {r.artist}
              </>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
