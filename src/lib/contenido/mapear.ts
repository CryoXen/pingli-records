/**
 * De las filas de la base al contenido que usa el sitio.
 */
import type { Cartel } from "@/config/carteles";
import { site, type Release } from "@/config/site";
import type { AjustesSonidos, Contenido, FilaFrase, FilaLanzamiento, FilaPrevision, Mundo, SonidoUI, SonidosUI, TipoSonido } from "./tipos";

/** URL pública de un archivo guardado en una carpeta ("portadas", "previsiones" o "sonidos"). */
export type UrlPublica = (carpeta: "portadas" | "previsiones" | "sonidos", ruta: string) => string;

const MUNDOS: readonly Mundo[] = ["claro", "oscuro"];
const TIPOS: readonly TipoSonido[] = ["proyecto", "frase"];

/** Los sonidos como vienen en src/config/site.ts (antes de tocar nada en el admin). */
export function sonidosPorDefecto(): AjustesSonidos {
  const fx = site.audio.sfx;
  const slot = (x: { gainDb: number } | null) => ({ ruta: null, nombre: null, activo: !!x, gainDb: x?.gainDb ?? 0, inicio: 0 });
  return {
    volumen: fx.volume,
    proyecto: { claro: slot(fx.proyecto.claro), oscuro: slot(fx.proyecto.oscuro) },
    frase: { claro: slot(fx.frase.claro), oscuro: slot(fx.frase.oscuro) },
  };
}

/** Completa lo que falte (p. ej. un sonido que se agregue después) con lo de site.ts. */
export function completarSonidos(a: Partial<AjustesSonidos> | null | undefined): AjustesSonidos {
  const base = sonidosPorDefecto();
  if (!a) return base;
  const out: AjustesSonidos = { ...base, volumen: typeof a.volumen === "number" ? a.volumen : base.volumen };
  for (const t of TIPOS) for (const m of MUNDOS) out[t] = { ...out[t], [m]: { ...base[t][m], ...(a[t]?.[m] ?? {}) } };
  return out;
}

/** De lo que guarda el admin a lo que suena en el sitio. */
export function sonidosUI(a: AjustesSonidos, url: UrlPublica): SonidosUI {
  const fx = site.audio.sfx;
  const uno = (t: TipoSonido, m: Mundo): SonidoUI | null => {
    const s = a[t][m];
    const original = fx[t][m];
    if (!s.activo) return null;
    if (s.ruta) return { src: url("sonidos", s.ruta), gainDb: s.gainDb, inicio: s.inicio };
    return original ? { src: original.src, gainDb: s.gainDb, inicio: 0 } : null;
  };
  return {
    volumen: a.volumen,
    proyecto: { claro: uno("proyecto", "claro"), oscuro: uno("proyecto", "oscuro") },
    frase: { claro: uno("frase", "claro"), oscuro: uno("frase", "oscuro") },
  };
}

/** "mw52s1nnuyj9-glitch-1.png" → "glitch-1.png" (las rutas llevan un id al frente para no repetirse). */
export const nombreDeRuta = (ruta: string) => ruta.split("/").pop()!.replace(/^[0-9a-z]{10,14}-(?=.+\.)/, "");

/** Agrupa por tema, respetando el orden. */
function porTema<T>(filas: readonly FilaFrase[], mundo: Mundo, banco: FilaFrase["banco"], f: (r: FilaFrase) => T) {
  const out: Record<string, T[]> = {};
  for (const r of filas) {
    if (r.mundo !== mundo || r.banco !== banco || !r.activo) continue;
    (out[r.tema || "sin tema"] ??= []).push(f(r));
  }
  return out;
}

export function filaARelease(r: FilaLanzamiento, url: UrlPublica): Release {
  return {
    catalog: r.catalogo,
    title: r.titulo,
    artist: r.artista || undefined,
    year: r.anio ?? undefined,
    description: r.descripcion || undefined,
    tags: r.etiquetas,
    links: r.enlaces,
    image: r.portada ? url("portadas", r.portada) : undefined,
    x: r.x,
    y: r.y,
    size: r.tamano,
  };
}

export function filasAContenido(
  frases: readonly FilaFrase[],
  lanzamientos: readonly FilaLanzamiento[],
  previsiones: readonly FilaPrevision[],
  url: UrlPublica,
  sonidos: Partial<AjustesSonidos> | null = null,
): Contenido {
  const orden = <T extends { orden: number }>(a: readonly T[]) => [...a].sort((x, y) => x.orden - y.orden);
  const fs = orden(frases);
  const [claroC, oscuroC] = MUNDOS.map((m) =>
    porTema<Cartel>(fs, m, "carteles", (r) => ({ id: r.id, icono: r.icono ?? "puntos", texto: r.texto })),
  );
  const [claroF, oscuroF] = MUNDOS.map((m) => porTema<string>(fs, m, "frases", (r) => r.texto));
  return {
    releases: orden(lanzamientos)
      .filter((r) => r.publicado)
      .map((r) => filaARelease(r, url)),
    carteles: { claro: claroC, oscuro: oscuroC },
    frases: { claro: claroF, oscuro: oscuroF },
    previsiones: previsiones
      .filter((p) => p.activo)
      .map((p) => ({ src: url("previsiones", p.ruta), tipo: p.tipo, rareza: p.rareza, nombre: p.nombre ?? nombreDeRuta(p.ruta) })),
    sonidos: sonidosUI(completarSonidos(sonidos), url),
  };
}
