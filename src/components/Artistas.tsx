import type { Artist } from "@/config/site";

/** Lo que va en el "nombre de archivo" del cuadro vacío: "artista 01" → "artista-01.jpg". */
const archivo = (a: Artist) =>
  `${a.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || a.id}.jpg`;

/**
 * Los artistas: cuadros fijos alrededor de la esfera (los coloca src/lib/artistas.ts).
 * Sin foto, el marco vacío con su nombre de archivo, como los lanzamientos.
 * Al tocar uno se despliegan sus proyectos alrededor.
 */
export function Artistas({ artists }: { artists: readonly Artist[] }) {
  return (
    <>
      {artists.map((a, i) => (
        <button key={a.id} type="button" className="release artista" data-artista={i} data-lod="hidden" aria-label={`${a.name}: ver sus proyectos`}>
          {a.image ? <img className="release-img" src={a.image} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
          <span className="release-alt" aria-hidden="true">
            {archivo(a)}
          </span>
          <span className="release-caption" aria-hidden="true">
            {a.name}
          </span>
        </button>
      ))}
    </>
  );
}
