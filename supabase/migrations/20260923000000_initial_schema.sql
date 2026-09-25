-- KaziLedger's FastAPI service owns access to these tables. The browser does
-- not query them through Supabase's Data API, so RLS is enabled without public
-- policies and the API connects with the database role over SSL.

do $$
begin
  create type public.userstatus as enum ('active', 'suspended', 'pending');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.requeststatus as enum (
    'matching',
    'needs_info',
    'quoted',
    'funded',
    'in_progress',
    'delivered',
    'disputed',
    'completed',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.permissions (
  id uuid primary key,
  name varchar(120) not null unique,
  description text
);

create table if not exists public.roles (
  id uuid primary key,
  name varchar(100) not null unique,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_subcategories (
  id uuid primary key,
  category varchar(120) not null default 'Professional services',
  name varchar(160) not null unique,
  scope_schema json not null default '{}'::json,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key,
  email varchar(320) unique,
  phone varchar(32) unique,
  password_hash varchar(255) not null,
  status public.userstatus not null default 'active',
  client_type varchar(24) not null default 'individual',
  role varchar(24) not null default 'client',
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expert_subcategories (
  id uuid primary key,
  expert_id uuid not null references public.users(id),
  subcategory_id uuid not null references public.service_subcategories(id),
  status varchar(24) not null default 'pending',
  is_available boolean not null default true,
  documents json not null default '[]'::json,
  interview_outcome text,
  interview_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_bands (
  id uuid primary key,
  subcategory_id uuid not null references public.service_subcategories(id),
  client_type varchar(24) not null,
  minimum numeric(18, 2) not null,
  maximum numeric(18, 2) not null,
  currency varchar(3) not null default 'UGX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_bands_valid_range check (minimum >= 0 and maximum > minimum)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id),
  permission_id uuid not null references public.permissions(id),
  primary key (role_id, permission_id)
);

create table if not exists public.service_requests (
  id uuid primary key,
  client_id uuid not null references public.users(id),
  subcategory_id uuid not null references public.service_subcategories(id),
  assigned_expert_id uuid references public.users(id),
  status public.requeststatus not null default 'matching',
  scope_details json not null,
  rejection_count integer not null default 0,
  response_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id),
  role_id uuid not null references public.roles(id),
  primary key (user_id, role_id)
);

create table if not exists public.wallets (
  id uuid primary key,
  expert_id uuid unique references public.users(id),
  user_id uuid unique references public.users(id),
  balance numeric(18, 2) not null default 0,
  currency varchar(3) not null default 'UGX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_has_owner check (user_id is not null or expert_id is not null)
);

create table if not exists public.disputes (
  id uuid primary key,
  request_id uuid not null unique references public.service_requests(id),
  raised_by_id uuid not null references public.users(id),
  reason text not null,
  evidence json not null default '[]'::json,
  status varchar(24) not null default 'open',
  resolution varchar(24),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escrow_transactions (
  id uuid primary key,
  request_id uuid not null references public.service_requests(id),
  amount numeric(18, 2) not null,
  status varchar(24) not null default 'pending',
  pesapal_tracking_id varchar(120) unique,
  release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint escrow_transactions_positive_amount check (amount > 0)
);

create table if not exists public.quotes (
  id uuid primary key,
  request_id uuid not null unique references public.service_requests(id),
  expert_id uuid not null references public.users(id),
  amount numeric(18, 2) not null,
  currency varchar(3) not null default 'UGX',
  status varchar(24) not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_positive_amount check (amount > 0)
);

create table if not exists public.request_assignment_logs (
  id uuid primary key,
  request_id uuid not null references public.service_requests(id),
  expert_id uuid references public.users(id),
  action varchar(32) not null,
  reason text,
  timestamp timestamptz not null default now()
);

create table if not exists public.wallet_topups (
  id uuid primary key,
  wallet_id uuid not null references public.wallets(id),
  amount numeric(18, 2) not null,
  status varchar(24) not null default 'pending',
  pesapal_tracking_id varchar(120) unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_topups_positive_amount check (amount > 0)
);

create table if not exists public.wallet_transactions (
  id uuid primary key,
  wallet_id uuid not null references public.wallets(id),
  type varchar(32) not null,
  amount numeric(18, 2) not null,
  status varchar(24) not null default 'pending',
  provider varchar(24),
  provider_ref varchar(120),
  escrow_id uuid references public.escrow_transactions(id),
  created_at timestamptz not null default now()
);

create index if not exists ix_escrow_transactions_request_id
  on public.escrow_transactions(request_id);
create index if not exists ix_request_assignment_logs_request_id
  on public.request_assignment_logs(request_id);
create index if not exists ix_wallet_topups_wallet_id
  on public.wallet_topups(wallet_id);
create index if not exists ix_wallet_transactions_wallet_id
  on public.wallet_transactions(wallet_id);
create unique index if not exists ux_price_bands_service_client_type
  on public.price_bands(subcategory_id, client_type);

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.service_subcategories enable row level security;
alter table public.users enable row level security;
alter table public.expert_subcategories enable row level security;
alter table public.price_bands enable row level security;
alter table public.role_permissions enable row level security;
alter table public.service_requests enable row level security;
alter table public.user_roles enable row level security;
alter table public.wallets enable row level security;
alter table public.disputes enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.quotes enable row level security;
alter table public.request_assignment_logs enable row level security;
alter table public.wallet_topups enable row level security;
alter table public.wallet_transactions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
