"use client";

/**
 * Artistas: salen del campo "artista" de los lanzamientos (uno por nombre).
 * Aquí se les pone foto y se les cambia el nombre (renombrar cambia también
 * el de sus lanzamientos). Su lugar y su tamaño se acomodan en el sitio con
 * "editar" (mantén presionado el contador).
 */
import { useEffect, useMemo, useState } from "react";
import { rutaUnica, type AdminStore } from "@/lib/admin/store";
import { claveDeArtista } from "@/lib/contenido/artistas";
import type { FilaArtista, FilaLanzamiento } from "@/lib/contenido/tipos";
import { EstadoTexto, Imagen, useEstado } from "./comun";

type Grupo = {
  clave: string;
  /** Como se muestra: el de la fila guardada o, si no hay, el del primer lanzamiento. */
  nombre: string;
  /** Cómo aparece escrito en sus lanzamientos (puede variar en mayúsculas o espacios). */
  variantes: string[];
  lanzamientos: FilaLanzamiento[];
  fila: FilaArtista | null;
};

/** "Bsulshell" → "bsulshell.jpg" (el nombre de archivo del cuadro vacío, como en el sitio). */
const archivo = (nombre: string) =>
  `${nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "artista"}.jpg`;

export function Artistas({ store, filas, setFilas, lanzamientos, setLanzamientos, avisar }: {
  store: AdminStore;
  filas: FilaArtista[];
  setFilas: (f: (prev: FilaArtista[]) => FilaArtista[]) => void;
  lanzamientos: FilaLanzamiento[];
  setLanzamientos: (f: (prev: FilaLanzamiento[]) => FilaLanzamiento[]) => void;
  avisar: () => void;
}) {
  const grupos = useMemo(() => {
    const porClave = new Map(filas.map((f) => [claveDeArtista(f.nombre), f]));
    const out = new Map<string, Grupo>();
    for (const l of [...lanzamientos].sort((a, b) => a.orden - b.orden)) {
      const nombre = l.artista.trim();
      if (!nombre) continue;
      const clave = claveDeArtista(nombre);
      let g = out.get(clave);
      if (!g) {
        const fila = porClave.get(clave) ?? null;
        g = { clave, nombre: fila?.nombre ?? nombre, variantes: [], lanzamientos: [], fila };
        out.set(clave, g);
      }
      if (!g.variantes.includes(l.artista)) g.variantes.push(l.artista);
      g.lanzamientos.push(l);
    }
    return [...out.values()];
  }, [filas, lanzamientos]);
  const sueltos = lanzamientos.filter((l) => !l.artista.trim());

  const [sel, setSel] = useState<string | null>(grupos[0]?.clave ?? null);
  const actual = grupos.find((g) => g.clave === sel) ?? null;

  return (
    <section className="adm-seccion adm-lanzamientos adm-artistas" aria-label="artistas">
      <div className="adm-columna">
        <div className="adm-barra">
          <span className="adm-cuenta">{grupos.length} artistas</span>
        </div>
        {grupos.length ? (
          <ul className="adm-tarjetas">
            {grupos.map((g) => (
              <li key={g.clave}>
                <button type="button" className="adm-tarjeta" aria-current={sel === g.clave ? "true" : undefined} onClick={() => setSel(g.clave)}>
                  <span className="adm-tarjeta-foto adm-marco">
                    {g.fila?.foto ? <Imagen store={store} carpeta="portadas" ruta={g.fila.foto} /> : archivo(g.nombre)}
                  </span>
                  <span className="adm-tarjeta-texto">
                    <b>{g.nombre}</b>
                    <span>
                      {g.lanzamientos.length} {g.lanzamientos.length === 1 ? "lanzamiento" : "lanzamientos"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-gris">aún no hay artistas: escribe el artista en cada lanzamiento.</p>
        )}
        {sueltos.length ? (
          <p className="adm-gris adm-nota-chica">
            sin artista (sueltos en el plano): {sueltos.map((l) => l.catalogo).join(", ")}
          </p>
        ) : null}
      </div>

      {actual ? (
        <Formulario
          key={actual.clave + (actual.fila?.id ?? "")}
          store={store}
          grupo={actual}
          otros={grupos.filter((g) => g.clave !== actual.clave).map((g) => g.clave)}
          onGuardado={(fila, antes) => {
            setFilas((prev) => [...prev.filter((f) => f.id !== fila.id), fila]);
            if (antes.length) {
              setLanzamientos((prev) => prev.map((l) => (antes.includes(l.artista) ? { ...l, artista: fila.nombre } : l)));
            }
            setSel(claveDeArtista(fila.nombre));
            avisar();
          }}
        />
      ) : grupos.length ? (
        <p className="adm-vacio">elige un artista.</p>
      ) : null}
    </section>
  );
}

function Formulario({ store, grupo, otros, onGuardado }: {
  store: AdminStore;
  grupo: Grupo;
  otros: string[];
  onGuardado: (fila: FilaArtista, antes: string[]) => void;
}) {
  const [nombre, setNombre] = useState(grupo.nombre);
  const [foto, setFoto] = useState<string | null>(grupo.fila?.foto ?? null);
  const [archivoNuevo, setArchivoNuevo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [estado, correr] = useEstado();

  // vista previa de la foto elegida, antes de subirla
  useEffect(() => {
    if (!archivoNuevo) return setVista(null);
    const u = URL.createObjectURL(archivoNuevo);
    setVista(u);
    return () => URL.revokeObjectURL(u);
  }, [archivoNuevo]);

  const limpio = nombre.trim().replace(/\s+/g, " ");
  const repetido = otros.includes(claveDeArtista(limpio));
  const renombrado = limpio !== grupo.nombre || grupo.variantes.some((v) => v !== limpio);
  const cambiado = renombrado || archivoNuevo !== null || foto !== (grupo.fila?.foto ?? null);

  const guardar = () =>
    correr(async () => {
      if (!limpio) throw new Error("el artista necesita un nombre.");
      if (repetido) throw new Error("ya hay otro artista con ese nombre.");
      let ruta = foto;
      if (archivoNuevo) ruta = await store.subir("portadas", archivoNuevo, rutaUnica("artista", archivoNuevo));
      const fila = await store.guardarArtista({ id: grupo.fila?.id ?? null, nombre: limpio, foto: ruta }, renombrado ? grupo.variantes : undefined);
      // la foto anterior ya no se usa
      const anterior = grupo.fila?.foto;
      if (anterior && anterior !== ruta) await store.borrarArchivo("portadas", anterior).catch(() => {});
      setArchivoNuevo(null);
      setFoto(ruta);
      onGuardado(fila, renombrado ? grupo.variantes.filter((v) => v !== limpio) : []);
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
          {vista ? <img className="adm-img" src={vista} alt="" /> : foto ? <Imagen store={store} carpeta="portadas" ruta={foto} /> : archivo(limpio || grupo.nombre)}
        </span>
        <div className="adm-foto-acciones">
          <label className="adm-boton">
            {foto || archivoNuevo ? "cambiar foto" : "subir foto"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setArchivoNuevo(f);
                e.target.value = "";
              }}
            />
          </label>
          {foto || archivoNuevo ? (
            <button
              type="button"
              className="adm-link"
              onClick={() => {
                setArchivoNuevo(null);
                setFoto(null);
              }}
            >
              quitar foto
            </button>
          ) : null}
        </div>
      </div>

      <div className="adm-campos">
        <label className="adm-campo adm-ancho">
          <span>nombre</span>
          <input className="adm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-invalid={!limpio || repetido} required />
        </label>
        <div className="adm-campo adm-completo">
          <span>sus lanzamientos</span>
          <ul className="adm-lista-simple">
            {grupo.lanzamientos.map((l) => (
              <li key={l.catalogo}>
                {l.catalogo} · {l.titulo || "sin título"}
                {l.publicado ? "" : " · oculto"}
              </li>
            ))}
          </ul>
          {renombrado && grupo.lanzamientos.length ? (
            <p className="adm-gris adm-nota-chica">al guardar, sus {grupo.lanzamientos.length} lanzamientos pasan a llamarse “{limpio}”.</p>
          ) : null}
        </div>
        <p className="adm-gris adm-nota-chica adm-completo">
          su lugar y su tamaño en el plano se acomodan en el sitio: mantén presionado el contador, entra y toca «editar».
        </p>
      </div>

      <div className="adm-acciones">
        <button type="submit" className="adm-boton adm-primario" disabled={!cambiado || estado.tipo === "guardando"}>
          guardar
        </button>
        <EstadoTexto estado={estado} />
      </div>
    </form>
  );
}
