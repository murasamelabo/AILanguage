// 実験用の Anthropic クライアントを作る。
// - API キー: 環境変数 AILANG_API_KEY
// - ワークスペース ID（任意）: 引数 --workspace wrkspc_... または環境変数 AILANG_WORKSPACE_ID。
//   特定のワークスペースに紐づいていないキーでは、anthropic-workspace-id ヘッダーが必須になる。
import Anthropic from '@anthropic-ai/sdk';

// 100 万トークンあたりの単価（ドル）: [入力, 出力]。2026-11-03 時点の公開価格。
export const PRICE = {
  'claude-fable-5-2': [8, 40],
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};
export const costOf = (model, usage) =>
  (usage.input_tokens * PRICE[model][0] + usage.output_tokens * PRICE[model][1]) / 1e6;

export function makeClient() {
  const apiKey = process.env.AILANG_API_KEY;
  if (!apiKey) {
    console.error('環境変数 AILANG_API_KEY が設定されていません。環境設定に追加してからセッションを開き直してください。');
    process.exit(1);
  }
  const i = process.argv.indexOf('--workspace');
  const workspace = i > 0 ? process.argv[i + 1] : process.env.AILANG_WORKSPACE_ID;
  return new Anthropic({
    apiKey,
    maxRetries: 5,
    ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
  });
}
