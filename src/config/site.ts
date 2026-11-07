/**
 * pingli records — configuración central del sitio.
 *
 * Todo lo que es contenido o comportamiento ajustable vive aquí:
 * textos, lanzamientos en el lienzo, la figura ASCII, los caminos secretos,
 * las frases, el ciclo de 3:33, el audio y el admin. El motor (src/engine)
 * solo lee estos valores.
 *
 * Con Supabase configurado, los lanzamientos, las frases, las previsiones y
 * los sonidos se editan en /admin; lo de aquí queda como respaldo (si faltan
 * las variables o la base no responde).
 *
 * Colores y tipografías: src/app/globals.css (variables CSS).
 */
import type { StoreId } from "@/lib/release-panel";

export type Release = {
  /** Número de catálogo. Aparece como "texto alternativo" dentro del marco vacío. */
  catalog: string;
  title: string;
  artist?: string;
  /** Año de publicación. */
  year?: number;
  /** Descripción general: propuesta, sonido, proceso. Una línea en blanco separa párrafos. */
  description?: string;
  /** Etiquetas; el panel les antepone "#". */
  tags?: string[];
  /**
   * Dónde conseguirlo. bandcamp / youtube: enlace completo. soulseek: un
   * enlace slsk:// o, si es solo un usuario o una carpeta, el panel lo copia
   * al portapapeles al hacer clic. Sin valor = aparece apagado.
   */
  links?: Partial<Record<StoreId, string>>;
  /** Foto del lanzamiento (URL). Sin foto, el cuadro queda vacío con su nombre de archivo. */
  image?: string;
  /** Posición en el mundo (unidades del lienzo; el objeto ASCII está en 0,0). */
  x: number;
  y: number;
  /** Lado del marco en unidades del mundo. Valores muy pequeños = solo se ve con zoom. */
  size: number;
  /** Ruta a la portada cuando exista (sin usar: la foto va en `image`). */
  cover?: string;
};

export type AsciiShape = "sphere" | "torus";

/** Texto de relleno para probar el panel. PROVISIONAL. */
const PLACEHOLDER =
  "Texto provisional. Aquí va la descripción general del proyecto: de dónde sale, qué propone y cómo suena.";

export const site = {
  name: "pingli records",

  /** Textos de la interfaz. */
  copy: {
    /** (sin usar desde el paso 4) */
    descriptor: "sello discográfico",
    /** (sin usar desde el paso 4) */
    hint: "arrastra para moverte. acércate todo lo que quieras: no hay fondo.",
    /** Textos del muro. */
    wall: {
      title: "muro",
      claro: "claro",
      oscuro: "oscuro",
    },
    /** Textos de la zona (el cuarto dentro de la imagen de los carteles). */
    zone: {
      /** Encabezado, junto a la cuenta de carteles leídos. */
      title: "carteles",
      claro: "claro",
      oscuro: "oscuro",
      /** Para lectores de pantalla. */
      label: "carteles leídos",
    },
    /** Textos del panel de lanzamiento. */
    panel: {
      close: "cerrar",
      /** Al pasar el cursor por una etiqueta. */
      tagHint: "resaltar en el plano",
      /** Encabezado de los sitios donde conseguirlo. */
      stores: "conseguir en",
      /** Aviso al copiar un usuario de Soulseek. */
      copied: "copiado",
      /** Al pasar el cursor por un sitio sin enlace. */
      noLink: "sin enlace todavía",
    },
  },

  /** (sin usar desde el paso 4) */
  genres: ["ambient", "noise", "drone", "industrial", "electrónica", "idm"],

  /**
   * Lanzamientos en el lienzo. PROVISIONALES: marcos vacíos con datos de relleno
   * para probar el panel. pgl000 es diminuto a propósito: solo aparece si haces zoom.
   */
  releases: [
    {
      catalog: "pgl001", title: "sin título", artist: "artista", year: 2026, x: 820, y: -360, size: 220,
      description: `${PLACEHOLDER}\n\nUn segundo párrafo para probar textos largos: el proceso, los instrumentos o las grabaciones, quién participó y dónde.`,
      tags: ["ambient", "drone"],
      // PROVISIONAL: enlaces de muestra para ver el estado activo
      links: { bandcamp: "https://bandcamp.com", youtube: "https://www.youtube.com", soulseek: "pingli" },
    },
    { catalog: "pgl002", title: "sin título", artist: "artista", year: 2026, x: -1150, y: 260, size: 300, description: PLACEHOLDER, tags: ["noise", "industrial"] },
    { catalog: "pgl003", title: "sin título", artist: "artista", year: 2026, x: 380, y: 940, size: 160, description: PLACEHOLDER, tags: ["electrónica", "idm"] },
    { catalog: "pgl004", title: "sin título", artist: "artista", year: 2026, x: -620, y: -1180, size: 260, description: PLACEHOLDER, tags: ["drone"] },
    { catalog: "pgl005", title: "sin título", artist: "artista", year: 2026, x: 2300, y: 820, size: 340, description: PLACEHOLDER, tags: ["ambient", "electrónica"] },
    { catalog: "pgl006", title: "sin título", artist: "artista", year: 2026, x: -2600, y: -700, size: 200, description: PLACEHOLDER, tags: ["noise"] },
    { catalog: "pgl000", title: "sin título", artist: "artista", year: 2026, x: 1240, y: 1260, size: 1.6, description: PLACEHOLDER, tags: ["drone", "noise"] },
  ] as Release[],

  /**
   * Dónde conseguir los lanzamientos, en este orden. Íconos PENDIENTES de
   * diseño: mientras `icon` sea null se dibuja un marco vacío de 1 px.
   */
  stores: [
    { id: "bandcamp", label: "bandcamp", icon: null },
    { id: "youtube", label: "youtube", icon: null },
    { id: "soulseek", label: "soulseek", icon: null },
  ] as { id: StoreId; label: string; icon: string | null }[],

  /**
   * Frases que brotan del plano (el banco está en src/config/frases.ts:
   * uno para el lado claro y otro para el oscuro). Aparecen al azar en
   * ciertos segmentos; al enfocarte en una empieza una cuenta de 10 s y
   * después se desvanece.
   */
  phrases: {
    /** false = el plano no dice nada. */
    enabled: true,
    /**
     * Qué brota del plano:
     *  - "carteles": los 120 carteles (dibujo + frase) de src/config/carteles.ts,
     *    que se coleccionan en el muro al leerlos.
     *  - "frases": las frases anteriores de src/config/frases.ts (guardadas, solo texto).
     */
    source: "carteles" as "carteles" | "frases",
    /**
     * Imagen para todos los carteles (en el plano y en el muro), en public/.
     * null = usar los dibujos de src/config/iconos.ts (guardados).
     */
    signImage: "/carteles/imagen-rota.png" as string | null,
    /** Segundos entre apariciones: al azar dentro de este rango. */
    every: [25, 50] as [number, number],
    /** Segundos después de entrar antes de la primera frase. */
    startAfter: 20,
    /** Cuántas frases a la vez, como máximo. */
    maxVisible: 2,
    /** Qué parte del plano habla (0–1). El resto de los segmentos guarda silencio. */
    fertility: 0.6,
    /** Tamaño de un segmento del plano, en px de pantalla, al nivel de zoom en que estés. */
    segment: 900,
    /** Segundos que hay que mirar una frase (cerca del centro o con el cursor) para que empiece la cuenta. */
    attention: 0.8,
    /** La cuenta: segundos hasta que se desvanece. */
    timer: 10,
    /** Mostrar la cuenta (10, 09, 08…) junto a la frase. */
    showTimer: true,
    /** Si nadie la mira, se va sola después de estos segundos. */
    idle: 40,
    /** Tamaño del texto al aparecer, en px (igual que .phrase en phrases.css). */
    size: 15,
    /** Devenir: probabilidad (0–1) de que, al terminar la cuenta, la frase se rehaga en otra en vez de apagarse. 0 = siempre se apaga. */
    becoming: 0,
    /** Cuántas veces seguidas puede devenir una misma frase. */
    maxBecomings: 2,
    /**
     * Dónde no brota nada (ni carteles ni frases), en unidades del plano
     * (a zoom 1 son px). Vale a cualquier zoom: de lejos y de muy cerca.
     */
    keepOut: {
      /** Radio de la zona principal alrededor del núcleo (0, 0). La figura mide 230 de radio. */
      core: 700,
      /** Margen alrededor de cada lanzamiento, como fracción de su tamaño (0.75 = tres cuartos de cuadro por lado). */
      releases: 0.75,
    },
  },

  /**
   * El muro: donde se cuelgan los carteles leídos. Es un camino secreto: está
   * en el plano, lejos, y solo dos carteles dan la pista de dónde.
   */
  wall: {
    /** APAGADO por ahora. true = el muro vuelve, con los carteles que ya se hayan leído. */
    enabled: false,
    /** Centro del muro en coordenadas del HUD (x, y). */
    x: -3333,
    y: 3333,
  },

  /**
   * La zona: un cuarto dentro de la imagen de los carteles. Haz zoom sobre la
   * imagen de un cartel hasta que llene la pantalla y entras; adentro están
   * los carteles que ya leíste. Para salir, aléjate (zoom out).
   */
  zone: {
    /** false = hacer zoom a la imagen no abre nada. */
    enabled: true,
    /** Qué tanto de la pantalla (0–1, el lado corto) tiene que llenar la imagen para entrar. */
    dive: 0.75,
    /** Desde el encuadre completo de la zona, hasta dónde hay que alejarse para salir (0.8 = al 80 %). */
    exit: 0.8,
  },

  /**
   * El ciclo de 3:33. Cada visita dura esto, contado desde "entrar", en los dos
   * mundos (cruzar de lado no la reinicia). Al cumplirse aparece una imagen al
   * azar de public/previsiones durante `hold` segundos; luego todo se detiene y
   * el sitio vuelve a "entrar".
   */
  cycle: {
    /** false = la visita no tiene fin. */
    enabled: true,
    /**
     * Segundos que dura cada visita, igual en los dos mundos (213 = 3:33).
     * Con Supabase se cambia en el admin (previsiones → cuenta regresiva).
     */
    duration: 213,
    /**
     * Segundos que se ve una foto de la previsión (los videos duran lo que
     * duran, hasta 30 s). Con Supabase se cambia en el admin (previsiones).
     */
    hold: 10,
    /**
     * Canción final: suena mientras se ve una foto de la previsión y la
     * música de fondo se corta (con un video suena el video). Es el final de
     * "Tan" (los últimos 10 s, de 3:01 a 3:11). null = sigue la de fondo.
     * Con Supabase se cambia, se apaga y se le mueve el volumen en el admin
     * (pestaña "música").
     */
    song: { src: "/audio/tan-final.mp3", gainDb: 0 } as { src: string; gainDb: number } | null,
    /** "contain": la imagen se ve completa; "cover": llena la pantalla y recorta. */
    fit: "contain" as "contain" | "cover",
    /**
     * Qué tan seguido sale cada rareza (se le pone a cada imagen en el admin).
     * Son pesos: si una rareza no tiene imágenes, se reparte entre las demás.
     */
    rareza: { comun: 60, rara: 25, muy_rara: 12, unica: 3 },
  },

  /**
   * Panel de admin: frases, lanzamientos y previsiones. Se entra por la URL
   * o manteniendo presionada la cuenta 3:33 (abajo a la derecha). Siempre
   * pide usuario y contraseña (Supabase).
   */
  admin: {
    /** A dónde lleva la acción secreta. */
    path: "/admin",
    /** Segundos que hay que mantener presionada la cuenta. 0 = sin acción secreta. */
    hold: 3.33,
  },

  /**
   * Música de fondo. Cada lado del sitio tiene su pista, en loop sin corte.
   * Los archivos viven en public/audio/.
   */
  audio: {
    /** false = sin música, sin pantalla de entrada y sin deslizador. */
    enabled: true,
    /**
     * Las canciones originales. Con Supabase, en el admin (pestaña "música")
     * se suben otras y se elige cuál suena en cada mundo (o silencio).
     */
    tracks: {
      /** Lado claro: suena al entrar. */
      light: { src: "/audio/piaga.mp3", title: "003 Piaga", gainDb: 0 },
      /** Lado oscuro (secreto). gainDb iguala su volumen con Piaga (es 1.1 dB más fuerte). */
      dark: { src: "/audio/upper-sanctuary.mp3", title: "009 Upper Sanctuary", gainDb: -1.1 },
    },
    /** Volumen inicial del deslizador (0–1). Después se recuerda en el navegador del visitante. */
    volume: 0.7,
    /** Segundos del fade de entrada al pulsar "entrar". */
    fadeIn: 8,
    loop: {
      /** Segundos que se enciman el final y el inicio de cada vuelta (lo que tarda en irse la que termina). */
      overlap: 12,
      /** Segundos en que la vuelta nueva llega a su volumen (más corto que overlap = sin hueco en la unión). */
      rise: 6,
      /** Silencio al final de los archivos que se ignora. */
      trimEnd: 0.9,
    },
    /** La mezcla al cruzar de lado. */
    switch: {
      /** Segundos que dura. */
      duration: 7,
      /** La pista que se va se hunde (pasa-bajos) mientras la que llega se abre. */
      filter: true,
    },
    copy: {
      /** El único texto de la pantalla de entrada. */
      enter: "entrar",
      /** Etiqueta del deslizador. */
      volume: "vol",
    },
    /**
     * Efectos de sonido, uno por mundo. Los archivos están recortados (sin
     * silencio al inicio, para que suenen al instante) y nivelados entre sí
     * a ~ -16 LUFS. gainDb los sube o baja. null = sin sonido. Desde el
     * admin se pueden cambiar, apagar y bajar o subir todos juntos.
     */
    sfx: {
      /**
       * Volumen de todos los sonidos de la interfaz, 0–1 (la música no
       * cambia). 0.5 = unos 12 dB por debajo de como vienen los archivos.
       * El admin lo cambia (pestaña "sonidos").
       */
      volume: 0.5,
      /** Al tocar un proyecto (un cuadro del plano). */
      proyecto: {
        claro: { src: "/audio/sfx/proyecto-claro.mp3", gainDb: 0 },
        oscuro: { src: "/audio/sfx/proyecto-oscuro.mp3", gainDb: 0 },
      },
      /** Cada vez que aparece una frase o un cartel. */
      frase: {
        claro: { src: "/audio/sfx/frase-claro.mp3", gainDb: 0 },
        oscuro: { src: "/audio/sfx/frase-oscuro.mp3", gainDb: 0 },
      },
    },
  },

  /** La figura ASCII del centro. */
  asciiObject: {
    /** "sphere" (esfera con un corte que gira, como el video) o "torus". */
    shape: "sphere" as AsciiShape,
    /** Radio en unidades del mundo. */
    radius: 230,
    /** Caracteres de menor a mayor densidad. El primero debe ser un espacio. */
    ramp: " .,:;^+*",
    /** Vueltas por minuto del giro. */
    rpm: 2.2,
  },

  camera: {
    /** Límites técnicos del zoom; en la práctica se siente infinito. */
    minScale: 1e-7,
    maxScale: 1e10,
    /** Cuánto acerca un doble clic. */
    diveFactor: 4,
  },

  secrets: {
    /**
     * PROVISIONAL — camino al lado oscuro: hacer zoom al núcleo del objeto
     * hasta `depth` te atraviesa al otro lado del sitio. Repetirlo te regresa.
     */
    darkSide: {
      enabled: true,
      /** Escala a la que se cruza (1 = vista inicial). */
      depth: 2400,
      /**
       * Qué tan dentro de la figura hay que hacer zoom (fracción del radio).
       * 0.8 = casi cualquier punto de la figura; 0.2 = solo el centro exacto.
       */
      coreRadius: 0.8,
      /** Se recuerda en el navegador del visitante. */
      remember: true,
    },
  },
} as const;

export type SiteConfig = typeof site;
