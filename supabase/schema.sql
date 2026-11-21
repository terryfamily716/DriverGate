-- DriverGate PostgreSQL Schema for Supabase
-- Run this in your Supabase SQL Editor if connecting an external Supabase project
-- via SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment secrets.

create table if not exists public.companies (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.companies (id, name, active)
values ('ralphs-grocery-company', 'Ralphs Grocery Company', true)
on conflict (id) do nothing;

create table if not exists public.driver_checkins (
  id uuid primary key,
  check_in_code text not null unique,
  first_name text not null,
  last_name text not null,
  company_id text not null references public.companies(id),
  company_name text not null,
  selfie_data_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  driver_badge boolean not null default false,
  shop_steward_badge boolean not null default false,
  driver_badge_number text,
  shop_steward_badge_number text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

create index if not exists idx_driver_checkins_code
  on public.driver_checkins (check_in_code);

create index if not exists idx_driver_checkins_status_submitted
  on public.driver_checkins (status, submitted_at desc);

create table if not exists public.admin_config (
  id text primary key,
  passcode_hash text,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security: only service_role backend routes access these tables directly.
alter table public.companies enable row level security;
alter table public.driver_checkins enable row level security;
alter table public.admin_config enable row level security;
