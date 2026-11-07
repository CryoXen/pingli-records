import Ciclo from "@/components/Ciclo";
import InfiniteCanvas from "@/components/InfiniteCanvas";
import { getContenido } from "@/lib/contenido/servidor";

/**
 * La portada. El contenido (lanzamientos, frases, previsiones, música) viene de
 * Supabase; el panel de admin pide rehacer la página al guardar, y además se
 * revisa sola cada 5 minutos.
 */
export const revalidate = 300;

export default async function Home() {
  const contenido = await getContenido();
  return (
    <>
      <InfiniteCanvas contenido={contenido} />
      <Ciclo images={contenido.previsiones} final={contenido.musica.final} prevision={contenido.prevision} />
    </>
  );
}
