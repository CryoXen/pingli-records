/**
 * Los carteles que este visitante ya leyó. Se guardan en su navegador
 * (sobreviven a la recarga de los 3:33) y avisan con el evento
 * "pingli:cartel" cada vez que se suma uno, para que el muro lo cuelgue.
 */

const KEY = "pingli:carteles";
export const CARTEL_EVENT = "pingli:cartel";

let cache: Set<string> | null = null;

export function collected(): Set<string> {
  if (cache) return cache;
  cache = new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) cache.add(id);
  } catch {
    /* almacenamiento bloqueado o dañado: se empieza de cero */
  }
  return cache;
}

export function collect(id: string) {
  const set = collected();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* almacenamiento bloqueado: dura esta visita */
  }
  window.dispatchEvent(new CustomEvent(CARTEL_EVENT, { detail: id }));
}
