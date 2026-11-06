/**
 * El contenido de src/config convertido en filas, igual que en
 * supabase/seed.sql (lo usan el script que genera ese archivo y la vista
 * previa del admin).
 */
import { carteles } from "@/config/carteles";
import { frases } from "@/config/frases";
import { site } from "@/config/site";
import type { FilaFrase, FilaLanzamiento, Mundo } from "./tipos";

const MUNDOS: readonly Mundo[] = ["claro", "oscuro"];
/** Prefijo de los ids de las frases (las de solo texto): fc001…, fo001… */
export const PREFIJO_FRASES: Record<Mundo, string> = { claro: "fc", oscuro: "fo" };

export function frasesDesdeConfig(): FilaFrase[] {
  const out: FilaFrase[] = [];
  let orden = 0;
  for (const mundo of MUNDOS)
    for (const [tema, lista] of Object.entries(carteles[mundo]))
      for (const c of lista)
        out.push({ id: c.id, banco: "carteles", mundo, tema, texto: c.texto, icono: c.icono, activo: true, orden: orden++ });
  for (const mundo of MUNDOS) {
    let n = 0;
    for (const [tema, lista] of Object.entries(frases[mundo]))
      for (const texto of lista)
        out.push({
          id: PREFIJO_FRASES[mundo] + String(++n).padStart(3, "0"),
          banco: "frases",
          mundo,
          tema,
          texto,
          icono: null,
          activo: true,
          orden: orden++,
        });
  }
  return out;
}

export function lanzamientosDesdeConfig(): FilaLanzamiento[] {
  return site.releases.map((r, i) => ({
    catalogo: r.catalog,
    titulo: r.title ?? "",
    artista: r.artist ?? "",
    anio: r.year ?? null,
    descripcion: r.description ?? "",
    etiquetas: [...(r.tags ?? [])],
    enlaces: { ...(r.links ?? {}) },
    portada: null,
    x: r.x,
    y: r.y,
    tamano: r.size,
    publicado: true,
    orden: i,
  }));
}
