-- Migración aplicada en Checua.
-- Los adicionales temporales quedan en reserva_adicional, no en adicional.
alter table public.reserva_adicional
  add column if not exists descripcion_temporal text;
alter table public.reserva_adicional
  add constraint reserva_adicional_temporal_detalle_check
  check (id_adicional is not null or
    (codigo_adicional like 'temporal_%' and descripcion_temporal is not null
     and length(btrim(descripcion_temporal)) > 0 and tipo_movimiento = 'agregado'
     and precio_unitario > 0 and impacto_total = precio_unitario * cantidad_aplicada)) not valid;
