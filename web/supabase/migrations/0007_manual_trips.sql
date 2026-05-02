-- ============================================================================
-- 手動 Trip の追加 + 編集履歴トラッキング
-- ============================================================================

-- 1. status の CHECK を 'manual' も許容するよう緩和
alter table public.trips drop constraint if exists trips_status_check;
alter table public.trips
  add constraint trips_status_check
  check (status in ('auto_detected', 'manual'));

-- 2. 編集履歴用カラム
alter table public.trips
  add column if not exists edited_at timestamptz,
  add column if not exists edit_source text;

alter table public.trips drop constraint if exists trips_edit_source_check;
alter table public.trips
  add constraint trips_edit_source_check
  check (
    edit_source is null
    or edit_source in ('manual_create', 'user_edit')
  );

-- 3. RLS: ユーザーが自分の手動 Trip を INSERT できるポリシー
drop policy if exists "user can insert own manual trip" on public.trips;
create policy "user can insert own manual trip"
  on public.trips for insert
  with check (auth.uid() = account_id and status = 'manual');

-- 4. visited_areas のデフォルト値が JSON 配列でない場合に備える（既存 schema は問題なし）

do $$
begin
  raise notice '0007 migration: 手動 Trip + edit_source 完了';
end;
$$;
