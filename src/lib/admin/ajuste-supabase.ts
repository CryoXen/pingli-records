/**
 * Guarda en Supabase lo que se ajustó con "editar" en el sitio: el lugar y el
 * tamaño del artista (tabla artistas, por nombre) y el tamaño y el lugar de
 * cada proyecto alrededor de él (lanzamientos: tamano, desfase_x, desfase_y).
 * Después pide que la portada se vuelva a armar. Solo un admin puede.
 */
import type { CambioAjuste } from "@/lib/artistas-ajuste";
import { hecho, sb, supabaseStore } from "./store-supabase";

export async function guardarAjusteSupabase(c: CambioAjuste): Promise<void> {
  const { data } = await sb().auth.getSession();
  if (!data.session) throw new Error("tu sesión se cerró: vuelve a entrar.");
  const a = c.artista;
  await hecho(sb().from("artistas").upsert({ nombre: a.nombre, x: a.x, y: a.y, tamano: a.size }, { onConflict: "nombre" }));
  await Promise.all(
    c.proyectos.map((p) =>
      hecho(
        sb()
          .from("lanzamientos")
          .update({ tamano: p.size, desfase_x: p.offset?.x ?? null, desfase_y: p.offset?.y ?? null })
          .eq("catalogo", p.catalog),
      ),
    ),
  );
  await supabaseStore.publicar();
}
