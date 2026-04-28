-- ============================================================================
-- migration 0002: location_tracks テーブル
-- 200m間隔 or 5分間隔の経路点を保存（Trip 詳細ページのマップ表示用）
-- LocationStay とは独立。判定アルゴリズムには使わない、表示専用
-- ============================================================================

create table if not exists public.location_tracks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  ts timestamptz not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  source text not null check (source in ('GPS','MOCK')),
  created_at timestamptz not null default now()
);

create index if not exists location_tracks_account_ts_idx
  on public.location_tracks (account_id, ts);

-- ========================================
-- RLS
-- ========================================

alter table public.location_tracks enable row level security;

drop policy if exists "manage own tracks or admin" on public.location_tracks;
create policy "manage own tracks or admin"
  on public.location_tracks for all
  using (auth.uid() = account_id or public.is_admin())
  with check (auth.uid() = account_id or public.is_admin());

-- ========================================
-- 完了
-- ========================================
do $$
begin
  raise notice 'location_tracks テーブル作成完了';
end;
$$;
