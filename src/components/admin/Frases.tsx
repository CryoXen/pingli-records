"use client";

/**
 * Frases de cada mundo: los carteles (lo que brota hoy). Las frases de solo
 * texto que estaban guardadas siguen en la base, pero ya no se muestran aquí.
 * Editar el texto se guarda al salir del campo.
 */
import { useMemo, useState } from "react";
import { site } from "@/config/site";
import type { AdminStore } from "@/lib/admin/store";
import type { Banco, FilaFrase, Mundo } from "@/lib/contenido/tipos";
import {
  Confirmar,
  EstadoTexto,
  Segmentos,
  TextoLargo,
  useEstado,
} from "./comun";

const MUNDOS = [
  { id: "claro", nombre: "claro" },
  { id: "oscuro", nombre: "oscuro" },
] as const;

/** El siguiente id libre: c61, o61… (carteles) o fc091, fo091… (frases). */
function siguienteId(
  filas: readonly FilaFrase[],
  banco: Banco,
  mundo: Mundo,
): string {
  const pre =
    banco === "carteles"
      ? mundo === "claro"
        ? "c"
        : "o"
      : mundo === "claro"
        ? "fc"
        : "fo";
  const ancho = banco === "carteles" ? 2 : 3;
  const usados = new Set(filas.map((f) => f.id));
  let n =
    Math.max(
      0,
      ...filas
        .filter((f) => f.id.startsWith(pre))
        .map((f) => Number(f.id.slice(pre.length)) || 0),
    ) + 1;
  while (usados.has(pre + String(n).padStart(ancho, "0"))) n++;
  return pre + String(n).padStart(ancho, "0");
}

export function Frases({
  store,
  filas,
  setFilas,
  avisar,
}: {
  store: AdminStore;
  filas: FilaFrase[];
  setFilas: (f: (prev: FilaFrase[]) => FilaFrase[]) => void;
  avisar: () => void;
}) {
  const [mundo, setMundo] = useState<Mundo>("claro");
  // el banco que brota hoy (carteles); las "frases guardadas" ya no se editan aquí
  const banco: Banco = site.phrases.source === "frases" ? "frases" : "carteles";
  const [busca, setBusca] = useState("");
  const [nueva, setNueva] = useState(false);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas
      .filter((f) => f.mundo === mundo && f.banco === banco)
      .filter(
        (f) =>
          !q ||
          f.texto.toLowerCase().includes(q) ||
          f.id.includes(q) ||
          f.tema.includes(q),
      )
      .sort((a, b) => a.orden - b.orden);
  }, [filas, mundo, banco, busca]);

  const temas = useMemo(
    () => [
      ...new Set(
        filas
          .filter((f) => f.mundo === mundo && f.banco === banco)
          .map((f) => f.tema),
      ),
    ],
    [filas, mundo, banco],
  );
  const grupos = useMemo(() => {
    const g = new Map<string, FilaFrase[]>();
    for (const f of visibles) g.set(f.tema, [...(g.get(f.tema) ?? []), f]);
    return [...g.entries()];
  }, [visibles]);

  const total = filas.filter((f) => f.mundo === mundo && f.banco === banco);
  const activas = total.filter((f) => f.activo).length;

  const actualizar = (f: FilaFrase) =>
    setFilas((prev) => prev.map((x) => (x.id === f.id ? f : x)));

  return (
    <section className="adm-seccion" aria-label="frases">
      <div className="adm-barra">
        <Segmentos
          label="mundo"
          value={mundo}
          options={MUNDOS}
          onChange={setMundo}
        />
        <input
          className="adm-input adm-busca"
          type="search"
          placeholder="buscar"
          aria-label="buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <span className="adm-cuenta">
          {activas}/{total.length} activas
        </span>
        <button
          type="button"
          className="adm-boton"
          onClick={() => setNueva(true)}
          disabled={nueva}
        >
          + nueva
        </button>
      </div>

      {nueva ? (
        <NuevaFrase
          temas={temas}
          onCancel={() => setNueva(false)}
          onCrear={async (tema, texto) => {
            const f: FilaFrase = {
              id: siguienteId(filas, banco, mundo),
              banco,
              mundo,
              tema,
              texto,
              icono: banco === "carteles" ? "puntos" : null,
              activo: true,
              orden: Math.max(0, ...filas.map((x) => x.orden)) + 1,
            };
            await store.guardarFrase(f);
            setFilas((prev) => [...prev, f]);
            setNueva(false);
            avisar();
          }}
        />
      ) : null}

      {grupos.length === 0 ? (
        <p className="adm-vacio">
          {busca ? "nada coincide." : "no hay frases aquí todavía."}
        </p>
      ) : null}
      {grupos.map(([tema, lista]) => (
        <div key={tema} className="adm-grupo">
          <h3 className="adm-grupo-titulo">
            {tema || "sin tema"} <span>{lista.length}</span>
          </h3>
          <ul className="adm-lista">
            {lista.map((f) => (
              <FilaFraseUI
                key={f.id}
                fila={f}
                temas={temas}
                guardar={async (n) => {
                  await store.guardarFrase(n);
                  actualizar(n);
                  avisar();
                }}
                borrar={async () => {
                  await store.borrarFrase(f.id);
                  setFilas((prev) => prev.filter((x) => x.id !== f.id));
                  avisar();
                }}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function FilaFraseUI({
  fila,
  temas,
  guardar,
  borrar,
}: {
  fila: FilaFrase;
  temas: string[];
  guardar: (f: FilaFrase) => Promise<void>;
  borrar: () => Promise<void>;
}) {
  const [texto, setTexto] = useState(fila.texto);
  const [estado, correr] = useEstado();
  const cambiar = (n: Partial<FilaFrase>) =>
    correr(() => guardar({ ...fila, ...n }));
  return (
    <li className="adm-frase" data-inactiva={!fila.activo || undefined}>
      <span className="adm-id">{fila.id}</span>
      <TextoLargo
        className="adm-input adm-frase-texto"
        value={texto}
        aria-label={`texto de ${fila.id}`}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const t = texto.trim();
          if (!t) setTexto(fila.texto);
          else if (t !== fila.texto) void cambiar({ texto: t });
        }}
      />
      <div className="adm-frase-meta">
        <select
          className="adm-input adm-mini"
          value={fila.tema}
          aria-label="tema"
          onChange={(e) => void cambiar({ tema: e.target.value })}
        >
          {temas.map((t) => (
            <option key={t} value={t}>
              {t || "sin tema"}
            </option>
          ))}
        </select>
        <label className="adm-check">
          <input
            type="checkbox"
            checked={fila.activo}
            onChange={(e) => void cambiar({ activo: e.target.checked })}
          />
          activa
        </label>
        <Confirmar onConfirm={() => void correr(borrar)}>borrar</Confirmar>
        <EstadoTexto estado={estado} />
      </div>
    </li>
  );
}

function NuevaFrase({
  temas,
  onCrear,
  onCancel,
}: {
  temas: string[];
  onCrear: (tema: string, texto: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [tema, setTema] = useState(temas[0] ?? "");
  const [otro, setOtro] = useState("");
  const [texto, setTexto] = useState("");
  const [estado, correr] = useEstado();
  const temaFinal = tema === "__otro" ? otro.trim().toLowerCase() : tema;
  return (
    <form
      className="adm-nueva"
      onSubmit={(e) => {
        e.preventDefault();
        if (texto.trim() && temaFinal)
          void correr(() => onCrear(temaFinal, texto.trim()));
      }}
    >
      <TextoLargo
        className="adm-input adm-frase-texto"
        autoFocus
        placeholder="la frase nueva"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="texto"
      />
      <div className="adm-frase-meta">
        <select
          className="adm-input adm-mini"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          aria-label="tema"
        >
          {temas.map((t) => (
            <option key={t} value={t}>
              {t || "sin tema"}
            </option>
          ))}
          <option value="__otro">otro tema…</option>
        </select>
        {tema === "__otro" ? (
          <input
            className="adm-input adm-mini"
            placeholder="tema"
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            aria-label="tema nuevo"
          />
        ) : null}
        <button
          type="submit"
          className="adm-boton"
          disabled={!texto.trim() || !temaFinal}
        >
          agregar
        </button>
        <button type="button" className="adm-link" onClick={onCancel}>
          cancelar
        </button>
        <EstadoTexto estado={estado} />
      </div>
    </form>
  );
}
