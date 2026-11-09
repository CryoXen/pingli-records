/**
 * El contenido del sitio, leído en el servidor.
 *
 * Con Supabase configurado (NEXT_PUBLIC_SUPABASE_URL y
 * NEXT_PUBLIC_SUPABASE_ANON_KEY) viene de la base que edita el panel de
 * admin. Sin esas variables, o si la base no responde, el sitio usa lo de
 * src/config y public/previsiones, como hasta ahora: nunca se queda vacío
 * por un error de conexión.
 */
import { createClient } from "@supabase/supabase-js";
import { carteles } from "@/config/carteles";
import { frases } from "@/config/frases";
import { site } from "@/config/site";
import { listPrevisiones } from "@/lib/previsiones";
import { armarArtistas } from "./artistas";
import { completarPrevision, filasAContenido, musicaPorDefecto, musicaUI, sonidosPorDefecto, sonidosUI } from "./mapear";
import type { AjustesMusica, AjustesPrevision, AjustesSonidos, Contenido, FilaArtista, FilaFrase, FilaLanzamiento, FilaPrevision } from "./tipos";

/** Lo de src/config y public/previsiones. */
export function contenidoEstatico(): Contenido {
  // los artistas salen del nombre de artista de cada lanzamiento
  const { artists, releases } = armarArtistas(site.releases, [], null);
  return {
    artists,
    releases,
    carteles,
    frases,
    previsiones: listPrevisiones(),
    sonidos: sonidosUI(sonidosPorDefecto(), () => ""),
    musica: musicaUI(musicaPorDefecto(), () => ""),
    prevision: completarPrevision(null),
  };
}

export async function getContenido(): Promise<Contenido> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return contenidoEstatico();
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const [f, l, p] = await Promise.all([
      sb.from("frases").select("*").eq("activo", true).order("orden"),
      sb.from("lanzamientos").select("*").eq("publicado", true).order("orden"),
      sb.from("previsiones").select("*").eq("activo", true),
    ]);
    const error = f.error ?? l.error ?? p.error;
    if (error) throw error;
    // los ajustes (sonidos, música, previsión): lo que falte se toma de site.ts
    const a = await sb.from("ajustes").select("clave, valor").in("clave", ["sonidos", "musica", "prevision"]);
    // foto, lugar y tamaño de los artistas (si la tabla no responde, quedan en su lugar de siempre)
    const ar = await sb.from("artistas").select("id, nombre, foto, x, y, tamano");
    if (ar.error) console.error("[pingli] no se pudo leer la tabla artistas", ar.error);
    const ajuste = <T>(clave: string) =>
      a.error ? null : (((a.data ?? []) as { clave: string; valor: unknown }[]).find((x) => x.clave === clave)?.valor as Partial<T> | undefined) ?? null;
    return filasAContenido(
      f.data as FilaFrase[],
      l.data as FilaLanzamiento[],
      p.data as FilaPrevision[],
      (carpeta, ruta) => sb.storage.from(carpeta).getPublicUrl(ruta).data.publicUrl,
      ar.error ? [] : ((ar.data ?? []) as FilaArtista[]),
      {
        sonidos: ajuste<AjustesSonidos>("sonidos"),
        musica: ajuste<AjustesMusica>("musica"),
        prevision: ajuste<AjustesPrevision>("prevision"),
      },
    );
  } catch (e) {
    console.error("[pingli] no se pudo leer Supabase; se usa src/config", e);
    return contenidoEstatico();
  }
}
