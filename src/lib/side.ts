import { site } from "@/config/site";

/** De qué lado del sitio está el visitante. "dark" = el lado secreto. */
export type Side = "light" | "dark";

const KEY = "pingli:lado";

export function currentSide(): Side {
  return document.documentElement.dataset.side === "dark" ? "dark" : "light";
}

export function setSide(side: Side) {
  document.documentElement.dataset.side = side;
  if (!site.secrets.darkSide.remember) return;
  try {
    localStorage.setItem(KEY, side);
  } catch {
    /* almacenamiento bloqueado: el cambio solo dura esta visita */
  }
}

/**
 * Script que corre antes de pintar: aplica el lado recordado (sin parpadeo)
 * y oculta la interfaz hasta que empieza la entrada animada.
 */
export const bootScript = `(function(){var d=document.documentElement;d.classList.add('intro');${
  site.secrets.darkSide.remember
    ? `try{if(localStorage.getItem('${KEY}')==='dark')d.dataset.side='dark';}catch(e){}`
    : ""
}})();`;
