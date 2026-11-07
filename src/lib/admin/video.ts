/**
 * Videos para la previsión.
 *
 * Al subir un video se recorta al fragmento elegido (hasta 30 s) y se
 * convierte en el navegador a un MP4 ligero que se reproduce en cualquier
 * teléfono, incluidos los videos de iPhone (HEVC) en Android:
 *   H.264 + AAC · como máximo 1080p (1920 px el lado largo) · 30 cuadros por
 *   segundo · ~4 Mbps en 1080p (30 s ≈ 15 MB)
 *
 * Usa WebCodecs (el hardware de la computadora o del teléfono) a través de
 * mediabunny; si el navegador no sabe hacer AAC, usa un codificador incluido.
 * Las librerías se cargan solo cuando hace falta (no pesan en el sitio).
 */

/** Lo más largo que puede durar un video en la previsión. */
export const VIDEO_MAX_S = 30;
/** El lado largo y el corto, como máximo (1080p). */
const LADO_LARGO = 1920;
const LADO_CORTO = 1080;
const FPS_MAX = 30;

export type InfoVideo = {
  duracion: number;
  /** Tamaño en pantalla (ya girado si el video viene girado). */
  ancho: number;
  alto: number;
  fps: number | null;
  audio: boolean;
};

export type Convertido = { archivo: File; duracion: number; ancho: number; alto: number };

const mb = () => import("mediabunny");

/** Lo básico de un video, sin abrirlo entero. */
export async function leerVideo(file: File): Promise<InfoVideo> {
  try {
    const { Input, ALL_FORMATS, BlobSource } = await mb();
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      const v = await input.getPrimaryVideoTrack();
      if (!v) throw new Error("sin video");
      const [duracion, a, stats] = await Promise.all([
        input.computeDuration(),
        input.getPrimaryAudioTrack(),
        v.computePacketStats(90).catch(() => null),
      ]);
      return { duracion, ancho: v.displayWidth, alto: v.displayHeight, fps: stats?.averagePacketRate ?? null, audio: !!a };
    } finally {
      input.dispose();
    }
  } catch {
    // formato que mediabunny no lee: lo que diga el navegador
    return leerConElNavegador(file);
  }
}

function leerConElNavegador(file: File): Promise<InfoVideo> {
  return new Promise((ok, mal) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      ok({ duracion: v.duration, ancho: v.videoWidth, alto: v.videoHeight, fps: null, audio: true });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      mal(new Error("no se pudo leer como video."));
    };
    v.src = url;
  });
}

/** El tamaño de salida: el mismo aspecto, sin pasar de 1080p, en números pares. */
export function tamanoSalida(ancho: number, alto: number): { ancho: number; alto: number } {
  const largo = Math.max(ancho, alto);
  const corto = Math.min(ancho, alto);
  const k = Math.min(1, LADO_LARGO / largo, LADO_CORTO / corto);
  const par = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { ancho: par(ancho), alto: par(alto) };
}

/** ¿Este navegador puede convertir videos? (WebCodecs con H.264) */
export async function puedeConvertir(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    const { canEncodeVideo } = await mb();
    return await canEncodeVideo("avc", { width: 1280, height: 720 });
  } catch {
    return false;
  }
}

/**
 * Recorta y convierte. `alAvanzar` recibe de 0 a 1. Se puede cancelar con
 * `senal` (AbortSignal).
 */
export async function convertirVideo(
  file: File,
  tramo: { inicio: number; fin: number },
  alAvanzar: (p: number) => void,
  senal?: AbortSignal,
): Promise<Convertido> {
  const { Input, ALL_FORMATS, BlobSource, Output, Mp4OutputFormat, BufferTarget, Conversion, canEncodeAudio } = await mb();
  // AAC: si el navegador no lo trae (Firefox, algunos Linux), el codificador incluido
  if (!(await canEncodeAudio("aac").catch(() => false))) {
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
  }

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const v = await input.getPrimaryVideoTrack();
    if (!v) throw new Error("el archivo no tiene video.");
    const stats = await v.computePacketStats(90).catch(() => null);
    const { ancho, alto } = tamanoSalida(v.displayWidth, v.displayHeight);
    const fps = stats?.averagePacketRate && stats.averagePacketRate > FPS_MAX + 1 ? FPS_MAX : undefined;
    // ~4 Mbps en 1080p, menos en tamaños chicos
    const bitrate = Math.round(Math.min(4_000_000, Math.max(900_000, ancho * alto * Math.min(30, stats?.averagePacketRate ?? 30) * 0.065)));

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      trim: { start: tramo.inicio, end: tramo.fin },
      video: {
        codec: "avc",
        width: ancho,
        height: alto,
        fit: "contain",
        frameRate: fps,
        bitrate,
        // el giro se aplica a los cuadros: así se ve derecho en cualquier reproductor
        allowTransformationMetadata: false,
        forceTranscode: true,
      },
      audio: { codec: "aac", bitrate: 128_000, numberOfChannels: 2, sampleRate: 48000, forceTranscode: true },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const motivo = conversion.discardedTracks.find((d) => d.track.type === "video")?.reason;
      throw new Error(
        motivo === "undecodable_source_codec"
          ? "este navegador no puede leer este video (prueba con Chrome o Safari en computadora)."
          : "este navegador no puede convertir videos (prueba con Chrome, Edge o Safari en computadora).",
      );
    }
    conversion.onProgress = (p) => alAvanzar(p);
    const cancelar = () => void conversion.cancel();
    senal?.addEventListener("abort", cancelar);
    try {
      await conversion.execute();
    } finally {
      senal?.removeEventListener("abort", cancelar);
    }
    if (!target.buffer) throw new Error("no se pudo convertir el video.");
    const nombre = file.name.replace(/\.[^.]+$/, "") + ".mp4";
    return {
      archivo: new File([target.buffer], nombre, { type: "video/mp4" }),
      duracion: tramo.fin - tramo.inicio,
      ancho,
      alto,
    };
  } finally {
    input.dispose();
  }
}

/** 75.3 → "1:15.3" */
export function tiempo(s: number, decimas = true): string {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const r = t - m * 60;
  const seg = decimas ? r.toFixed(1).padStart(4, "0") : String(Math.floor(r)).padStart(2, "0");
  return `${m}:${seg}`;
}
