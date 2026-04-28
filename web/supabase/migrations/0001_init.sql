-- ============================================================================
-- PLEX 出張ログ - 初期スキーマ
-- プラン §3 データモデル に対応
-- ============================================================================

-- ========================================
-- 1. Tables
-- ========================================

-- 1.1 accounts: ユーザーアカウント（auth.users と1:1）
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  company_name text not null,
  created_at timestamptz not null default now(),
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  suspended_at timestamptz,
  suspended_reason text
);

create index if not exists accounts_status_idx on public.accounts (status);
create index if not exists accounts_role_idx on public.accounts (role);

-- 1.2 account_settings: アカウント設定（自宅・勤務地・閾値・業務時間など）
create table if not exists public.account_settings (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  -- 自宅・勤務地（オンボーディング前は NULL）
  work_lat double precision,
  work_lng double precision,
  work_radius_m integer not null default 1000,
  home_lat double precision,
  home_lng double precision,
  home_radius_m integer not null default 1000,
  -- 出張定義
  trip_definition_type text not null default 'hours' check (trip_definition_type in ('hours','km')),
  trip_threshold_hours integer not null default 4,
  trip_threshold_km integer not null default 30,
  -- 業務時間
  business_hours_start time not null default '09:00',
  business_hours_end time not null default '18:00',
  -- 休日設定
  include_holidays boolean not null default false,
  include_weekends boolean not null default false,
  -- デフォルト目的
  default_purpose text not null default '客先訪問',
  updated_at timestamptz not null default now()
);

-- 1.3 location_stays: 端末側で集約された滞在ノード
create table if not exists public.location_stays (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  ts_start timestamptz not null,
  ts_end timestamptz not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision not null,
  source text not null check (source in ('SLC','GF','MOCK')),
  created_at timestamptz not null default now()
);

create index if not exists location_stays_account_ts_idx on public.location_stays (account_id, ts_start);

-- 1.4 trips: 自動判定された出張
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  date date not null,
  depart_ts timestamptz not null,
  return_ts timestamptz not null,
  destination_label text,
  visited_areas text[] not null default '{}',
  total_minutes integer not null,
  max_distance_km double precision,
  status text not null default 'auto_detected' check (status = 'auto_detected'),
  purpose text not null default '客先訪問',
  is_excluded boolean not null default false,
  excluded_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, date)
);

create index if not exists trips_account_date_idx on public.trips (account_id, date desc);

-- 1.5 evidence: 月次エビデンス（PDF/CSV/ZIP メタデータ）
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  period text not null check (period ~ '^\d{6}$'),  -- 'YYYYMM'
  kind text not null check (kind in ('log_pdf','log_csv','trip_evidence_json','settings_snapshot_json','manifest_json','readme_txt','zip')),
  storage_uri text not null,
  sha256 text not null,
  retain_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists evidence_account_period_idx on public.evidence (account_id, period);

-- 1.6 admin_audit_log: 運営者操作ログ
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.accounts(id) on delete cascade,
  action text not null check (action in ('create','suspend','resume','delete','edit')),
  target_account_id uuid not null references public.accounts(id) on delete cascade,
  ts timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_target_idx on public.admin_audit_log (target_account_id);
create index if not exists admin_audit_ts_idx on public.admin_audit_log (ts desc);

-- ========================================
-- 2. Triggers
-- ========================================

-- Account 作成時に account_settings を自動作成
create or replace function public.create_default_settings()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.account_settings (account_id) values (new.id)
  on conflict (account_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_account_created on public.accounts;
create trigger on_account_created
  after insert on public.accounts
  for each row execute function public.create_default_settings();

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_account_settings_updated_at on public.account_settings;
create trigger touch_account_settings_updated_at
  before update on public.account_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_trips_updated_at on public.trips;
create trigger touch_trips_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

-- ========================================
-- 3. Helper: 現在のユーザーが admin か判定
-- ========================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.accounts
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- ========================================
-- 4. Row Level Security
-- ========================================

alter table public.accounts enable row level security;
alter table public.account_settings enable row level security;
alter table public.location_stays enable row level security;
alter table public.trips enable row level security;
alter table public.evidence enable row level security;
alter table public.admin_audit_log enable row level security;

-- ----- accounts -----
drop policy if exists "view own or admin" on public.accounts;
create policy "view own or admin"
  on public.accounts for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "admin can insert" on public.accounts;
create policy "admin can insert"
  on public.accounts for insert
  with check (public.is_admin());

drop policy if exists "admin can update any" on public.accounts;
create policy "admin can update any"
  on public.accounts for update
  using (public.is_admin());

drop policy if exists "user can update own profile" on public.accounts;
create policy "user can update own profile"
  on public.accounts for update
  using (auth.uid() = id and status = 'active')
  with check (auth.uid() = id);

-- ----- account_settings -----
drop policy if exists "manage own settings or admin" on public.account_settings;
create policy "manage own settings or admin"
  on public.account_settings for all
  using (auth.uid() = account_id or public.is_admin())
  with check (auth.uid() = account_id or public.is_admin());

-- ----- location_stays -----
drop policy if exists "manage own stays or admin" on public.location_stays;
create policy "manage own stays or admin"
  on public.location_stays for all
  using (auth.uid() = account_id or public.is_admin())
  with check (auth.uid() = account_id or public.is_admin());

-- ----- trips -----
drop policy if exists "view own trips or admin" on public.trips;
create policy "view own trips or admin"
  on public.trips for select
  using (auth.uid() = account_id or public.is_admin());

drop policy if exists "user can update own trip purpose/excluded" on public.trips;
create policy "user can update own trip purpose/excluded"
  on public.trips for update
  using (auth.uid() = account_id);
-- INSERT は service_role 経由（バッチジョブ）で行う前提

-- ----- evidence -----
drop policy if exists "view own evidence or admin" on public.evidence;
create policy "view own evidence or admin"
  on public.evidence for select
  using (auth.uid() = account_id or public.is_admin());
-- INSERT/UPDATE/DELETE は service_role 経由（証拠保管なのでユーザーは編集不可）

-- ----- admin_audit_log -----
drop policy if exists "admin view audit log" on public.admin_audit_log;
create policy "admin view audit log"
  on public.admin_audit_log for select
  using (public.is_admin());

drop policy if exists "admin insert audit log" on public.admin_audit_log;
create policy "admin insert audit log"
  on public.admin_audit_log for insert
  with check (public.is_admin());

-- ========================================
-- 5. 完了メッセージ
-- ========================================

do $$
begin
  raise notice 'PLEX 出張ログ 初期スキーマ作成完了';
  raise notice '次は Authentication > Users で自分を作って、SQL Editor で UPDATE accounts SET role=admin を実行';
end;
$$;
