-- ヨミ管理（着地予測）用の追加セットアップ
-- Supabaseの「SQL Editor」にこの内容を貼り付けて1回だけ実行してください。
-- 実行しなくてもアプリは動きます（その場合、月次目標は各端末にだけ保存されます）。

-- 1) 月次目標などの共有設定を保存するテーブル
create table if not exists app_settings (
  key        text primary key,
  value      jsonb,
  updated_by text default '',
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;

drop policy if exists "Allow all read settings"   on app_settings;
drop policy if exists "Allow all insert settings" on app_settings;
drop policy if exists "Allow all update settings" on app_settings;

create policy "Allow all read settings"   on app_settings for select using (true);
create policy "Allow all insert settings" on app_settings for insert with check (true);
create policy "Allow all update settings" on app_settings for update using (true);

-- 2) 変更履歴の読み込みを速くするインデックス（change_logs がある場合のみ）
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'change_logs') then
    create index if not exists change_logs_field_created_idx on change_logs (field, created_at);
  end if;
end $$;
