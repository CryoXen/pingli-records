"use client";

/**
 * Música: las canciones de fondo de cada mundo (se pueden subir varias y se
 * elige cuál suena, o silencio) y la canción final del contador (la que
 * suena mientras se ve una foto de la previsión). Cada canción se nivela
 * sola al subirla (con la misma sonoridad que "003 Piaga") y su volumen se
 * puede mover. Se puede escuchar aquí antes de elegirla.
 */
import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import { analizarSonido, LUFS_MUSICA } from "@/lib/admin/analizar-sonido";
import { rutaUnica, type AdminStore } from "@/lib/admin/store";
import { tiempo } from "@/lib/admin/video";
import { completarMusica, finalOriginal } from "@/lib/contenido/mapear";
import type { AjustesMusica, CancionFondo, Mundo } from "@/lib/contenido/tipos";
import { Confirmar, EstadoTexto, useEstado } from "./comun";

const MUNDOS: readonly Mundo[] = ["claro", "oscuro"];
const LADO = { claro: "light", oscuro: "dark" } as const;
/** Supabase (plan gratis) no acepta archivos de más de 50 MB. */
const MAX_MB = 45;
/** Rango del volumen de cada canción, en dB. */
const DB_MIN = -24;
const DB_MAX = 12;

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const db = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`;

/** Para escuchar aquí: una canción a la vez, con su volumen y sin el silencio del inicio. */
function useReproductor() {
  const ctx = useRef<AudioContext | null>(null);
  const el = useRef<HTMLAudioElement | null>(null);
  const gain = useRef<GainNode | null>(null);
  const [sonando, setSonando] = useState<string | null>(null);
  useEffect(
    () => () => {
      el.current?.pause();
      void ctx.current?.close();
    },
    [],
  );
  const parar = () => {
    el.current?.pause();
    setSonando(null);
  };
  const tocar = async (clave: string, url: string, gainDb: number, inicio: number) => {
    if (sonando === clave) return parar();
    if (!ctx.current) {
      const c = new AudioContext();
      const a = new Audio();
      a.crossOrigin = "anonymous"; // las de Supabase vienen de otro dominio
      a.preload = "auto";
      const g = c.createGain();
      c.createMediaElementSource(a).connect(g).connect(c.destination);
      a.addEventListener("ended", () => setSonando(null));
      ctx.current = c;
      el.current = a;
      gain.current = g;
    }
    await ctx.current.resume();
    const a = el.current!;
    a.pause();
    gain.current!.gain.value = Math.pow(10, gainDb / 20);
    a.src = inicio > 0.01 ? `${url}#t=${inicio.toFixed(2)}` : url;
    setSonando(clave);
    try {
      await a.play();
    } catch (e) {
      setSonando(null);
      throw e;
    }
  };
  /** Mover el volumen mientras suena. */
  const volumen = (clave: string, gainDb: number) => {
    if (sonando === clave && gain.current && ctx.current) gain.current.gain.setTargetAtTime(Math.pow(10, gainDb / 20), ctx.current.currentTime, 0.03);
  };
  return { tocar, parar, volumen, sonando };
}
type Reproductor = ReturnType<typeof useReproductor>;

export function Musica({ store, avisar }: { store: AdminStore; avisar: () => void }) {
  const [a, setA] = useState<AjustesMusica | null>(null);
  const [error, setError] = useState("");
  const [estado, correr] = useEstado();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rep = useReproductor();

  useEffect(() => {
    store.ajuste<AjustesMusica>("musica").then(
      (v) => setA(completarMusica(v)),
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [store]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (error) return <p className="adm-error" role="alert">{error}</p>;
  if (!a) return <p className="adm-gris">cargando…</p>;

  /** Guarda ya (elegir, subir, borrar) o un momento después (mover un volumen). */
  const guardar = (n: AjustesMusica, despues = false) => {
    setA(n);
    clearTimeout(timer.current);
    const ir = () =>
      correr(async () => {
        await store.guardarAjuste("musica", n);
        avisar();
      });
    if (despues) timer.current = setTimeout(() => void ir(), 500);
    else return ir();
  };

  const urlDe = async (ruta: string | null, original: string) =>
    ruta ? store.url("sonidos", ruta) : store.recurso ? store.recurso(original) : original;

  return (
    <section className="adm-seccion" aria-label="música">
      <p className="adm-gris adm-nota-chica adm-musica-nota">
        la marcada suena en ese mundo, en loop. al subir una canción se nivela sola (igual de fuerte que “{site.audio.tracks.light.title}”); el
        volumen de cada una se puede mover. en el sitio, cada visitante además tiene su “vol”. <EstadoTexto estado={estado} />
      </p>

      <div className="adm-musica">
        {MUNDOS.map((m) => (
          <Fondo
            key={m}
            mundo={m}
            a={a}
            rep={rep}
            urlDe={urlDe}
            guardar={guardar}
            subir={(f) => store.subir("sonidos", f, rutaUnica(`fondo-${m}`, f))}
            borrarArchivo={(ruta) => store.borrarArchivo("sonidos", ruta).catch(() => {})}
          />
        ))}
      </div>

      <Final
        a={a}
        rep={rep}
        urlDe={urlDe}
        guardar={guardar}
        subir={(f) => store.subir("sonidos", f, rutaUnica("final", f))}
        borrarArchivo={(ruta) => store.borrarArchivo("sonidos", ruta).catch(() => {})}
      />
    </section>
  );
}

/** Mide una canción al subirla: su nivel y sus silencios. */
async function medir(f: File) {
  if (f.size > MAX_MB * 1024 * 1024) throw new Error(`pesa más de ${MAX_MB} MB.`);
  try {
    return await analizarSonido(await f.arrayBuffer(), LUFS_MUSICA);
  } catch {
    throw new Error("no se pudo leer como audio.");
  }
}

const sinExtension = (n: string) => n.replace(/\.[^.]+$/, "");

function Fondo({ mundo, a, rep, urlDe, guardar, subir, borrarArchivo }: {
  mundo: Mundo;
  a: AjustesMusica;
  rep: Reproductor;
  urlDe: (ruta: string | null, original: string) => Promise<string>;
  guardar: (n: AjustesMusica, despues?: boolean) => Promise<boolean> | undefined;
  subir: (f: File) => Promise<string>;
  borrarArchivo: (ruta: string) => Promise<void>;
}) {
  const f = a.fondo[mundo];
  const [subiendo, setSubiendo] = useState("");
  const [error, setError] = useState("");
  const original = site.audio.tracks[LADO[mundo]].src;
  const poner = (fondo: AjustesMusica["fondo"][Mundo], despues = false) => guardar({ ...a, fondo: { ...a.fondo, [mundo]: fondo } }, despues);
  const cambiar = (id: string, n: Partial<CancionFondo>, despues = false) =>
    poner({ ...f, canciones: f.canciones.map((c) => (c.id === id ? { ...c, ...n } : c)) }, despues);
  const grupo = `fondo-${mundo}`;

  return (
    <div className="adm-fondo">
      <h3 className="adm-grupo-titulo">
        fondo · {mundo}
      </h3>
      <ul className="adm-canciones" role="radiogroup" aria-label={`canción de fondo, mundo ${mundo}`}>
        {f.canciones.map((c) => {
          const clave = `${mundo}:${c.id}`;
          return (
            <li key={c.id} className="adm-cancion" data-activa={f.activa === c.id || undefined}>
              <label className="adm-check adm-cancion-nombre">
                <input type="radio" name={grupo} checked={f.activa === c.id} onChange={() => void poner({ ...f, activa: c.id })} />
                <span>
                  {c.nombre}
                  <span className="adm-gris">
                    {c.id === "original" ? " · original" : ""}
                    {c.duracion ? ` · ${tiempo(c.duracion, false)}` : ""}
                  </span>
                </span>
              </label>
              <div className="adm-cancion-ajustes">
                <button
                  type="button"
                  className="adm-boton"
                  aria-pressed={rep.sonando === clave}
                  onClick={() => {
                    setError("");
                    void urlDe(c.ruta, original)
                      .then((u) => rep.tocar(clave, u, c.gainDb, c.inicio))
                      .catch((e) => setError(e instanceof Error ? e.message : "no se pudo reproducir"));
                  }}
                >
                  {rep.sonando === clave ? "■ parar" : "▶ escuchar"}
                </button>
                <Volumen
                  valor={c.gainDb}
                  auto={c.auto}
                  onChange={(v) => {
                    rep.volumen(clave, v);
                    void cambiar(c.id, { gainDb: v }, true);
                  }}
                />
                {c.id !== "original" ? (
                  <Confirmar
                    onConfirm={() => {
                      if (rep.sonando === clave) rep.parar();
                      void poner({ activa: f.activa === c.id ? "original" : f.activa, canciones: f.canciones.filter((x) => x.id !== c.id) });
                      if (c.ruta) void borrarArchivo(c.ruta);
                    }}
                  >
                    borrar
                  </Confirmar>
                ) : null}
              </div>
            </li>
          );
        })}
        <li className="adm-cancion" data-activa={f.activa === null || undefined}>
          <label className="adm-check adm-cancion-nombre">
            <input type="radio" name={grupo} checked={f.activa === null} onChange={() => void poner({ ...f, activa: null })} />
            <span>
              silencio <span className="adm-gris">· sin música en este mundo</span>
            </span>
          </label>
        </li>
      </ul>
      <div className="adm-frase-meta">
        <label className="adm-boton">
          + subir canción
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setError("");
              setSubiendo(`midiendo ${file.name}…`);
              void (async () => {
                try {
                  const an = await medir(file);
                  setSubiendo(`subiendo ${file.name}…`);
                  const ruta = await subir(file);
                  const nueva: CancionFondo = {
                    id: nuevoId(),
                    ruta,
                    nombre: sinExtension(file.name),
                    gainDb: an.gainDb,
                    auto: an.gainDb,
                    inicio: an.inicio,
                    fin: an.fin,
                    duracion: Math.round(an.duracion * 10) / 10,
                  };
                  await poner({ ...f, canciones: [...f.canciones, nueva] });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "no se pudo subir");
                } finally {
                  setSubiendo("");
                }
              })();
            }}
          />
        </label>
        {subiendo ? <span className="adm-gris">{subiendo}</span> : null}
      </div>
      {error ? <span className="adm-estado" data-tipo="error">{error}</span> : null}
    </div>
  );
}

function Final({ a, rep, urlDe, guardar, subir, borrarArchivo }: {
  a: AjustesMusica;
  rep: Reproductor;
  urlDe: (ruta: string | null, original: string) => Promise<string>;
  guardar: (n: AjustesMusica, despues?: boolean) => Promise<boolean> | undefined;
  subir: (f: File) => Promise<string>;
  borrarArchivo: (ruta: string) => Promise<void>;
}) {
  const s = a.final;
  const [subiendo, setSubiendo] = useState("");
  const [error, setError] = useState("");
  const original = site.cycle.song?.src ?? null;
  const poner = (n: Partial<AjustesMusica["final"]>, despues = false) => guardar({ ...a, final: { ...s, ...n } }, despues);
  const clave = "final";
  const nombre = s.ruta ? s.nombre ?? s.ruta : original ? `original · ${original.split("/").pop()}` : "sin canción";

  return (
    <div className="adm-final" data-inactivo={!s.activo || undefined}>
      <h3 className="adm-grupo-titulo">canción final del contador</h3>
      <p className="adm-gris adm-nota-chica">
        suena desde 00:00 mientras se ve una foto de la previsión (la música de fondo se corta). con los videos suena el video. apagada: durante
        la foto sigue la música de fondo.
      </p>
      <div className="adm-cancion">
        <span className="adm-cancion-nombre">
          {nombre}
          {s.duracion ? <span className="adm-gris"> · {tiempo(s.duracion, false)}</span> : null}
        </span>
        <div className="adm-cancion-ajustes">
          <button
            type="button"
            className="adm-boton"
            disabled={!s.ruta && !original}
            aria-pressed={rep.sonando === clave}
            onClick={() => {
              setError("");
              void urlDe(s.ruta, original ?? "")
                .then((u) => rep.tocar(clave, u, s.gainDb, s.inicio))
                .catch((e) => setError(e instanceof Error ? e.message : "no se pudo reproducir"));
            }}
          >
            {rep.sonando === clave ? "■ parar" : "▶ escuchar"}
          </button>
          <Volumen
            valor={s.gainDb}
            auto={s.auto}
            onChange={(v) => {
              rep.volumen(clave, v);
              void poner({ gainDb: v }, true);
            }}
          />
          <label className="adm-check">
            <input type="checkbox" checked={s.activo} onChange={(e) => void poner({ activo: e.target.checked })} />
            suena
          </label>
        </div>
      </div>
      <div className="adm-frase-meta">
        <label className="adm-boton">
          cambiar
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setError("");
              setSubiendo(`midiendo ${file.name}…`);
              void (async () => {
                try {
                  const an = await medir(file);
                  setSubiendo(`subiendo ${file.name}…`);
                  const ruta = await subir(file);
                  const viejo = s.ruta;
                  if (rep.sonando === clave) rep.parar();
                  await poner({ ruta, nombre: file.name, activo: true, gainDb: an.gainDb, auto: an.gainDb, inicio: an.inicio, duracion: Math.round(an.duracion * 10) / 10 });
                  if (viejo) void borrarArchivo(viejo);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "no se pudo subir");
                } finally {
                  setSubiendo("");
                }
              })();
            }}
          />
        </label>
        {s.ruta ? (
          <button
            type="button"
            className="adm-link"
            onClick={() => {
              const viejo = s.ruta;
              if (rep.sonando === clave) rep.parar();
              void poner({ ...finalOriginal(), activo: s.activo });
              if (viejo) void borrarArchivo(viejo);
            }}
          >
            volver al original
          </button>
        ) : null}
        {subiendo ? <span className="adm-gris">{subiendo}</span> : null}
      </div>
      {error ? <span className="adm-estado" data-tipo="error">{error}</span> : null}
    </div>
  );
}

/** El volumen de una canción, en dB, con un atajo para volver al nivelado automático. */
function Volumen({ valor, auto, onChange }: { valor: number; auto: number; onChange: (v: number) => void }) {
  return (
    <span className="adm-vol">
      <input
        type="range"
        min={DB_MIN}
        max={DB_MAX}
        step={0.5}
        value={valor}
        aria-label="volumen"
        aria-valuetext={db(valor)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="adm-vol-valor">{db(valor)}</span>
      {Math.abs(valor - auto) > 0.01 ? (
        <button type="button" className="adm-link" title={`nivelado automático: ${db(auto)}`} onClick={() => onChange(auto)}>
          ↺
        </button>
      ) : null}
    </span>
  );
}
