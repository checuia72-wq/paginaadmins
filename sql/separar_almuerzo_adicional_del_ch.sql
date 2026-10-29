-- Aplicada en Supabase checua el 29-10-2026.
-- Registrar el almuerzo adicional separadamente de la configuración del plan/CH.
alter table public.reserva
  add column if not exists almuerzo_adicional boolean not null default false;
alter table public.reserva
  add column if not exists restaurante_almuerzo_adicional text;
alter table public.reserva
  add column if not exists id_menu_almuerzo_adicional bigint
    references public.restaurante_menu(id_menu);

comment on column public.reserva.almuerzo_adicional is
  'Almuerzo adquirido aparte del plan base; no participa en la seleccion del CH';
comment on column public.reserva.restaurante_almuerzo_adicional is
  'Restaurante del almuerzo adquirido como adicional';
comment on column public.reserva.id_menu_almuerzo_adicional is
  'Plato elegido opcionalmente para el almuerzo adicional';
