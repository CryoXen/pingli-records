"use client";

/**
 * El panel de admin de pingli records: entrar, y después una barra lateral
 * con las secciones agrupadas (plano, previsión, sonido). En pantallas chicas
 * la barra se guarda tras el botón "menú". Funciona con cualquier AdminStore
 * (Supabase en el sitio, el navegador en la vista previa).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import type { AdminStore } from "@/lib/admin/store";
import type {
  FilaArtista,
  FilaFrase,
  FilaLanzamiento,
  FilaPrevision,
} from "@/lib/contenido/tipos";
import { Artistas } from "./Artistas";
import { Frases } from "./Frases";
import { Lanzamientos } from "./Lanzamientos";
import { Musica } from "./Musica";
import { Previsiones } from "./Previsiones";
import { Sonidos } from "./Sonidos";

type Pestana =
  "frases" | "lanzamientos" | "artistas" | "previsiones" | "música" | "sonidos";
/** El menú: grupos y, dentro, sus secciones (con el nombre que se muestra). */
const MENU: readonly {
  grupo: string;
  secciones: readonly { id: Pestana; nombre: string }[];
}[] = [
  {
    grupo: "plano",
    secciones: [
      { id: "frases", nombre: "frases" },
      { id: "lanzamientos", nombre: "lanzamientos" },
      { id: "artistas", nombre: "artistas" },
    ],
  },
  {
    grupo: "previsión",
    secciones: [{ id: "previsiones", nombre: "imágenes y videos" }],
  },
  {
    grupo: "sonido",
    secciones: [
      { id: "música", nombre: "música" },
      { id: "sonidos", nombre: "sonidos" },
    ],
  },
];
const PESTANAS: readonly Pestana[] = MENU.flatMap((g) =>
  g.secciones.map((x) => x.id),
);
const PESTANA_KEY = "pingli:admin:pestana";

type Fase =
  | { tipo: "cargando" }
  | { tipo: "entrar" }
  | { tipo: "sin-permiso"; email: string }
  | { tipo: "dentro"; email: string }
  | { tipo: "error"; msg: string };

export default function Admin({ store }: { store: AdminStore }) {
  const [fase, setFase] = useState<Fase>({ tipo: "cargando" });

  const revisar = useCallback(async () => {
    try {
      const s = await store.sesion();
      if (!s) return setFase({ tipo: "entrar" });
      setFase(
        (await store.esAdmin())
          ? { tipo: "dentro", email: s.email }
          : { tipo: "sin-permiso", email: s.email },
      );
    } catch (e) {
      setFase({
        tipo: "error",
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  }, [store]);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  return (
    <div className="adm">
      {store.nota ? <p className="adm-nota">{store.nota}</p> : null}
      {fase.tipo === "cargando" ? (
        <p className="adm-centro adm-gris">cargando…</p>
      ) : null}
      {fase.tipo === "error" ? (
        <p className="adm-centro adm-gris" role="alert">
          {fase.msg}
        </p>
      ) : null}
      {fase.tipo === "entrar" ? (
        <Entrar store={store} onDentro={revisar} />
      ) : null}
      {fase.tipo === "sin-permiso" ? (
        <div className="adm-centro">
          <p>{fase.email} no es admin.</p>
          <button
            type="button"
            className="adm-link"
            onClick={() => store.salir().then(revisar)}
          >
            salir
          </button>
        </div>
      ) : null}
      {fase.tipo === "dentro" ? (
        <Panel
          store={store}
          email={fase.email}
          onSalir={() => store.salir().then(revisar)}
        />
      ) : null}
    </div>
  );
}

function Entrar({
  store,
  onDentro,
}: {
  store: AdminStore;
  onDentro: () => void;
}) {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="adm-entrar"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        setError("");
        try {
          await store.entrar(email.trim(), clave);
          onDentro();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setEnviando(false);
        }
      }}
    >
      <h1 className="adm-marca">
        {site.name} <span>admin</span>
      </h1>
      <label className="adm-campo">
        <span>correo</span>
        <input
          className="adm-input"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="adm-campo">
        <span>contraseña</span>
        <input
          className="adm-input"
          type="password"
          autoComplete="current-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="adm-boton adm-primario"
        disabled={enviando}
      >
        {enviando ? "entrando…" : "entrar"}
      </button>
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Panel({
  store,
  email,
  onSalir,
}: {
  store: AdminStore;
  email: string;
  onSalir: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>(() => {
    try {
      const p = sessionStorage.getItem(PESTANA_KEY) as Pestana | null;
      return p && PESTANAS.includes(p) ? p : "frases";
    } catch {
      return "frases";
    }
  });
  const [frases, setFrases] = useState<FilaFrase[] | null>(null);
  const [lanzamientos, setLanzamientos] = useState<FilaLanzamiento[] | null>(
    null,
  );
  const [previsiones, setPrevisiones] = useState<FilaPrevision[] | null>(null);
  const [artistas, setArtistas] = useState<FilaArtista[] | null>(null);
  const [error, setError] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      store.frases(),
      store.lanzamientos(),
      store.previsiones(),
      store.artistas(),
    ]).then(
      ([f, l, p, a]) => {
        setFrases(f);
        setLanzamientos(l);
        setPrevisiones(p);
        setArtistas(a);
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [store]);

  useEffect(() => {
    try {
      sessionStorage.setItem(PESTANA_KEY, pestana);
    } catch {
      /* sin almacenamiento */
    }
  }, [pestana]);

  // después de guardar, el sitio se vuelve a armar (una vez, aunque se guarden varias cosas seguidas)
  const avisar = useCallback(() => {
    setPendiente(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      store.publicar().finally(() => setPendiente(false));
    }, 1200);
  }, [store]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const cargado = frases && lanzamientos && previsiones && artistas;
  const [menu, setMenu] = useState(false);
  const actual = MENU.flatMap((g) =>
    g.secciones.map((x) => ({ ...x, grupo: g.grupo })),
  ).find((x) => x.id === pestana);
  // Esc cierra el menú (en pantallas chicas)
  useEffect(() => {
    if (!menu) return;
    const al = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", al);
    return () => window.removeEventListener("keydown", al);
  }, [menu]);
  return (
    <>
      <header className="adm-arriba">
        <button
          type="button"
          className="adm-menu-boton"
          aria-expanded={menu}
          aria-controls="adm-lado"
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? "cerrar" : "menú"}
        </button>
        <a className="adm-marca" href={store.sitio}>
          {site.name} <span>admin</span>
        </a>
        <span className="adm-donde" aria-hidden="true">
          {actual ? `${actual.grupo} · ${actual.nombre}` : ""}
        </span>
        <div className="adm-sesion">
          <span className="adm-gris" aria-live="polite">
            {pendiente ? "publicando…" : ""}
          </span>
          <span className="adm-gris adm-correo">{email}</span>
          <a className="adm-link" href={store.sitio}>
            ver sitio
          </a>
          <button type="button" className="adm-link" onClick={onSalir}>
            salir
          </button>
        </div>
      </header>
      <div className="adm-armazon" data-menu={menu ? "" : undefined}>
        <nav className="adm-lado" id="adm-lado" aria-label="secciones">
          {MENU.map((g) => (
            <div key={g.grupo} className="adm-lado-grupo">
              <p className="adm-lado-titulo">{g.grupo}</p>
              <ul>
                {g.secciones.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      className="adm-lado-opcion"
                      aria-current={pestana === x.id ? "page" : undefined}
                      onClick={() => {
                        setPestana(x.id);
                        setMenu(false);
                      }}
                    >
                      {x.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="adm-velo"
          aria-label="cerrar el menú"
          tabIndex={-1}
          onClick={() => setMenu(false)}
        />
        <main className="adm-cuerpo">
          {error ? (
            <p className="adm-error" role="alert">
              {error}
            </p>
          ) : null}
          {!cargado && !error ? <p className="adm-gris">cargando…</p> : null}
          {cargado && pestana === "frases" ? (
            <Frases
              store={store}
              filas={frases}
              setFilas={(f) => setFrases((p) => f(p ?? []))}
              avisar={avisar}
            />
          ) : null}
          {cargado && pestana === "lanzamientos" ? (
            <Lanzamientos
              store={store}
              filas={lanzamientos}
              setFilas={(f) => setLanzamientos((p) => f(p ?? []))}
              avisar={avisar}
            />
          ) : null}
          {cargado && pestana === "artistas" ? (
            <Artistas
              store={store}
              filas={artistas}
              setFilas={(f) => setArtistas((p) => f(p ?? []))}
              lanzamientos={lanzamientos}
              setLanzamientos={(f) => setLanzamientos((p) => f(p ?? []))}
              avisar={avisar}
            />
          ) : null}
          {cargado && pestana === "previsiones" ? (
            <Previsiones
              store={store}
              filas={previsiones}
              setFilas={(f) => setPrevisiones((p) => f(p ?? []))}
              avisar={avisar}
            />
          ) : null}
          {cargado && pestana === "música" ? (
            <Musica store={store} avisar={avisar} />
          ) : null}
          {cargado && pestana === "sonidos" ? (
            <Sonidos store={store} avisar={avisar} />
          ) : null}
        </main>
      </div>
    </>
  );
}
