/**
 * El admin contra Supabase: login con usuario y contraseña (Supabase Auth),
 * tablas con permisos (solo los admins escriben) y las carpetas de imágenes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AjustesSonidos, FilaArtista, FilaFrase, FilaLanzamiento, FilaPrevision } from "@/lib/contenido/tipos";
import type { AdminStore, Carpeta } from "./store";

let cliente: SupabaseClient | null = null;

/** El cliente de Supabase del navegador (también lo usa el menú del contador: misma sesión). */
export function sb(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("falta configurar supabase: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  cliente = createClient(url, key, { auth: { persistSession: true, storageKey: "pingli:admin" } });
  return cliente;
}

/** Los errores de Supabase, en palabras del panel. */
function mensaje(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? "algo falló";
  if (/invalid login credentials/i.test(m)) return "usuario o contraseña incorrectos.";
  if (/email not confirmed/i.test(m)) return "falta confirmar el correo de esta cuenta.";
  if (/row-level security|permission denied|not allowed/i.test(m)) return "esta cuenta no tiene permiso para guardar.";
  if (/duplicate key|already exists/i.test(m)) return "ya existe uno con ese nombre.";
  if (/failed to fetch|network/i.test(m)) return "sin conexión con supabase.";
  return m.toLowerCase();
}

export async function hecho<T>(p: PromiseLike<{ data: T; error: { message?: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(mensaje(error));
  return data;
}

export const supabaseStore: AdminStore = {
  sitio: "/",

  async sesion() {
    const { data } = await sb().auth.getSession();
    return data.session ? { email: data.session.user.email ?? "" } : null;
  },
  async entrar(email, clave) {
    const { error } = await sb().auth.signInWithPassword({ email, password: clave });
    if (error) throw new Error(mensaje(error));
  },
  async salir() {
    await sb().auth.signOut();
  },
  async esAdmin() {
    return (await hecho(sb().rpc("es_admin"))) === true;
  },

  async frases() {
    return hecho(sb().from("frases").select("*").order("orden").range(0, 4999)) as Promise<FilaFrase[]>;
  },
  async guardarFrase(f) {
    await hecho(sb().from("frases").upsert(f));
  },
  async borrarFrase(id) {
    await hecho(sb().from("frases").delete().eq("id", id));
  },

  async lanzamientos() {
    return hecho(sb().from("lanzamientos").select("*").order("orden")) as Promise<FilaLanzamiento[]>;
  },
  async guardarLanzamiento(l, antes) {
    await hecho(sb().from("lanzamientos").upsert(l));
    if (antes && antes !== l.catalogo) await hecho(sb().from("lanzamientos").delete().eq("catalogo", antes));
  },
  async borrarLanzamiento(catalogo) {
    await hecho(sb().from("lanzamientos").delete().eq("catalogo", catalogo));
  },

  async artistas() {
    return hecho(sb().from("artistas").select("id, nombre, foto, x, y, tamano").order("nombre")) as Promise<FilaArtista[]>;
  },
  async guardarArtista(f, antes) {
    const cols = "id, nombre, foto, x, y, tamano";
    const fila = (await hecho(
      f.id
        ? sb().from("artistas").update({ nombre: f.nombre, foto: f.foto }).eq("id", f.id).select(cols).single()
        : sb().from("artistas").upsert({ nombre: f.nombre, foto: f.foto }, { onConflict: "nombre" }).select(cols).single(),
    )) as FilaArtista;
    // sus lanzamientos pasan al nombre nuevo
    const otros = (antes ?? []).filter((n) => n !== f.nombre);
    if (otros.length) await hecho(sb().from("lanzamientos").update({ artista: f.nombre }).in("artista", otros));
    return fila;
  },

  async previsiones() {
    return hecho(sb().from("previsiones").select("*").order("creado", { ascending: false })) as Promise<FilaPrevision[]>;
  },
  async guardarPrevision(p) {
    await hecho(sb().from("previsiones").upsert(p));
  },
  async borrarPrevision(id) {
    await hecho(sb().from("previsiones").delete().eq("id", id));
  },

  async sonidos() {
    const fila = await hecho(sb().from("ajustes").select("valor").eq("clave", "sonidos").maybeSingle());
    return ((fila as { valor?: Partial<AjustesSonidos> } | null)?.valor ?? null) as Partial<AjustesSonidos> | null;
  },
  async guardarSonidos(a) {
    await hecho(sb().from("ajustes").upsert({ clave: "sonidos", valor: a }));
  },
  async ajuste<T>(clave: string) {
    const fila = await hecho(sb().from("ajustes").select("valor").eq("clave", clave).maybeSingle());
    return ((fila as { valor?: Partial<T> } | null)?.valor ?? null) as Partial<T> | null;
  },
  async guardarAjuste(clave, valor) {
    await hecho(sb().from("ajustes").upsert({ clave, valor }));
  },

  async subir(carpeta: Carpeta, archivo, ruta) {
    await hecho(sb().storage.from(carpeta).upload(ruta, archivo, { contentType: archivo.type || undefined, cacheControl: "31536000", upsert: false }));
    return ruta;
  },
  async borrarArchivo(carpeta, ruta) {
    await hecho(sb().storage.from(carpeta).remove([ruta]));
  },
  async url(carpeta, ruta) {
    return sb().storage.from(carpeta).getPublicUrl(ruta).data.publicUrl;
  },

  async publicar() {
    const { data } = await sb().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/revalidar", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  },
};
