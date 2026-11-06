"use client";

/**
 * Lanzamientos: los cuadros del plano. Foto, información, etiquetas, enlaces
 * y dónde están. Los cambios se guardan con "guardar".
 */
import { useEffect, useMemo, useState } from "react";
import { site } from "@/config/site";
import { rutaUnica, type AdminStore } from "@/lib/admin/store";
import type { FilaLanzamiento } from "@/lib/contenido/tipos";
import { Confirmar, Etiquetas, EstadoTexto, Imagen, Numero, TextoLargo, useEstado } from "./comun";

type Borrador = FilaLanzamiento & { archivo?: File | null };

/** Un lugar libre en el plano para un cuadro nuevo: lejos del núcleo y de los demás. */
function lugarLibre(otros: readonly FilaLanzamiento[], tamano: number): { x: number; y: number } {
  const libre = (x: number, y: number) =>
    Math.hypot(x, y) > site.phrases.keepOut.core + tamano &&
    otros.every((o) => Math.abs(o.x - x) > (o.tamano + tamano) / 2 + 260 || Math.abs(o.y - y) > (o.tamano + tamano) / 2 + 260);
  for (let i = 0; i < 400; i++) {
    const r = 1200 + (i / 400) * 3200;
    const a = i * 2.39996; // ángulo dorado: da vueltas sin amontonarse
    const x = Math.round(Math.cos(a) * r);
    const y = Math.round(Math.sin(a) * r);
    if (libre(x, y)) return { x, y };
  }
  return { x: 4800, y: 0 };
}

function siguienteCatalogo(otros: readonly FilaLanzamiento[]): string {
  const n = Math.max(0, ...otros.map((o) => Number(o.catalogo.match(/^pgl(\d+)$/)?.[1] ?? 0))) + 1;
  return `pgl${String(n).padStart(3, "0")}`;
}

export function Lanzamientos({ store, filas, setFilas, avisar }: {
  store: AdminStore;
  filas: FilaLanzamiento[];
  setFilas: (f: (prev: FilaLanzamiento[]) => FilaLanzamiento[]) => void;
  avisar: () => void;
}) {
  const [sel, setSel] = useState<string | null>(filas[0]?.catalogo ?? null);
  const [nuevo, setNuevo] = useState<Borrador | null>(null);
  const ordenadas = useMemo(() => [...filas].sort((a, b) => a.orden - b.orden), [filas]);
  const etiquetas = useMemo(() => [...new Set(filas.flatMap((f) => f.etiquetas))].sort(), [filas]);
  const actual = nuevo ?? filas.find((f) => f.catalogo === sel) ?? null;

  const crear = () => {
    const tamano = 220;
    setNuevo({
      catalogo: siguienteCatalogo(filas),
      titulo: "",
      artista: "",
      anio: new Date().getFullYear(),
      descripcion: "",
      etiquetas: [],
      enlaces: {},
      portada: null,
      ...lugarLibre(filas, tamano),
      tamano,
      publicado: true,
      orden: Math.max(0, ...filas.map((f) => f.orden)) + 1,
    });
  };

  return (
    <section className="adm-seccion adm-lanzamientos" aria-label="lanzamientos">
      <div className="adm-columna">
        <div className="adm-barra">
          <span className="adm-cuenta">{filas.length} lanzamientos</span>
          <button type="button" className="adm-boton" onClick={crear} disabled={!!nuevo}>
            + nuevo
          </button>
        </div>
        <ul className="adm-tarjetas">
          {nuevo ? (
            <li>
              <button type="button" className="adm-tarjeta" aria-current="true">
                <span className="adm-tarjeta-foto adm-marco">{nuevo.catalogo}.jpg</span>
                <span className="adm-tarjeta-texto">
                  <b>{nuevo.titulo || "nuevo"}</b>
                  <span>sin guardar</span>
                </span>
              </button>
            </li>
          ) : null}
          {ordenadas.map((f) => (
            <li key={f.catalogo}>
              <button
                type="button"
                className="adm-tarjeta"
                aria-current={!nuevo && sel === f.catalogo ? "true" : undefined}
                data-oculto={!f.publicado || undefined}
                onClick={() => {
                  setNuevo(null);
                  setSel(f.catalogo);
                }}
              >
                <span className="adm-tarjeta-foto adm-marco">
                  {f.portada ? <Imagen store={store} carpeta="portadas" ruta={f.portada} /> : `${f.catalogo}.jpg`}
                </span>
                <span className="adm-tarjeta-texto">
                  <b>{f.titulo || "sin título"}</b>
                  <span>
                    {f.catalogo}
                    {f.artista ? ` · ${f.artista}` : ""}
                    {f.publicado ? "" : " · oculto"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {actual ? (
        <Formulario
          key={nuevo ? "nuevo" : actual.catalogo}
          store={store}
          inicial={actual}
          esNuevo={!!nuevo}
          etiquetas={etiquetas}
          catalogos={filas.map((f) => f.catalogo)}
          onCancelar={nuevo ? () => setNuevo(null) : undefined}
          onGuardado={(f, antes) => {
            setFilas((prev) => [...prev.filter((x) => x.catalogo !== f.catalogo && x.catalogo !== antes), f]);
            setNuevo(null);
            setSel(f.catalogo);
            avisar();
          }}
          onBorrado={(catalogo) => {
            setFilas((prev) => prev.filter((x) => x.catalogo !== catalogo));
            setSel(null);
            avisar();
          }}
        />
      ) : (
        <p className="adm-vacio">elige un lanzamiento o crea uno nuevo.</p>
      )}
    </section>
  );
}

function Formulario({ store, inicial, esNuevo, etiquetas, catalogos, onGuardado, onBorrado, onCancelar }: {
  store: AdminStore;
  inicial: Borrador;
  esNuevo: boolean;
  etiquetas: string[];
  catalogos: string[];
  onGuardado: (f: FilaLanzamiento, antes?: string) => void;
  onBorrado: (catalogo: string) => void;
  onCancelar?: () => void;
}) {
  const [b, setB] = useState<Borrador>(inicial);
  const [estado, correr] = useEstado();
  const [vista, setVista] = useState<string | null>(null);
  const set = (n: Partial<Borrador>) => setB((prev) => ({ ...prev, ...n }));

  // vista previa de la foto elegida, antes de subirla
  useEffect(() => {
    if (!b.archivo) return setVista(null);
    const u = URL.createObjectURL(b.archivo);
    setVista(u);
    return () => URL.revokeObjectURL(u);
  }, [b.archivo]);

  const catalogoOk = /^[a-z0-9_-]+$/.test(b.catalogo) && (b.catalogo === inicial.catalogo && !esNuevo ? true : !catalogos.includes(b.catalogo));
  const cambiado = JSON.stringify({ ...b, archivo: undefined }) !== JSON.stringify({ ...inicial, archivo: undefined }) || b.archivo !== undefined || esNuevo;

  const guardar = () =>
    correr(async () => {
      if (!catalogoOk) throw new Error("el catálogo debe ser único y solo llevar letras minúsculas, números, - o _.");
      let portada = b.portada;
      if (b.archivo) portada = await store.subir("portadas", b.archivo, rutaUnica(b.catalogo, b.archivo));
      const { archivo: _archivo, ...resto } = b;
      void _archivo;
      const fila: FilaLanzamiento = { ...resto, portada, titulo: b.titulo.trim(), artista: b.artista.trim() };
      await store.guardarLanzamiento(fila, esNuevo ? undefined : inicial.catalogo);
      // la foto anterior ya no se usa
      if (inicial.portada && inicial.portada !== portada && !esNuevo) await store.borrarArchivo("portadas", inicial.portada).catch(() => {});
      onGuardado(fila, esNuevo ? undefined : inicial.catalogo);
    });

  return (
    <form
      className="adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <div className="adm-foto">
        <span className="adm-marco adm-foto-marco" style={{ aspectRatio: "1" }}>
          {vista ? <img className="adm-img" src={vista} alt="" /> : b.portada ? <Imagen store={store} carpeta="portadas" ruta={b.portada} /> : `${b.catalogo}.jpg`}
        </span>
        <div className="adm-foto-acciones">
          <label className="adm-boton">
            {b.portada || b.archivo ? "cambiar foto" : "subir foto"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) set({ archivo: f });
                e.target.value = "";
              }}
            />
          </label>
          {b.portada || b.archivo ? (
            <button type="button" className="adm-link" onClick={() => set({ archivo: null, portada: null })}>
              quitar foto
            </button>
          ) : null}
        </div>
      </div>

      <div className="adm-campos">
        <label className="adm-campo">
          <span>catálogo</span>
          <input className="adm-input" value={b.catalogo} onChange={(e) => set({ catalogo: e.target.value.toLowerCase().trim() })} aria-invalid={!catalogoOk} required />
        </label>
        <label className="adm-campo adm-ancho">
          <span>título</span>
          <input className="adm-input" value={b.titulo} onChange={(e) => set({ titulo: e.target.value })} />
        </label>
        <label className="adm-campo">
          <span>artista</span>
          <input className="adm-input" value={b.artista} onChange={(e) => set({ artista: e.target.value })} />
        </label>
        <label className="adm-campo adm-corto">
          <span>año</span>
          <input
            className="adm-input"
            inputMode="numeric"
            value={b.anio ?? ""}
            onChange={(e) => set({ anio: e.target.value.trim() ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
          />
        </label>
        <label className="adm-campo adm-completo">
          <span>descripción — una línea en blanco separa párrafos</span>
          <TextoLargo className="adm-input" value={b.descripcion} onChange={(e) => set({ descripcion: e.target.value })} />
        </label>
        <div className="adm-campo adm-completo">
          <span>etiquetas</span>
          <Etiquetas value={b.etiquetas} onChange={(etiquetas) => set({ etiquetas })} sugerencias={etiquetas} />
        </div>
        {site.stores.map((s) => (
          <label key={s.id} className="adm-campo adm-ancho">
            <span>{s.label}</span>
            <input
              className="adm-input"
              value={b.enlaces[s.id] ?? ""}
              placeholder={s.id === "soulseek" ? "usuario, carpeta o slsk://" : "https://"}
              onChange={(e) => {
                const enlaces = { ...b.enlaces };
                if (e.target.value.trim()) enlaces[s.id] = e.target.value.trim();
                else delete enlaces[s.id];
                set({ enlaces });
              }}
            />
          </label>
        ))}
        <fieldset className="adm-campo adm-completo adm-posicion">
          <legend>en el plano — como las coordenadas de arriba a la derecha del sitio</legend>
          <label>
            x <Numero label="x" value={b.x} onChange={(x) => set({ x })} />
          </label>
          <label>
            y <Numero label="y" value={-b.y || 0} onChange={(y) => set({ y: -y })} />
          </label>
          <label>
            tamaño <Numero label="tamaño" value={b.tamano} onChange={(t) => set({ tamano: Math.max(0.1, t) })} />
          </label>
        </fieldset>
        <label className="adm-check adm-completo">
          <input type="checkbox" checked={b.publicado} onChange={(e) => set({ publicado: e.target.checked })} />
          publicado (si no, no aparece en el sitio)
        </label>
      </div>

      <div className="adm-acciones">
        <button type="submit" className="adm-boton adm-primario" disabled={!cambiado || estado.tipo === "guardando"}>
          guardar
        </button>
        {onCancelar ? (
          <button type="button" className="adm-link" onClick={onCancelar}>
            cancelar
          </button>
        ) : null}
        {!esNuevo ? (
          <Confirmar
            onConfirm={() =>
              void correr(async () => {
                await store.borrarLanzamiento(inicial.catalogo);
                if (inicial.portada) await store.borrarArchivo("portadas", inicial.portada).catch(() => {});
                onBorrado(inicial.catalogo);
              })
            }
          >
            borrar lanzamiento
          </Confirmar>
        ) : null}
        <EstadoTexto estado={estado} />
      </div>
    </form>
  );
}
