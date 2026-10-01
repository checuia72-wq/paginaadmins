-- Sincroniza almuerzos comprados como "plan adicional" con la reserva.
-- Regla: al agregar/aprobar un almuerzo, incluye_almuerzo pasa a TRUE.
-- IMPORTANTE: este SQL NO modifica id_codigo_operativo ni reasigna el CH.

create or replace function public.marcar_almuerzo_desde_plan_adicional()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.activo = true
     and lower(coalesce(new.nombre, '')) like '%almuerzo%' then
    update public.reserva
    set incluye_almuerzo = true
    where id_reserva = new.id_reserva;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_marcar_almuerzo_desde_plan_adicional
  on public.reserva_plan_adicional;

create trigger trg_marcar_almuerzo_desde_plan_adicional
after insert or update of activo, nombre
on public.reserva_plan_adicional
for each row
execute function public.marcar_almuerzo_desde_plan_adicional();

-- Corrige también las reservas que ya tenían el almuerzo agregado antes
-- de instalar este trigger. No toca el CH.
update public.reserva r
set incluye_almuerzo = true
where coalesce(r.incluye_almuerzo, false) = false
  and exists (
    select 1
    from public.reserva_plan_adicional rpa
    where rpa.id_reserva = r.id_reserva
      and rpa.activo = true
      and lower(coalesce(rpa.nombre, '')) like '%almuerzo%'
  );
