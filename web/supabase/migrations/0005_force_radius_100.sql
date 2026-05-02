-- ============================================================================
-- 自宅・勤務地 半径を 100m に固定
-- 旧スキーマ（default 1000）で作られた DB に念押し
-- ============================================================================

-- 1. カラムデフォルトを 100m に強制
alter table public.account_settings
  alter column work_radius_m set default 100;
alter table public.account_settings
  alter column home_radius_m set default 100;

-- 2. 100 以外で残っている行があれば 100 に正規化
update public.account_settings
set work_radius_m = 100
where work_radius_m <> 100;
update public.account_settings
set home_radius_m = 100
where home_radius_m <> 100;

-- 3. トリガ関数を更新: 明示的に 100 をセットする
create or replace function public.create_default_settings()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.account_settings (account_id, work_radius_m, home_radius_m)
  values (new.id, 100, 100)
  on conflict (account_id) do nothing;
  return new;
end;
$$;

do $$
begin
  raise notice '0005 migration: 半径 100m 強制 完了';
end;
$$;
