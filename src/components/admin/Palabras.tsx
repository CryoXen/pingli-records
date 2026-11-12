"use client";

/**
 * Palabras de la previsión: las fuentes que pueden salir en el destello de
 * palabras (arriba de la previsión). Se guarda en el ajuste "prevision"
 * (fuentes: ids; null = todas). Siempre queda al menos una.
 */
import { useEffect, useRef, useState } from "react";
import {
  FUENTES_DESTELLO,
  GRUPOS_FUENTE,
  type FuenteDestello,
} from "@/config/fuentes-destello";
import palabras from "@/config/palabras.json";
import type { AdminStore } from "@/lib/admin/store";
import { completarPrevision } from "@/lib/contenido/mapear";
import type { AjustesPrevision } from "@/lib/contenido/tipos";
import { EstadoTexto, useEstado } from "./comun";

const TODAS = FUENTES_DESTELLO.map((f) => f.id);
const MUESTRAS = [
  "sustancia",
  "numograma",
  "atención",
  "gravedad",
  "afecto",
  "vacío",
  "máquinas",
  "alegría",
];

export function Palabras({
  store,
  avisar,
}: {
  store: AdminStore;
  avisar: () => void;
}) {
  const [a, setA] = useState<AjustesPrevision | null>(null);
  const [estado, correr] = useEstado();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    store.ajuste<AjustesPrevision>("prevision").then(
      (v) => setA(completarPrevision(v)),
      () => setA(completarPrevision(null)),
    );
  }, [store]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!a) return <p className="adm-gris">cargando…</p>;

  const activas = new Set(
    (a.fuentes ?? TODAS).filter((id) => TODAS.includes(id)),
  );
  if (!activas.size) TODAS.forEach((id) => activas.add(id));

  const guardar = (ids: Set<string>) => {
    if (!ids.size) return; // siempre queda una
    const fuentes =
      ids.size === TODAS.length ? null : TODAS.filter((id) => ids.has(id));
    const nuevo = { ...a, fuentes };
    setA(nuevo);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        void correr(async () => {
          // lo demás del ajuste (tiempos) se respeta tal como esté guardado ahora
          const actual = completarPrevision(
            await store.ajuste<AjustesPrevision>("prevision").catch(() => null),
          );
          await store.guardarAjuste("prevision", { ...actual, fuentes });
          avisar();
        }),
      500,
    );
  };
  const alternar = (id: string) => {
    const n = new Set(activas);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    guardar(n);
  };
  const grupo = (fs: readonly FuenteDestello[], on: boolean) => {
    const n = new Set(activas);
    fs.forEach((f) => (on ? n.add(f.id) : n.delete(f.id)));
    guardar(n);
  };

  return (
    <section
      className="adm-seccion adm-palabras"
      aria-label="palabras de la previsión"
    >
      <p className="adm-gris adm-palabras-nota">
        durante la previsión, arriba, destellan palabras sueltas de los libros (
        {palabras.length} palabras, en español), cada una en una fuente
        distinta. aquí eliges qué fuentes pueden salir.
      </p>
      <div className="adm-barra">
        <span className="adm-cuenta">
          {activas.size} de {TODAS.length} fuentes
        </span>
        <button
          type="button"
          className="adm-link"
          onClick={() => guardar(new Set(TODAS))}
          disabled={activas.size === TODAS.length}
        >
          todas
        </button>
        <EstadoTexto estado={estado} />
      </div>
      {GRUPOS_FUENTE.map((g) => {
        const fs = FUENTES_DESTELLO.filter((f) => f.grupo === g.id);
        const prendidas = fs.filter((f) => activas.has(f.id)).length;
        return (
          <fieldset key={g.id} className="adm-fuentes">
            <legend>
              {g.nombre}{" "}
              <span className="adm-gris">
                {prendidas}/{fs.length}
              </span>
              <button
                type="button"
                className="adm-link"
                onClick={() => grupo(fs, true)}
                disabled={prendidas === fs.length}
              >
                todas
              </button>
              <button
                type="button"
                className="adm-link"
                onClick={() => grupo(fs, false)}
                disabled={!prendidas || prendidas === activas.size}
              >
                ninguna
              </button>
            </legend>
            <ul className="adm-fuentes-lista">
              {fs.map((f, i) => {
                const on = activas.has(f.id);
                return (
                  <li key={f.id}>
                    <label
                      className="adm-fuente"
                      data-grupo={f.grupo}
                      data-apagada={on ? undefined : ""}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={on && activas.size === 1}
                        onChange={() => alternar(f.id)}
                      />
                      <span
                        className="adm-fuente-muestra"
                        style={{
                          fontFamily: `${f.familia}, sans-serif`,
                          fontWeight: f.peso ?? 400,
                          fontStretch: f.ancho ?? "100%",
                        }}
                      >
                        {MUESTRAS[i % MUESTRAS.length]}
                      </span>
                      <span className="adm-fuente-nombre">{f.nombre}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </section>
  );
}
