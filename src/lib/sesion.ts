/**
 * La sesión de admin vista desde el sitio (el menú que abre el contador).
 *
 * En el sitio es Supabase Auth, la misma sesión que usa /admin: entrar desde
 * el menú también deja entrar al panel, y al revés. Supabase se descarga solo
 * cuando se abre el menú (src/lib/admin/sesion-supabase.ts), así la portada
 * no carga nada de más. La vista previa pone una simulada con definirSesion.
 */

export type Sesion = {
  correo: string;
  /** El nombre que muestra el menú ("chris", "henry"). */
  nombre: string;
  /** ¿Está en la tabla de admins? */
  admin: boolean;
};

export interface ProveedorSesion {
  /** Aviso fijo abajo del formulario (la vista previa dice que es simulado). */
  readonly nota?: string;
  actual(): Promise<Sesion | null>;
  /** Lanza un Error con el mensaje para mostrar si no se pudo. */
  entrar(correo: string, clave: string): Promise<Sesion>;
  salir(): Promise<void>;
  /**
   * Ir al panel. Sin esto, se navega a site.admin.path. Si devuelve un
   * texto, el menú lo muestra en lugar de navegar.
   */
  irAlPanel?(): string | void;
}

let proveedor: ProveedorSesion | null = null;

/** Cambia de dónde sale la sesión (la vista previa la simula). */
export function definirSesion(p: ProveedorSesion | null) {
  proveedor = p;
}

export async function obtenerSesion(): Promise<ProveedorSesion> {
  if (proveedor) return proveedor;
  const { sesionSupabase } = await import("@/lib/admin/sesion-supabase");
  proveedor = sesionSupabase;
  return proveedor;
}
