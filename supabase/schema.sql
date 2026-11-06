-- pingli records — base de datos del panel de admin (Supabase).
--
-- Córrelo una vez en Supabase → SQL Editor. Crea:
--   frases        lo que brota del plano en cada mundo (carteles y frases)
--   lanzamientos  los cuadros del plano: foto, información, etiquetas, enlaces
--   previsiones   las imágenes del ciclo de 3:33, con su tipo y su rareza
--   ajustes       ajustes del sitio; hoy: los sonidos de la interfaz (clave "sonidos")
--   admins        quién puede editar (usuarios de Supabase Auth)
-- y tres carpetas públicas: "portadas" y "previsiones" (imágenes) y "sonidos".
--
-- Se puede volver a correr cuando cambie (no borra nada): así se agregan
-- tablas o carpetas nuevas a una base que ya existe.
--
-- Permisos: cualquiera puede LEER lo activo (el sitio lo necesita); solo los
-- usuarios que estén en "admins" pueden escribir, subir o borrar.

-- ———————————————————————————————— tablas

create table if not exists public.frases (
  -- c01…c60 / o01…o60 (carteles), fc001… / fo001… (frases). Fijo: los carteles leídos se guardan por id.
  id          text primary key,
  -- "carteles" (dibujo + frase, lo que brota hoy) o "frases" (solo texto, guardadas)
  banco       text not null check (banco in ('carteles', 'frases')),
  mundo       text not null check (mundo in ('claro', 'oscuro')),
  tema        text not null default '',
  texto       text not null check (length(trim(texto)) > 0),
  -- pictograma de src/config/iconos.ts (solo carteles; hoy todos usan la imagen rota)
  icono       text,
  activo      boolean not null default true,
  orden       integer not null default 0,
  actualizado timestamptz not null default now()
);

create table if not exists public.lanzamientos (
  catalogo    text primary key check (catalogo ~ '^[a-z0-9_-]+$'),
  titulo      text not null default '',
  artista     text not null default '',
  anio        integer,
  descripcion text not null default '',
  etiquetas   text[] not null default '{}',
  -- { "bandcamp": "...", "youtube": "...", "soulseek": "..." }
  enlaces     jsonb not null default '{}'::jsonb,
  -- ruta de la foto dentro de la carpeta "portadas" (null = el cuadro vacío de siempre)
  portada     text,
  -- posición y tamaño en el plano (las mismas unidades que site.ts)
  x           double precision not null default 0,
  y           double precision not null default 0,
  tamano      double precision not null default 220 check (tamano > 0),
  publicado   boolean not null default true,
  orden       integer not null default 0,
  actualizado timestamptz not null default now()
);

create table if not exists public.previsiones (
  id      uuid primary key default gen_random_uuid(),
  -- ruta dentro de la carpeta "previsiones"
  ruta    text not null unique,
  -- lo escribe el admin ("paisaje", "glitch"…): no salen dos del mismo tipo seguidas
  tipo    text not null default '',
  -- común 60 %, rara 25 %, muy rara 12 %, única 3 %
  rareza  text not null default 'comun' check (rareza in ('comun', 'rara', 'muy_rara', 'unica')),
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);

-- ajustes sueltos del sitio, como un documento JSON por clave
create table if not exists public.ajustes (
  clave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

-- (agregada en el paso 20: el nombre original del archivo, que se ve debajo de la imagen)
alter table public.previsiones add column if not exists nombre text;

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create index if not exists frases_mundo on public.frases (banco, mundo, orden);
create index if not exists lanzamientos_orden on public.lanzamientos (orden);

-- "actualizado" al día en cada cambio
create or replace function public.tocar() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists frases_tocar on public.frases;
create trigger frases_tocar before update on public.frases for each row execute function public.tocar();
drop trigger if exists lanzamientos_tocar on public.lanzamientos;
create trigger lanzamientos_tocar before update on public.lanzamientos for each row execute function public.tocar();
drop trigger if exists ajustes_tocar on public.ajustes;
create trigger ajustes_tocar before update on public.ajustes for each row execute function public.tocar();

-- ¿quien pregunta es admin?
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.es_admin() to anon, authenticated;

-- ———————————————————————————————— permisos (RLS)

alter table public.frases enable row level security;
alter table public.lanzamientos enable row level security;
alter table public.previsiones enable row level security;
alter table public.ajustes enable row level security;
alter table public.admins enable row level security;

drop policy if exists "leer frases" on public.frases;
create policy "leer frases" on public.frases for select using (activo or public.es_admin());
drop policy if exists "admin escribe frases" on public.frases;
create policy "admin escribe frases" on public.frases for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "leer lanzamientos" on public.lanzamientos;
create policy "leer lanzamientos" on public.lanzamientos for select using (publicado or public.es_admin());
drop policy if exists "admin escribe lanzamientos" on public.lanzamientos;
create policy "admin escribe lanzamientos" on public.lanzamientos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "leer previsiones" on public.previsiones;
create policy "leer previsiones" on public.previsiones for select using (activo or public.es_admin());
drop policy if exists "admin escribe previsiones" on public.previsiones;
create policy "admin escribe previsiones" on public.previsiones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "leer ajustes" on public.ajustes;
create policy "leer ajustes" on public.ajustes for select using (true);
drop policy if exists "admin escribe ajustes" on public.ajustes;
create policy "admin escribe ajustes" on public.ajustes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- cada admin solo puede verse a sí mismo (así el panel sabe si entró un admin)
drop policy if exists "verse a si mismo" on public.admins;
create policy "verse a si mismo" on public.admins for select to authenticated using (user_id = auth.uid());

-- ———————————————————————————————— imágenes (Storage)

insert into storage.buckets (id, name, public)
values ('portadas', 'portadas', true), ('previsiones', 'previsiones', true), ('sonidos', 'sonidos', true)
on conflict (id) do nothing;

-- (leer: las carpetas son públicas, cualquiera ve las imágenes por su URL; esta
-- regla deja además al admin listarlas y reemplazarlas)
drop policy if exists "admin ve imagenes" on storage.objects;
create policy "admin ve imagenes" on storage.objects for select to authenticated
  using (bucket_id in ('portadas', 'previsiones', 'sonidos') and public.es_admin());
drop policy if exists "admin sube imagenes" on storage.objects;
create policy "admin sube imagenes" on storage.objects for insert to authenticated
  with check (bucket_id in ('portadas', 'previsiones', 'sonidos') and public.es_admin());
drop policy if exists "admin cambia imagenes" on storage.objects;
create policy "admin cambia imagenes" on storage.objects for update to authenticated
  using (bucket_id in ('portadas', 'previsiones', 'sonidos') and public.es_admin());
drop policy if exists "admin borra imagenes" on storage.objects;
create policy "admin borra imagenes" on storage.objects for delete to authenticated
  using (bucket_id in ('portadas', 'previsiones', 'sonidos') and public.es_admin());
