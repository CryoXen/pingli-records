// Transforma el contenido a un blob opaco para que no viaje legible en el HTML.
// Es simétrico y el mismo módulo corre en el servidor y en el cliente.

const PARTES = ["pg", "li", "7f", "::", "r3", "c0", "rd", "s", "9a"];
const LLAVE = PARTES.join("") + String(PARTES.length * 977);

function hashSemilla(s: string): () => number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function flujo(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) & 0xff;
  };
}

function keystream(): () => number {
  const semilla = hashSemilla(LLAVE);
  return flujo(semilla(), semilla(), semilla(), semilla());
}

function bytesABase64(bytes: Uint8Array): string {
  let bin = "";
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + paso)));
  }
  return btoa(bin);
}

function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function cifrar(texto: string): string {
  const datos = new TextEncoder().encode(texto);
  const k = keystream();
  const salida = new Uint8Array(datos.length);
  for (let i = 0; i < datos.length; i++) salida[i] = datos[i] ^ k();
  return bytesABase64(salida);
}

export function descifrar(blob: string): string {
  const datos = base64ABytes(blob);
  const k = keystream();
  const salida = new Uint8Array(datos.length);
  for (let i = 0; i < datos.length; i++) salida[i] = datos[i] ^ k();
  return new TextDecoder().decode(salida);
}
