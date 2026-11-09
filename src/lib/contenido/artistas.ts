/**
 * Los artistas del plano salen de los lanzamientos: uno por cada nombre de
 * artista distinto (sin importar mayúsculas ni espacios de más), en el orden
 * en que aparecen. De la tabla "artistas" se toma lo que el admin les puso:
 * foto, lugar y tamaño. Sin fila (o sin lugar), cada artista nuevo ocupa el
 * siguiente de site.artistas.lugares.
 *
 * Los lanzamientos sin artista no se agrupan: quedan sueltos en el plano.
 */
import { site, type Artist, type Release } from "@/config/site";
import type { UrlPublica } from "./mapear";
import type { FilaArtista } from "./tipos";

/** "  Bsulshell " y "bsulshell" son el mismo artista. */
export const claveDeArtista = (nombre: string) => nombre.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "artista";

/** Un lugar para el artista número `i` que no tiene uno guardado. */
function lugarPorDefecto(i: number) {
  const fijos = site.artistas.lugares;
  if (i < fijos.length) return fijos[i];
  // después, en espiral alrededor de la esfera (ángulo dorado: no se amontonan)
  const k = i - fijos.length;
  const r = 1700 + k * 260;
  const a = k * 2.39996;
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
}

export function armarArtistas(
  releases: readonly Release[],
  filas: readonly FilaArtista[],
  url: UrlPublica | null,
): { artists: Artist[]; releases: Release[] } {
  const porClave = new Map(filas.map((f) => [claveDeArtista(f.nombre), f]));
  const artists: Artist[] = [];
  const idDe = new Map<string, string>();
  const usados = new Set<string>();
  /** Los que no tienen lugar guardado: se acomodan al final, donde no estorben. */
  const sinLugar: Artist[] = [];

  for (const r of releases) {
    const nombre = r.artist?.trim();
    if (!nombre) continue;
    const clave = claveDeArtista(nombre);
    if (idDe.has(clave)) continue;
    const fila = porClave.get(clave);
    let id = fila?.id ?? `n-${slug(nombre)}`;
    while (usados.has(id)) id += "-";
    usados.add(id);
    idDe.set(clave, id);
    const a: Artist = {
      id,
      // el nombre como lo escribe la fila del admin; si no hay, como en el primer lanzamiento
      name: fila?.nombre ?? nombre,
      image: fila?.foto && url ? url("portadas", fila.foto) : undefined,
      x: fila?.x ?? 0,
      y: fila?.y ?? 0,
      size: fila?.tamano ?? site.artistas.tamano,
    };
    artists.push(a);
    if (fila?.x == null || fila?.y == null) sinLugar.push(a);
  }

  // cada uno sin lugar toma el siguiente de site.artistas.lugares que no quede encima de otro
  const puestos = artists.filter((a) => !sinLugar.includes(a));
  let k = 0;
  for (const a of sinLugar) {
    let lugar = lugarPorDefecto(k++);
    for (let intento = 0; intento < 64 && puestos.some((o) => Math.hypot(o.x - lugar.x, o.y - lugar.y) < (o.size + a.size) / 2 + 260); intento++) {
      lugar = lugarPorDefecto(k++);
    }
    a.x = lugar.x;
    a.y = lugar.y;
    puestos.push(a);
  }

  return {
    artists,
    releases: releases.map((r) => {
      const id = r.artist?.trim() ? idDe.get(claveDeArtista(r.artist)) : undefined;
      return { ...r, artistId: id };
    }),
  };
}
