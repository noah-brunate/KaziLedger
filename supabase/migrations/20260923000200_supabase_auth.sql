-- Supabase Auth is the identity authority. KaziLedger keeps authorization and
-- business profile fields in public.users, linked one-to-one to auth.users.

alter table public.users
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

alter table public.users
  alter column password_hash drop not null;

create unique index if not exists ix_users_auth_user_id
  on public.users(auth_user_id)
  where auth_user_id is not null;

create or replace function public.handle_kaziledger_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_role text;
  requested_client_type text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'expert' then 'expert'
    else 'client'
  end;
  requested_client_type := case
    when new.raw_user_meta_data ->> 'client_type' = 'business' then 'business'
    else 'individual'
  end;

  -- Link a legacy KaziLedger profile when its email already exists. This does
  -- not copy the legacy password; Supabase remains the only password store.
  update public.users
  set
    auth_user_id = new.id,
    email = coalesce(new.email, public.users.email),
    phone = coalesce(new.phone, public.users.phone),
    password_hash = null,
    updated_at = now()
  where auth_user_id is null
    and new.email is not null
    and lower(email) = lower(new.email);

  if found then
    return new;
  end if;

  insert into public.users (
    id,
    auth_user_id,
    email,
    phone,
    password_hash,
    status,
    client_type,
    role,
    marketing_consent
  )
  values (
    new.id,
    new.id,
    new.email,
    new.phone,
    null,
    'active'::public.userstatus,
    requested_client_type,
    requested_role,
    lower(coalesce(new.raw_user_meta_data ->> 'marketing_consent', 'false')) = 'true'
  )
  on conflict (id) do update
  set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    phone = excluded.phone,
    password_hash = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists kaziledger_on_auth_user_created on auth.users;
create trigger kaziledger_on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_kaziledger_auth_user();

-- Link any Auth accounts that were created before this migration.
update public.users as profile
set
  auth_user_id = auth_user.id,
  password_hash = null,
  updated_at = now()
from auth.users as auth_user
where profile.auth_user_id is null
  and auth_user.email is not null
  and lower(profile.email) = lower(auth_user.email);

insert into public.users (
  id,
  auth_user_id,
  email,
  phone,
  password_hash,
  status,
  client_type,
  role,
  marketing_consent
)
select
  auth_user.id,
  auth_user.id,
  auth_user.email,
  auth_user.phone,
  null,
  'active'::public.userstatus,
  case
    when auth_user.raw_user_meta_data ->> 'client_type' = 'business' then 'business'
    else 'individual'
  end,
  case
    when auth_user.raw_user_meta_data ->> 'role' = 'expert' then 'expert'
    else 'client'
  end,
  lower(coalesce(auth_user.raw_user_meta_data ->> 'marketing_consent', 'false')) = 'true'
from auth.users as auth_user
where not exists (
  select 1 from public.users as profile
  where profile.auth_user_id = auth_user.id or profile.id = auth_user.id
)
on conflict do nothing;
