"use client";

/**
 * Piezas compartidas del panel de admin.
 */
import { useEffect, useId, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import type { AdminStore, Carpeta } from "@/lib/admin/store";

/** Botones de opción en una línea: [ claro | oscuro ]. */
export function Segmentos<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { id: T; nombre: string; nota?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="adm-seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={props.value === o.id}
          className="adm-seg-btn"
          onClick={() => props.onChange(o.id)}
        >
          {o.nombre}
          {o.nota ? <span className="adm-seg-nota">{o.nota}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Una imagen guardada (portadas o previsiones). Si no carga, lo dice. */
export function Imagen({ store, carpeta, ruta, alt = "" }: { store: AdminStore; carpeta: Carpeta; ruta: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    let vivo = true;
    setFalla(false);
    store.url(carpeta, ruta).then(
      (u) => vivo && setSrc(u),
      () => vivo && setFalla(true),
    );
    return () => {
      vivo = false;
    };
  }, [store, carpeta, ruta]);
  if (falla) return <span className="adm-img-falla">no carga</span>;
  return src ? <img className="adm-img" src={src} alt={alt} loading="lazy" onError={() => setFalla(true)} /> : null;
}

/** Botón que pide un segundo clic para confirmar ("borrar" → "¿seguro?"). */
export function Confirmar({ children, onConfirm, disabled }: { children: ReactNode; onConfirm: () => void; disabled?: boolean }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 3000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <button
      type="button"
      className="adm-link adm-peligro"
      disabled={disabled}
      onClick={() => {
        if (armado) {
          setArmado(false);
          onConfirm();
        } else setArmado(true);
      }}
    >
      {armado ? "¿seguro?" : children}
    </button>
  );
}

/** Etiquetas como #chips: escribir y Enter (o coma) agrega; × quita. */
export function Etiquetas({ value, onChange, sugerencias }: { value: string[]; onChange: (v: string[]) => void; sugerencias: string[] }) {
  const [texto, setTexto] = useState("");
  const lista = useId();
  const agregar = (t: string) => {
    const limpio = t.trim().replace(/^#/, "").toLowerCase();
    if (limpio && !value.includes(limpio)) onChange([...value, limpio]);
    setTexto("");
  };
  return (
    <div className="adm-chips">
      {value.map((t) => (
        <span key={t} className="adm-chip">
          #{t}
          <button type="button" aria-label={`quitar ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="adm-chip-input"
        value={texto}
        list={lista}
        placeholder={value.length ? "" : "ambient, drone…"}
        aria-label="nueva etiqueta"
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) agregar(v.slice(0, -1));
          else setTexto(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            agregar(texto);
          } else if (e.key === "Backspace" && !texto && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => texto && agregar(texto)}
      />
      <datalist id={lista}>
        {sugerencias
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}

/** Estado de guardado de una fila: "guardando…", "guardado", o el error. */
export type Estado = { tipo: "nada" } | { tipo: "guardando" } | { tipo: "guardado" } | { tipo: "error"; msg: string };

export function useEstado() {
  const [estado, setEstado] = useState<Estado>({ tipo: "nada" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const correr = async (f: () => Promise<void>) => {
    clearTimeout(timer.current);
    setEstado({ tipo: "guardando" });
    try {
      await f();
      setEstado({ tipo: "guardado" });
      timer.current = setTimeout(() => setEstado({ tipo: "nada" }), 1600);
      return true;
    } catch (e) {
      setEstado({ tipo: "error", msg: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };
  return [estado, correr] as const;
}

export function EstadoTexto({ estado }: { estado: Estado }) {
  if (estado.tipo === "nada") return null;
  return (
    <span className="adm-estado" data-tipo={estado.tipo} role={estado.tipo === "error" ? "alert" : "status"}>
      {estado.tipo === "guardando" ? "guardando…" : estado.tipo === "guardado" ? "guardado" : estado.msg}
    </span>
  );
}

/** Textarea que crece con el texto. */
export function TextoLargo(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

/** Campo de número que deja escribir "-" o "12." sin brincar. */
export function Numero({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [texto, setTexto] = useState(String(value));
  useEffect(() => {
    if (Number(texto) !== value) setTexto(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className="adm-input adm-num"
      inputMode="decimal"
      aria-label={label}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
