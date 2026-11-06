"use client";

/**
 * Sonidos de la interfaz: el volumen de todos juntos y, por mundo, el de
 * tocar un proyecto y el de aparecer una frase. Cada uno se puede probar,
 * cambiar por otro archivo (se mide y se nivela solo), regresar al original
 * o apagar. La música de fondo no cambia aquí.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { site } from "@/config/site";
import { analizarSonido } from "@/lib/admin/analizar-sonido";
import { rutaUnica, type AdminStore } from "@/lib/admin/store";
import { volumenADb } from "@/lib/audio/sfx";
import { completarSonidos } from "@/lib/contenido/mapear";
import type { AjusteSonido, AjustesSonidos, Mundo, TipoSonido } from "@/lib/contenido/tipos";
import { EstadoTexto, useEstado } from "./comun";

const TIPOS: readonly { id: TipoSonido; nombre: string }[] = [
  { id: "proyecto", nombre: "al tocar un proyecto" },
  { id: "frase", nombre: "al aparecer una frase" },
];
const MUNDOS: readonly Mundo[] = ["claro", "oscuro"];
const MAX_MB = 5;

/** Para escuchar en el admin, igual que en el sitio (mismo volumen, sin el silencio del inicio). */
function useProbar() {
  const ctx = useRef<AudioContext | null>(null);
  const cache = useRef(new Map<string, Promise<AudioBuffer>>());
  const sonando = useRef<AudioBufferSourceNode | null>(null);
  useEffect(() => () => void ctx.current?.close(), []);
  return async (url: string, gainDb: number, inicio: number) => {
    ctx.current ??= new AudioContext();
    const c = ctx.current;
    if (c.state !== "running") await c.resume();
    let b = cache.current.get(url);
    if (!b) {
      b = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((d) => new Promise<AudioBuffer>((ok, mal) => c.decodeAudioData(d, ok, mal)));
      cache.current.set(url, b);
    }
    const buffer = await b;
    try {
      sonando.current?.stop();
    } catch {
      /* ya terminó */
    }
    const g = c.createGain();
    g.gain.value = Number.isFinite(gainDb) ? Math.pow(10, gainDb / 20) : 0;
    g.connect(c.destination);
    const n = c.createBufferSource();
    n.buffer = buffer;
    n.connect(g);
    n.start(0, Math.min(inicio, Math.max(0, buffer.duration - 0.01)));
    sonando.current = n;
  };
}

export function Sonidos({ store, avisar }: { store: AdminStore; avisar: () => void }) {
  const [a, setA] = useState<AjustesSonidos | null>(null);
  const [error, setError] = useState("");
  const [estado, correr] = useEstado();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const probar = useProbar();

  useEffect(() => {
    store.sonidos().then(
      (v) => setA(completarSonidos(v)),
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [store]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (error) return <p className="adm-error" role="alert">{error}</p>;
  if (!a) return <p className="adm-gris">cargando…</p>;

  const guardar = (n: AjustesSonidos) =>
    correr(async () => {
      await store.guardarSonidos(n);
      avisar();
    });

  const cambiarVolumen = (v: number) => {
    const n = { ...a, volumen: v };
    setA(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void guardar(n), 450);
  };

  const urlDe = async (t: TipoSonido, m: Mundo, s: AjusteSonido) => {
    if (s.ruta) return store.url("sonidos", s.ruta);
    const original = site.audio.sfx[t][m];
    if (!original) throw new Error("este sonido no tiene archivo original.");
    return store.recurso ? store.recurso(original.src) : original.src;
  };

  const ponerSlot = async (t: TipoSonido, m: Mundo, s: AjusteSonido) => {
    const n: AjustesSonidos = { ...a, [t]: { ...a[t], [m]: s } };
    await store.guardarSonidos(n);
    setA(n);
    avisar();
  };

  const db = volumenADb(a.volumen);
  return (
    <section className="adm-seccion" aria-label="sonidos">
      <div className="adm-volumen">
        <label className="adm-campo">
          <span>volumen de todos los sonidos de la interfaz (la música de fondo no cambia)</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(a.volumen * 100)}
            onChange={(e) => cambiarVolumen(Number(e.target.value) / 100)}
            aria-valuetext={`${Math.round(a.volumen * 100)} por ciento`}
          />
        </label>
        <span className="adm-volumen-valor">
          {Math.round(a.volumen * 100)} %<span className="adm-gris"> · {Number.isFinite(db) ? `${db.toFixed(1)} dB` : "sin sonido"}</span>
        </span>
        <EstadoTexto estado={estado} />
      </div>
      <p className="adm-gris adm-nota-chica">
        en el sitio, además, cada visitante tiene su propio volumen (“vol”, arriba a la izquierda), que baja música y sonidos juntos.
      </p>

      <div className="adm-sonidos">
        <span />
        {MUNDOS.map((m) => (
          <h3 key={m} className="adm-grupo-titulo">
            {m}
          </h3>
        ))}
        {TIPOS.map((t) => (
          <Fila key={t.id} nombre={t.nombre}>
            {MUNDOS.map((m) => (
              <Slot
                key={m}
                tipo={t.id}
                mundo={m}
                s={a[t.id][m]}
                original={site.audio.sfx[t.id][m]?.src.split("/").pop() ?? null}
                onProbar={async () => probar(await urlDe(t.id, m, a[t.id][m]), a[t.id][m].gainDb + db, a[t.id][m].inicio)}
                onCambiar={async (s, viejo) => {
                  await ponerSlot(t.id, m, s);
                  if (viejo) await store.borrarArchivo("sonidos", viejo).catch(() => {});
                }}
                subir={(archivo) => store.subir("sonidos", archivo, rutaUnica(`${t.id}-${m}`, archivo))}
              />
            ))}
          </Fila>
        ))}
      </div>
    </section>
  );
}

function Fila({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <>
      <h3 className="adm-sonidos-fila">{nombre}</h3>
      {children}
    </>
  );
}

function Slot({ tipo, mundo, s, original, onProbar, onCambiar, subir }: {
  tipo: TipoSonido;
  mundo: Mundo;
  s: AjusteSonido;
  original: string | null;
  onProbar: () => Promise<void>;
  onCambiar: (s: AjusteSonido, archivoViejo: string | null) => Promise<void>;
  subir: (archivo: File) => Promise<string>;
}) {
  const [estado, correr] = useEstado();
  const [error, setError] = useState("");
  const base = site.audio.sfx[tipo][mundo];
  return (
    <div className="adm-slot" data-inactivo={!s.activo || undefined}>
      <p className="adm-slot-archivo">
        {s.ruta ? s.nombre ?? s.ruta : original ? `original · ${original}` : "sin sonido"}
      </p>
      {s.ruta ? (
        <p className="adm-gris adm-nota-chica">
          nivelado {s.gainDb > 0 ? "+" : ""}
          {s.gainDb.toFixed(1)} dB{s.inicio >= 0.01 ? ` · se saltan ${s.inicio.toFixed(2)} s de silencio` : ""}
        </p>
      ) : null}
      <div className="adm-frase-meta">
        <button
          type="button"
          className="adm-boton"
          disabled={!s.ruta && !original}
          onClick={() => {
            setError("");
            onProbar().catch((e) => setError(e instanceof Error ? e.message : "no se pudo reproducir"));
          }}
        >
          ▶ probar
        </button>
        <label className="adm-boton">
          cambiar
          <input
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              void correr(async () => {
                if (f.size > MAX_MB * 1024 * 1024) throw new Error(`pesa más de ${MAX_MB} MB: para un sonido de interfaz, mejor uno corto.`);
                let an;
                try {
                  an = await analizarSonido(await f.arrayBuffer());
                } catch {
                  throw new Error("no se pudo leer como audio.");
                }
                const ruta = await subir(f);
                await onCambiar({ ruta, nombre: f.name, activo: true, gainDb: an.gainDb, inicio: an.inicio }, s.ruta);
              });
            }}
          />
        </label>
        {s.ruta ? (
          <button
            type="button"
            className="adm-link"
            onClick={() => void correr(() => onCambiar({ ruta: null, nombre: null, activo: true, gainDb: base?.gainDb ?? 0, inicio: 0 }, s.ruta))}
          >
            volver al original
          </button>
        ) : null}
        <label className="adm-check">
          <input type="checkbox" checked={s.activo} onChange={(e) => void correr(() => onCambiar({ ...s, activo: e.target.checked }, null))} />
          suena
        </label>
      </div>
      <EstadoTexto estado={estado} />
      {error ? <span className="adm-estado" data-tipo="error">{error}</span> : null}
    </div>
  );
}
