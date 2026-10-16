-- Fecha real en la que el cliente realizó cada abono de una reserva.
-- Se mantiene fecha_pago para la fecha/hora de registro del movimiento en el sistema.

alter table public.reserva_pago
  add column if not exists fecha_abono date;

comment on column public.reserva_pago.fecha_abono is
  'Fecha indicada por el usuario en la que se realizó el abono. Es independiente de fecha_pago.';
