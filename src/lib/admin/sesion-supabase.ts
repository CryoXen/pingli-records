/**
 * La sesión del menú del contador contra Supabase: la misma cuenta (y la
 * misma sesión guardada) que el panel de admin.
 *
 * El nombre que muestra el menú sale de la columna "nombre" de la tabla
 * admins (chris, henry); si no lo tiene, la parte del correo antes de la @.
 */
import type { ProveedorSesion, Sesion } from "@/lib/sesion";
import { sb, supabaseStore } from "./store-supabase";

async function nombreDe(uid: string, correo: string): Promise<string> {
  try {
    const { data, error } = await sb().from("admins").select("nombre").eq("user_id", uid).maybeSingle();
    const nombre = (data as { nombre?: string | null } | null)?.nombre;
    if (!error && nombre) return nombre;
  } catch {
    /* sin la columna todavía, o sin conexión */
  }
  return correo.split("@")[0] || "admin";
}

async function actual(): Promise<Sesion | null> {
  const { data } = await sb().auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const correo = u.email ?? "";
  const [nombre, admin] = await Promise.all([nombreDe(u.id, correo), supabaseStore.esAdmin().catch(() => false)]);
  return { correo, nombre, admin };
}

export const sesionSupabase: ProveedorSesion = {
  actual,
  async entrar(correo, clave) {
    await supabaseStore.entrar(correo, clave);
    const s = await actual();
    if (!s) throw new Error("no se pudo entrar.");
    return s;
  },
  salir: () => supabaseStore.salir(),
};
