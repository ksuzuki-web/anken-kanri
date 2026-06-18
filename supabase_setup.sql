-- 案件管理アプリ用テーブル
-- Supabaseの「SQL Editor」にこの内容を貼り付けて実行してください。

create table candidates (
  id text primary key,
  candidate_name text not null default '',
  company text default '',
  assigned_ca text default '',
  fee numeric,
  status text not null default 'lead',
  interview_date date,
  memo text default '',
  next_action text default '',
  status_changed_at date,
  updated_at date,
  created_at timestamptz default now()
);

-- 認証なしでアプリから読み書きできるようにする設定
-- （社内ツール用の簡易設定。誰でもURLを知っていれば読み書き可能になります）
alter table candidates enable row level security;

create policy "Allow all read" on candidates
  for select using (true);

create policy "Allow all insert" on candidates
  for insert with check (true);

create policy "Allow all update" on candidates
  for update using (true);

create policy "Allow all delete" on candidates
  for delete using (true);

-- 他の人がデータを変更したときに自動で画面を更新するための設定（リアルタイム共有）
alter publication supabase_realtime add table candidates;
