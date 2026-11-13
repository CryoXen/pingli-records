# pingli records

Sitio del sello discográfico: un lienzo infinito con una figura ASCII viva al
centro, carteles que brotan del plano y audio ambiental. Enfocado a música
ambient, noise, drone, industrial, electrónica e IDM.

Next.js 16 (App Router) + TypeScript + GSAP + Supabase (base de datos, imágenes,
sonidos y login del admin). Se publica en Vercel.

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

En `.env.local` para desarrollo y en Vercel → Settings → Environment Variables.
Sin ellas el sitio funciona con el contenido de `src/config` y `public/previsiones`.

## Supabase

- `supabase/schema.sql`: tablas, permisos (RLS) y carpetas públicas (`portadas`,
  `previsiones`, `sonidos`). Se puede volver a correr.
- `supabase/seed.sql`: contenido inicial. `scripts/seed.mjs` lo rehace desde
  `src/config`.
- Ajustes en la tabla `ajustes` (JSON): `sonidos`, `musica` y `prevision`.
- Un admin es un usuario de Supabase Auth con su `user_id` en `public.admins`.

## Admin

En `/admin` se gestiona el contenido: frases, lanzamientos (foto, información,
etiquetas, enlaces, posición), artistas, previsiones (fotos y videos), música de
fondo y sonidos de la interfaz. Los videos se recortan y se convierten a MP4
ligero en el navegador (mediabunny + WebCodecs) antes de subirse; al guardar, la
portada se regenera en segundos.

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
| Textos, géneros, lanzamientos, figura ASCII, zoom | `src/config/site.ts` |
| Colores y tamaños de texto, layout de esquinas | `src/app/globals.css` |
| Tipografías | `src/app/fonts.css` y `src/app/fonts/` |
| Cómo se dibuja la figura (forma, luz, caracteres) | `src/engine/ascii-object.ts` |
| El plano de puntos | `src/engine/grid.ts` |
| Navegación (ratón, rueda, táctil, teclado) | `src/engine/engine.ts` |
| Texto de cada esquina | `src/components/Overlay.tsx` |
| Marcos de lanzamientos | `src/components/Releases.tsx` |

El motor (`src/engine`) no depende de React: la interfaz solo lo monta y le pasa
la configuración.

Fuentes: Archivo y Courier Prime, SIL Open Font License 1.1.
