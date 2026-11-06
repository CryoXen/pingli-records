/**
 * Al subir un sonido desde el admin, se mide en el navegador:
 *  - dónde empieza (para saltarse el silencio del inicio y que suene al instante)
 *  - qué tan fuerte es, en LUFS (como los medidores de audio: filtro K y
 *    compuertas de la norma ITU-R BS.1770), para nivelarlo con los demás
 *    (~ −16 LUFS) sin volver a codificar el archivo.
 */

/** Nivel al que quedan todos los sonidos de la interfaz (igual que los originales). */
export const LUFS_OBJETIVO = -16;
/** Lo que se considera silencio al inicio. */
const UMBRAL_DB = -55;

export type Analisis = {
  /** Segundos que dura el archivo. */
  duracion: number;
  /** Segundos de silencio al inicio. */
  inicio: number;
  /** Sonoridad medida. */
  lufs: number;
  /** Pico, en dBFS. */
  picoDb: number;
  /** Cuánto hay que subirlo o bajarlo para quedar en LUFS_OBJETIVO (sin pasar de −1 dBFS de pico). */
  gainDb: number;
};

export async function analizarSonido(data: ArrayBuffer): Promise<Analisis> {
  const tmp = new OfflineAudioContext(1, 1, 44100);
  const buf = await new Promise<AudioBuffer>((ok, mal) => tmp.decodeAudioData(data.slice(0), ok, mal));
  const ch = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));

  // dónde empieza y el pico
  const umbral = Math.pow(10, UMBRAL_DB / 20);
  let primero = -1;
  let pico = 0;
  for (let i = 0; i < buf.length; i++) {
    for (const c of ch) {
      const v = Math.abs(c[i]);
      if (v > pico) pico = v;
      if (primero < 0 && v > umbral) primero = i;
    }
  }
  const inicio = primero < 0 ? 0 : Math.max(0, primero / buf.sampleRate - 0.005);

  // filtro K: un estante de +4 dB en los agudos y un pasa-altos en 38 Hz
  const off = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
  const src = off.createBufferSource();
  src.buffer = buf;
  const estante = off.createBiquadFilter();
  estante.type = "highshelf";
  estante.frequency.value = 1681.97;
  estante.gain.value = 4;
  const altos = off.createBiquadFilter();
  altos.type = "highpass";
  altos.frequency.value = 38.13;
  altos.Q.value = 0.5;
  src.connect(estante).connect(altos).connect(off.destination);
  src.start();
  const k = await off.startRendering();
  const kc = Array.from({ length: k.numberOfChannels }, (_, i) => k.getChannelData(i));

  // bloques de 400 ms cada 100 ms (si es más corto, un solo bloque)
  const largo = Math.min(k.length, Math.round(0.4 * k.sampleRate));
  const paso = Math.max(1, Math.round(0.1 * k.sampleRate));
  // sumas acumuladas de los cuadrados: cada bloque sale en una resta
  const acum = kc.map((c) => {
    const a = new Float64Array(c.length + 1);
    for (let i = 0; i < c.length; i++) a[i + 1] = a[i] + c[i] * c[i];
    return a;
  });
  const bloques: number[] = [];
  for (let s = 0; s + largo <= k.length; s += paso) {
    let z = 0;
    for (const a of acum) z += (a[s + largo] - a[s]) / largo;
    bloques.push(z);
  }
  const lufsDe = (z: number) => -0.691 + 10 * Math.log10(z);
  const media = (zs: number[]) => zs.reduce((a, b) => a + b, 0) / zs.length;
  const absolutos = bloques.filter((z) => z > 0 && lufsDe(z) > -70);
  let lufs = -70;
  if (absolutos.length) {
    const relativo = lufsDe(media(absolutos)) - 10;
    const finales = absolutos.filter((z) => lufsDe(z) > relativo);
    lufs = lufsDe(media(finales.length ? finales : absolutos));
  }

  const picoDb = pico > 0 ? 20 * Math.log10(pico) : -Infinity;
  let gainDb = LUFS_OBJETIVO - lufs;
  if (Number.isFinite(picoDb)) gainDb = Math.min(gainDb, -1 - picoDb); // sin saturar
  gainDb = Math.max(-24, Math.min(24, gainDb));
  return { duracion: buf.duration, inicio, lufs, picoDb, gainDb: Math.round(gainDb * 10) / 10 };
}
