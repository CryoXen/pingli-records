/** Coordenada con más decimales cuanto más profundo es el zoom. */
export function formatCoord(v: number, scale: number) {
  const decimals = Math.max(0, Math.min(6, Math.ceil(Math.log10(scale))));
  const out = v.toFixed(decimals);
  return /^-0(\.0+)?$/.test(out) ? out.slice(1) : out;
}

/** Escala legible: 1.00, 24.50, 2.4e3, 4.0e-3 */
export function formatScale(s: number) {
  if (s >= 1000 || s < 0.01) return s.toExponential(1).replace("e+", "e");
  return s.toFixed(2);
}
