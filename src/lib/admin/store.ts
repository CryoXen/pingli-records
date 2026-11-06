/**
 * Lo que el panel de admin necesita de dónde se guarda el contenido. En el
 * sitio es Supabase (store-supabase.ts); en la vista previa, el navegador.
 */
import type { AjustesSonidos, FilaFrase, FilaLanzamiento, FilaPrevision } from "@/lib/contenido/tipos";

export type Carpeta = "portadas" | "previsiones" | "sonidos";

export interface AdminStore {
  /** Aviso fijo arriba del panel (la vista previa dice que guarda solo en el navegador). */
  readonly nota?: string;
  /** A dónde lleva "ver sitio". */
  readonly sitio: string;
  /** Ruta de un archivo del sitio (p. ej. "/audio/sfx/frase-claro.mp3") tal como la ve el admin. */
  recurso?(src: string): string;

  sesion(): Promise<{ email: string } | null>;
  /** Lanza un Error con un mensaje para mostrar si no se pudo. */
  entrar(email: string, clave: string): Promise<void>;
  salir(): Promise<void>;
  esAdmin(): Promise<boolean>;

  frases(): Promise<FilaFrase[]>;
  guardarFrase(f: FilaFrase): Promise<void>;
  borrarFrase(id: string): Promise<void>;

  lanzamientos(): Promise<FilaLanzamiento[]>;
  /** `antes`: el catálogo anterior, si se cambió. */
  guardarLanzamiento(l: FilaLanzamiento, antes?: string): Promise<void>;
  borrarLanzamiento(catalogo: string): Promise<void>;

  previsiones(): Promise<FilaPrevision[]>;
  /** Crea o actualiza (por id). */
  guardarPrevision(p: FilaPrevision): Promise<void>;
  borrarPrevision(id: string): Promise<void>;

  /** Los sonidos de la interfaz (null = nunca se han tocado: los de site.ts). */
  sonidos(): Promise<Partial<AjustesSonidos> | null>;
  guardarSonidos(a: AjustesSonidos): Promise<void>;

  /** Sube un archivo y devuelve su ruta dentro de la carpeta. */
  subir(carpeta: Carpeta, archivo: File, ruta: string): Promise<string>;
  borrarArchivo(carpeta: Carpeta, ruta: string): Promise<void>;
  url(carpeta: Carpeta, ruta: string): Promise<string>;

  /** Pide que el sitio se vuelva a armar con lo nuevo. */
  publicar(): Promise<void>;
}

/** Nombre de archivo seguro y único: "pgl007-1730851234-portada.jpg". */
export function rutaUnica(prefijo: string, archivo: File): string {
  const ext = (archivo.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? archivo.type.split("/")[1] ?? "jpg").toLowerCase();
  const base = archivo.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${prefijo ? prefijo + "-" : ""}${id}${base ? "-" + base : ""}.${ext}`;
}
