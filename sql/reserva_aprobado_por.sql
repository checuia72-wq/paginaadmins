-- Registra de forma permanente quién aprobó cada reserva.
-- La identidad se captura en base de datos en el momento exacto en que
-- aprobado cambia de FALSE a TRUE, independientemente de la pantalla usada.

alter table public.reserva
  add column if not exists aprobado_por_user_id uuid null,
  add column if not exists aprobado_por_username text null,
  add column if not exists aprobado_por_email text null;

create index if not exists reserva_aprobado_por_user_id_idx
  on public.reserva (aprobado_por_user_id);

comment on column public.reserva.aprobado_por_user_id is
  'UUID del usuario autenticado que realizó la aprobación vigente de la reserva.';
comment on column public.reserva.aprobado_por_username is
  'Nombre de usuario guardado como instantánea al momento de aprobar.';
comment on column public.reserva.aprobado_por_email is
  'Correo del usuario guardado como instantánea al momento de aprobar.';

create or replace function public.registrar_autor_aprobacion_reserva()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_username text;
  v_email text;
begin
  -- Cuando una reserva deja de estar aprobada se limpia el aprobador.
  if coalesce(new.aprobado, false) = false then
    new.aprobado_por_user_id := null;
    new.aprobado_por_username := null;
    new.aprobado_por_email := null;
    return new;
  end if;

  -- Solo vuelve a sellar la identidad cuando nace aprobada o pasa
  -- de pendiente/no aprobada a aprobada.
  if tg_op = 'INSERT'
     or coalesce(old.aprobado, false) = false then
    v_user_id := auth.uid();

    if v_user_id is not null then
      select ur.username, au.email
      into v_username, v_email
      from auth.users au
      left join public.usuario_roles ur
        on ur.user_id = au.id
      where au.id = v_user_id
      limit 1;

      new.aprobado_por_user_id := v_user_id;
      new.aprobado_por_username := nullif(btrim(coalesce(v_username, '')), '');
      new.aprobado_por_email := nullif(btrim(coalesce(v_email, '')), '');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_registrar_autor_aprobacion_reserva
on public.reserva;

create trigger tr_registrar_autor_aprobacion_reserva
before insert or update of aprobado
on public.reserva
for each row
execute function public.registrar_autor_aprobacion_reserva();

-- Si la bitácora de Actividad ya existe, intenta recuperar el aprobador
-- de reservas históricas aprobadas después de haber instalado la auditoría.
do $$
begin
  if to_regclass('public.actividad_sistema') is not null then
    execute $sql$
      update public.reserva r
      set
        aprobado_por_user_id = a.actor_user_id,
        aprobado_por_username = a.actor_username,
        aprobado_por_email = a.actor_email
      from (
        select distinct on (act.registro_id)
          act.registro_id,
          act.actor_user_id,
          act.actor_username,
          act.actor_email
        from public.actividad_sistema act
        where act.accion = 'aprobar_reserva'
        order by act.registro_id, act.fecha desc
      ) a
      where a.registro_id = r.id_reserva::text
        and coalesce(r.aprobado, false) = true
        and r.aprobado_por_user_id is null
    $sql$;
  end if;
end
$$;

-- Permite que Control Operativo del coordinador obtenga únicamente
-- la atribución de aprobación sin exponer datos adicionales de auth.users.
create or replace function public.aprobadores_control_operativo()
returns table (
  id_reserva bigint,
  aprobado_por_user_id uuid,
  aprobado_por_username text,
  aprobado_por_email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select r.nombre
  into v_role
  from public.usuario_roles ur
  join public.roles r on r.id_rol = ur.role_id
  where ur.user_id = auth.uid()
  limit 1;

  if v_role not in ('administrador', 'atencion', 'coordinador') then
    return;
  end if;

  return query
  select
    res.id_reserva::bigint,
    res.aprobado_por_user_id,
    res.aprobado_por_username,
    res.aprobado_por_email
  from public.reserva res
  where coalesce(res.aprobado, false) = true;
end;
$$;

revoke all on function public.aprobadores_control_operativo() from public, anon;
grant execute on function public.aprobadores_control_operativo() to authenticated;
