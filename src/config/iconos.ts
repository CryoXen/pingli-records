/**
 * pingli records — pictogramas de los carteles.
 *
 * Dibujos originales en el lenguaje del sitio: líneas de 1.5 px y puntos
 * cuadrados, sobre una cuadrícula de 24 × 24. Se pintan con el color de
 * tinta del lado en que estés (currentColor).
 *
 * Para agregar uno: un nombre y el contenido de un <svg viewBox="0 0 24 24">.
 * Los rellenos llevan ${F}; todo lo demás es trazo.
 */

const F = 'fill="currentColor" stroke="none"';
const dot = (x: number, y: number) => `<rect x="${x - 1}" y="${y - 1}" width="2" height="2" ${F}/>`;

export const iconos: Record<string, string> = {
  // caminar, puertas, mapas
  puerta: `<path d="M7 21V3h10v18M4 21h16"/>${dot(14, 12)}`,
  "puerta-abierta": `<path d="M7 21V3h10v18M4 21h16M7 3l6 2.5v16.5"/>`,
  escalera: `<path d="M3 21h4v-4h4v-4h4V9h4V5h2"/>`,
  pozo: `<path d="M4 4h16M6 4v16h12V4M9 9h6M10 13h4M11 17h2"/>`,
  flecha: `<path d="M3 12h17M14 6l6 6-6 6"/>`,
  vuelta: `<path d="M20 12a8 8 0 1 1-2.3-5.7M18 2v4.5h-4.5"/>`,
  camino: `<path d="M10 3L4 21M14 3l6 18M12 6v2M12 11v3M12 17v4"/>`,
  cruce: `<path d="M12 3v18M3 12h18M9.5 5.5L12 3l2.5 2.5"/>`,
  mapa: `<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>`,
  brujula: `<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.5 4.5-4.5 2.5 2.5-4.5z"/>`,
  laberinto: `<path d="M3 3h18v18H3V7h14v10H7v-6h6v2"/>`,
  espiral: `<path d="M12 12h2v2h-4v-4h6v6H8V8h10v10H6V6h14"/>`,
  montana: `<path d="M2 20l7-12 4 6 3-4 6 10z"/>`,
  ventana: `<rect x="4" y="3" width="16" height="18"/><path d="M12 3v18M4 12h16"/>`,
  muro: `<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><path d="M13 13h2M19 13h2v2M21 19v2h-2M15 21h-2v-2"/>`,
  esfera: `<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>`,

  // mirar
  ojo: `<path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z"/><circle cx="12" cy="12" r="3"/>`,
  "ojo-cerrado": `<path d="M2 11c3 4 7 6 10 6s7-2 10-6M5 14l-2 3M9 16l-1 3M15 16l1 3M19 14l2 3"/>`,
  lupa: `<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21"/>`,
  espejo: `<ellipse cx="12" cy="10" rx="6" ry="8"/><path d="M12 18v4M8 22h8M10 6l-2 3M14 7l-3 5"/>`,
  puntos: [5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => dot(x, y))).join(""),
  hueco: `<path d="M4 4h4M12 4h4M20 4v4M20 12v4M20 20h-4M12 20H8M4 20v-4M4 12V8"/>`,
  cubo: `<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>`,
  sol: `<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>`,
  luna: `<path d="M15 3a9 9 0 1 0 6 13A7 7 0 0 1 15 3z"/>`,
  pajaro: `<path d="M3 12c3-4 6-4 9 0 3-4 6-4 9 0"/>`,

  // lo vivo
  semilla: `<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>`,
  brote: `<path d="M12 21V10M12 13c-4 0-6-2-6-6 4 0 6 2 6 6zM12 11c0-4 2-6 6-6 0 4-2 6-6 6zM6 21h12"/>`,
  arbol: `<circle cx="12" cy="9" r="6"/><path d="M12 15v6M8 21h8"/>`,
  hoja: `<path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16zM4 20L14 10"/>`,
  piedra: `<path d="M4 17c0-5 3-9 8-9s8 3 8 8l-2 3H6z"/>`,
  pez: `<path d="M3 12c4-6 10-6 14 0-4 6-10 6-14 0zM17 12l4-4v8z"/>`,
  persona: `<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M7 11h10M12 15l-4 6M12 15l4 6"/>`,
  baile: `<circle cx="12" cy="4.5" r="2"/><path d="M12 7l-1 6 3 3v5M11 13l-4 3M12 9l5-2M11.5 9L6 7"/>`,
  cabeza: `<path d="M9 21v-3H7v-3l-2-1 2-3c0-5 3-8 7-8s6 3 6 7-2 6-4 7v4"/>`,
  pulso: `<path d="M2 12h5l2-5 4 10 2-5h7"/>`,
  nudo: `<path d="M3 12h6c2 0 3-1 3-3s-1-3-3-3-3 1-3 3 1 3 3 3h12"/>`,
  llave: `<circle cx="7" cy="12" r="4"/><path d="M11 12h10M17 12v4M20 12v3"/>`,
  vela: `<rect x="9" y="11" width="6" height="10"/><path d="M12 11V9M12 3c2 2 2 4 0 5-2-1-2-3 0-5z"/>`,

  // el jardín
  rastrillo: `<path d="M3 7c3-2 6 2 9 0s6 2 9 0M3 12c3-2 6 2 9 0s6 2 9 0M3 17c3-2 6 2 9 0s6 2 9 0"/>`,
  cuenco: `<path d="M3 11h18a9 9 0 0 1-18 0zM8 20h8"/>`,
  banca: `<path d="M4 7h16M3 11h18M4 15h16M6 15v5M18 15v5"/>`,
  "reloj-arena": `<path d="M6 3h12M6 21h12M7 3l10 18M17 3L7 21"/>`,
  lluvia: `<path d="M6 13a4 4 0 0 1 0-8 6 6 0 0 1 11.5-1A4.5 4.5 0 0 1 18 13zM8 16l-1 3M12 16l-1 3M16 16l-1 3"/>`,
  nube: `<path d="M6 18a4 4 0 0 1 0-8 6 6 0 0 1 11.5-1A4.5 4.5 0 0 1 18 18z"/>`,
  ola: `<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-2.5 5-2"/>`,
  viento: `<path d="M3 8h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 18h7"/>`,
  escoba: `<path d="M16 3l-5 9M7 12h6l-1 9H6z"/>`,
  globo: `<ellipse cx="12" cy="9" rx="5" ry="6"/><path d="M12 15l-1 2h2l-1-2M12 17v4"/>`,

  // soltar, esperar
  pausa: `<path d="M9 5v14M15 5v14"/>`,
  candado: `<rect x="5" y="10" width="14" height="11"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>`,
  carga: `<rect x="3" y="10" width="18" height="5"/><rect x="5" y="12" width="7" height="1.5" ${F}/>`,
  dado: `<rect x="4" y="4" width="16" height="16"/>${dot(8, 8)}${dot(12, 12)}${dot(16, 16)}`,
  calendario: `<rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/>${dot(8, 14)}${dot(12, 14)}${dot(16, 17)}`,
  infinito: `<path d="M12 12c-2-3-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1 6-4s4-4 6-4a4 4 0 0 1 0 8c-2 0-4-1-6-4z"/>`,
  reloj: `<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>`,

  // el sonido
  altavoz: `<path d="M4 9h4l5-4v14l-5-4H4zM16 9c1.5 1.5 1.5 4.5 0 6M19 6c3 3 3 9 0 12"/>`,
  barras: `<path d="M4 14v4M8 9v9M12 4v14M16 11v7M20 7v11"/>`,
  onda: `${dot(4, 19)}<path d="M3 13a7 7 0 0 1 8 8M3 8a12 12 0 0 1 13 13M3 3a17 17 0 0 1 18 18"/>`,
  nota: `<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>`,
  campana: `<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>`,
  eco: `<path d="M8 6a8 8 0 0 0 0 12M12 8a5 5 0 0 0 0 8M16 10a2 2 0 0 0 0 4"/>`,
  auriculares: `<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6"/><rect x="17" y="14" width="4" height="6"/>`,
  diapason: `<path d="M9 3v8a3 3 0 0 0 6 0V3M12 14v7"/>`,
  radio: `<rect x="3" y="8" width="18" height="12"/><circle cx="15" cy="14" r="3"/><path d="M6 12h4M6 15h4M6 4l12 4"/>`,

  // máquinas y números
  pantalla: `<rect x="3" y="4" width="18" height="12"/><path d="M9 20h6M12 16v4"/>`,
  cursor: `<path d="M5 3v16l4-4 3 6 2-1-3-6h6z"/>`,
  carpeta: `<path d="M3 6h7l2 2h9v11H3z"/>`,
  "archivo-roto": `<path d="M4 3h12l4 4v14H4zM4 14l4-3 3 3 4-4 5 4"/>`,
  glitch: `<rect x="4" y="4" width="10" height="10"/><path d="M10 10h10v10H10M14 4h3M4 18v2"/>`,
  virus: `<circle cx="12" cy="12" r="5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>`,
  cable: `<path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>`,
  codigo: `<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>`,
  cero: `<ellipse cx="12" cy="12" rx="6" ry="9"/><path d="M7 19L17 5"/>`,
  nueve: `<circle cx="12" cy="8" r="5"/><path d="M17 8v6c0 4-3 7-8 7"/>`,
  asterisco: `<path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/>`,
  craneo: `<path d="M6 16v-5a6 6 0 0 1 12 0v5h-3v4H9v-4z"/><rect x="8.5" y="10" width="2.5" height="2.5" ${F}/><rect x="13" y="10" width="2.5" height="2.5" ${F}/>`,
};

/** El <svg> completo de un pictograma (vacío si el nombre no existe). */
export function icono(nombre: string, className = "icon"): string {
  const body = iconos[nombre];
  if (!body) return "";
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">${body}</svg>`;
}
