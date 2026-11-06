// Genera supabase/seed.sql con el contenido actual de src/config (frases, carteles, lanzamientos).
// Uso: node scripts/seed.mjs
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "node_modules/.cache/seed-config.cjs");
await build({
  entryPoints: [path.join(root, "src/lib/contenido/semilla.ts")],
  bundle: true, platform: "node", format: "cjs", outfile: out, alias: { "@": path.join(root, "src") }, logLevel: "error",
});
const { frasesDesdeConfig, lanzamientosDesdeConfig } = createRequire(import.meta.url)(out);

const q = (v) => (v == null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(", ")}]::text[]`;
const frases = frasesDesdeConfig().map((f) => `(${[q(f.id), q(f.banco), q(f.mundo), q(f.tema), q(f.texto), q(f.icono), f.orden].join(", ")})`);
const rel = lanzamientosDesdeConfig().map((r) =>
  `(${[q(r.catalogo), q(r.titulo), q(r.artista), q(r.anio), q(r.descripcion), arr(r.etiquetas), q(JSON.stringify(r.enlaces)) + "::jsonb", q(r.x), q(r.y), q(r.tamano), r.orden].join(", ")})`);

fs.writeFileSync(path.join(root, "supabase/seed.sql"), `-- pingli records — el contenido de hoy (src/config), para empezar.
-- Córrelo una vez después de schema.sql. Si una fila ya existe, no la toca.

insert into public.frases (id, banco, mundo, tema, texto, icono, orden) values
${frases.join(",\n")}
on conflict (id) do nothing;

insert into public.lanzamientos (catalogo, titulo, artista, anio, descripcion, etiquetas, enlaces, x, y, tamano, orden) values
${rel.join(",\n")}
on conflict (catalogo) do nothing;
`);
console.log(`seed.sql: ${frases.length} frases/carteles, ${rel.length} lanzamientos`);
