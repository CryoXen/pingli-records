"use client";

/**
 * El panel de admin de pingli records: entrar, y después frases,
 * lanzamientos, artistas, previsiones, música y sonidos. Funciona con cualquier AdminStore (Supabase en
 * el sitio, el navegador en la vista previa).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import type { AdminStore } from "@/lib/admin/store";
import type { FilaArtista, FilaFrase, FilaLanzamiento, FilaPrevision } from "@/lib/contenido/tipos";
import { Artistas } from "./Artistas";
import { Frases } from "./Frases";
import { Lanzamientos } from "./Lanzamientos";
import { Musica } from "./Musica";
import { Previsiones } from "./Previsiones";
import { Sonidos } from "./Sonidos";

type Pestana = "frases" | "lanzamientos" | "artistas" | "previsiones" | "música" | "sonidos";
const PESTANAS: readonly Pestana[] = ["frases", "lanzamientos", "artistas", "previsiones", "música", "sonidos"];
const PESTANA_KEY = "pingli:admin:pestana";

type Fase = { tipo: "cargando" } | { tipo: "entrar" } | { tipo: "sin-permiso"; email: string } | { tipo: "dentro"; email: string } | { tipo: "error"; msg: string };

export default function Admin({ store }: { store: AdminStore }) {
  const [fase, setFase] = useState<Fase>({ tipo: "cargando" });

  const revisar = useCallback(async () => {
    try {
      const s = await store.sesion();
      if (!s) return setFase({ tipo: "entrar" });
      setFase((await store.esAdmin()) ? { tipo: "dentro", email: s.email } : { tipo: "sin-permiso", email: s.email });
    } catch (e) {
      setFase({ tipo: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }, [store]);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  return (
    <div className="adm">
      {store.nota ? <p className="adm-nota">{store.nota}</p> : null}
      {fase.tipo === "cargando" ? <p className="adm-centro adm-gris">cargando…</p> : null}
      {fase.tipo === "error" ? <p className="adm-centro adm-gris" role="alert">{fase.msg}</p> : null}
      {fase.tipo === "entrar" ? <Entrar store={store} onDentro={revisar} /> : null}
      {fase.tipo === "sin-permiso" ? (
        <div className="adm-centro">
          <p>{fase.email} no es admin.</p>
          <button type="button" className="adm-link" onClick={() => store.salir().then(revisar)}>
            salir
          </button>
        </div>
      ) : null}
      {fase.tipo === "dentro" ? <Panel store={store} email={fase.email} onSalir={() => store.salir().then(revisar)} /> : null}
    </div>
  );
}

function Entrar({ store, onDentro }: { store: AdminStore; onDentro: () => void }) {
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
        <input className="adm-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="adm-campo">
        <span>contraseña</span>
        <input className="adm-input" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
      </label>
      <button type="submit" className="adm-boton adm-primario" disabled={enviando}>
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

function Panel({ store, email, onSalir }: { store: AdminStore; email: string; onSalir: () => void }) {
  const [pestana, setPestana] = useState<Pestana>(() => {
    try {
      const p = sessionStorage.getItem(PESTANA_KEY) as Pestana | null;
      return p && PESTANAS.includes(p) ? p : "frases";
    } catch {
      return "frases";
    }
  });
  const [frases, setFrases] = useState<FilaFrase[] | null>(null);
  const [lanzamientos, setLanzamientos] = useState<FilaLanzamiento[] | null>(null);
  const [previsiones, setPrevisiones] = useState<FilaPrevision[] | null>(null);
  const [artistas, setArtistas] = useState<FilaArtista[] | null>(null);
  const [error, setError] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    Promise.all([store.frases(), store.lanzamientos(), store.previsiones(), store.artistas()]).then(
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
  return (
    <>
      <header className="adm-arriba">
        <a className="adm-marca" href={store.sitio}>
          {site.name} <span>admin</span>
        </a>
        <nav className="adm-pestanas" aria-label="secciones">
          {PESTANAS.map((p) => (
            <button key={p} type="button" className="adm-pestana" aria-current={pestana === p ? "page" : undefined} onClick={() => setPestana(p)}>
              {p}
            </button>
          ))}
        </nav>
        <div className="adm-sesion">
          <span className="adm-gris" aria-live="polite">
            {pendiente ? "publicando…" : ""}
          </span>
          <span className="adm-gris">{email}</span>
          <a className="adm-link" href={store.sitio}>
            ver sitio
          </a>
          <button type="button" className="adm-link" onClick={onSalir}>
            salir
          </button>
        </div>
      </header>
      <main className="adm-cuerpo">
        {error ? (
          <p className="adm-error" role="alert">
            {error}
          </p>
        ) : null}
        {!cargado && !error ? <p className="adm-gris">cargando…</p> : null}
        {cargado && pestana === "frases" ? (
          <Frases store={store} filas={frases} setFilas={(f) => setFrases((p) => f(p ?? []))} avisar={avisar} />
        ) : null}
        {cargado && pestana === "lanzamientos" ? (
          <Lanzamientos store={store} filas={lanzamientos} setFilas={(f) => setLanzamientos((p) => f(p ?? []))} avisar={avisar} />
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
          <Previsiones store={store} filas={previsiones} setFilas={(f) => setPrevisiones((p) => f(p ?? []))} avisar={avisar} />
        ) : null}
        {cargado && pestana === "música" ? <Musica store={store} avisar={avisar} /> : null}
        {cargado && pestana === "sonidos" ? <Sonidos store={store} avisar={avisar} /> : null}
      </main>
    </>
  );
}
