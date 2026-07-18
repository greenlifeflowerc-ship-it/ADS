-- ===========================================================================
-- Ads Maker — initial schema, RLS, and job/metering RPCs
-- Supabase = DB + Auth + RLS only. Media lives in Cloudinary (tables store the
-- secure_url + public_id). Provider keys are env-level (no api_keys table).
-- Jobs run through a Postgres-backed queue drained by /api/jobs/tick.
--
-- Every owner-scoped table carries a denormalized user_id so RLS is the trivial
-- `user_id = auth.uid()` (no recursive EXISTS subqueries on child reads).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Auto-fill user_id from the authed session on client inserts (so the client
-- never has to send it, and can't spoof it — RLS still checks the final value).
create or replace function public.set_owner()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Brand profile
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brain_md text not null default '',
  niche text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_user_id_idx on public.profiles (user_id, created_at desc);

create table public.profile_identity (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logo_url text,
  logo_public_id text,
  colors jsonb not null default '[]',   -- [{name, hex}]
  fonts jsonb not null default '[]',    -- [{name, url|family}]
  updated_at timestamptz not null default now()
);

create table public.identity_images (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  public_id text,
  note text,
  created_at timestamptz not null default now()
);
create index identity_images_profile_idx on public.identity_images (profile_id);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  created_at timestamptz not null default now()
);
create index products_profile_idx on public.products (profile_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  public_id text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id);

-- ---------------------------------------------------------------------------
-- Winning ads (discovered)
-- ---------------------------------------------------------------------------
create table public.winning_ads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (format in ('video', 'post', 'carousel')),
  source_platform text,
  source_url text,
  preview_url text,
  preview_public_id text,
  metrics jsonb not null default '{}',
  apify_run_id text,
  analysis jsonb,                       -- cached AdAnalysis (hook/structure/message/style/sequence)
  fetched_at timestamptz not null default now(),
  unique (profile_id, source_url)       -- dedupe re-runs (spec §6.3)
);
create index winning_ads_profile_idx on public.winning_ads (profile_id, fetched_at desc);

create table public.winning_ad_media (
  id uuid primary key default gen_random_uuid(),
  winning_ad_id uuid not null references public.winning_ads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  public_id text,
  kind text,
  order_index int not null default 0
);
create index winning_ad_media_ad_idx on public.winning_ad_media (winning_ad_id, order_index);

-- ---------------------------------------------------------------------------
-- Generations
-- ---------------------------------------------------------------------------
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  winning_ad_id uuid references public.winning_ads(id) on delete set null,
  type text not null check (type in ('video', 'post', 'carousel')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  params jsonb not null default '{}',
  product_image_ids uuid[] not null default '{}',
  prompt_log jsonb,                     -- transparency (spec §6.4)
  error text,
  cost_usd numeric not null default 0,  -- rolled up from api_usage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generations_profile_idx on public.generations (profile_id, created_at desc);
create index generations_user_idx on public.generations (user_id, created_at desc);

create table public.generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  public_id text,
  kind text not null,                   -- 'image' | 'clip' | 'audio' | 'final'
  order_index int not null default 0,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (generation_id, kind, order_index)   -- idempotent upsert on retry (no dupes)
);
create index generation_assets_gen_idx on public.generation_assets (generation_id, order_index);

-- ---------------------------------------------------------------------------
-- Metering ledger (append-only). api_keys table intentionally omitted (env keys).
-- ---------------------------------------------------------------------------
create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  generation_id uuid references public.generations(id) on delete set null,
  job_id uuid,
  units numeric not null default 0,
  unit_type text,                       -- 'tokens' | 'images' | 'seconds' | 'characters' | 'run'
  cost_usd numeric not null default 0,
  request_key text unique,              -- exactly-once metering across retries (NULLs are distinct)
  created_at timestamptz not null default now()
);
create index api_usage_user_idx on public.api_usage (user_id, created_at desc);
create index api_usage_generation_idx on public.api_usage (generation_id);

-- ---------------------------------------------------------------------------
-- Jobs queue (both job types)
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('discover_winning_ads', 'generate_content')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  progress int not null default 0,      -- 0..100
  progress_message text,
  payload jsonb not null default '{}',  -- inputs
  result jsonb not null default '{}',   -- outputs + resume cursor
  error text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  profile_id uuid references public.profiles(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  dedupe_key text unique,               -- idempotent enqueue
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_claim_idx on public.jobs (status, run_after);
create index jobs_user_idx on public.jobs (user_id, created_at desc);
create index jobs_generation_idx on public.jobs (generation_id);

-- ---------------------------------------------------------------------------
-- Per-user app settings (active profile selection persists here)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger profile_identity_updated_at before update on public.profile_identity
  for each row execute function public.set_updated_at();
create trigger generations_updated_at before update on public.generations
  for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: owner-scoped tables get full CRUD + set_owner; server tables get SELECT.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  owned text[] := array[
    'profiles', 'profile_identity', 'identity_images', 'products', 'product_images',
    'winning_ads', 'winning_ad_media', 'generations', 'generation_assets'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t || '_sel', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t || '_ins', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_upd', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t || '_del', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.set_owner()', t || '_owner', t);
  end loop;
end $$;

-- jobs + api_usage: client reads only; the engine/worker writes via the service role (RLS-exempt).
alter table public.jobs enable row level security;
create policy jobs_sel on public.jobs for select using (user_id = auth.uid());

alter table public.api_usage enable row level security;
create policy api_usage_sel on public.api_usage for select using (user_id = auth.uid());

-- user_settings: full CRUD by the owner (user_id is the PK here).
alter table public.user_settings enable row level security;
create policy user_settings_sel on public.user_settings for select using (user_id = auth.uid());
create policy user_settings_ins on public.user_settings for insert with check (user_id = auth.uid());
create policy user_settings_upd on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_del on public.user_settings for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs: atomic job claim, dead-lease reaper, and the metering choke point.
-- All SECURITY DEFINER so the service-role worker can call them safely.
-- ---------------------------------------------------------------------------

-- Atomically claim the next runnable job. FOR UPDATE SKIP LOCKED guarantees two
-- concurrent ticks never grab the same job.
create or replace function public.claim_next_job(p_worker text, p_lease_sec int default 120)
returns public.jobs
language plpgsql security definer set search_path = public as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs
   where status = 'queued' and run_after <= now()
   order by created_at
   for update skip locked
   limit 1;

  if not found then
    return null;
  end if;

  update public.jobs set
    status = 'running',
    attempts = attempts + 1,
    locked_by = p_worker,
    locked_at = now(),
    lease_expires_at = now() + make_interval(secs => p_lease_sec),
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = j.id
  returning * into j;

  return j;
end $$;

-- Requeue jobs whose worker died mid-lease (crash recovery).
create or replace function public.requeue_expired_jobs()
returns int
language sql security definer set search_path = public as $$
  with r as (
    update public.jobs set
      status = 'queued', run_after = now(),
      locked_by = null, locked_at = null, lease_expires_at = null, updated_at = now()
    where status = 'running' and lease_expires_at < now() and attempts < max_attempts
    returning 1
  )
  select coalesce(count(*), 0)::int from r;
$$;

-- THE metering choke point: append a usage row and roll it into generations.cost_usd
-- in one transaction, exactly once (request_key dedupes retries).
create or replace function public.add_usage(
  p_user uuid,
  p_generation uuid,
  p_provider text,
  p_units numeric,
  p_unit_type text,
  p_cost numeric,
  p_request_key text default null,
  p_job uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  inserted_cost numeric;
begin
  insert into public.api_usage(user_id, generation_id, job_id, provider, units, unit_type, cost_usd, request_key)
  values (p_user, p_generation, p_job, p_provider, p_units, p_unit_type, p_cost, p_request_key)
  on conflict (request_key) do nothing
  returning cost_usd into inserted_cost;

  if inserted_cost is not null and p_generation is not null then
    update public.generations
      set cost_usd = coalesce(cost_usd, 0) + inserted_cost, updated_at = now()
      where id = p_generation;
  end if;
end $$;

-- Sum a user's spend since the start of the current month (budget cap checks).
create or replace function public.month_to_date_cost(p_user uuid)
returns numeric
language sql security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0)
    from public.api_usage
   where user_id = p_user
     and created_at >= date_trunc('month', now());
$$;
