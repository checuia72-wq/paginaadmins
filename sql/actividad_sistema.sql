-- Auditoría central de acciones realizadas desde la aplicación.
-- Registra INSERT / UPDATE / DELETE sobre las tablas actuales de public,
-- identifica al usuario autenticado y conserva valores anteriores/nuevos.
-- usuario_roles se audita explícitamente desde la Edge Function de gestión de usuarios
-- para conservar correctamente la identidad del administrador que ejecutó la acción.

create table if not exists public.actividad_sistema (
  id_actividad bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  actor_user_id uuid null,
  actor_username text null,
  actor_email text null,
  actor_role text null,
  actor_source text not null default 'usuario',
  accion text not null,
  operacion text not null,
  tabla text not null,
  registro_id text null,
  referencia text null,
  datos_antes jsonb null,
  datos_despues jsonb null,
  cambios jsonb not null default '{}'::jsonb
);

comment on table public.actividad_sistema is
  'Bitácora inmutable de acciones que modifican información desde la aplicación.';

comment on column public.actividad_sistema.accion is
  'Código semántico de la acción, por ejemplo aprobar_reserva o registrar_devolucion.';

create index if not exists actividad_sistema_fecha_idx
  on public.actividad_sistema (fecha desc);

create index if not exists actividad_sistema_actor_idx
  on public.actividad_sistema (actor_user_id, fecha desc);

create index if not exists actividad_sistema_accion_idx
  on public.actividad_sistema (accion, fecha desc);

create index if not exists actividad_sistema_tabla_idx
  on public.actividad_sistema (tabla, fecha desc);

alter table public.actividad_sistema enable row level security;

drop policy if exists actividad_sistema_admin_select on public.actividad_sistema;
create policy actividad_sistema_admin_select
on public.actividad_sistema
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario_roles ur
    join public.roles r on r.id_rol = ur.role_id
    where ur.user_id = auth.uid()
      and r.nombre = 'administrador'
  )
);

revoke insert, update, delete on public.actividad_sistema from anon, authenticated;
grant select on public.actividad_sistema to authenticated;

create or replace function public.actividad_registro_id(
  p_old jsonb,
  p_new jsonb
)
returns text
language sql
immutable
as $$
  select coalesce(
    p_new->>'id_reserva',
    p_old->>'id_reserva',
    p_new->>'id_plan',
    p_old->>'id_plan',
    p_new->>'id_participante',
    p_old->>'id_participante',
    p_new->>'id_cliente',
    p_old->>'id_cliente',
    p_new->>'id_venta',
    p_old->>'id_venta',
    p_new->>'id_pago',
    p_old->>'id_pago',
    p_new->>'id_devolucion',
    p_old->>'id_devolucion',
    p_new->>'id_transferencia',
    p_old->>'id_transferencia',
    p_new->>'id_consumo',
    p_old->>'id_consumo',
    p_new->>'id',
    p_old->>'id'
  );
$$;

create or replace function public.actividad_referencia(
  p_old jsonb,
  p_new jsonb
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(p_new->>'codigo_reserva',''),
    nullif(p_old->>'codigo_reserva',''),
    nullif(p_new->>'nombre_plan',''),
    nullif(p_old->>'nombre_plan',''),
    nullif(p_new->>'nombre',''),
    nullif(p_old->>'nombre',''),
    nullif(p_new->>'telefono_cliente',''),
    nullif(p_old->>'telefono_cliente',''),
    nullif(p_new->>'codigo',''),
    nullif(p_old->>'codigo',''),
    public.actividad_registro_id(p_old, p_new)
  );
$$;

create or replace function public.actividad_codigo_accion(
  p_tabla text,
  p_operacion text,
  p_old jsonb,
  p_new jsonb
)
returns text
language plpgsql
immutable
as $$
begin
  if p_tabla = 'reserva' and p_operacion = 'UPDATE' then
    if p_old->'aprobado' is distinct from p_new->'aprobado' then
      if coalesce(p_new->>'aprobado','false') = 'true' then
        return 'aprobar_reserva';
      else
        return 'desaprobar_reserva';
      end if;
    end if;

    if p_old->'id_plan' is distinct from p_new->'id_plan' then
      return 'cambiar_plan_reserva';
    end if;

    if p_old->'fecha_reserva' is distinct from p_new->'fecha_reserva'
       or p_old->'id_fecha' is distinct from p_new->'id_fecha'
       or p_old->'id_hora' is distinct from p_new->'id_hora' then
      return 'reprogramar_reserva';
    end if;

    if p_old->'cantidad_personas' is distinct from p_new->'cantidad_personas' then
      return 'cambiar_participantes_reserva';
    end if;

    return 'actualizar_reserva';
  end if;

  if p_tabla = 'reserva' and p_operacion = 'INSERT' then
    return 'crear_reserva';
  end if;

  if p_tabla = 'reserva' and p_operacion = 'DELETE' then
    return 'eliminar_reserva';
  end if;

  if p_tabla = 'reserva_devolucion' then
    if p_operacion = 'INSERT' then return 'registrar_devolucion'; end if;
    if p_operacion = 'DELETE' then return 'eliminar_devolucion'; end if;
    return 'actualizar_devolucion';
  end if;

  if p_tabla = 'plan' then
    if p_operacion = 'INSERT' then return 'crear_plan'; end if;
    if p_operacion = 'DELETE' then return 'eliminar_plan'; end if;
    return 'actualizar_plan';
  end if;

  if p_tabla = 'participante' then
    if p_operacion = 'INSERT' then return 'crear_participante'; end if;
    if p_operacion = 'DELETE' then return 'eliminar_participante'; end if;
    return 'actualizar_participante';
  end if;

  if p_tabla = 'reserva_pago' then
    if p_operacion = 'INSERT' then return 'registrar_pago_reserva'; end if;
    if p_operacion = 'DELETE' then return 'eliminar_pago_reserva'; end if;
    return 'actualizar_pago_reserva';
  end if;

  if p_tabla like 'snack_venta%' then
    if p_operacion = 'INSERT' then return 'registrar_venta_snack'; end if;
    if p_operacion = 'DELETE' then return 'eliminar_venta_snack'; end if;
    return 'actualizar_venta_snack';
  end if;

  if p_tabla like '%inventario%' then
    if p_operacion = 'INSERT' then return 'crear_movimiento_inventario'; end if;
    if p_operacion = 'DELETE' then return 'eliminar_movimiento_inventario'; end if;
    return 'actualizar_inventario';
  end if;

  if p_operacion = 'INSERT' then
    return 'crear_' || p_tabla;
  elsif p_operacion = 'DELETE' then
    return 'eliminar_' || p_tabla;
  end if;

  return 'actualizar_' || p_tabla;
end;
$$;

create or replace function public.registrar_actividad_generica()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_actor uuid := auth.uid();
  v_username text;
  v_email text;
  v_role text;
  v_cambios jsonb := '{}'::jsonb;
  v_accion text;
  v_source text := 'usuario';
begin
  if tg_op in ('UPDATE','DELETE') then
    v_old := to_jsonb(old);
  end if;

  if tg_op in ('INSERT','UPDATE') then
    v_new := to_jsonb(new);
  end if;

  if tg_table_name = 'actividad_sistema' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(
      jsonb_object_agg(
        key,
        jsonb_build_object(
          'antes', v_old->key,
          'despues', v_new->key
        )
      ),
      '{}'::jsonb
    )
    into v_cambios
    from jsonb_object_keys(coalesce(v_old,'{}'::jsonb) || coalesce(v_new,'{}'::jsonb)) key
    where v_old->key is distinct from v_new->key;
  elsif tg_op = 'INSERT' then
    v_cambios := coalesce(v_new, '{}'::jsonb);
  else
    v_cambios := coalesce(v_old, '{}'::jsonb);
  end if;

  if v_actor is not null then
    select
      ur.username,
      au.email,
      r.nombre
    into
      v_username,
      v_email,
      v_role
    from public.usuario_roles ur
    left join auth.users au on au.id = ur.user_id
    left join public.roles r on r.id_rol = ur.role_id
    where ur.user_id = v_actor;
  else
    v_source := 'sistema';
  end if;

  v_accion := public.actividad_codigo_accion(
    tg_table_name,
    tg_op,
    v_old,
    v_new
  );

  insert into public.actividad_sistema (
    actor_user_id,
    actor_username,
    actor_email,
    actor_role,
    actor_source,
    accion,
    operacion,
    tabla,
    registro_id,
    referencia,
    datos_antes,
    datos_despues,
    cambios
  )
  values (
    v_actor,
    v_username,
    v_email,
    v_role,
    v_source,
    v_accion,
    tg_op,
    tg_table_name,
    public.actividad_registro_id(v_old, v_new),
    public.actividad_referencia(v_old, v_new),
    v_old,
    v_new,
    v_cambios
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
exception
  when others then
    -- La auditoría nunca debe impedir la operación principal.
    raise warning 'No fue posible registrar actividad para %.%: %', tg_table_schema, tg_table_name, sqlerrm;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
end;
$$;

do $$
declare
  r record;
  trigger_name text;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in (
        'actividad_sistema',
        'usuario_roles'
      )
  loop
    trigger_name := 'tr_auditoria_' || left(md5(r.tablename), 16);

    execute format(
      'drop trigger if exists %I on public.%I',
      trigger_name,
      r.tablename
    );

    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_actividad_generica()',
      trigger_name,
      r.tablename
    );
  end loop;
end
$$;
