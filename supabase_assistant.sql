-- Chatworkアシスタント用テーブル
-- Supabaseの「SQL Editor」にこの内容を貼り付けて実行してください。
-- （案件管理アプリの candidates テーブル等とは独立。実行しなくてもアシスタントは
--   ローカル保存で動きますが、実行するとGitHub Actionsでの自動実行やチーム共有ができます）

-- 同期状態・ルーム一覧・メンバー・タスクなどの保存用（キー・バリュー形式）
create table if not exists cw_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Chatworkメッセージの蓄積
create table if not exists cw_messages (
  room_id bigint not null,
  message_id text not null,
  account_id bigint,
  account_name text default '',
  body text default '',
  send_time bigint,
  update_time bigint,
  created_at timestamptz default now(),
  primary key (room_id, message_id)
);
create index if not exists cw_messages_send_time_idx on cw_messages (send_time);

-- 自動生成ナレッジ（ルームノート・会社プロファイル・ブリーフ履歴）
create table if not exists cw_docs (
  key text primary key,
  content text default '',
  updated_at timestamptz default now()
);

-- 既存アプリと同様の簡易権限設定
-- （URLとanonキーを知っていれば読み書き可能。社内ツール用の設定です）
alter table cw_state enable row level security;
alter table cw_messages enable row level security;
alter table cw_docs enable row level security;

create policy "cw_state all select" on cw_state for select using (true);
create policy "cw_state all insert" on cw_state for insert with check (true);
create policy "cw_state all update" on cw_state for update using (true);
create policy "cw_state all delete" on cw_state for delete using (true);

create policy "cw_messages all select" on cw_messages for select using (true);
create policy "cw_messages all insert" on cw_messages for insert with check (true);
create policy "cw_messages all update" on cw_messages for update using (true);
create policy "cw_messages all delete" on cw_messages for delete using (true);

create policy "cw_docs all select" on cw_docs for select using (true);
create policy "cw_docs all insert" on cw_docs for insert with check (true);
create policy "cw_docs all update" on cw_docs for update using (true);
create policy "cw_docs all delete" on cw_docs for delete using (true);
