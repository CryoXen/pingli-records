/**
 * El contenido editable del sitio: lo que se guarda en Supabase (filas) y
 * cómo lo usa el sitio (Contenido). Lo comparten el sitio, el panel de admin
 * y la vista previa.
 */
import type { BancoDeCarteles } from "@/config/carteles";
import type { Release } from "@/config/site";
import type { StoreId } from "@/lib/release-panel";

export type Mundo = "claro" | "oscuro";
export type Banco = "carteles" | "frases";
export type Rareza = "comun" | "rara" | "muy_rara" | "unica";

/** Las rarezas en orden, con su nombre para el admin. Los pesos están en site.cycle.rareza. */
export const RAREZAS: readonly { readonly id: Rareza; readonly nombre: string }[] = [
  { id: "comun", nombre: "común" },
  { id: "rara", nombre: "rara" },
  { id: "muy_rara", nombre: "muy rara" },
  { id: "unica", nombre: "única" },
];

// —— filas (tal como están en la base) ——

export type FilaFrase = {
  id: string;
  banco: Banco;
  mundo: Mundo;
  tema: string;
  texto: string;
  icono: string | null;
  activo: boolean;
  orden: number;
};

export type FilaLanzamiento = {
  catalogo: string;
  titulo: string;
  artista: string;
  anio: number | null;
  descripcion: string;
  etiquetas: string[];
  enlaces: Partial<Record<StoreId, string>>;
  /** Ruta dentro de la carpeta "portadas". */
  portada: string | null;
  x: number;
  y: number;
  tamano: number;
  publicado: boolean;
  orden: number;
};

/** Una previsión es una foto o un video (MP4, hasta 30 s, con su sonido). */
export type Medio = "imagen" | "video";

export type FilaPrevision = {
  id: string;
  /** Ruta dentro de la carpeta "previsiones". */
  ruta: string;
  /** Nombre original del archivo: es lo único que se muestra debajo de la imagen. */
  nombre: string | null;
  tipo: string;
  rareza: Rareza;
  activo: boolean;
  creado: string;
  medio: Medio;
  /** Segundos que dura (solo videos). */
  duracion: number | null;
  /** Nivelado automático del sonido del video, en dB (calculado al subirlo). */
  ganancia: number;
};

// —— lo que usa el sitio ——

export type Prevision = {
  readonly src: string;
  readonly tipo: string;
  readonly rareza: Rareza;
  /** El nombre del archivo, que se ve debajo de la imagen. */
  readonly nombre?: string;
  /** "imagen" si no se dice. */
  readonly medio?: Medio;
  /** Segundos (videos). */
  readonly duracion?: number;
  /** dB para el sonido del video. */
  readonly ganancia?: number;
};

export type BancoDeFrases = {
  readonly claro: { readonly [tema: string]: readonly string[] };
  readonly oscuro: { readonly [tema: string]: readonly string[] };
};

// —— sonidos de la interfaz ——

export type TipoSonido = "proyecto" | "frase";

/** Un sonido de la interfaz, como lo guarda el admin (tabla "ajustes", clave "sonidos"). */
export type AjusteSonido = {
  /** Ruta en la carpeta "sonidos"; null = el sonido original del sitio. */
  ruta: string | null;
  /** Nombre del archivo que se subió, para mostrarlo en el admin. */
  nombre: string | null;
  activo: boolean;
  /** Nivelado automático en dB, calculado al subirlo. */
  gainDb: number;
  /** Segundos de silencio al inicio que se saltan, calculados al subirlo. */
  inicio: number;
};

export type AjustesSonidos = {
  /** Volumen de todos los sonidos de la interfaz, 0–1. La música no cambia. */
  volumen: number;
  proyecto: Record<Mundo, AjusteSonido>;
  frase: Record<Mundo, AjusteSonido>;
};

/** Lo que usa el sitio: un sonido listo para sonar (null = apagado). */
export type SonidoUI = { readonly src: string; readonly gainDb: number; readonly inicio: number };
export type SonidosUI = {
  readonly volumen: number;
  readonly proyecto: Readonly<Record<Mundo, SonidoUI | null>>;
  readonly frase: Readonly<Record<Mundo, SonidoUI | null>>;
};

// —— música (tabla "ajustes", clave "musica") ——

/** Una canción de fondo de un mundo. */
export type CancionFondo = {
  /** "original" = la que trae el sitio (no se puede borrar). */
  id: string;
  /** Ruta en la carpeta "sonidos"; null = el archivo original del sitio. */
  ruta: string | null;
  nombre: string;
  /** Volumen en dB (empieza en el nivelado automático y se puede mover). */
  gainDb: number;
  /** El nivelado automático, para poder regresar a él. */
  auto: number;
  /** Silencio al inicio y al final, en segundos (el loop los salta). */
  inicio: number;
  fin: number;
  /** Segundos que dura, para mostrarlo en el admin. */
  duracion: number | null;
};

export type AjustesMusica = {
  /** Por mundo: la lista y cuál suena (null = silencio en ese mundo). */
  fondo: Record<Mundo, { activa: string | null; canciones: CancionFondo[] }>;
  /** La canción final del contador: suena mientras se ve una foto de la previsión. */
  final: {
    ruta: string | null;
    nombre: string | null;
    /** false = no suena: sigue la música de fondo. */
    activo: boolean;
    gainDb: number;
    auto: number;
    inicio: number;
    duracion: number | null;
  };
};

/** Lo que usa el sitio. */
export type PistaUI = {
  readonly src: string;
  readonly title: string;
  readonly gainDb: number;
  readonly inicio: number;
  readonly fin: number;
};
export type MusicaUI = {
  readonly fondo: Readonly<Record<Mundo, PistaUI | null>>;
  readonly final: { readonly src: string; readonly gainDb: number; readonly inicio: number } | null;
};

// —— la previsión (tabla "ajustes", clave "prevision") ——

export type AjustesPrevision = {
  /** Segundos que dura la cuenta regresiva de cada visita (213 = 3:33). */
  duracionCiclo: number;
  /** Segundos que se ve cada foto (los videos duran lo que duran). */
  duracionFoto: number;
};

export type Contenido = {
  readonly releases: readonly Release[];
  readonly carteles: BancoDeCarteles;
  readonly frases: BancoDeFrases;
  readonly previsiones: readonly Prevision[];
  readonly sonidos: SonidosUI;
  readonly musica: MusicaUI;
  readonly prevision: AjustesPrevision;
};
