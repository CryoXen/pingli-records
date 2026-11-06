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
import { filasAContenido, sonidosPorDefecto, sonidosUI } from "./mapear";
import type { AjustesSonidos, Contenido, FilaFrase, FilaLanzamiento, FilaPrevision } from "./tipos";

/** Lo de src/config y public/previsiones. */
export function contenidoEstatico(): Contenido {
  return {
    releases: site.releases,
    carteles,
    frases,
    previsiones: listPrevisiones(),
    sonidos: sonidosUI(sonidosPorDefecto(), () => ""),
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
    // los ajustes de sonido: si la tabla todavía no existe, se usan los de site.ts
    const a = await sb.from("ajustes").select("valor").eq("clave", "sonidos").maybeSingle();
    return filasAContenido(
      f.data as FilaFrase[],
      l.data as FilaLanzamiento[],
      p.data as FilaPrevision[],
      (carpeta, ruta) => sb.storage.from(carpeta).getPublicUrl(ruta).data.publicUrl,
      a.error ? null : ((a.data?.valor as Partial<AjustesSonidos> | undefined) ?? null),
    );
  } catch (e) {
    console.error("[pingli] no se pudo leer Supabase; se usa src/config", e);
    return contenidoEstatico();
  }
}
