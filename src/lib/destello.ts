/**
 * El destello de palabras de la previsión (solo las de tipo "previsión"): en
 * el lugar del nombre del archivo, debajo de la imagen o el video, una palabra
 * al azar de los libros del proyecto con la extensión real del archivo
 * ("sustancia.mp4", "gravedad.mp4"…), cambiando a toda velocidad. En la misma
 * letra del nombre de archivo.
 *
 * Las palabras (src/config/palabras.json: las más usadas de los cuatro libros
 * en español) se descargan antes, junto con la previsión (prepararDestello).
 */

export type DestelloSettings = {
  readonly enabled: boolean;
  /** Segundos que dura cada palabra. */
  readonly cada: number;
};

/**
 * El destello solo sale con las previsiones de tipo "previsión" (sin importar
 * mayúsculas ni acentos: Previsión, PREVISION, previsiones…).
 */
export function activaDestello(tipo: string | null | undefined): boolean {
  const t = (tipo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return /^prevision(es)?$/.test(t);
}

/** La extensión real del archivo (".mp4", ".jpg"…), de su ruta guardada. */
export function extensionDe(src: string): string {
  const m = decodeURIComponent(src.split(/[?#]/)[0]).match(
    /\.([a-z0-9]{2,5})$/i,
  );
  return m ? `.${m[1].toLowerCase()}` : "";
}

let palabras: string[] | null = null;
let preparando: Promise<void> | null = null;

/** Descarga las palabras (una sola vez). */
export function prepararDestello(): Promise<void> {
  preparando ??= import("@/config/palabras.json")
    .then((m) => {
      palabras = (m.default ?? m) as string[];
    })
    .catch(() => {});
  return preparando;
}

/** Hace destellar `el` con palabras + `ext`; devuelve cómo detenerlo. */
export function mountDestello(
  el: HTMLElement,
  ext: string,
  s: DestelloSettings,
): () => void {
  if (!s.enabled) return () => {};
  let vivo = true;
  let raf = 0;
  let ultima = 0;
  void prepararDestello();

  const paso = (ahora: number) => {
    if (!vivo) return;
    raf = requestAnimationFrame(paso);
    if (!palabras || ahora - ultima < s.cada * 1000) return;
    ultima = ahora;
    el.textContent =
      palabras[Math.floor(Math.random() * palabras.length)] + ext;
  };
  raf = requestAnimationFrame(paso);

  return () => {
    vivo = false;
    cancelAnimationFrame(raf);
  };
}
