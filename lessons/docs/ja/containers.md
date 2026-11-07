# Containers で実行する

isolate（Workers）は速くて安い代わりに、OS のコマンドも、ネイティブのライブラリも、ファイルシステムもありません。**Containers** はその制約を捨てる場所です。Docker イメージをそのまま動かせます。

この章のエディタは、書いた Python をコンテナの中のファイルに置いて `python3` で実行しています。`print` の出力がそのまま返ります。

## 何が変わるか

|            | isolate                   | container                              |
| ---------- | ------------------------- | -------------------------------------- |
| 起動       | ミリ秒                    | 秒                                     |
| 使えるもの | Web 標準 + バインディング | OS コマンド、任意のバイナリ、pip / apt |
| ファイル   | なし                      | あり（ただし揮発）                     |
| 課金       | リクエスト + CPU          | 実行している時間 + メモリ              |

Python、ffmpeg、Playwright、ネイティブ拡張を使う科学計算は、isolate では動きません。逆に「HTTP を待つ」「DB を引く」だけなら isolate の方が速くて安い。

## このサイトでの作り

- イメージは `Dockerfile.sandbox`（Node のイメージ + `python3`）
- `getSandbox('lesson-container')` でコンテナを 1 つ取り、使い回す
- 実行ごとに `/workspace/run-<id>.py` を書いて `python3` で走らせ、終わったら消す
- 外向きの通信は切ってある

```ts
const sandbox = await getSandbox('lesson-container');
await sandbox.files.writeFile('/workspace/main.py', code);
const result = await sandbox.run(['python3', 'main.py'], { cwd: '/workspace' });
```

## 注意

- コンテナは**起動に秒**かかり、使っていないと止まる。初回の実行だけ遅い
- 実行している間は課金される。回数が多い処理を置く場所ではない
- 状態は残らない。残したいものは D1 / R2 / KV に置く

どこで isolate とコンテナを分けるかは [ランタイムの深掘り](/docs/runtimes) にまとめています。
