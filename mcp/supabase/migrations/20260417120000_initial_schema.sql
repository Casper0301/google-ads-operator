-- google-ads-mcp initial schema
-- Plan → Preview → Confirm → Execute pattern for all write ops.
-- Read ops are autonomous; writes are gated by the `changes` table.

create extension if not exists pgcrypto;

-- ============================================================================
-- Enums
-- ============================================================================

create type platform_type as enum (
  'google_ads',
  'meta_ads',
  'snap_ads',
  'tiktok_ads'
);

create type change_status as enum (
  'draft',             -- Claude built a plan, not yet submitted
  'pending_approval',  -- awaiting human confirm
  'approved',          -- confirmed, ready to execute
  'executing',         -- API calls in flight
  'completed',         -- success
  'failed',            -- error during execute
  'rolled_back'        -- manually reversed after completion
);

create type campaign_status as enum (
  'running',
  'paused',
  'draft',
  'removed',
  'ended',
  'unknown'
);

-- ============================================================================
-- Clients — the agency's customers
-- ============================================================================

create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  industry text,
  tier int default 1 check (tier in (1, 2, 3)),  -- Validering / Skalering / Optimalisering
  monthly_retainer_nok int,
  notes text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_clients_active on clients(active) where active = true;

-- ============================================================================
-- Platform connections — OAuth credentials per client per platform
-- Tokens are encrypted at the app layer before insert (AES-256-GCM)
-- ============================================================================

create table platform_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform platform_type not null,
  account_external_id text not null,  -- Google customer ID, Meta ad account ID, etc.
  account_name text,
  mcc_id text,                         -- Google MCC if applicable
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  metadata jsonb default '{}',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (client_id, platform, account_external_id)
);

create index idx_platform_connections_client on platform_connections(client_id) where active = true;

-- ============================================================================
-- Campaigns — synced state from ad platforms
-- ============================================================================

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references platform_connections(id) on delete cascade,
  external_id text not null,
  name text not null,
  status campaign_status default 'unknown',
  campaign_type text,                  -- search, pmax, display, meta_traffic, meta_conversions
  objective text,
  budget_micros bigint,                -- Google uses micros (1 NOK = 1_000_000)
  currency text default 'NOK',
  start_date date,
  end_date date,
  last_synced_at timestamptz default now(),
  raw jsonb default '{}',              -- full platform response for debugging
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (connection_id, external_id)
);

create index idx_campaigns_connection on campaigns(connection_id);
create index idx_campaigns_status on campaigns(status) where status in ('running', 'paused');

-- ============================================================================
-- Ad groups — under campaigns
-- ============================================================================

create table ad_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text,
  last_synced_at timestamptz default now(),
  raw jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (campaign_id, external_id)
);

create index idx_ad_groups_campaign on ad_groups(campaign_id);

-- ============================================================================
-- Changes — the plan/preview/approve/execute pipeline
-- Every write op passes through this table
-- ============================================================================

create table changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  connection_id uuid references platform_connections(id) on delete set null,
  operation_type text not null,        -- 'add_negative_keywords', 'pause_campaign', 'create_campaign'
  target_type text,                    -- 'campaign', 'ad_group', 'keyword', 'account'
  target_external_id text,

  plan jsonb not null,                 -- structured description of proposed change
  preview_text text,                   -- human-readable summary shown at approval time
  undo_data jsonb,                     -- data needed to roll back after execute

  status change_status default 'draft',
  initiated_by text default 'claude',  -- 'claude', 'manual', 'scheduled'
  rationale text,                      -- why this change is being proposed

  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  executed_at timestamptz,

  result jsonb,
  error text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_changes_client_status on changes(client_id, status);
create index idx_changes_pending on changes(status, created_at) where status = 'pending_approval';

-- ============================================================================
-- Playbooks — reusable campaign templates per industry/goal
-- ============================================================================

create table playbooks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  industry text,                       -- 'car_dealer', 'service_business', 'ecom'
  platform platform_type,
  template jsonb not null,             -- structured template data
  version int default 1,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_playbooks_active on playbooks(active, industry, platform) where active = true;

-- ============================================================================
-- Audit log — immutable record of everything that happened
-- ============================================================================

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  change_id uuid references changes(id) on delete set null,
  actor text not null,                 -- 'claude', 'human', 'system'
  action text not null,                -- 'sync', 'propose', 'approve', 'execute', 'rollback'
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_audit_log_client_time on audit_log(client_id, created_at desc);
create index idx_audit_log_change on audit_log(change_id);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated before update on clients
  for each row execute function set_updated_at();
create trigger trg_connections_updated before update on platform_connections
  for each row execute function set_updated_at();
create trigger trg_campaigns_updated before update on campaigns
  for each row execute function set_updated_at();
create trigger trg_ad_groups_updated before update on ad_groups
  for each row execute function set_updated_at();
create trigger trg_changes_updated before update on changes
  for each row execute function set_updated_at();
create trigger trg_playbooks_updated before update on playbooks
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS — enabled with no public policies. Service role key is the only accessor
-- (matches the MCP server's single-operator deployment model).
-- ============================================================================

alter table clients enable row level security;
alter table platform_connections enable row level security;
alter table campaigns enable row level security;
alter table ad_groups enable row level security;
alter table changes enable row level security;
alter table playbooks enable row level security;
alter table audit_log enable row level security;

-- No public policies. Access only via service role.
