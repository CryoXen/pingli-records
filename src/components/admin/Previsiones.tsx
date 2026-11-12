"use client";

/**
 * Previsiones: lo que aparece al terminar la cuenta regresiva (y cuánto dura
 * esa cuenta). Fotos y videos
 * (MP4, hasta 30 s, con su sonido). Cada una lleva un tipo (para no mostrar
 * dos del mismo tipo seguidas) y una rareza (qué tan seguido sale). Solo
 * salen las activas que de verdad cargan.
 *
 * Los videos se recortan al fragmento elegido y se convierten en el navegador
 * a un MP4 ligero antes de subirse (src/lib/admin/video.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { site } from "@/config/site";
import { analizarSonido, LUFS_MUSICA } from "@/lib/admin/analizar-sonido";
import { rutaUnica, type AdminStore } from "@/lib/admin/store";
import {
  convertirVideo,
  leerVideo,
  puedeConvertir,
  tiempo,
  VIDEO_MAX_S,
  type InfoVideo,
} from "@/lib/admin/video";
import { formatClock } from "@/lib/ciclo";
import {
  completarPrevision,
  DURACION_CICLO,
  DURACION_FOTO,
  nombreDeRuta,
} from "@/lib/contenido/mapear";
import {
  RAREZAS,
  type AjustesPrevision,
  type FilaPrevision,
  type Rareza,
} from "@/lib/contenido/tipos";
import { Confirmar, EstadoTexto, Imagen, Segmentos, useEstado } from "./comun";

const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16),
      );

const pct = (n: number) =>
  n >= 10 ? `${Math.round(n)} %` : `${n.toFixed(1)} %`;
const esVideo = (f: File) =>
  f.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|mkv|3gp)$/i.test(f.name);
/** Lo más pesado que se acepta para convertir (un video de teléfono de varios minutos). */
const MAX_VIDEO_MB = 2048;
/** Supabase (plan gratis) no acepta archivos de más de 50 MB. */
const MAX_SUBIDA_MB = 50;

/** Probabilidad de cada rareza y de cada previsión, con las activas de hoy. */
function probabilidades(filas: readonly FilaPrevision[]) {
  const activas = filas.filter((f) => f.activo);
  const por = Object.fromEntries(
    RAREZAS.map((r) => [r.id, activas.filter((f) => f.rareza === r.id).length]),
  ) as Record<Rareza, number>;
  const pesos = site.cycle.rareza;
  const total = RAREZAS.reduce((a, r) => a + (por[r.id] ? pesos[r.id] : 0), 0);
  const deRareza = (r: Rareza) =>
    total && por[r] ? (pesos[r] / total) * 100 : 0;
  return {
    por,
    deRareza,
    deImagen: (r: Rareza) => (por[r] ? deRareza(r) / por[r] : 0),
  };
}

type Subida = {
  id: number;
  nombre: string;
  estado: string;
  tipo: "subiendo" | "listo" | "error";
};
type Pedido = {
  file: File;
  info: InfoVideo;
  responder: (t: { inicio: number; fin: number } | null) => void;
};

export function Previsiones({
  store,
  filas,
  setFilas,
  avisar,
}: {
  store: AdminStore;
  filas: FilaPrevision[];
  setFilas: (f: (prev: FilaPrevision[]) => FilaPrevision[]) => void;
  avisar: () => void;
}) {
  const [tipo, setTipo] = useState("");
  const [rareza, setRareza] = useState<Rareza>("comun");
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [filtro, setFiltro] = useState<string>("todas");
  const [encima, setEncima] = useState(false);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const contador = useRef(0);

  const tipos = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) m.set(f.tipo, (m.get(f.tipo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filas]);
  const prob = useMemo(() => probabilidades(filas), [filas]);
  const visibles = filas.filter((f) =>
    filtro === "todas"
      ? true
      : filtro === "m:video"
        ? f.medio === "video"
        : filtro === "m:imagen"
          ? f.medio !== "video"
          : filtro.startsWith("r:")
            ? f.rareza === filtro.slice(2)
            : f.tipo === filtro.slice(2),
  );
  const videos = filas.filter((f) => f.medio === "video").length;

  /** El recorte de un video largo: abre el cuadro y espera la respuesta. */
  const pedirTramo = (file: File, info: InfoVideo) =>
    new Promise<{ inicio: number; fin: number } | null>((responder) =>
      setPedido({ file, info, responder }),
    );

  async function subir(archivos: File[]) {
    const validos = archivos.filter(
      (a) => a.type.startsWith("image/") || esVideo(a),
    );
    const nuevas = validos.map((a) => ({
      id: ++contador.current,
      nombre: a.name,
      estado: "en espera…",
      tipo: "subiendo" as const,
    }));
    setSubidas((s) => [...nuevas, ...s].slice(0, 30));
    const opciones = { tipo: tipo.trim().toLowerCase(), rareza };
    for (const [i, a] of validos.entries()) {
      const id = nuevas[i].id;
      const marcar = (estado: string, t: Subida["tipo"] = "subiendo") =>
        setSubidas((s) =>
          s.map((x) => (x.id === id ? { ...x, estado, tipo: t } : x)),
        );
      try {
        const fila = esVideo(a)
          ? await subirVideo(a, opciones, marcar)
          : await subirImagen(a, opciones, marcar);
        if (!fila) {
          marcar("cancelado", "error");
          continue;
        }
        await store.guardarPrevision(fila);
        setFilas((prev) => [fila, ...prev]);
        marcar("lista", "listo");
      } catch (e) {
        marcar(e instanceof Error ? e.message : "no se pudo subir", "error");
      }
    }
    avisar();
  }

  async function subirImagen(
    a: File,
    o: { tipo: string; rareza: Rareza },
    marcar: (e: string) => void,
  ): Promise<FilaPrevision> {
    marcar("subiendo…");
    const ruta = await store.subir("previsiones", a, rutaUnica("", a));
    return {
      id: nuevoId(),
      ruta,
      nombre: a.name,
      tipo: o.tipo,
      rareza: o.rareza,
      activo: true,
      creado: new Date().toISOString(),
      medio: "imagen",
      duracion: null,
      ganancia: 0,
    };
  }

  async function subirVideo(
    a: File,
    o: { tipo: string; rareza: Rareza },
    marcar: (e: string) => void,
  ): Promise<FilaPrevision | null> {
    if (a.size > MAX_VIDEO_MB * 1024 * 1024)
      throw new Error("el video pesa demasiado.");
    marcar("leyendo el video…");
    const info = await leerVideo(a);
    if (!(info.duracion > 0) || !info.ancho)
      throw new Error("no se pudo leer como video.");
    const largo = info.duracion > VIDEO_MAX_S + 0.05;
    const tramo = largo
      ? await pedirTramo(a, info)
      : { inicio: 0, fin: info.duracion };
    if (!tramo) return null;

    let archivo: File;
    let duracion = tramo.fin - tramo.inicio;
    if (await puedeConvertir()) {
      marcar("convirtiendo 0 %");
      const c = await convertirVideo(a, tramo, (p) =>
        marcar(`convirtiendo ${Math.round(p * 100)} %`),
      );
      archivo = c.archivo;
      duracion = c.duracion;
    } else if (
      !largo &&
      /\.(mp4|m4v)$/i.test(a.name) &&
      a.size <= MAX_SUBIDA_MB * 1024 * 1024
    ) {
      // sin poder convertir aquí, un MP4 corto se sube tal cual
      archivo = a;
    } else {
      throw new Error(
        "este navegador no puede recortar ni convertir videos: usa Chrome, Edge o Safari en computadora.",
      );
    }
    if (archivo.size > MAX_SUBIDA_MB * 1024 * 1024)
      throw new Error(
        `quedó de más de ${MAX_SUBIDA_MB} MB: elige un fragmento más corto.`,
      );

    // el sonido del video se nivela con la música (sin volver a codificarlo)
    marcar("midiendo el sonido…");
    let ganancia = 0;
    if (info.audio) {
      try {
        ganancia = (
          await analizarSonido(await archivo.arrayBuffer(), LUFS_MUSICA)
        ).gainDb;
      } catch {
        ganancia = 0; // sin sonido, o el navegador no lo separa: tal cual
      }
    }
    marcar(`subiendo ${(archivo.size / 1024 / 1024).toFixed(1)} MB…`);
    const ruta = await store.subir(
      "previsiones",
      archivo,
      rutaUnica("", archivo),
    );
    return {
      id: nuevoId(),
      ruta,
      nombre: a.name,
      tipo: o.tipo,
      rareza: o.rareza,
      activo: true,
      creado: new Date().toISOString(),
      medio: "video",
      duracion: Math.round(duracion * 100) / 100,
      ganancia,
    };
  }

  return (
    <section className="adm-seccion" aria-label="previsiones">
      <TiemposCiclo store={store} avisar={avisar} />

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
          arrastra fotos o videos aquí o{" "}
          <label className="adm-link">
            elige archivos
            <input
              type="file"
              accept="image/*,video/*,.mp4,.mov,.m4v,.webm"
              multiple
              hidden
              onChange={(e) => {
                void subir([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </label>
        </p>
        <p className="adm-gris adm-nota-chica">
          videos: hasta {VIDEO_MAX_S} s, con su sonido (en lugar de la canción
          final). si es más largo, eliges el fragmento. se convierten a mp4
          ligero (máx. 1080p) antes de subirse, así se ven en cualquier
          teléfono.
        </p>
        <div className="adm-subir-opciones">
          <label className="adm-campo">
            <span>tipo de las que subas</span>
            <input
              className="adm-input"
              list="adm-tipos"
              value={tipo}
              placeholder="paisaje, glitch…"
              onChange={(e) => setTipo(e.target.value)}
            />
            <span className="adm-gris adm-nota-chica">
              con tipo «previsión», en lugar del nombre del archivo destellan
              palabras de los libros.
            </span>
          </label>
          <div className="adm-campo">
            <span>rareza</span>
            <Segmentos
              label="rareza de las que subas"
              value={rareza}
              options={RAREZAS}
              onChange={setRareza}
            />
          </div>
        </div>
        {subidas.length ? (
          <ul className="adm-subidas">
            {subidas.map((s) => (
              <li key={s.id} data-estado={s.tipo}>
                {s.nombre} — {s.estado}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <datalist id="adm-tipos">
        {tipos
          .filter(([t]) => t)
          .map(([t]) => (
            <option key={t} value={t} />
          ))}
      </datalist>

      <div className="adm-rarezas">
        {RAREZAS.map((r) => (
          <div key={r.id} className="adm-rareza" data-rareza={r.id}>
            <b>{r.nombre}</b>
            <span>
              {prob.por[r.id]}{" "}
              {prob.por[r.id] === 1 ? "previsión" : "previsiones"}
            </span>
            <span>
              {prob.por[r.id]
                ? `sale ${pct(prob.deRareza(r.id))} de las veces`
                : "sin previsiones: su parte se reparte"}
            </span>
          </div>
        ))}
      </div>

      <div className="adm-barra">
        <select
          className="adm-input adm-mini"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="mostrar"
        >
          <option value="todas">todas ({filas.length})</option>
          <option value="m:imagen">fotos ({filas.length - videos})</option>
          <option value="m:video">videos ({videos})</option>
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
        <span className="adm-cuenta">
          nunca salen dos del mismo tipo seguidas · las que no cargan no salen
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="adm-vacio">
          {filas.length
            ? "nada con ese filtro."
            : "todavía no hay previsiones: a los 3:33 el sitio vuelve a “entrar” sin nada."}
        </p>
      ) : null}
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

      {pedido ? (
        <RecorteVideo
          file={pedido.file}
          info={pedido.info}
          onListo={(t) => {
            setPedido(null);
            pedido.responder(t);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * Los tiempos del ciclo: cuánto dura la cuenta regresiva de cada visita y
 * cuánto se ve cada foto al terminar (los videos duran lo que duran).
 */
function TiemposCiclo({
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
  if (!a) return null;
  const cambiar = (n: Partial<AjustesPrevision>) => {
    const nuevo = completarPrevision({ ...a, ...n });
    setA(nuevo);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        void correr(async () => {
          await store.guardarAjuste("prevision", nuevo);
          avisar();
        }),
      600,
    );
  };
  return (
    <div className="adm-ciclo">
      <CuentaRegresiva
        valor={a.duracionCiclo}
        onChange={(s) => cambiar({ duracionCiclo: s })}
      />
      <div className="adm-volumen adm-duracion">
        <label className="adm-campo">
          <span>
            al terminar, cada foto se ve (los videos duran lo que duran, hasta{" "}
            {VIDEO_MAX_S} s)
          </span>
          <input
            type="range"
            min={DURACION_FOTO.min}
            max={DURACION_FOTO.max}
            step={1}
            value={a.duracionFoto}
            onChange={(e) => cambiar({ duracionFoto: Number(e.target.value) })}
            aria-valuetext={`${a.duracionFoto} segundos`}
          />
        </label>
        <span className="adm-volumen-valor">{a.duracionFoto} s</span>
        <EstadoTexto estado={estado} />
      </div>
    </div>
  );
}

/** La cuenta regresiva en minutos y segundos (de 0:10 a 59:59). */
function CuentaRegresiva({
  valor,
  onChange,
}: {
  valor: number;
  onChange: (s: number) => void;
}) {
  const [min, setMin] = useState(String(Math.floor(valor / 60)));
  const [seg, setSeg] = useState(String(valor % 60));
  // si llega otro valor (al cargar, o al volver al original), se reescribe
  useEffect(() => {
    setMin(String(Math.floor(valor / 60)));
    setSeg(String(valor % 60));
  }, [valor]);
  const enviar = (m: string, s: string) => {
    const mm = Math.max(0, Math.min(59, Math.floor(Number(m) || 0)));
    const ss = Math.max(0, Math.min(59, Math.floor(Number(s) || 0)));
    const total = Math.max(
      DURACION_CICLO.min,
      Math.min(DURACION_CICLO.max, mm * 60 + ss),
    );
    if (total !== valor) onChange(total);
  };
  const original = site.cycle.duration;
  return (
    <fieldset className="adm-campo adm-cuenta">
      <legend>
        cuenta regresiva: cuánto dura cada visita antes de la previsión (de 0:10
        a 59:59)
      </legend>
      <div className="adm-tiempo">
        <input
          className="adm-input adm-num"
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={min}
          aria-label="minutos"
          onChange={(e) => {
            setMin(e.target.value);
            if (e.target.value !== "") enviar(e.target.value, seg);
          }}
          onBlur={() => setMin(String(Math.floor(valor / 60)))}
        />
        <span>min</span>
        <input
          className="adm-input adm-num"
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={seg}
          aria-label="segundos"
          onChange={(e) => {
            setSeg(e.target.value);
            if (e.target.value !== "") enviar(min, e.target.value);
          }}
          onBlur={() => setSeg(String(valor % 60))}
        />
        <span>s</span>
        <span className="adm-volumen-valor adm-reloj">
          {formatClock(valor)}
        </span>
        {valor !== original ? (
          <button
            type="button"
            className="adm-link"
            onClick={() => onChange(original)}
          >
            volver a {formatClock(original)}
          </button>
        ) : null}
      </div>
      <span className="adm-gris adm-nota-chica">
        la previsión se empieza a descargar 90 s antes del final (o desde el
        inicio, si dura menos).
      </span>
    </fieldset>
  );
}

/**
 * El cuadro para elegir el fragmento de un video largo: dónde empieza y
 * cuánto dura (hasta 30 s). Se puede ver y escuchar antes de recortarlo.
 */
function RecorteVideo({
  file,
  info,
  onListo,
}: {
  file: File;
  info: InfoVideo;
  onListo: (t: { inicio: number; fin: number } | null) => void;
}) {
  const dur = info.duracion;
  const [inicio, setInicio] = useState(0);
  const [largo, setLargo] = useState(Math.min(VIDEO_MAX_S, dur));
  const [viendo, setViendo] = useState(false);
  const [ahora, setAhora] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const fin = Math.min(dur, inicio + largo);
  const maxLargo = Math.max(0.5, Math.min(VIDEO_MAX_S, dur - inicio));

  // al mover el inicio, el video muestra ese cuadro
  useEffect(() => {
    const v = ref.current;
    if (!v || viendo) return;
    try {
      v.currentTime = inicio;
    } catch {
      /* sin datos todavía */
    }
  }, [inicio, viendo]);

  // Esc cancela
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onListo(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onListo]);

  const ver = () => {
    const v = ref.current;
    if (!v) return;
    if (viendo) {
      v.pause();
      setViendo(false);
      return;
    }
    v.currentTime = inicio;
    v.muted = false;
    void v.play().then(
      () => setViendo(true),
      () => setViendo(false),
    );
  };

  const moverInicio = (t: number) => {
    const i = Math.max(0, Math.min(dur - 0.5, t));
    setInicio(i);
    setLargo((l) => Math.min(l, Math.max(0.5, Math.min(VIDEO_MAX_S, dur - i))));
  };

  return (
    <div
      className="adm-modal"
      role="dialog"
      aria-modal="true"
      aria-label="elegir el fragmento del video"
    >
      <div className="adm-recorte">
        <p className="adm-recorte-titulo">
          <b>{file.name}</b>
          <span className="adm-gris">
            {" "}
            · {tiempo(dur)} · {info.ancho}×{info.alto}
          </span>
        </p>
        <p className="adm-gris adm-nota-chica">
          dura más de {VIDEO_MAX_S} s: elige el fragmento que va a aparecer.
        </p>
        <video
          ref={ref}
          className="adm-recorte-video"
          src={url}
          playsInline
          preload="auto"
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setAhora(v.currentTime);
            if (viendo && v.currentTime >= fin) {
              v.pause();
              setViendo(false);
              v.currentTime = inicio;
            }
          }}
          onPause={() => setViendo(false)}
        />
        <div
          className="adm-linea"
          role="presentation"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            moverInicio(((e.clientX - r.left) / r.width) * dur - largo / 2);
          }}
        >
          <span
            className="adm-linea-tramo"
            style={{
              left: `${(inicio / dur) * 100}%`,
              width: `${((fin - inicio) / dur) * 100}%`,
            }}
          />
          {viendo ? (
            <span
              className="adm-linea-ahora"
              style={{ left: `${(ahora / dur) * 100}%` }}
            />
          ) : null}
        </div>
        <label className="adm-campo">
          <span>
            empieza en <b>{tiempo(inicio)}</b>
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, dur - 0.5)}
            step={0.1}
            value={inicio}
            onChange={(e) => moverInicio(Number(e.target.value))}
          />
        </label>
        <label className="adm-campo">
          <span>
            dura <b>{(fin - inicio).toFixed(1)} s</b> (termina en {tiempo(fin)})
          </span>
          <input
            type="range"
            min={0.5}
            max={maxLargo}
            step={0.1}
            value={Math.min(largo, maxLargo)}
            onChange={(e) => setLargo(Number(e.target.value))}
          />
        </label>
        <div className="adm-acciones">
          <button type="button" className="adm-boton" onClick={ver}>
            {viendo ? "■ parar" : "▶ ver fragmento"}
          </button>
          <button
            type="button"
            className="adm-boton adm-primario"
            onClick={() => onListo({ inicio, fin })}
          >
            recortar y subir
          </button>
          <button
            type="button"
            className="adm-link"
            onClick={() => onListo(null)}
          >
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Un video guardado, chiquito: se ve su primer cuadro; ▶ lo reproduce con sonido. */
function VideoMini({ store, ruta }: { store: AdminStore; ruta: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);
  const [tocando, setTocando] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let vivo = true;
    store.url("previsiones", ruta).then(
      (u) => vivo && setSrc(u),
      () => vivo && setFalla(true),
    );
    return () => {
      vivo = false;
    };
  }, [store, ruta]);
  if (falla) return <span className="adm-img-falla">no carga</span>;
  if (!src) return null;
  return (
    <>
      <video
        ref={ref}
        className="adm-img"
        src={`${src}#t=0.1`}
        preload="metadata"
        playsInline
        onError={() => setFalla(true)}
        onEnded={() => setTocando(false)}
        onPause={() => setTocando(false)}
      />
      <button
        type="button"
        className="adm-video-play"
        aria-label={tocando ? "parar" : "ver con sonido"}
        onClick={() => {
          const v = ref.current;
          if (!v) return;
          if (!v.paused) return v.pause();
          void v.play().then(
            () => setTocando(true),
            () => setTocando(false),
          );
        }}
      >
        {tocando ? "■" : "▶"}
      </button>
    </>
  );
}

function TarjetaPrevision({
  store,
  fila,
  prob,
  guardar,
  borrar,
}: {
  store: AdminStore;
  fila: FilaPrevision;
  prob: number;
  guardar: (f: FilaPrevision) => Promise<void>;
  borrar: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState(fila.tipo);
  const [estado, correr] = useEstado();
  const cambiar = (n: Partial<FilaPrevision>) =>
    correr(() => guardar({ ...fila, ...n }));
  const video = fila.medio === "video";
  return (
    <li
      className="adm-prevision"
      data-inactiva={!fila.activo || undefined}
      data-rareza={fila.rareza}
      data-medio={fila.medio}
    >
      <span className="adm-marco adm-prevision-foto">
        {video ? (
          <VideoMini store={store} ruta={fila.ruta} />
        ) : (
          <Imagen store={store} carpeta="previsiones" ruta={fila.ruta} />
        )}
      </span>
      <span
        className="adm-gris adm-nota-chica adm-prevision-nombre"
        title="lo que se ve debajo"
      >
        {fila.nombre ?? nombreDeRuta(fila.ruta)}
        {video ? (
          <span className="adm-prevision-medio">
            {" "}
            · video {fila.duracion ? tiempo(fila.duracion, false) : ""}
          </span>
        ) : null}
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
      <select
        className="adm-input adm-mini"
        value={fila.rareza}
        aria-label="rareza"
        onChange={(e) => void cambiar({ rareza: e.target.value as Rareza })}
      >
        {RAREZAS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </select>
      <div className="adm-frase-meta">
        <label className="adm-check">
          <input
            type="checkbox"
            checked={fila.activo}
            onChange={(e) => void cambiar({ activo: e.target.checked })}
          />
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
