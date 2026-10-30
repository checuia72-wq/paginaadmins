-- Aplicado en proyecto Supabase Checua.
alter table public.usuario_roles add column if not exists telefono text;
alter table public.usuario_roles drop constraint if exists usuario_roles_telefono_formato;
alter table public.usuario_roles add constraint usuario_roles_telefono_formato
  check (telefono is null or telefono ~ '^[+]?[0-9]{7,15}
alter table public.reserva add column if not exists guia_user_id uuid references auth.users(id);
alter table public.reserva add column if not exists guia_username text;
alter table public.reserva add column if not exists guia_telefono text;
comment on column public.reserva.guia_telefono is 'Teléfono del guía asignado, copia histórica al aprobar la reserva';
) not valid;
alter table public.reserva add column if not exists guia_user_id uuid references auth.users(id);
alter table public.reserva add column if not exists guia_username text;
alter table public.reserva add column if not exists guia_telefono text;
comment on column public.reserva.guia_telefono is 'Teléfono del guía asignado, copia histórica al aprobar la reserva';
