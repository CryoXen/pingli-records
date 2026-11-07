/**
 * Las imágenes de public/previsiones, para cuando el sitio no usa Supabase.
 * Solo en el servidor: Next.js la corre al construir el sitio (o en cada
 * recarga en desarrollo), así que basta con poner o quitar imágenes de la
 * carpeta y volver a construir.
 *
 * También videos (.mp4, .webm): duran lo que duran (hasta 30 s) y suenan.
 *
 * Una subcarpeta es un tipo: public/previsiones/glitch/a.jpg tiene tipo
 * "glitch" (para no mostrar dos del mismo tipo seguidas). Todas son comunes;
 * la rareza se pone en el panel de admin.
 */
import fs from "node:fs";
import path from "node:path";
import type { Prevision } from "@/lib/contenido/tipos";

const IMAGE = /\.(jpe?g|png|gif|webp|avif)$/i;
const VIDEO = /\.(mp4|m4v|webm)$/i;

export function listPrevisiones(folder = "previsiones"): Prevision[] {
  const dir = path.join(process.cwd(), "public", folder);
  const out: Prevision[] = [];
  const read = (sub: string) => {
    let names: fs.Dirent[] = [];
    try {
      names = fs.readdirSync(path.join(dir, sub), { withFileTypes: true });
    } catch {
      return; // sin carpeta: no hay previsiones
    }
    for (const d of names.sort((a, b) => a.name.localeCompare(b.name))) {
      if (d.name.startsWith(".")) continue;
      if (d.isDirectory() && !sub) read(d.name);
      else if (d.isFile() && (IMAGE.test(d.name) || VIDEO.test(d.name))) {
        const rel = sub ? `${encodeURIComponent(sub)}/${encodeURIComponent(d.name)}` : encodeURIComponent(d.name);
        const medio = VIDEO.test(d.name) ? "video" : "imagen";
        out.push({ src: `/${folder}/${rel}`, tipo: sub, rareza: "comun", nombre: d.name, medio });
      }
    }
  };
  read("");
  return out;
}
