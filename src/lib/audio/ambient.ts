/**
 * pingli records — música de fondo.
 *
 * Una pista por lado del sitio, cada una en loop sin corte: antes de que
 * termine, una segunda copia arranca desde el inicio y ambas se enciman con
 * un crossfade de potencia constante. Al cruzar al otro lado, las pistas se
 * mezclan; si `switch.filter` está activo, la que se va se hunde en un
 * filtro pasa-bajos mientras la que llega se abre.
 *
 * Se usa <audio> (descarga progresiva, poca memoria) conectado a Web Audio
 * (fades precisos y un volumen que también funciona en iPhone).
 *
 *   voz A ─┐
 *          ├─ pista ─ filtro ─┐
 *   voz B ─┘                  ├─ entrada (fade) ─ volumen ─ salida
 *   (otra pista, igual) ──────┘
 *
 * El lado se lee del atributo data-side de <html>, así que el motor no
 * necesita saber nada del lienzo: cuando el sitio cambia de lado, la música
 * lo sigue sola.
 */

export type Side = "light" | "dark";

export type AudioTrack = {
  readonly src: string;
  readonly title: string;
  /** Ajuste de nivel en dB, para que las pistas suenen igual de fuerte. */
  readonly gainDb: number;
};

export type AudioSettings = {
  readonly enabled: boolean;
  readonly tracks: { readonly light: AudioTrack; readonly dark: AudioTrack };
  /** Volumen inicial del deslizador, 0–1. Después se recuerda por visitante. */
  readonly volume: number;
  /** Segundos del fade de entrada. */
  readonly fadeIn: number;
  readonly loop: {
    /** Segundos que se enciman el final y el inicio de cada vuelta (lo que tarda en irse la que termina). */
    readonly overlap: number;
    /** Segundos en que la vuelta nueva llega a su volumen. */
    readonly rise: number;
    /** Silencio al final del archivo que se ignora. */
    readonly trimEnd: number;
  };
  readonly switch: {
    /** Segundos de la mezcla al cruzar de lado. */
    readonly duration: number;
    readonly filter: boolean;
  };
  readonly copy: { readonly enter: string; readonly volume: string };
};

const VOLUME_KEY = "pingli:volumen";
/** Filtro abierto, la pista que se va termina hundida aquí, la que llega empieza aquí. */
const OPEN_HZ = 20000;
const SUNK_HZ = 320;
const RISE_HZ = 700;

const dbToGain = (db: number) => Math.pow(10, db / 20);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const other = (s: Side): Side => (s === "dark" ? "light" : "dark");
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Safari (Mac y iPhone) pide un gesto por cada <audio>; Chrome y Firefox no. */
const needsBless = () => "webkitAudioContext" in window || /iP(hone|ad|od)/.test(navigator.userAgent);
/** Posición del deslizador → ganancia. Cuadrática: se siente pareja al oído. */
const volumeToGain = (v: number) => v * v;

export const currentSide = (): Side =>
  document.documentElement.dataset.side === "dark" ? "dark" : "light";

/* ───────── curvas ─────────
 * Cada cambio de ganancia o de filtro se programa como una curva y se anota
 * aquí, para poder retomarlo a la mitad sin saltos (Firefox no tiene
 * cancelAndHoldAtTime). */

type Curve = "power" | "swell" | "exp";
type Glide = { from: number; to: number; t0: number; dur: number; curve: Curve };
const glides = new WeakMap<AudioParam, Glide>();

function shape(g: Glide, p: number): number {
  const { from, to } = g;
  if (p <= 0) return from;
  if (p >= 1) return to;
  switch (g.curve) {
    case "power": {
      // potencia constante: dos curvas así suman siempre lo mismo
      const c = Math.cos((p * Math.PI) / 2);
      const s = Math.sin((p * Math.PI) / 2);
      return Math.sqrt(from * from * c * c + to * to * s * s);
    }
    case "exp":
      return from * Math.pow(to / from, p);
    case "swell": {
      // entra "desde lejos": lineal en decibeles, con arranque y llegada suaves
      const k = p * p * (3 - 2 * p);
      const a = from > 0.001 ? 20 * Math.log10(from) : -60;
      const b = to > 0.001 ? 20 * Math.log10(to) : -60;
      return dbToGain(a + (b - a) * k);
    }
  }
}

function valueNow(param: AudioParam, t: number): number {
  const g = glides.get(param);
  if (!g) return param.value;
  if (g.dur <= 0) return g.to;
  return shape(g, (t - g.t0) / g.dur);
}

function glide(ctx: BaseAudioContext, param: AudioParam, to: number, dur: number, curve: Curve = "power") {
  const now = ctx.currentTime;
  const from = valueNow(param, now);
  param.cancelScheduledValues(now);
  if (dur <= 0.02 || Math.abs(from - to) < 1e-6) {
    param.setValueAtTime(to, now);
    glides.set(param, { from: to, to, t0: now, dur: 0, curve });
    return;
  }
  param.setValueAtTime(from, now);
  const g: Glide = { from, to, t0: now + 0.01, dur, curve };
  const n = Math.min(4096, Math.max(8, Math.ceil(dur * 60)));
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) values[i] = shape(g, i / (n - 1));
  param.setValueCurveAtTime(values, g.t0, dur);
  glides.set(param, g);
}

/* ───────── una pista en loop ───────── */

type Voice = { el: HTMLAudioElement; gain?: GainNode };

class Track {
  readonly voices: [Voice, Voice];
  readonly level: number;
  out?: GainNode;
  filter?: BiquadFilterNode;
  private ctx?: AudioContext;
  private active = 0;
  private turning = false;
  private primed = false;
  private wanted = false;
  private timer = 0;

  constructor(
    readonly cfg: AudioTrack,
    private readonly loop: AudioSettings["loop"],
  ) {
    this.level = dbToGain(cfg.gainDb);
    this.voices = [this.voice(), this.voice()];
  }

  private voice(): Voice {
    const el = new Audio();
    el.preload = "none";
    el.src = this.cfg.src;
    return { el };
  }

  /** Empieza a descargar la voz que va a sonar. */
  warm() {
    const el = this.voices[this.active].el;
    el.preload = "auto";
    if (el.readyState === 0) el.load();
  }

  connect(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.5; // sin resonancia: solo oscurece
    this.filter.frequency.value = OPEN_HZ;
    this.out.connect(this.filter).connect(dest);
    this.voices.forEach((v, i) => {
      v.gain = ctx.createGain();
      v.gain.gain.value = i === this.active ? 1 : 0;
      ctx.createMediaElementSource(v.el).connect(v.gain).connect(this.out!);
      v.el.addEventListener("ended", () => this.onEnded(v));
    });
  }

  /**
   * En iPhone cada <audio> necesita un play() dentro de un gesto del
   * visitante. Se "bendicen" todas en el clic de entrada, en silencio.
   */
  bless() {
    for (const v of this.voices) {
      if (!v.el.paused) continue;
      v.el.play().then(
        () => {
          if (this.wanted && v === this.voices[this.active]) return;
          v.el.pause();
          v.el.currentTime = 0;
        },
        () => {},
      );
    }
  }

  /** Reproduce (o sigue) desde donde se quedó. Resuelve cuando ya suena. */
  async play(): Promise<void> {
    this.wanted = true;
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 250);
    const el = this.voices[this.active].el;
    if (el.preload !== "auto") el.preload = "auto";
    try {
      await el.play();
    } catch {
      /* sin permiso o sin red: el sitio sigue, en silencio */
    }
  }

  pause() {
    this.wanted = false;
    clearInterval(this.timer);
    for (const v of this.voices) v.el.pause();
    if (this.ctx && this.turning) {
      // si se pausó a media vuelta, queda solo la voz nueva
      this.voices.forEach((v, i) => glide(this.ctx!, v.gain!.gain, i === this.active ? 1 : 0, 0));
      this.voices[1 - this.active].el.currentTime = 0;
      this.turning = false;
      this.primed = false;
    }
  }

  private tick() {
    const el = this.voices[this.active].el;
    const d = el.duration;
    if (!Number.isFinite(d) || d <= this.loop.overlap + this.loop.trimEnd + 1) return;
    const turnAt = d - this.loop.trimEnd - this.loop.overlap;
    if (!this.primed && el.currentTime >= turnAt - 20) {
      // la siguiente vuelta se prepara 20 s antes, para que arranque al instante
      const next = this.voices[1 - this.active].el;
      next.preload = "auto";
      if (next.readyState === 0) next.load();
      next.currentTime = 0;
      this.primed = true;
    }
    if (!this.turning && el.currentTime >= turnAt) this.turn();
  }

  /** Una vuelta del loop: la voz en reposo entra desde el inicio y se enciman. */
  private turn() {
    const ctx = this.ctx;
    if (!ctx || !this.wanted) return;
    this.turning = true;
    const cur = this.voices[this.active];
    const next = this.voices[1 - this.active];
    const { overlap, rise } = this.loop;
    glide(ctx, next.gain!.gain, 0, 0);
    next.el.currentTime = 0;
    this.active = 1 - this.active;
    const cross = () => {
      if (!this.wanted) return;
      // la nueva entra más rápido de lo que se va la vieja: el final de las
      // pistas ya trae su propio fade, así no se hunde el volumen en la unión
      glide(ctx, next.gain!.gain, 1, Math.min(rise, overlap));
      glide(ctx, cur.gain!.gain, 0, overlap);
      setTimeout(() => {
        if (this.voices[this.active] !== cur) cur.el.pause();
        this.turning = false;
        this.primed = false;
      }, (overlap + 0.5) * 1000);
    };
    next.el.play().then(cross, cross);
  }

  private onEnded(v: Voice) {
    // red lenta o pestaña en segundo plano: si la vuelta no alcanzó a empezar, empieza ya
    if (this.wanted && !this.turning && v === this.voices[this.active]) this.turn();
  }

  destroy() {
    this.pause();
    for (const v of this.voices) v.el.removeAttribute("src");
  }
}

/* ───────── el motor ───────── */

export class Ambient {
  private ctx?: AudioContext;
  private master?: GainNode;
  private bus?: GainNode;
  private readonly tracks: Record<Side, Track>;
  private side: Side = "light";
  private started = false;
  private mixId = 0;
  private volume: number;
  private observer?: MutationObserver;
  /** Sonidos cortos ya decodificados (la canción de la previsión, los efectos), por ruta. */
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** Lo que está sonando aparte del loop, por ruta (un sonido no se encima consigo mismo). */
  private shots = new Map<string, { node: AudioBufferSourceNode; gain: GainNode }>();

  constructor(private readonly s: AudioSettings) {
    this.tracks = {
      light: new Track(s.tracks.light, s.loop),
      dark: new Track(s.tracks.dark, s.loop),
    };
    let saved: number | null = null;
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw !== null && raw !== "") saved = Number(raw);
    } catch {
      /* almacenamiento bloqueado */
    }
    this.volume = clamp01(saved !== null && Number.isFinite(saved) ? saved : s.volume);
  }

  get isStarted() {
    return this.started;
  }

  /** Antes de entrar: descarga la pista del lado en el que está el visitante. */
  warm() {
    if (!this.s.enabled) return;
    this.tracks[currentSide()].warm();
  }

  /** Llamar dentro del clic o tecla de "entrar": los navegadores lo exigen. */
  enter() {
    if (this.started || !this.s.enabled) return;
    this.started = true;
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback"; // iPhone en silencio
    } catch {
      /* no soportado */
    }

    const ctx = new AudioContext({ latencyHint: "playback" });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = volumeToGain(this.volume);
    this.master.connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(this.master);

    this.side = currentSide();
    const first = this.tracks[this.side];
    for (const t of Object.values(this.tracks)) t.connect(ctx, this.bus);
    glide(ctx, first.out!.gain, first.level, 0);
    void ctx.resume();

    // play() tiene que llamarse aquí mismo, dentro del gesto
    const playing = first.play();
    if (needsBless()) for (const t of Object.values(this.tracks)) t.bless();
    playing.then(() => {
      glide(ctx, this.bus!.gain, 1, this.s.fadeIn, "swell");
      // la otra pista se descarga cuando la primera ya suena
      setTimeout(() => this.tracks[other(this.side)].warm(), 4000);
    });

    this.observer = new MutationObserver(() => this.follow(currentSide()));
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-side"] });
  }

  /** Mezcla hacia la pista del lado nuevo. */
  private follow(to: Side) {
    const ctx = this.ctx;
    if (!ctx || to === this.side) return;
    this.side = to;
    const id = ++this.mixId;
    const { duration: D, filter } = this.s.switch;
    const inc = this.tracks[to];
    const out = this.tracks[other(to)];

    // si la que llega estaba en silencio, empieza oscura
    if (filter && valueNow(inc.out!.gain, ctx.currentTime) < 0.01) {
      glide(ctx, inc.filter!.frequency, RISE_HZ, 0);
    }
    const ready = inc.play();

    const leave = () => {
      if (id !== this.mixId) return;
      glide(ctx, out.out!.gain, 0, D);
      if (filter) glide(ctx, out.filter!.frequency, SUNK_HZ, D, "exp");
      setTimeout(() => {
        if (id === this.mixId) out.pause();
      }, (D + 0.5) * 1000);
    };
    const arrive = () => {
      if (id !== this.mixId) return;
      glide(ctx, inc.out!.gain, inc.level, D);
      if (filter) glide(ctx, inc.filter!.frequency, OPEN_HZ, D * 0.85, "exp");
    };
    // las dos empiezan juntas; si la nueva tarda en cargar, la vieja no la espera más de 1.5 s
    Promise.race([ready, wait(1500)]).then(leave);
    ready.then(arrive);
  }

  /**
   * Descarga y decodifica una pista corta (la canción de la previsión), para
   * que suene al instante cuando haga falta. Se puede llamar varias veces.
   */
  loadCue(src: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let buffer = this.buffers.get(src);
    if (!buffer) {
      buffer = fetch(src)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        // la forma con callbacks: Safari viejo no devuelve promesa
        .then((data) => new Promise<AudioBuffer>((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
        .catch(() => {
          this.buffers.delete(src); // se puede volver a intentar
          return null;
        });
      this.buffers.set(src, buffer);
    }
    return buffer;
  }

  /** Suena un buffer ya decodificado, aparte del loop, con el volumen del deslizador. */
  private shoot(src: string, buffer: AudioBuffer, gainDb: number, offset = 0) {
    const ctx = this.ctx!;
    // si el mismo sonido ya estaba sonando, se apaga rápido (no se enciman)
    const prev = this.shots.get(src);
    if (prev) {
      glide(ctx, prev.gain.gain, 0, 0.05);
      try {
        prev.node.stop(ctx.currentTime + 0.08);
      } catch {
        /* ya había terminado */
      }
    }
    const gain = ctx.createGain();
    gain.gain.value = dbToGain(gainDb);
    gain.connect(this.master!);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(gain);
    node.onended = () => {
      if (this.shots.get(src)?.node === node) this.shots.delete(src);
      gain.disconnect();
    };
    node.start(0, Math.max(0, Math.min(offset, buffer.duration - 0.01)));
    this.shots.set(src, { node, gain });
  }

  /** Apaga los sonidos cortos que estén sonando (no la música). */
  stopShots(fade = 0.15) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [src, shot] of this.shots) {
      glide(ctx, shot.gain.gain, 0, fade);
      try {
        shot.node.stop(ctx.currentTime + fade + 0.02);
      } catch {
        /* ya había terminado */
      }
      this.shots.delete(src);
    }
  }

  /**
   * Un efecto de sonido (tocar un proyecto, que aparezca una frase). Si
   * todavía no se descargó, no suena esta vez (para no llegar tarde).
   * `offset`: segundos del inicio que se saltan (silencio).
   */
  playSfx(src: string, gainDb = 0, offset = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state === "closed") return;
    const pending = this.buffers.get(src);
    if (!pending) {
      void this.loadCue(src);
      return;
    }
    void pending.then((buffer) => {
      if (!buffer || !this.ctx) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      this.shoot(src, buffer, gainDb, offset);
    });
  }

  /**
   * Suena la pista corta: la música de fondo se corta (casi de golpe, como
   * aparece la imagen) y entra esta, con el mismo volumen del deslizador.
   * Devuelve false si no pudo sonar (sin audio, sin descargar, etc.).
   */
  async playCue(src: string, gainDb = 0, cut = 0.15): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.bus) return false;
    const buffer = await this.loadCue(src);
    if (!buffer) return false;
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    this.mixId++; // cancela cualquier mezcla en curso
    glide(ctx, this.bus.gain, 0, cut);
    window.setTimeout(() => {
      for (const t of Object.values(this.tracks)) t.pause();
    }, cut * 1000 + 40);
    this.shoot(src, buffer, gainDb);
    return true;
  }

  /** Corta todo: la música se apaga casi en seco (sin chasquido) y se detiene. */
  stop(fade = 0.12) {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    this.mixId++; // cancela cualquier mezcla en curso
    glide(ctx, this.bus.gain, 0, fade);
    for (const shot of this.shots.values()) glide(ctx, shot.gain.gain, 0, fade);
    window.setTimeout(() => {
      for (const t of Object.values(this.tracks)) t.pause();
      void ctx.suspend();
    }, fade * 1000 + 40);
  }

  getVolume() {
    return this.volume;
  }

  setVolume(v: number) {
    this.volume = clamp01(v);
    try {
      localStorage.setItem(VOLUME_KEY, this.volume.toFixed(3));
    } catch {
      /* almacenamiento bloqueado */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(volumeToGain(this.volume), this.ctx.currentTime, 0.04);
    }
  }

  destroy() {
    this.observer?.disconnect();
    for (const t of Object.values(this.tracks)) t.destroy();
    void this.ctx?.close();
  }
}

let shared: Ambient | null = null;

/** Un solo motor para todo el sitio (lo comparten la entrada y el deslizador). */
export function getAmbient(s: AudioSettings): Ambient {
  if (!shared) shared = new Ambient(s);
  return shared;
}
