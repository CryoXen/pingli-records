/**
 * Las fuentes que pueden salir en el destello de palabras de la previsión.
 * Cuáles salen se elige en el admin (previsión → palabras); sin elegir,
 * todas. Para agregar una: su archivo en src/app/fonts/destello/, su
 * @font-face en src/app/destello.css y su renglón aquí.
 */
export type GrupoFuente = "fina" | "mono" | "cursiva" | "extraña";

export type FuenteDestello = {
  /** Con este id se guarda en el admin. */
  id: string;
  nombre: string;
  /** Lo que va en font-family. */
  familia: string;
  grupo: GrupoFuente;
  /** Solo para fuentes del sitio con varios pesos. */
  peso?: number;
  ancho?: string;
};

export const GRUPOS_FUENTE: readonly { id: GrupoFuente; nombre: string }[] = [
  { id: "fina", nombre: "finas" },
  { id: "mono", nombre: "de máquina, finas" },
  { id: "cursiva", nombre: "cursivas" },
  { id: "extraña", nombre: "extrañas" },
];

export const FUENTES_DESTELLO: readonly FuenteDestello[] = [
  { id: "gruppo", nombre: "Gruppo", familia: '"pd Gruppo"', grupo: "fina" },
  {
    id: "poiret-one",
    nombre: "Poiret One",
    familia: '"pd Poiret One"',
    grupo: "fina",
  },
  {
    id: "wire-one",
    nombre: "Wire One",
    familia: '"pd Wire One"',
    grupo: "fina",
  },
  { id: "raleway", nombre: "Raleway", familia: '"pd Raleway"', grupo: "fina" },
  {
    id: "josefin-sans",
    nombre: "Josefin Sans",
    familia: '"pd Josefin Sans"',
    grupo: "fina",
  },
  { id: "exo-2", nombre: "Exo 2", familia: '"pd Exo 2"', grupo: "fina" },
  {
    id: "advent-pro",
    nombre: "Advent Pro",
    familia: '"pd Advent Pro"',
    grupo: "fina",
  },
  {
    id: "montserrat-alternates",
    nombre: "Montserrat Alternates",
    familia: '"pd Montserrat Alternates"',
    grupo: "fina",
  },
  { id: "jura", nombre: "Jura", familia: '"pd Jura"', grupo: "fina" },
  {
    id: "lexend-zetta",
    nombre: "Lexend Zetta",
    familia: '"pd Lexend Zetta"',
    grupo: "fina",
  },
  {
    id: "julius-sans-one",
    nombre: "Julius Sans One",
    familia: '"pd Julius Sans One"',
    grupo: "fina",
  },
  {
    id: "nixie-one",
    nombre: "Nixie One",
    familia: '"pd Nixie One"',
    grupo: "fina",
  },
  {
    id: "ibm-plex-mono",
    nombre: "IBM Plex Mono",
    familia: '"pd IBM Plex Mono"',
    grupo: "mono",
  },
  {
    id: "azeret-mono",
    nombre: "Azeret Mono",
    familia: '"pd Azeret Mono"',
    grupo: "mono",
  },
  {
    id: "major-mono-display",
    nombre: "Major Mono Display",
    familia: '"pd Major Mono Display"',
    grupo: "mono",
  },
  {
    id: "sacramento",
    nombre: "Sacramento",
    familia: '"pd Sacramento"',
    grupo: "cursiva",
  },
  {
    id: "mrs-saint-delafield",
    nombre: "Mrs Saint Delafield",
    familia: '"pd Mrs Saint Delafield"',
    grupo: "cursiva",
  },
  {
    id: "monsieur-la-doulaise",
    nombre: "Monsieur La Doulaise",
    familia: '"pd Monsieur La Doulaise"',
    grupo: "cursiva",
  },
  {
    id: "italianno",
    nombre: "Italianno",
    familia: '"pd Italianno"',
    grupo: "cursiva",
  },
  { id: "megrim", nombre: "Megrim", familia: '"pd Megrim"', grupo: "extraña" },
  {
    id: "bungee-hairline",
    nombre: "Bungee Hairline",
    familia: '"pd Bungee Hairline"',
    grupo: "extraña",
  },
  {
    id: "tourney",
    nombre: "Tourney",
    familia: '"pd Tourney"',
    grupo: "extraña",
  },
  {
    id: "turret-road",
    nombre: "Turret Road",
    familia: '"pd Turret Road"',
    grupo: "extraña",
  },
  {
    id: "redacted-script",
    nombre: "Redacted Script",
    familia: '"pd Redacted Script"',
    grupo: "extraña",
  },
  { id: "doto", nombre: "Doto", familia: '"pd Doto"', grupo: "extraña" },
  // la del sitio, en su corte más delgado
  {
    id: "archivo-fina",
    nombre: "Archivo (fina)",
    familia: '"Archivo"',
    grupo: "fina",
    peso: 100,
    ancho: "125%",
  },
];

/** Las elegidas (ids); null, vacío o ninguna válida = todas. */
export function fuentesElegidas(
  ids: readonly string[] | null | undefined,
): readonly FuenteDestello[] {
  if (!ids || !ids.length) return FUENTES_DESTELLO;
  const e = FUENTES_DESTELLO.filter((f) => ids.includes(f.id));
  return e.length ? e : FUENTES_DESTELLO;
}
