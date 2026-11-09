/**
 * Panel de lanzamiento.
 *
 * Al seleccionar un cuadro del lienzo, a la derecha se despliega su
 * información: título, artista y año, descripción, etiquetas y dónde
 * conseguirlo. Es una ventana de 1 px como los marcos del lienzo, con una
 * barra arriba (número de catálogo y "cerrar"). Se dibuja de arriba abajo
 * por pasos y el contenido aparece pieza por pieza, como la entrada del sitio.
 *
 * En celular ocupa toda la pantalla y entra desde la derecha.
 * Se cierra con "cerrar" o Esc; al elegir otro cuadro, el contenido cambia.
 *
 * Las etiquetas son botones: al tocar una, los lanzamientos que la tienen se
 * resaltan en el lienzo (el resto se atenúa) y la cámara los encuadra a
 * todos en el espacio libre. Otro toque la apaga; al cerrar el panel se limpia.
 */

export type StoreId = "bandcamp" | "youtube" | "soulseek";

export type Store = {
  readonly id: StoreId;
  readonly label: string;
  /** Ruta del ícono (p. ej. "/icons/bandcamp.svg"). null = marco vacío, pendiente de diseño. */
  readonly icon: string | null;
};

export type PanelRelease = {
  readonly catalog: string;
  readonly title: string;
  readonly artist?: string;
  readonly year?: number;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly links?: { readonly [K in StoreId]?: string };
  /** Posición y tamaño en el lienzo (para encuadrar los resaltados). */
  readonly x?: number;
  readonly y?: number;
  readonly size?: number;
};

export type PanelCopy = {
  readonly close: string;
  /** Al pasar el cursor por una etiqueta. */
  readonly tagHint: string;
  readonly stores: string;
  readonly copied: string;
  readonly noLink: string;
};

const MOBILE = "(max-width: 720px)";
const PANEL_ID = "panel-lanzamiento";

type Api = { open(index: number, focus: boolean): void; close(): void };
let api: Api | null = null;

type Fly = (x: number, y: number, scale: number) => void;
let fly: Fly | null = null;

/** El lienzo le presta su cámara al panel, para encuadrar los lanzamientos de una etiqueta. */
export function connectCamera(f: Fly | null) {
  fly = f;
}

/** Abre el panel de un lanzamiento. `focus`: mover el foco al panel (al abrirlo con teclado). */
export function openRelease(index: number, opts: { focus?: boolean } = {}) {
  api?.open(index, Boolean(opts.focus));
  // aviso para el sonido del proyecto (src/lib/audio/sfx.ts), según el mundo
  window.dispatchEvent(new CustomEvent("pingli:proyecto", { detail: { index } }));
}

export function closeRelease() {
  api?.close();
}

/**
 * Cuánto tapa el panel por la derecha, en px. La cámara lo usa para centrar
 * el cuadro en el espacio que queda libre. En celular es 0 (el panel tapa todo).
 */
export function releasePanelInset(): number {
  if (typeof window === "undefined" || window.matchMedia(MOBILE).matches) return 0;
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return 0;
  return Math.max(0, window.innerWidth - panel.getBoundingClientRect().left);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountReleasePanel(
  releases: readonly PanelRelease[],
  stores: readonly Store[],
  copy: PanelCopy,
): () => void {
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = () => window.matchMedia(MOBILE).matches;

  const panel = el("aside", "panel");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-labelledby", "panel-title");
  panel.inert = true;
  const bar = el("div", "panel-bar");
  const cat = el("span", "panel-cat");
  const closeBtn = el("button", "panel-close", copy.close);
  closeBtn.type = "button";
  bar.append(cat, closeBtn);
  const body = el("div", "panel-body");
  body.tabIndex = -1;
  panel.append(bar, body);
  document.body.append(panel);

  let openIndex = -1;
  let anims: Animation[] = [];
  let returnFocus: HTMLElement | null = null;
  let activeTag: string | null = null;

  /** Resalta en el lienzo los lanzamientos con esa etiqueta (null = ninguno). */
  function highlight(tag: string | null) {
    activeTag = tag;
    const root = document.documentElement;
    const hits: number[] = [];
    document.querySelectorAll<HTMLElement>("[data-release]").forEach((b) => {
      const i = Number(b.dataset.release);
      const on = tag !== null && Boolean(releases[i]?.tags?.includes(tag));
      if (on) {
        b.dataset.tagged = `#${tag}`;
        hits.push(i);
      } else delete b.dataset.tagged;
    });
    if (tag === null) delete root.dataset.tagging;
    else root.dataset.tagging = tag;
    body.querySelectorAll<HTMLButtonElement>(".panel-tag").forEach((t) => {
      t.setAttribute("aria-pressed", String(t.dataset.tag === tag));
    });
    if (tag !== null) frameAll(hits);
  }

  /** Encuadra varios lanzamientos en el espacio que el panel deja libre. */
  function frameAll(indices: number[]) {
    const rs = indices.map((i) => releases[i]).filter((r) => r && r.x !== undefined && r.y !== undefined && r.size);
    if (!fly || rs.length < 2) return; // uno solo ya está centrado
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const it of rs) {
      const h = it.size! / 2;
      l = Math.min(l, it.x! - h);
      r = Math.max(r, it.x! + h);
      t = Math.min(t, it.y! - h);
      b = Math.max(b, it.y! + h);
    }
    const inset = releasePanelInset();
    const pad = 110; // márgenes y espacio para los pies de foto
    const w = Math.max(80, window.innerWidth - inset - pad * 2);
    const hgt = Math.max(80, window.innerHeight - pad * 2);
    const scale = Math.min(4, w / (r - l), hgt / (b - t));
    fly((l + r) / 2 + inset / 2 / scale, (t + b) / 2 + 12 / scale, scale);
  }

  const stopAnims = () => {
    for (const a of anims) a.cancel();
    anims = [];
  };

  function storeItem(store: Store, value: string | undefined): HTMLLIElement {
    const li = el("li");
    let icon: HTMLElement;
    if (store.icon) {
      const img = el("img", "panel-icon");
      img.src = store.icon;
      img.alt = "";
      icon = img;
    } else {
      icon = el("span", "panel-icon"); // marco vacío hasta que existan los íconos
    }
    icon.setAttribute("aria-hidden", "true");
    const label = el("span", "panel-store-label", store.label);

    let item: HTMLElement;
    if (!value) {
      item = el("span", "panel-store");
      item.dataset.off = "";
      item.title = copy.noLink;
      item.setAttribute("aria-label", `${store.label}: ${copy.noLink}`);
    } else if (/^(https?:|slsk:)/i.test(value)) {
      const a = el("a", "panel-store");
      a.href = value;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      item = a;
    } else {
      // un usuario o una carpeta de Soulseek (sin enlace web): se copia al portapapeles
      const b = el("button", "panel-store");
      b.type = "button";
      b.title = value;
      b.addEventListener("click", () => {
        const show = (text: string) => {
          label.textContent = text;
          window.setTimeout(() => (label.textContent = store.label), 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(value).then(() => show(`${copy.copied}: ${value}`), () => show(value));
        else show(value);
      });
      item = b;
    }
    item.append(icon, label);
    li.append(item);
    return li;
  }

  /** Llena el panel; devuelve las piezas en el orden en que aparecen. */
  function fill(r: PanelRelease): HTMLElement[] {
    cat.textContent = r.catalog;
    const parts: HTMLElement[] = [];

    const title = el("h2", "panel-title", r.title);
    title.id = "panel-title";
    parts.push(title);

    const meta = [r.artist, r.year].filter((v) => v !== undefined && v !== "").join(", ");
    if (meta) parts.push(el("p", "panel-meta", meta));

    if (r.description) {
      const desc = el("div", "panel-desc");
      for (const para of r.description.split(/\n\s*\n/)) if (para.trim()) desc.append(el("p", "", para.trim()));
      parts.push(desc);
    }

    if (r.tags?.length) {
      const tags = el("ul", "panel-tags");
      tags.setAttribute("aria-label", "etiquetas");
      for (const t of r.tags) {
        const li = el("li");
        const b = el("button", "panel-tag", `#${t}`);
        b.type = "button";
        b.dataset.tag = t;
        b.title = copy.tagHint;
        b.setAttribute("aria-pressed", String(t === activeTag));
        b.addEventListener("click", () => highlight(activeTag === t ? null : t));
        li.append(b);
        tags.append(li);
      }
      parts.push(tags);
    }

    if (stores.length) {
      const box = el("div", "panel-stores");
      const list = el("ul");
      for (const s of stores) list.append(storeItem(s, r.links?.[s.id]));
      box.append(el("p", "panel-label", copy.stores), list);
      parts.push(box);
    }

    body.replaceChildren(...parts);
    body.scrollTop = 0;
    return parts;
  }

  /** Aparición escalonada, como la entrada del sitio. */
  function reveal(nodes: HTMLElement[], delay: number) {
    if (reduce()) return;
    nodes.forEach((node, k) => {
      anims.push(
        node.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], {
          duration: 520,
          delay: delay + k * 80,
          easing: "cubic-bezier(.2,.6,.2,1)",
          fill: "backwards",
        }),
      );
    });
  }

  /** La ventana: de arriba abajo por pasos (en celular, entra desde la derecha). */
  function frame(opening: boolean): Animation | null {
    if (reduce()) return null;
    const m = mobile();
    const shut = m ? { transform: "translateX(100%)" } : { clipPath: "inset(0 0 100% 0)" };
    const full = m ? { transform: "none" } : { clipPath: "inset(0 0 0 0)" };
    const a = panel.animate(opening ? [shut, full] : [full, shut], {
      duration: m ? (opening ? 420 : 300) : opening ? 360 : 240,
      easing: m ? (opening ? "cubic-bezier(.2,.7,.2,1)" : "ease-in") : opening ? "steps(9, end)" : "steps(6, end)",
      fill: "forwards",
    });
    anims.push(a);
    return a;
  }

  function select(index: number) {
    document.querySelectorAll<HTMLElement>("[data-release]").forEach((b) => {
      const on = Number(b.dataset.release) === index;
      if (on) b.dataset.selected = "";
      else delete b.dataset.selected;
      b.setAttribute("aria-controls", PANEL_ID);
      b.setAttribute("aria-expanded", String(on));
    });
  }

  function open(index: number, focus: boolean) {
    const r = releases[index];
    if (!r) return;
    select(index);
    returnFocus = document.querySelector<HTMLElement>(`[data-release="${index}"]`);
    const wasOpen = openIndex >= 0;
    if (wasOpen && index === openIndex) {
      if (focus) body.focus({ preventScroll: true });
      return;
    }
    openIndex = index;
    stopAnims();
    // si el lanzamiento nuevo no tiene la etiqueta encendida, se apaga
    if (activeTag !== null && !r.tags?.includes(activeTag)) highlight(null);

    if (wasOpen && !reduce()) {
      // cambio de lanzamiento: el contenido se desvanece y vuelve a aparecer
      const out = body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
      anims.push(out);
      out.finished.then(
        () => {
          out.cancel();
          reveal([cat, ...fill(r)], 0);
        },
        () => {},
      );
    } else {
      const parts = fill(r);
      panel.dataset.open = "";
      panel.inert = false;
      frame(true);
      reveal([cat, closeBtn, ...parts], wasOpen ? 0 : 220);
    }
    if (focus) body.focus({ preventScroll: true });
  }

  function close() {
    if (openIndex < 0) return;
    openIndex = -1;
    select(-1);
    highlight(null);
    stopAnims();
    const hadFocus = panel.contains(document.activeElement);
    const done = () => {
      delete panel.dataset.open;
      panel.inert = true;
      body.replaceChildren();
    };
    const a = frame(false);
    if (a)
      a.finished.then(
        () => {
          a.cancel();
          done();
        },
        () => {},
      );
    else done();
    if (hadFocus) returnFocus?.focus({ preventScroll: true });
  }

  const onDocKey = (e: KeyboardEvent) => {
    // (con el menú del contador abierto, Esc solo cierra el menú)
    if (e.key === "Escape" && openIndex >= 0 && !document.documentElement.hasAttribute("data-menu-admin")) {
      e.preventDefault();
      close();
    }
  };
  // dentro del panel, las teclas no mueven el lienzo
  const onPanelKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") e.stopPropagation();
  };
  closeBtn.addEventListener("click", close);
  panel.addEventListener("keydown", onPanelKey);
  document.addEventListener("keydown", onDocKey);

  api = { open, close };

  return () => {
    if (api?.open === open) api = null;
    stopAnims();
    select(-1);
    document.removeEventListener("keydown", onDocKey);
    panel.remove();
  };
}
