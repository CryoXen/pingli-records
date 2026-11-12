// dibuja "pingli records" con la fuente y el estilo del sitio, grande, para trazarlo
const { chromium } = require("playwright");
const fs = require("fs");
const font = fs.readFileSync("/home/claude/pingli-records/src/app/fonts/archivo-wdth.woff2").toString("base64");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 4200, height: 700 } });
  await p.setContent(`<style>@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,${font}) format("woff2-variations")}
  body{margin:0;background:#fff}h1{margin:100px;display:inline-block;font-family:Archivo;font-size:400px;font-weight:600;font-stretch:125%;letter-spacing:-.015em;line-height:.95;color:#000;-webkit-font-smoothing:antialiased}</style><h1>pingli records</h1>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const caja = await p.$eval("h1", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.screenshot({ path: "texto.png" });
  fs.writeFileSync("texto.json", JSON.stringify(caja));
  console.log(caja);
  await b.close();
})();
