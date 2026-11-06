"use client";

/**
 * Previsiones: las imágenes del ciclo de 3:33. Cada una lleva un tipo (para
 * no mostrar dos del mismo tipo seguidas) y una rareza (qué tan seguido sale).
 * Solo salen las activas que de verdad cargan.
 */
import { useMemo, useState } from "react";
import { site } from "@/config/site";
import { rutaUnica, type AdminStore } from "@/lib/admin/store";
import { nombreDeRuta } from "@/lib/contenido/mapear";
import { RAREZAS, type FilaPrevision, type Rareza } from "@/lib/contenido/tipos";
import { Confirmar, EstadoTexto, Imagen, Segmentos, useEstado } from "./comun";

const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

const pct = (n: number) => (n >= 10 ? `${Math.round(n)} %` : `${n.toFixed(1)} %`);

/** Probabilidad de cada rareza y de cada imagen, con las imágenes activas de hoy. */
function probabilidades(filas: readonly FilaPrevision[]) {
  const activas = filas.filter((f) => f.activo);
  const por = Object.fromEntries(RAREZAS.map((r) => [r.id, activas.filter((f) => f.rareza === r.id).length])) as Record<Rareza, number>;
  const pesos = site.cycle.rareza;
  const total = RAREZAS.reduce((a, r) => a + (por[r.id] ? pesos[r.id] : 0), 0);
  const deRareza = (r: Rareza) => (total && por[r] ? (pesos[r] / total) * 100 : 0);
  return { por, deRareza, deImagen: (r: Rareza) => (por[r] ? deRareza(r) / por[r] : 0) };
}

export function Previsiones({ store, filas, setFilas, avisar }: {
  store: AdminStore;
  filas: FilaPrevision[];
  setFilas: (f: (prev: FilaPrevision[]) => FilaPrevision[]) => void;
  avisar: () => void;
}) {
  const [tipo, setTipo] = useState("");
  const [rareza, setRareza] = useState<Rareza>("comun");
  const [subidas, setSubidas] = useState<{ nombre: string; estado: "subiendo" | "listo" | string }[]>([]);
  const [filtro, setFiltro] = useState<string>("todas");
  const [encima, setEncima] = useState(false);

  const tipos = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) m.set(f.tipo, (m.get(f.tipo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filas]);
  const prob = useMemo(() => probabilidades(filas), [filas]);
  const visibles = filas.filter((f) =>
    filtro === "todas" ? true : filtro.startsWith("r:") ? f.rareza === filtro.slice(2) : f.tipo === filtro.slice(2),
  );

  async function subir(archivos: File[]) {
    const imagenes = archivos.filter((a) => a.type.startsWith("image/"));
    setSubidas((s) => [...imagenes.map((a) => ({ nombre: a.name, estado: "subiendo" })), ...s].slice(0, 30));
    for (const a of imagenes) {
      const marcar = (estado: string) => setSubidas((s) => s.map((x) => (x.nombre === a.name && x.estado === "subiendo" ? { ...x, estado } : x)));
      try {
        const ruta = await store.subir("previsiones", a, rutaUnica("", a));
        const fila: FilaPrevision = { id: nuevoId(), ruta, nombre: a.name, tipo: tipo.trim().toLowerCase(), rareza, activo: true, creado: new Date().toISOString() };
        await store.guardarPrevision(fila);
        setFilas((prev) => [fila, ...prev]);
        marcar("listo");
      } catch (e) {
        marcar(e instanceof Error ? e.message : "no se pudo subir");
      }
    }
    avisar();
  }

  return (
    <section className="adm-seccion" aria-label="previsiones">
      <div
        className="adm-subir"
        data-encima={encima || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          void subir([...e.dataTransfer.files]);
        }}
      >
        <p>
          arrastra imágenes aquí o{" "}
          <label className="adm-link">
            elige archivos
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void subir([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </label>
        </p>
        <div className="adm-subir-opciones">
          <label className="adm-campo">
            <span>tipo de las que subas</span>
            <input className="adm-input" list="adm-tipos" value={tipo} placeholder="paisaje, glitch…" onChange={(e) => setTipo(e.target.value)} />
          </label>
          <div className="adm-campo">
            <span>rareza</span>
            <Segmentos label="rareza de las que subas" value={rareza} options={RAREZAS} onChange={setRareza} />
          </div>
        </div>
        {subidas.length ? (
          <ul className="adm-subidas">
            {subidas.map((s, i) => (
              <li key={i} data-estado={s.estado === "subiendo" || s.estado === "listo" ? s.estado : "error"}>
                {s.nombre} — {s.estado === "subiendo" ? "subiendo…" : s.estado === "listo" ? "lista" : s.estado}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <datalist id="adm-tipos">
        {tipos.filter(([t]) => t).map(([t]) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="adm-rarezas">
        {RAREZAS.map((r) => (
          <div key={r.id} className="adm-rareza" data-rareza={r.id}>
            <b>{r.nombre}</b>
            <span>
              {prob.por[r.id]} {prob.por[r.id] === 1 ? "imagen" : "imágenes"}
            </span>
            <span>{prob.por[r.id] ? `sale ${pct(prob.deRareza(r.id))} de las veces` : "sin imágenes: su parte se reparte"}</span>
          </div>
        ))}
      </div>

      <div className="adm-barra">
        <select className="adm-input adm-mini" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="mostrar">
          <option value="todas">todas ({filas.length})</option>
          {RAREZAS.map((r) => (
            <option key={r.id} value={`r:${r.id}`}>
              {r.nombre}
            </option>
          ))}
          {tipos.map(([t, n]) => (
            <option key={t} value={`t:${t}`}>
              tipo: {t || "sin tipo"} ({n})
            </option>
          ))}
        </select>
        <span className="adm-cuenta">nunca salen dos del mismo tipo seguidas · las que no cargan no salen</span>
      </div>

      {visibles.length === 0 ? <p className="adm-vacio">{filas.length ? "nada con ese filtro." : "todavía no hay previsiones: a los 3:33 el sitio vuelve a “entrar” sin imagen."}</p> : null}
      <ul className="adm-galeria">
        {visibles.map((f) => (
          <TarjetaPrevision
            key={f.id}
            store={store}
            fila={f}
            prob={f.activo ? prob.deImagen(f.rareza) : 0}
            guardar={async (n) => {
              await store.guardarPrevision(n);
              setFilas((prev) => prev.map((x) => (x.id === n.id ? n : x)));
              avisar();
            }}
            borrar={async () => {
              await store.borrarPrevision(f.id);
              await store.borrarArchivo("previsiones", f.ruta).catch(() => {});
              setFilas((prev) => prev.filter((x) => x.id !== f.id));
              avisar();
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function TarjetaPrevision({ store, fila, prob, guardar, borrar }: {
  store: AdminStore;
  fila: FilaPrevision;
  prob: number;
  guardar: (f: FilaPrevision) => Promise<void>;
  borrar: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState(fila.tipo);
  const [estado, correr] = useEstado();
  const cambiar = (n: Partial<FilaPrevision>) => correr(() => guardar({ ...fila, ...n }));
  return (
    <li className="adm-prevision" data-inactiva={!fila.activo || undefined} data-rareza={fila.rareza}>
      <span className="adm-marco adm-prevision-foto">
        <Imagen store={store} carpeta="previsiones" ruta={fila.ruta} />
      </span>
      <span className="adm-gris adm-nota-chica adm-prevision-nombre" title="lo que se ve debajo de la imagen">
        {fila.nombre ?? nombreDeRuta(fila.ruta)}
      </span>
      <input
        className="adm-input adm-mini"
        list="adm-tipos"
        value={tipo}
        placeholder="tipo"
        aria-label="tipo"
        onChange={(e) => setTipo(e.target.value)}
        onBlur={() => {
          const t = tipo.trim().toLowerCase();
          if (t !== fila.tipo) void cambiar({ tipo: t });
        }}
      />
      <select className="adm-input adm-mini" value={fila.rareza} aria-label="rareza" onChange={(e) => void cambiar({ rareza: e.target.value as Rareza })}>
        {RAREZAS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </select>
      <div className="adm-frase-meta">
        <label className="adm-check">
          <input type="checkbox" checked={fila.activo} onChange={(e) => void cambiar({ activo: e.target.checked })} />
          activa
        </label>
        <span className="adm-prob" title="probabilidad de salir en cada ciclo">
          {fila.activo ? `≈ ${pct(prob)}` : "no sale"}
        </span>
        <Confirmar onConfirm={() => void correr(borrar)}>borrar</Confirmar>
      </div>
      <EstadoTexto estado={estado} />
    </li>
  );
}
