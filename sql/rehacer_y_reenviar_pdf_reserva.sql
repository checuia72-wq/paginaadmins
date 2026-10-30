-- Aplicado en Supabase Checua. Reutiliza el webhook de confirmación existente.
-- El flujo de n8n genera el PDF y lo envía en una sola ejecución.
create table if not exists public.reserva_pdf_reenvio (
  id_reserva integer primary key references public.reserva(id_reserva) on delete cascade,
  solicitado_por uuid,
  solicitado_en timestamptz not null default now(),
  request_id bigint
);
revoke all on public.reserva_pdf_reenvio from public, anon, authenticated;

create or replace function public.rehacer_y_reenviar_pdf_reserva(p_id_reserva integer)
returns bigint language plpgsql security definer set search_path = public, net as $$
declare
  v public.reserva%rowtype;
  v_role text;
  v_previous timestamptz;
  v_request bigint;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select rr.nombre into v_role from public.usuario_roles u join public.roles rr on rr.id_rol=u.role_id where u.user_id=auth.uid();
  if v_role not in ('administrador','atencion','coordinador') then raise exception 'No autorizado para reenviar confirmaciones'; end if;
  select * into v from public.reserva where id_reserva=p_id_reserva for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v.aprobado is distinct from true then raise exception 'La reserva no está aprobada'; end if;
  if coalesce(trim(v.telefono_cliente),'')='' then raise exception 'La reserva no tiene teléfono de contacto'; end if;
  select solicitado_en into v_previous from public.reserva_pdf_reenvio where id_reserva=p_id_reserva;
  if v_previous > now()-interval '2 minutes' then raise exception 'Ya se solicitó el reenvío recientemente. Intenta después de 2 minutos'; end if;
  select net.http_post(
    url:='https://n8n-test.checua.shop/webhook/reserva-aprobada',
    headers:=jsonb_build_object('Content-Type','application/json'),
    body:=jsonb_build_object(
      'id_reserva',v.id_reserva,'telefono_cliente',v.telefono_cliente,
      'id_plan',v.id_plan,'cantidad_personas',v.cantidad_personas,
      'aprobado',v.aprobado,'fecha_solicitud',v.fecha_solicitud,
      'fecha_aprobacion',v.fecha_aprobacion
    ),
    timeout_milliseconds:=30000
  ) into v_request;
  insert into public.reserva_pdf_reenvio(id_reserva,solicitado_por,solicitado_en,request_id)
  values(p_id_reserva,auth.uid(),now(),v_request)
  on conflict(id_reserva) do update set solicitado_por=excluded.solicitado_por,solicitado_en=excluded.solicitado_en,request_id=excluded.request_id;
  return v_request;
end; $$;
revoke all on function public.rehacer_y_reenviar_pdf_reserva(integer) from public,anon;
grant execute on function public.rehacer_y_reenviar_pdf_reserva(integer) to authenticated;
