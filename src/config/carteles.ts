/**
 * pingli records — los 120 carteles.
 *
 * Inspirados en la idea de los carteles de Antichamber (un dibujo simple y
 * una lección breve que sirve para recorrer el lugar y también para la
 * vida), pero escritos y dibujados para este sitio: ninguno viene del juego.
 *
 * 60 en el lado claro (vitalista: Spinoza, Weil, el jardín) y 60 en el
 * oscuro (técnica, CCRU, lo críptico), 10 por tema. Algunos esconden pistas
 * de los caminos secretos del sitio: cómo cruzar al otro lado y dónde está
 * el muro en el que se guardan los carteles leídos.
 *
 * id: único y fijo (es lo que se guarda al coleccionar; no lo cambies).
 * icono: un nombre de src/config/iconos.ts.
 */

export type Cartel = { readonly id: string; readonly icono: string; readonly texto: string };

export const carteles = {
  claro: {
    explorar: [
      { id: "c01", icono: "puerta", texto: "una puerta cerrada también es una invitación a buscar otra." },
      { id: "c02", icono: "camino", texto: "si no sabes a dónde ir, cualquier dirección te enseña algo." },
      { id: "c03", icono: "vuelta", texto: "regresar no es perder: es ver lo mismo con otros ojos." },
      { id: "c04", icono: "muro", texto: "lo que lees no se pierde: queda colgado en un muro lejano, arriba a la izquierda." },
      { id: "c05", icono: "brujula", texto: "perderse un poco es la única forma de encontrar lo que no buscabas." },
      { id: "c06", icono: "flecha", texto: "avanzar no siempre es ir hacia adelante." },
      { id: "c07", icono: "escalera", texto: "nadie sube de un salto. cada escalón cuenta." },
      { id: "c08", icono: "cruce", texto: "elegir un camino no borra los otros: solo los deja para después." },
      { id: "c09", icono: "montana", texto: "lo que parece lejos cambia de tamaño en cuanto empiezas a caminar." },
      { id: "c10", icono: "esfera", texto: "en el centro hay algo que gira. si entras lo suficiente, sales a otro lado." },
    ],
    mirar: [
      { id: "c11", icono: "ojo", texto: "mira algo hasta que deje de ser lo que creías." },
      { id: "c12", icono: "lupa", texto: "acércate. casi todo es más interesante de cerca." },
      { id: "c13", icono: "espejo", texto: "lo que ves depende también de dónde estás parado." },
      { id: "c14", icono: "ojo-cerrado", texto: "cerrar los ojos también es una forma de mirar." },
      { id: "c15", icono: "puntos", texto: "de lejos es una mancha. de cerca, mil puntos que decidieron estar juntos." },
      { id: "c16", icono: "sol", texto: "la luz no elige qué tocar. tú sí eliges qué mirar." },
      { id: "c17", icono: "hueco", texto: "lo que falta en un dibujo también lo dibuja." },
      { id: "c18", icono: "cubo", texto: "cambia el ángulo y la misma forma te cuenta otra historia." },
      { id: "c19", icono: "pajaro", texto: "mira sin querer atrapar: así se queda lo que vuela." },
      { id: "c20", icono: "luna", texto: "lo que ves a medias no está incompleto: está en camino." },
    ],
    alegria: [
      { id: "c21", icono: "brote", texto: "todo lo vivo insiste. insiste tú también." },
      { id: "c22", icono: "persona", texto: "un cuerpo contento entiende cosas que una mente triste no alcanza." },
      { id: "c23", icono: "pulso", texto: "la alegría no es un premio: es la señal de que puedes más." },
      { id: "c24", icono: "arbol", texto: "crecer es seguir siendo tú, pero más." },
      { id: "c25", icono: "baile", texto: "lo que te hace bailar también te está enseñando algo." },
      { id: "c26", icono: "vela", texto: "una alegría pequeña alcanza para iluminar todo el cuarto." },
      { id: "c27", icono: "pez", texto: "nada en la corriente que te tocó, no contra la que imaginas." },
      { id: "c28", icono: "nudo", texto: "entender un nudo ya es empezar a deshacerlo." },
      { id: "c29", icono: "cabeza", texto: "pensar con claridad también es una forma de alegría." },
      { id: "c30", icono: "llave", texto: "la fuerza que buscas afuera se abre por dentro." },
    ],
    jardin: [
      { id: "c31", icono: "rastrillo", texto: "dibuja surcos en la arena. el viento también dibuja; nadie gana." },
      { id: "c32", icono: "piedra", texto: "la piedra no espera nada y aun así está completa." },
      { id: "c33", icono: "semilla", texto: "lo que siembras hoy no te pide prisa." },
      { id: "c34", icono: "hoja", texto: "deja caer lo que ya cumplió su estación." },
      { id: "c35", icono: "cuenco", texto: "un cuenco sirve justamente por lo que no tiene." },
      { id: "c36", icono: "banca", texto: "siéntate. el plano seguirá aquí cuando vuelvas." },
      { id: "c37", icono: "reloj-arena", texto: "la paciencia no es esperar: es estar mientras algo crece." },
      { id: "c38", icono: "lluvia", texto: "la lluvia no pregunta, y el jardín igual la agradece." },
      { id: "c39", icono: "ola", texto: "respira como el agua: llegar, irse, volver." },
      { id: "c40", icono: "nube", texto: "las nubes no se quedan. por eso el cielo nunca se repite." },
    ],
    soltar: [
      { id: "c41", icono: "pausa", texto: "detenerse también es avanzar en otra dirección." },
      { id: "c42", icono: "puerta-abierta", texto: "si algo no se abre empujando, prueba dejarlo ir." },
      { id: "c43", icono: "candado", texto: "a veces lo que te encierra es la llave que no sueltas." },
      { id: "c44", icono: "carga", texto: "fallar es parte del dibujo. borra y vuelve a trazar." },
      { id: "c45", icono: "dado", texto: "no todo se gana. algunas cosas solo se juegan." },
      { id: "c46", icono: "calendario", texto: "no tienes que llenar cada día para que cuente." },
      { id: "c47", icono: "infinito", texto: "lo que sueltas regresa, pero ya no pesa igual." },
      { id: "c48", icono: "reloj", texto: "no le pidas al tiempo que se detenga. pídele que te acompañe." },
      { id: "c49", icono: "escoba", texto: "barrer no es borrar: es hacer lugar para lo que llega." },
      { id: "c50", icono: "globo", texto: "soltar el hilo es la única manera de ver hasta dónde sube." },
    ],
    sonido: [
      { id: "c51", icono: "altavoz", texto: "escucha antes de hablar. el lugar ya está diciendo algo." },
      { id: "c52", icono: "barras", texto: "cada sonido tiene su altura. no todos tienen que gritar." },
      { id: "c53", icono: "onda", texto: "lo que suena aquí llega más lejos de lo que crees." },
      { id: "c54", icono: "campana", texto: "una campana no suena por miedo: suena porque alguien la tocó." },
      { id: "c55", icono: "eco", texto: "el eco no repite: responde." },
      { id: "c56", icono: "auriculares", texto: "cierra la puerta, sube el volumen y deja que el cuarto se agrande." },
      { id: "c57", icono: "diapason", texto: "afinar es escuchar con más cuidado que ayer." },
      { id: "c58", icono: "radio", texto: "entre dos estaciones también hay música, si sabes oír." },
      { id: "c59", icono: "viento", texto: "el viento no tiene voz propia: suena con lo que toca." },
      { id: "c60", icono: "nota", texto: "una melodía es tiempo al que alguien le dio forma." },
    ],
  },

  oscuro: {
    laberinto: [
      { id: "o01", icono: "laberinto", texto: "el pasillo que tomaste ya no es el mismo cuando regresas." },
      { id: "o02", icono: "espiral", texto: "hacia adentro también es una dirección. sigue." },
      { id: "o03", icono: "mapa", texto: "el mapa miente un poco para que sigas caminando." },
      { id: "o04", icono: "cruce", texto: "todas las salidas son entradas vistas desde atrás." },
      { id: "o05", icono: "cursor", texto: "el cursor no sabe a dónde va. tú tampoco, y aun así llegas." },
      { id: "o06", icono: "esfera", texto: "para volver a la luz, entra otra vez en lo que gira." },
      { id: "o07", icono: "pozo", texto: "no hay fondo. sigue bajando de todas formas." },
      { id: "o08", icono: "puerta", texto: "una puerta en medio de la nada sigue siendo una puerta." },
      { id: "o09", icono: "flecha", texto: "la flecha señala hacia atrás. confía en ella una sola vez." },
      { id: "o10", icono: "ventana", texto: "desde aquí se ve un cuarto que no aparece en ningún mapa." },
    ],
    numeros: [
      { id: "o11", icono: "nueve", texto: "después del nueve no viene un número. viene una puerta." },
      { id: "o12", icono: "cero", texto: "el cero es el único número que no le teme a nada." },
      { id: "o13", icono: "dado", texto: "el azar es un número que no quiso presentarse." },
      { id: "o14", icono: "calendario", texto: "tachar los días no los borra. los marca." },
      { id: "o15", icono: "puntos", texto: "suma los dígitos de tu fecha hasta que quede uno. ese número también te busca." },
      { id: "o16", icono: "reloj", texto: "3:33 no es una hora. es una cuenta que ya empezó." },
      { id: "o17", icono: "asterisco", texto: "* + ^ ; : , . así se desarma una palabra." },
      { id: "o18", icono: "muro", texto: "cuatro treses a la izquierda, cuatro treses hacia arriba. ahí se guarda lo que leíste." },
      { id: "o19", icono: "codigo", texto: "todo nombre es un número que aprendió a vestirse." },
      { id: "o20", icono: "candado", texto: "la contraseña es una fecha que todavía no ocurre." },
    ],
    maquina: [
      { id: "o21", icono: "pantalla", texto: "la pantalla también te mira; solo parpadea menos." },
      { id: "o22", icono: "cable", texto: "desconecta algo y escucha qué sigue funcionando." },
      { id: "o23", icono: "virus", texto: "un virus es una idea con demasiada prisa por llegar." },
      { id: "o24", icono: "glitch", texto: "el error es la máquina diciendo la verdad por accidente." },
      { id: "o25", icono: "carga", texto: "cargando. algunas cosas cargan para siempre y aun así funcionan." },
      { id: "o26", icono: "archivo-roto", texto: "la imagen no cargó. mira el hueco: también es una imagen." },
      { id: "o27", icono: "carpeta", texto: "en alguna carpeta que nadie abre hay una versión tuya más honesta." },
      { id: "o28", icono: "cubo", texto: "un cubo visto desde una esquina es un hexágono que miente." },
      { id: "o29", icono: "cabeza", texto: "la máquina aprende de ti mientras crees que la estás usando." },
      { id: "o30", icono: "pulso", texto: "la señal sigue aunque nadie la mire." },
    ],
    tiempo: [
      { id: "o31", icono: "reloj-arena", texto: "el tiempo no se acaba: cambia de recipiente." },
      { id: "o32", icono: "infinito", texto: "un bucle no se repite: cada vuelta sabe un poco más." },
      { id: "o33", icono: "vuelta", texto: "volviste al principio. el principio no volvió contigo." },
      { id: "o34", icono: "luna", texto: "lo que viene ya dejó huellas en lo que pasó." },
      { id: "o35", icono: "vela", texto: "toda cuenta regresiva también es una cuenta hacia algo." },
      { id: "o36", icono: "onda", texto: "una predicción dicha muchas veces empieza a cumplirse sola." },
      { id: "o37", icono: "pausa", texto: "pausa. el mundo sigue cargando detrás de ti." },
      { id: "o38", icono: "escalera", texto: "cada escalón es un día que alguien ya subió por ti." },
      { id: "o39", icono: "nube", texto: "lo que subiste a la nube ya está en el futuro, esperándote." },
      { id: "o40", icono: "espejo", texto: "en el espejo el reloj gira al revés y nadie se queja." },
    ],
    afuera: [
      { id: "o41", icono: "craneo", texto: "lo inorgánico no tiene prisa: te espera con la puerta abierta." },
      { id: "o42", icono: "hueco", texto: "hay un afuera del plano, y queda justo aquí." },
      { id: "o43", icono: "ojo", texto: "algo te mira desde donde no hay nadie." },
      { id: "o44", icono: "cero", texto: "el vacío no está vacío: está ocupado esperando." },
      { id: "o45", icono: "montana", texto: "la piedra sabe esperar más que cualquier dios." },
      { id: "o46", icono: "sol", texto: "el sol se gasta entero sin pedir nada. así se apaga todo." },
      { id: "o47", icono: "pajaro", texto: "lo que se va volando no regresa al mismo cielo." },
      { id: "o48", icono: "persona", texto: "de lejos eres un punto. de más lejos, ni eso." },
      { id: "o49", icono: "llave", texto: "la llave estaba afuera. siempre estuvo afuera." },
      { id: "o50", icono: "ojo-cerrado", texto: "cuando cierras los ojos, el plano sigue creciendo." },
    ],
    ruido: [
      { id: "o51", icono: "barras", texto: "el ruido es una canción que no te pidió permiso." },
      { id: "o52", icono: "altavoz", texto: "sube el volumen hasta que el cuarto deje de existir." },
      { id: "o53", icono: "onda", texto: "debajo de cada canción hay un zumbido que nadie compuso." },
      { id: "o54", icono: "radio", texto: "entre estaciones se oye a los que no tienen nombre." },
      { id: "o55", icono: "auriculares", texto: "con los ojos cerrados, el ruido dibuja cuartos." },
      { id: "o56", icono: "ola", texto: "la estática es el mar de las máquinas." },
      { id: "o57", icono: "eco", texto: "el eco llega tarde y aun así se queda con la última palabra." },
      { id: "o58", icono: "nota", texto: "a 170 bpm el tiempo se vuelve líquido." },
      { id: "o59", icono: "campana", texto: "una alarma también es una canción, con otro propósito." },
      { id: "o60", icono: "diapason", texto: "afinado o desafinado: el ruido no distingue." },
    ],
  },
} as const;

/** Carteles que dan la pista del muro: se esconden mientras el muro esté apagado. */
const PISTAS_DEL_MURO = new Set(["c04", "o18"]);

export type MundoDeCarteles = { readonly [tema: string]: readonly Cartel[] };
export type BancoDeCarteles = { readonly claro: MundoDeCarteles; readonly oscuro: MundoDeCarteles };

/**
 * Los carteles que pueden brotar, según si el muro está encendido.
 * `fuente`: los de este archivo o los que vienen del panel de admin.
 */
export function cartelesSegun(muro: boolean, fuente: BancoDeCarteles = carteles): BancoDeCarteles {
  if (muro) return fuente;
  const sin = (m: MundoDeCarteles): MundoDeCarteles =>
    Object.fromEntries(Object.entries(m).map(([tema, lista]) => [tema, lista.filter((c) => !PISTAS_DEL_MURO.has(c.id))]));
  return { claro: sin(fuente.claro), oscuro: sin(fuente.oscuro) };
}

/** Los 120, en orden: primero los claros, luego los oscuros. */
export const todosLosCarteles: readonly Cartel[] = [
  ...Object.values(carteles.claro).flat(),
  ...Object.values(carteles.oscuro).flat(),
];
