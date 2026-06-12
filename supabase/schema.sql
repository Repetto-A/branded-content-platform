create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values ('branded-content', 'branded-content', true)
on conflict (id) do nothing;

do $$
begin
  alter table storage.objects enable row level security;

  drop policy if exists "Public read branded-content objects" on storage.objects;
  create policy "Public read branded-content objects"
  on storage.objects
  for select
  to public
  using (bucket_id = 'branded-content');

  drop policy if exists "Service role manages branded-content objects" on storage.objects;
  create policy "Service role manages branded-content objects"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'branded-content')
  with check (bucket_id = 'branded-content');
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects RLS/policy setup because current role is not the table owner.';
end
$$;

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  website_url text,
  logo_url text,
  mascot_asset_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_profiles (
  brand_id uuid primary key references brands(id) on delete cascade,
  voice jsonb not null default '{}'::jsonb,
  visual_style jsonb not null default '{}'::jsonb,
  content_rules jsonb not null default '{}'::jsonb,
  context_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  type text not null,
  url text not null,
  label text,
  description text,
  usage text not null default 'optional',
  created_at timestamptz not null default now()
);

create table if not exists creative_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  output_type text not null,
  user_prompt text not null,
  platform text,
  format text,
  cta text,
  campaign_context text,
  reference_asset_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  approval_status text not null default 'pending',
  latest_run_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creative_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references creative_requests(id) on delete cascade,
  provider text not null,
  provider_workflow_id text,
  provider_execution_id text,
  workflow_run_id text,
  provider_payload_snapshot jsonb,
  provider_callback_snapshot jsonb,
  status text not null default 'queued',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creative_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references creative_jobs(id) on delete cascade,
  type text not null,
  url text,
  preview_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_assets_brand_id on brand_assets(brand_id);
create index if not exists idx_creative_requests_brand_id on creative_requests(brand_id);
create index if not exists idx_creative_jobs_request_id on creative_jobs(request_id);
create index if not exists idx_creative_jobs_execution_id on creative_jobs(provider_execution_id);
create index if not exists idx_creative_outputs_job_id on creative_outputs(job_id);
