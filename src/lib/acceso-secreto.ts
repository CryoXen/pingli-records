/**
 * La acción secreta para llegar al panel de admin: mantener presionada la
 * cuenta 3:33 (abajo a la derecha) 3.33 segundos.
 *
 * Mientras se mantiene, los dígitos se deshacen por la rampa de la figura
 * ASCII (* + ^ ; : , .), uno tras otro, hasta quedar en blanco; entonces se
 * abre el admin (que de todos modos pide usuario y contraseña). Si se suelta
 * antes, la cuenta vuelve a la normalidad. Igual con mouse que con el dedo.
 */

export type SecretSettings = {
  /** A dónde lleva (la URL del admin). */
  readonly path: string;
  /** Segundos que hay que mantenerla. 0 = sin acción secreta. */
  readonly hold: number;
};

const RAMP = "*+^;:,. ";

export function mountSecretHold(s: SecretSettings): () => void {
  if (!(s.hold > 0)) return () => {};
  let el: HTMLElement | null = null;
  let raf = 0;
  let t0 = 0;
  let pointer: number | null = null;
  // a cada carácter le toca deshacerse en otro momento
  let offsets: number[] = [];

  const base = () => (el?.dataset.time ?? el?.textContent ?? "").padEnd(5, " ");

  function paint(p: number) {
    if (!el) return;
    const text = base();
    if (offsets.length !== text.length) offsets = [...text].map(() => Math.random() * 0.45);
    el.textContent = [...text]
      .map((ch, i) => {
        if (ch === " ") return ch;
        const q = Math.min(1, Math.max(0, (p - offsets[i]) / 0.5));
        return q <= 0 ? ch : RAMP[Math.min(RAMP.length - 1, Math.floor(q * RAMP.length))];
      })
      .join("");
  }

  function stop() {
    cancelAnimationFrame(raf);
    pointer = null;
    if (!el) return;
    delete el.dataset.holding;
    el.textContent = el.dataset.time ?? el.textContent;
  }

  function step(now: number) {
    const p = Math.min(1, (now - t0) / (s.hold * 1000));
    paint(p);
    if (p < 1) {
      raf = requestAnimationFrame(step);
      return;
    }
    stop();
    window.location.assign(s.path);
  }

  function onDown(e: PointerEvent) {
    const target = (e.target as Element | null)?.closest<HTMLElement>("[data-cycle-clock]");
    if (!target || (e.pointerType === "mouse" && e.button !== 0)) return;
    // que el plano de abajo no empiece a arrastrarse
    e.stopPropagation();
    e.preventDefault();
    el = target;
    pointer = e.pointerId;
    offsets = [];
    el.dataset.holding = "";
    t0 = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }

  function onEnd(e: PointerEvent) {
    if (pointer === e.pointerId) stop();
  }

  function onMove(e: PointerEvent) {
    if (pointer !== e.pointerId || !el) return;
    // si el dedo o el mouse se sale de la cuenta, se cancela
    const r = el.getBoundingClientRect();
    const pad = 24;
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) stop();
  }

  // en celular, mantener presionado abre el menú de texto: aquí no
  const onMenu = (e: Event) => {
    if ((e.target as Element | null)?.closest("[data-cycle-clock]")) e.preventDefault();
  };

  document.addEventListener("pointerdown", onDown, { capture: true });
  window.addEventListener("pointerup", onEnd);
  window.addEventListener("pointercancel", onEnd);
  window.addEventListener("pointermove", onMove);
  document.addEventListener("contextmenu", onMenu);

  return () => {
    stop();
    document.removeEventListener("pointerdown", onDown, { capture: true });
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("contextmenu", onMenu);
  };
}
