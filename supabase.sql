-- ============================================================
-- Danscanner Pro · base de acceso (Supabase)
-- Pegá TODO esto en Supabase → SQL Editor → Run.
-- El PRIMER usuario que entre queda como administrador.
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'usuario'   check (role   in ('admin','usuario')),
  status      text not null default 'pendiente' check (status in ('pendiente','activo','bloqueado')),
  created_at  timestamptz not null default now()
);

create table if not exists public.invites (
  token       uuid primary key default gen_random_uuid(),
  email       text,
  role        text not null default 'usuario',
  created_by  uuid references auth.users on delete set null,
  expires_at  timestamptz not null default now() + interval '7 days',
  used_by     uuid references auth.users on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.invites  enable row level security;

-- ¿el usuario actual es administrador activo?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and status = 'activo');
$$;

-- Permisos: cada uno ve su perfil; el administrador ve y edita todos.
drop policy if exists p_sel on public.profiles;
create policy p_sel on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists p_del on public.profiles;
create policy p_del on public.profiles for delete using (public.is_admin());

drop policy if exists i_all on public.invites;
create policy i_all on public.invites for all using (public.is_admin()) with check (public.is_admin());

-- Al registrarse alguien: se crea su perfil. El primero es administrador.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare primero boolean;
begin
  select count(*) = 0 into primero from public.profiles;
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'full_name',''),
          case when primero then 'admin'  else 'usuario'   end,
          case when primero then 'activo' else 'pendiente' end)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- El administrador crea un enlace de invitación.
create or replace function public.create_invite(p_email text default null, p_days int default 7)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede invitar'; end if;
  insert into public.invites (email, created_by, expires_at)
  values (nullif(trim(p_email), ''), auth.uid(), now() + (p_days || ' days')::interval)
  returning token into t;
  return t;
end; $$;

-- La persona abre el enlace, entra con su correo y queda habilitada.
create or replace function public.redeem_invite(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare inv public.invites%rowtype; mail text;
begin
  select * into inv from public.invites where token = p_token;
  if inv.token is null or inv.used_by is not null or inv.expires_at < now() then return false; end if;
  select email into mail from auth.users where id = auth.uid();
  if inv.email is not null and lower(inv.email) <> lower(mail) then return false; end if;
  update public.profiles set status = 'activo', role = coalesce(inv.role,'usuario') where id = auth.uid();
  update public.invites  set used_by = auth.uid(), used_at = now() where token = p_token;
  return true;
end; $$;

revoke all on function public.create_invite(text,int) from anon;
grant execute on function public.create_invite(text,int)  to authenticated;
grant execute on function public.redeem_invite(uuid)      to authenticated;

-- Si ya habías creado la tabla antes, esto agrega la columna del nombre:
alter table public.profiles add column if not exists full_name text;
