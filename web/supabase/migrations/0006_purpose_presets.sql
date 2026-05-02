-- ============================================================================
-- 出張目的のプリセット（ユーザー追加可能）を保存する列
-- ============================================================================

alter table public.account_settings
  add column if not exists purpose_presets text[] not null default '{}';

do $$
begin
  raise notice '0006 migration: purpose_presets 列追加 完了';
end;
$$;
