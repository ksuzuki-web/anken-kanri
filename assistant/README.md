# Chatworkアシスタント「宅建Jobアシスタント」

Chatworkの全ルームのやり取りを自動で取り込み、**会社のことを理解した上で仕事をサポートするAIアシスタント**です。
案件管理アプリと同じリポジトリに同居していて、追加のパッケージインストールは不要（Node.jsだけで動きます）。

## できること

| コマンド | 内容 |
|---|---|
| `npm run cw:sync` | Chatworkの全ルームからメッセージ・タスクを取り込んで蓄積 |
| `npm run cw:brief` | **朝ブリーフ**を生成（未返信メンション / タスク期限 / 昨日の動き / 案件ボードの停滞・本日面接 / AI要約） |
| `npm run cw:brief:post` | 朝ブリーフをChatwork（マイチャット等）に投稿 |
| `npm run cw:ask -- "質問"` | 蓄積ログ・ナレッジ・案件データを根拠に質問へ回答（例: `"A社の件どうなってた？"`） |
| `npm run cw:learn` | ログから**会社まるごと理解ドキュメント**（ルームノート＋会社プロファイル）を自動生成 |
| `npm run cw:test` | セルフテスト（APIキー不要・外部通信なし） |

GitHub Actionsを設定すれば、**毎朝7時に自動でブリーフがChatworkに届く**ようになります（後述）。

## セットアップ（5分）

### 1. ChatworkのAPIトークンを発行

1. Chatworkの右上の自分のアイコン →「サービス連携」を開く
2. 左メニューの「APIトークン」→ パスワードを入れて発行
3. 表示されたトークンをコピー

### 2. `.env` に追記

プロジェクト直下の `.env`（なければ `.env.example` をコピーして作成）に追記:

```
CHATWORK_API_TOKEN=コピーしたトークン
ANTHROPIC_API_KEY=（任意。AI機能を使う場合 https://console.anthropic.com で発行）
```

`ANTHROPIC_API_KEY` がなくても、同期・朝ブリーフ・キーワード検索は動きます。
AI要約・ナレッジ学習・自然文Q&Aを使う場合だけ必要です。

### 3. 動かしてみる

```
npm run cw:test     # まずセルフテストで動作確認
npm run cw:sync     # Chatworkから取り込み
npm run cw:brief    # 朝ブリーフを表示
```

## 毎日の使い方（イメージ）

```
朝:    npm run cw:brief          → 今日やるべきことが1枚にまとまる
随時:  npm run cw:ask -- "○○社の求人の条件って何だったっけ？"
週1:   npm run cw:learn          → アシスタントの「会社理解」を最新化
```

## データの保存先

- **ローカルモード（初期状態）**: `data/`（メッセージ・同期状態）と `knowledge/`（自動生成ナレッジ）に保存。どちらも `.gitignore` 済みで、**社内チャットのログがGitHubに上がることはありません**。
- **Supabaseモード（推奨）**: Supabaseの「SQL Editor」で `supabase_assistant.sql` を実行すると自動で切り替わります。チームでのデータ共有と、GitHub Actionsでの自動実行時のデータ永続化ができます（案件管理アプリと同じSupabaseプロジェクトでOK）。

## 自動実行（GitHub Actions）— 毎朝ブリーフを自動で受け取る

1. Supabaseで `supabase_assistant.sql` を実行しておく（自動実行時のデータ置き場として推奨）
2. GitHubのリポジトリページ → Settings → Secrets and variables → **Actions** → New repository secret で以下を登録:
   - `CHATWORK_API_TOKEN`（必須）
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（推奨）
   - `ANTHROPIC_API_KEY`（任意・AI要約用）
   - `CHATWORK_BRIEF_ROOM_ID`（任意・投稿先。未設定ならマイチャット）
3. 以上。スケジュールは `.github/workflows/assistant.yml` に定義済み:
   - **平日 7:00** … 同期＋朝ブリーフをChatworkに投稿
   - **平日 11/14/17時** … 同期のみ（履歴の取りこぼし防止）
   - **土曜 6:00** … 週次ナレッジ学習
4. すぐ試したいときは、GitHubの Actions タブ →「Chatwork Assistant」→ Run workflow で手動実行できます。

## 仕組みと制約（知っておくと安心）

- Chatwork APIの仕様上、一度に取得できるのは各ルーム**最新100件**まで。過去の全履歴を一括では取れませんが、**定期的に同期することでそれ以降の履歴がどんどん蓄積**されていきます（自動実行の設定を推奨する理由です）。
- APIのレート制限（300リクエスト/5分）は自動で待機・リトライします。
- 「未返信メンション」は _「メンションの後にあなたがそのルームで発言していない」_ ことで判定する簡易ロジックです。目安としてお使いください。
- AI利用時のコスト目安: 朝ブリーフ1回あたり数円程度、ナレッジ学習はルーム数によって数十円程度です。

## セキュリティ上の注意

- APIトークンは**あなたのChatworkアカウントと同じ権限**を持ちます。`.env` やGitHub Secrets以外の場所（コード内・チャット内）には絶対に書かないでください。
- Supabaseモードでは社内チャットのログがSupabaseに保存されます。既存アプリと同様「URLとanonキーを知っていれば読める」簡易設定なので、キーの取り扱いには注意してください。

## ファイル構成

```
assistant/
  sync.js            Chatworkからの取り込み（差分同期・重複排除・レート制限対応）
  brief.js           朝ブリーフの生成とChatworkへの投稿
  ask.js             ログ・ナレッジを根拠にしたQ&A（--grepで検索のみも可）
  learn.js           ルームノート＋会社プロファイルの自動生成
  lib/
    env.js           .env読み込みと設定
    chatwork.js      Chatwork APIクライアント
    cwformat.js      Chatwork記法の整形・日時処理（日本時間）
    store.js         保存層（ローカル/Supabase自動切り替え）
    claude.js        Claude APIクライアント
    anken.js         案件管理アプリ（candidatesテーブル）との連携
  test/selftest.js   セルフテスト（モックサーバー使用）
supabase_assistant.sql        Supabaseモード用のテーブル作成SQL
.github/workflows/assistant.yml  自動実行スケジュール
```
