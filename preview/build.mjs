/**
 * Genera preview/dist/pingli-preview.html: la portada en un solo archivo.
 * React y GSAP se cargan desde cdnjs; el código propio, el CSS y las
 * fuentes van dentro del HTML.
 *
 *   npm run preview:build
 */
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "preview/dist");
mkdirSync(dist, { recursive: true });

const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js",
];

// react, react-dom y gsap se leen de las globales que dejan los scripts del CDN
const shims = {
  react: "module.exports = window.React;",
  "react-dom/client": "module.exports = window.ReactDOM;",
  gsap: "export const gsap = window.gsap; export default window.gsap;",
  "react/jsx-runtime": `
    const R = window.React;
    export const Fragment = R.Fragment;
    export function jsx(type, props, key) {
      return R.createElement(type, key === undefined ? props : Object.assign({}, props, { key }));
    }
    export const jsxs = jsx;
  `,
};

const globalsPlugin = {
  name: "cdn-globals",
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime|gsap)$/ }, (args) => ({
      path: args.path,
      namespace: "cdn-global",
    }));
    b.onLoad({ filter: /.*/, namespace: "cdn-global" }, (args) => ({
      contents: shims[args.path],
      loader: "js",
    }));
  },
};

await build({
  entryPoints: [join(root, "preview/entry.tsx")],
  outfile: join(dist, "bundle.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  loader: { ".woff2": "dataurl" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [globalsPlugin],
  logLevel: "warning",
});

// el mismo script de arranque que usa el layout de Next
const boot = await build({
  stdin: {
    contents: 'import { bootScript } from "@/lib/side"; globalThis.__boot = bootScript;',
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "neutral",
  tsconfig: join(root, "tsconfig.json"),
});
const sandbox = {};
new Function("globalThis", boot.outputFiles[0].text)(sandbox);

const js = readFileSync(join(dist, "bundle.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(dist, "bundle.css"), "utf8");

const html = `<title>pingli records</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<script>${sandbox.__boot}</script>
<div id="root"></div>
${CDN.map((src) => `<script src="${src}"></script>`).join("\n")}
<script>${js}</script>
`;

writeFileSync(join(dist, "pingli-preview.html"), html);
console.log(`preview/dist/pingli-preview.html  ${(html.length / 1024).toFixed(0)} KB`);
