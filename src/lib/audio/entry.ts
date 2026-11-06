/**
 * Pantalla de entrada.
 *
 * Los navegadores no dejan sonar audio hasta que el visitante hace un gesto
 * (clic, toque o tecla), así que el sitio abre con un solo link: "entrar".
 * Al pulsarlo arrancan juntas la intro animada y el fade de la música.
 */
import type { Ambient, AudioSettings } from "./ambient";

let resolveEntry: () => void = () => {};

/** Se cumple cuando el visitante entra. La intro de la portada lo espera. */
export const entered: Promise<void> = new Promise((r) => {
  resolveEntry = r;
});

export function mountGate(s: AudioSettings, ambient: Ambient): () => void {
  if (!s.enabled || ambient.isStarted) {
    resolveEntry();
    return () => {};
  }
  ambient.warm();

  const gate = document.createElement("div");
  gate.className = "gate";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gate-enter";
  button.textContent = s.copy.enter;
  gate.append(button);
  document.body.append(gate);

  let done = false;
  const enter = () => {
    if (done) return;
    done = true;
    document.removeEventListener("keydown", onKey);
    ambient.enter();
    resolveEntry();
    gate.dataset.leaving = "";
    window.setTimeout(() => gate.remove(), 1400);
  };
  // cualquier parte de la pantalla cuenta, y también Enter o espacio sin tener que enfocar el link
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    enter();
  };
  gate.addEventListener("click", enter);
  document.addEventListener("keydown", onKey);

  return () => {
    gate.removeEventListener("click", enter);
    document.removeEventListener("keydown", onKey);
    if (!done) gate.remove();
  };
}
