-- ============================================================================
-- モバイルアプリからのヘルスチェック保存
-- アカウント詳細の「位置情報」KPI 表示に利用
-- ============================================================================

alter table public.accounts
  add column if not exists last_mobile_status text
    check (
      last_mobile_status is null
      or last_mobile_status in (
        'services_off',
        'no_permission',
        'fg_only',
        'no_setting',
        'ready'
      )
    ),
  add column if not exists last_health_check_at timestamptz;

-- 自分のアカウントのヘルス状態を更新できるよう RLS ポリシー
-- （既に "user can update own profile" がある: auth.uid() = id and status='active'）
-- 追加ポリシーは不要。既存のポリシーで update 可能。

do $$
begin
  raise notice '0004 migration: mobile health check 完了';
end;
$$;
