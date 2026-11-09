# pingli records

Sitio del sello: un lienzo infinito con zoom sin fondo, una figura ASCII viva
al centro, dos mundos (claro y oscuro), carteles que brotan del plano, la zona
dentro de la imagen de los carteles, el ciclo de 3:33 con su previsión, audio
por mundo y un panel de admin.

Next.js 16 (App Router) + TypeScript + GSAP + Supabase (base de datos,
imágenes, sonidos y login del admin). Se publica en Vercel.

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

En `.env.local` para desarrollo y en Vercel → Settings → Environment
Variables. Sin ellas el sitio funciona igual con lo de `src/config` y
`public/previsiones` (y el admin avisa que falta configurarlo).

## Supabase

- `supabase/schema.sql`: tablas, permisos (RLS) y carpetas públicas
  (`portadas`, `previsiones`, `sonidos`). Se puede volver a correr.
- Ajustes en la tabla `ajustes`: `sonidos`, `musica` y `prevision` (JSON).
- `supabase/seed.sql`: el contenido inicial (120 carteles, 180 frases,
  7 lanzamientos). `scripts/seed.mjs` lo rehace desde `src/config`.
- Un admin = un usuario de Supabase Auth con su `user_id` en `public.admins`
  (y su `nombre`, el que muestra el menú del contador).
- Artistas: salen del campo `artista` de cada lanzamiento (uno por nombre).
  `public.artistas` guarda su foto, lugar y tamaño (por nombre); los
  lanzamientos guardan su lugar alrededor del artista en `desfase_x/desfase_y`
  (null = en abanico). Los lanzamientos sin artista quedan sueltos en su x / y.

## Admin

`/admin`, o desde el menú del contador: mantener presionada la cuenta 3:33
(abajo a la derecha) 3.33 s abre un menú con login (ahí mismo; ya con sesión
muestra tu nombre), ingresar a panel, editar (ajustar en el plano el lugar y
el tamaño de artistas y proyectos) y salir (cierra la sesión).
Frases por mundo, lanzamientos (foto, información, etiquetas, enlaces,
posición), artistas (foto y nombre), previsiones (fotos y videos de hasta 30 s, tipo y rareza, cuánto
dura la cuenta regresiva y cuánto se ve cada foto), música (varias canciones de fondo por mundo y cuál suena;
la canción final del contador) y sonidos de la interfaz (volumen global).
Los videos largos se recortan al fragmento elegido y se convierten a MP4
ligero en el navegador (mediabunny + WebCodecs) antes de subirse. Al guardar, la portada se rehace en segundos; además se revisa sola
cada 5 minutos.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # producción
npm run typecheck
```


## Dónde cambiar cada cosa

| Quieres cambiar… | Archivo |
| --- | --- |
| Textos, géneros, lanzamientos, figura ASCII, zoom, secretos | `src/config/site.ts` |
| Colores (claro y oscuro), tamaños de texto, layout de esquinas | `src/app/globals.css` |
| Tipografías | `src/app/fonts.css` y `src/app/fonts/` |
| Cómo se dibuja la figura (forma, luz, caracteres) | `src/engine/ascii-object.ts` |
| El plano de puntos | `src/engine/grid.ts` |
| Ratón, rueda, táctil, teclado, cruce al lado oscuro | `src/engine/engine.ts` |
| Qué texto aparece en cada esquina | `src/components/Overlay.tsx` |
| Marcos de lanzamientos | `src/components/Releases.tsx` |

El motor (`src/engine`) no depende de React: la interfaz solo lo monta y le pasa la configuración.

### Lanzamientos en el lienzo

Cada uno tiene posición (`x`, `y`) y tamaño (`size`) en unidades del mundo; la figura está en `0, 0` y mide 230 de radio. Un `size` muy pequeño esconde el lanzamiento: solo aparece con zoom (así está `pgl000`). Los que miden menos de 10 tampoco se alcanzan con Tab.

Ahora son marcos vacíos que muestran `pgl001.jpg`, como una imagen que no cargó. Cuando haya portadas, el campo `cover` está listo para usarse.

## El lado oscuro

Provisional. Haz zoom dentro de la figura hasta la escala `secrets.darkSide.depth` (2400): una ráfaga de caracteres te atraviesa y sales desde muy lejos, del otro lado del sitio. Repetirlo te regresa. Se recuerda en el navegador del visitante (`localStorage`, clave `pingli:lado`).

Se controla en `site.secrets.darkSide`: encender o apagar, la profundidad, qué tan dentro de la figura hay que apuntar y si se recuerda.

El tema vive en el atributo `data-side` del `<html>` (no en `data-theme`, para que nada externo pueda activarlo por accidente).

## Controles

- Arrastrar: moverse (con inercia)
- Rueda o pellizco: zoom alrededor del cursor
- Doble clic: acercarse ×4 (con Shift: alejarse)
- Flechas: moverse (Shift: más lejos) · `+` / `-`: zoom · `0`: volver al inicio
- Tab: recorre los lanzamientos y vuela hacia cada uno

`prefers-reduced-motion` reduce el giro y quita la inercia y las animaciones de vuelo.

## Vista previa en un solo HTML (solo el paso 1; ya no refleja el sitio)

```bash
npm run preview:build   # → preview/dist/pingli-preview.html
```

Empaqueta la misma portada (React 18 y GSAP desde cdnjs, todo lo demás adentro). Solo sirve para compartir el prototipo; el sitio real es el de Next.

## Pendiente de definir

- Cómo se desbloquea el lado oscuro (el disparador actual es provisional)
- Secciones del sitio y qué pasa al abrir un lanzamiento
- Tipografías definitivas
- Textos reales: descripción, contacto, redes
- Ícono pixel propio (en el espíritu de la referencia de Soulseek)

Fuentes: Archivo y Courier Prime, SIL Open Font License 1.1.
