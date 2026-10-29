-- Aplicado en Supabase checua el 29 de octubre de 2026.
-- Cada entrada de seleccion_almuerzos almacena numero e id_menu.
-- La selección de platos no altera id_codigo_operativo ni el CH.
alter table public.reserva
  add column if not exists seleccion_almuerzos jsonb not null default '[]'::jsonb;
comment on column public.reserva.seleccion_almuerzos is
  'Lista de platos elegidos por cada almuerzo de la reserva, con ordinal y id_menu; independiente del CH';
