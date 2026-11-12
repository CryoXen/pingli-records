/**
 * De las filas de la base al contenido que usa el sitio.
 */
import type { Cartel } from "@/config/carteles";
import { site, type Release } from "@/config/site";
import { armarArtistas } from "./artistas";
import type {
  AjustesMusica,
  AjustesPrevision,
  AjustesSonidos,
  CancionFondo,
  Contenido,
  FilaArtista,
  FilaFrase,
  FilaLanzamiento,
  FilaPrevision,
  Mundo,
  MusicaUI,
  PistaUI,
  SonidoUI,
  SonidosUI,
  TipoSonido,
} from "./tipos";

/** URL pública de un archivo guardado en una carpeta ("portadas", "previsiones" o "sonidos"). */
export type UrlPublica = (
  carpeta: "portadas" | "previsiones" | "sonidos",
  ruta: string,
) => string;

const MUNDOS: readonly Mundo[] = ["claro", "oscuro"];
const TIPOS: readonly TipoSonido[] = ["proyecto", "frase"];

/** Los sonidos como vienen en src/config/site.ts (antes de tocar nada en el admin). */
export function sonidosPorDefecto(): AjustesSonidos {
  const fx = site.audio.sfx;
  const slot = (x: { gainDb: number } | null) => ({
    ruta: null,
    nombre: null,
    activo: !!x,
    gainDb: x?.gainDb ?? 0,
    inicio: 0,
  });
  return {
    volumen: fx.volume,
    proyecto: {
      claro: slot(fx.proyecto.claro),
      oscuro: slot(fx.proyecto.oscuro),
    },
    frase: { claro: slot(fx.frase.claro), oscuro: slot(fx.frase.oscuro) },
  };
}

/** Completa lo que falte (p. ej. un sonido que se agregue después) con lo de site.ts. */
export function completarSonidos(
  a: Partial<AjustesSonidos> | null | undefined,
): AjustesSonidos {
  const base = sonidosPorDefecto();
  if (!a) return base;
  const out: AjustesSonidos = {
    ...base,
    volumen: typeof a.volumen === "number" ? a.volumen : base.volumen,
  };
  for (const t of TIPOS)
    for (const m of MUNDOS)
      out[t] = { ...out[t], [m]: { ...base[t][m], ...(a[t]?.[m] ?? {}) } };
  return out;
}

/** De lo que guarda el admin a lo que suena en el sitio. */
export function sonidosUI(a: AjustesSonidos, url: UrlPublica): SonidosUI {
  const fx = site.audio.sfx;
  const uno = (t: TipoSonido, m: Mundo): SonidoUI | null => {
    const s = a[t][m];
    const original = fx[t][m];
    if (!s.activo) return null;
    if (s.ruta)
      return {
        src: url("sonidos", s.ruta),
        gainDb: s.gainDb,
        inicio: s.inicio,
      };
    return original ? { src: original.src, gainDb: s.gainDb, inicio: 0 } : null;
  };
  return {
    volumen: a.volumen,
    proyecto: {
      claro: uno("proyecto", "claro"),
      oscuro: uno("proyecto", "oscuro"),
    },
    frase: { claro: uno("frase", "claro"), oscuro: uno("frase", "oscuro") },
  };
}

// —— música ——

/** Mundo del admin → lado del motor de audio. */
const LADO = { claro: "light", oscuro: "dark" } as const;

/** La canción original de un mundo, como viene en site.ts. */
export function cancionOriginal(m: Mundo): CancionFondo {
  const t = site.audio.tracks[LADO[m]];
  return {
    id: "original",
    ruta: null,
    nombre: t.title,
    gainDb: t.gainDb,
    auto: t.gainDb,
    inicio: 0,
    fin: site.audio.loop.trimEnd,
    duracion: null,
  };
}

/** La canción final original (site.cycle.song). */
export function finalOriginal(): AjustesMusica["final"] {
  const s = site.cycle.song;
  return {
    ruta: null,
    nombre: null,
    activo: !!s,
    gainDb: s?.gainDb ?? 0,
    auto: s?.gainDb ?? 0,
    inicio: 0,
    duracion: null,
  };
}

export function musicaPorDefecto(): AjustesMusica {
  return {
    fondo: {
      claro: { activa: "original", canciones: [cancionOriginal("claro")] },
      oscuro: { activa: "original", canciones: [cancionOriginal("oscuro")] },
    },
    final: finalOriginal(),
  };
}

/** Completa lo que falte con lo de site.ts; la original siempre está en la lista. */
export function completarMusica(
  a: Partial<AjustesMusica> | null | undefined,
): AjustesMusica {
  const base = musicaPorDefecto();
  if (!a) return base;
  const fondo = { ...base.fondo };
  for (const m of MUNDOS) {
    const f = a.fondo?.[m];
    if (!f) continue;
    const lista = Array.isArray(f.canciones)
      ? f.canciones.filter((c) => c && typeof c.id === "string")
      : [];
    const original = lista.find((c) => c.id === "original");
    const canciones = [
      { ...cancionOriginal(m), ...(original ?? {}), ruta: null },
      ...lista.filter((c) => c.id !== "original"),
    ];
    const activa =
      f.activa === null
        ? null
        : canciones.some((c) => c.id === f.activa)
          ? (f.activa as string)
          : "original";
    fondo[m] = { activa, canciones };
  }
  return { fondo, final: { ...base.final, ...(a.final ?? {}) } };
}

/** De lo que guarda el admin a lo que suena en el sitio. */
export function musicaUI(a: AjustesMusica, url: UrlPublica): MusicaUI {
  const pista = (m: Mundo): PistaUI | null => {
    const f = a.fondo[m];
    const c = f.canciones.find((x) => x.id === f.activa);
    if (!c) return null;
    const src = c.ruta
      ? url("sonidos", c.ruta)
      : site.audio.tracks[LADO[m]].src;
    return {
      src,
      title: c.nombre,
      gainDb: c.gainDb,
      inicio: c.inicio,
      fin: c.fin,
    };
  };
  const f = a.final;
  const original = site.cycle.song;
  const final = !f.activo
    ? null
    : f.ruta
      ? { src: url("sonidos", f.ruta), gainDb: f.gainDb, inicio: f.inicio }
      : original
        ? { src: original.src, gainDb: f.gainDb, inicio: 0 }
        : null;
  return { fondo: { claro: pista("claro"), oscuro: pista("oscuro") }, final };
}

// —— previsión ——

export const DURACION_FOTO = { min: 3, max: 60 } as const;
/** La cuenta regresiva: de 10 s a 59:59. */
export const DURACION_CICLO = { min: 10, max: 59 * 60 + 59 } as const;

const entre = (v: unknown, r: { min: number; max: number }, otro: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(r.max, Math.max(r.min, n)) : otro;
};

export function completarPrevision(
  a: Partial<AjustesPrevision> | null | undefined,
): AjustesPrevision {
  return {
    duracionCiclo: entre(a?.duracionCiclo, DURACION_CICLO, site.cycle.duration),
    duracionFoto: entre(a?.duracionFoto, DURACION_FOTO, site.cycle.hold),
  };
}

/** "mw52s1nnuyj9-glitch-1.png" → "glitch-1.png" (las rutas llevan un id al frente para no repetirse). */
export const nombreDeRuta = (ruta: string) =>
  ruta
    .split("/")
    .pop()!
    .replace(/^[0-9a-z]{10,14}-(?=.+\.)/, "");

/** Agrupa por tema, respetando el orden. */
function porTema<T>(
  filas: readonly FilaFrase[],
  mundo: Mundo,
  banco: FilaFrase["banco"],
  f: (r: FilaFrase) => T,
) {
  const out: Record<string, T[]> = {};
  for (const r of filas) {
    if (r.mundo !== mundo || r.banco !== banco || !r.activo) continue;
    (out[r.tema || "sin tema"] ??= []).push(f(r));
  }
  return out;
}

export function filaARelease(r: FilaLanzamiento, url: UrlPublica): Release {
  const conDesfase = r.desfase_x != null && r.desfase_y != null;
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
    offset: conDesfase ? { x: r.desfase_x!, y: r.desfase_y! } : null,
  };
}

export function filasAContenido(
  frases: readonly FilaFrase[],
  lanzamientos: readonly FilaLanzamiento[],
  previsiones: readonly FilaPrevision[],
  url: UrlPublica,
  artistas: readonly FilaArtista[],
  ajustes: {
    sonidos?: Partial<AjustesSonidos> | null;
    musica?: Partial<AjustesMusica> | null;
    prevision?: Partial<AjustesPrevision> | null;
  } = {},
): Contenido {
  const orden = <T extends { orden: number }>(a: readonly T[]) =>
    [...a].sort((x, y) => x.orden - y.orden);
  const fs = orden(frases);
  const [claroC, oscuroC] = MUNDOS.map((m) =>
    porTema<Cartel>(fs, m, "carteles", (r) => ({
      id: r.id,
      icono: r.icono ?? "puntos",
      texto: r.texto,
    })),
  );
  const [claroF, oscuroF] = MUNDOS.map((m) =>
    porTema<string>(fs, m, "frases", (r) => r.texto),
  );
  // los artistas salen de los lanzamientos publicados; de la tabla, su foto, lugar y tamaño
  const { artists, releases } = armarArtistas(
    orden(lanzamientos)
      .filter((r) => r.publicado)
      .map((r) => filaARelease(r, url)),
    artistas,
    url,
  );
  return {
    artists,
    releases,
    carteles: { claro: claroC, oscuro: oscuroC },
    frases: { claro: claroF, oscuro: oscuroF },
    previsiones: previsiones
      .filter((p) => p.activo)
      .map((p) => ({
        src: url("previsiones", p.ruta),
        tipo: p.tipo,
        rareza: p.rareza,
        nombre: p.nombre ?? nombreDeRuta(p.ruta),
        medio: p.medio === "video" ? "video" : "imagen",
        ...(p.medio === "video"
          ? { duracion: p.duracion ?? undefined, ganancia: p.ganancia ?? 0 }
          : {}),
      })),
    sonidos: sonidosUI(completarSonidos(ajustes.sonidos), url),
    musica: musicaUI(completarMusica(ajustes.musica), url),
    prevision: completarPrevision(ajustes.prevision),
  };
}
