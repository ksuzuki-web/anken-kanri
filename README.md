# 案件管理アプリ（ステップ2：4人共有・公開版）

宅建Jobエージェント ユニット向け、候補者選考進捗の共有管理ツールです。
Supabase（データベース）に接続し、ユニットの4人で同じデータをリアルタイムに見られる構成です。

## Claude Codeで進める作業（この順番で進めてください）

### 1. Supabaseのプロジェクトを作る

1. https://supabase.com にアクセスし、アカウントを作成
2. 「New project」でプロジェクトを作成（リージョンは Tokyo (ap-northeast-1) を推奨）
3. プロジェクト作成後、左メニューの「SQL Editor」を開く
4. このフォルダ内の `supabase_setup.sql` の内容を全部貼り付けて実行（Run）
   → これでテーブルと、4人が読み書きできる権限設定、リアルタイム共有の設定が完了します
5. 左メニューの「Project Settings」→「API」を開き、以下の2つをメモする
   - Project URL（例: `https://xxxxx.supabase.co`）
   - anon public key（長い文字列）

### 2. このプロジェクトに接続情報を設定する

このフォルダに `.env` という名前のファイルを新しく作り、以下のように書く（`.env.example`を参考に）。

```
VITE_SUPABASE_URL=さっきメモしたProject URL
VITE_SUPABASE_ANON_KEY=さっきメモしたanon public key
```

### 3. ローカルで動作確認する

```
npm install
npm run dev
```

表示されたURL（通常 http://localhost:5173 ）をブラウザで開き、候補者を追加してみる。
別のブラウザ（またはシークレットウィンドウ）で同じURLを開いても、同じデータが見えることを確認する。

### 4. 公開する（Vercelへデプロイ）

1. GitHubにこのプロジェクトをアップロード（Claude Codeに「GitHubにpushして」と頼めば一緒に進められます）
2. https://vercel.com にアクセスし、GitHubアカウントでログイン
3. 「Add New Project」→ 該当のGitHubリポジトリを選択
4. 「Environment Variables」の設定箇所で、`.env`に書いた2つの値（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）を登録
5. 「Deploy」を押す
6. 数十秒で公開用URL（`https://〇〇.vercel.app`）が発行される

このURLを4人で共有すれば、それぞれのスマホ・PCから同じデータを見て編集できます。
現状は認証なし（URLを知っていれば誰でも使える）の設定です。

## 今のバージョンでできること

- 候補者をカード化し、ステータス別のカンバンボードで管理
- 担当CA、企業名、紹介料、面接日、メモ、次回アクションの記録
- 停滞アラート：ステータス変更から一定日数以上動きがない案件を赤枠表示
- 期限アラート：面接予定日を過ぎてもステータスが進んでいない案件を赤枠表示
- 担当CA別フィルタ、要注意案件のみ表示
- Supabaseに接続し、4人でリアルタイムにデータを共有（誰かが編集すると他の人の画面も自動更新）

## まだできないこと（必要なら今後対応）

- ログイン・権限管理（今は認証なし）
- HRBC（Porters）との連携

## ファイル構成

```
supabase_setup.sql    Supabaseで実行するテーブル作成・権限設定SQL
.env.example           接続情報の書き方サンプル（.envを自分で作る）
src/
  constants.js          ステータス定義、担当CA一覧、アラートのしきい値
  alerts.js             停滞・期限超過の判定ロジック
  storage.js            Supabaseとのデータ送受信（読込・作成・更新・削除・リアルタイム購読）
  components/
    CandidateCard.jsx    候補者カード
    KanbanColumn.jsx     カンバンの列
    CandidateModal.jsx   追加・編集モーダル
    ClosedSection.jsx    落選・離脱の一覧（折りたたみ）
  App.jsx               全体のレイアウトと状態管理
```

## カスタマイズしたい点があれば

- 担当CAの名前は `src/constants.js` の `CA_MEMBERS` を編集してください
- 停滞アラートの基準日数はステータスごとに `src/constants.js` の `STALL_THRESHOLDS` で調整できます
