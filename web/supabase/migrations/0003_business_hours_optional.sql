-- ============================================================================
-- 業務時間を「設定しない」（24時間扱い）を選べるようにする
-- + 休日設定のデフォルトを「土日祝も含める」に変更
-- ============================================================================

-- 1. 業務時間 ON/OFF フラグ追加（false = 24時間 = 設定しない）
alter table public.account_settings
  add column if not exists business_hours_enabled boolean not null default false;

-- 2. include_holidays / include_weekends のデフォルトを true に変更
alter table public.account_settings
  alter column include_holidays set default true;
alter table public.account_settings
  alter column include_weekends set default true;

-- 3. 既存行も新デフォルトに揃える（MVP・本番データなし前提）
update public.account_settings
set
  business_hours_enabled = false,
  include_holidays = true,
  include_weekends = true;

do $$
begin
  raise notice '0003 migration: 業務時間 optional + 休日デフォルト変更 完了';
end;
$$;
