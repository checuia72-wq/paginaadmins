-- Agrega un nombre de usuario único a cada perfil de la aplicación.
-- El correo continúa almacenado en Supabase Auth; username vive junto al rol/perfil público.

alter table public.usuario_roles
  add column if not exists username text;

with base_usernames as (
  select
    ur.user_id,
    case
      when length(
        lower(
          regexp_replace(
            split_part(coalesce(u.email, 'usuario'), '@', 1),
            '[^a-z0-9._-]+',
            '',
            'g'
          )
        )
      ) >= 3
      then left(
        lower(
          regexp_replace(
            split_part(coalesce(u.email, 'usuario'), '@', 1),
            '[^a-z0-9._-]+',
            '',
            'g'
          )
        ),
        30
      )
      else 'usuario'
    end as base_username
  from public.usuario_roles ur
  left join auth.users u on u.id = ur.user_id
),
ranked_usernames as (
  select
    user_id,
    base_username,
    row_number() over (
      partition by base_username
      order by user_id
    ) as duplicate_number
  from base_usernames
)
update public.usuario_roles ur
set username = case
  when ranked.duplicate_number = 1
    then ranked.base_username
  else left(ranked.base_username, 23)
    || '-'
    || left(replace(ranked.user_id::text, '-', ''), 6)
end
from ranked_usernames ranked
where ur.user_id = ranked.user_id
  and (ur.username is null or btrim(ur.username) = '');

alter table public.usuario_roles
  alter column username set not null;

create unique index if not exists usuario_roles_username_unique
  on public.usuario_roles (username);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuario_roles_username_format_check'
      and conrelid = 'public.usuario_roles'::regclass
  ) then
    alter table public.usuario_roles
      add constraint usuario_roles_username_format_check
      check (
        username = lower(username)
        and username ~ '^[a-z0-9._-]{3,30}$'
      );
  end if;
end
$$;

comment on column public.usuario_roles.username is
  'Nombre de usuario único del perfil. Se almacena en minúsculas y es independiente del correo de autenticación.';
