# Frontier Model Release Timeline

[![Validate and render](https://github.com/crosscore/frontier-model-release-timeline/actions/workflows/ci.yml/badge.svg)](https://github.com/crosscore/frontier-model-release-timeline/actions/workflows/ci.yml)

Frontier AIモデルの発表が重なっていく様子を、編集可能なJSONから動画にするローカル生成ツールです。OpenAI / Anthropic / Google（Gemini）の**51件の選定イベント（2023-01-01〜2026-10-02）**を、公式出典付きで収録しています。業界全体を網羅したデータではありません。花火は横軸＝発表日、縦軸＝[Epoch AIのEpoch Capabilities Index（ECI）](https://epoch.ai/benchmarks/eci)の2次元グラフ上で、各モデルのスコアの高さで開きます。

[横長MP4](https://github.com/crosscore/frontier-model-release-timeline/raw/refs/heads/main/preview/frontier-landscape.mp4) · [縦長MP4](https://github.com/crosscore/frontier-model-release-timeline/raw/refs/heads/main/preview/frontier-portrait.mp4) · [全出典CSV](preview/sources.csv) · [集計方法](docs/methodology.md)

![Generated animation preview](preview/preview.gif)

GIFは無音・8fpsの見本です。BGMと滑らかな動きは上のMP4から確認できます。

30秒、30fps、オリジナルBGM・打上げ音付き。横長1920×1080と縦長1080×1920のMP4、GIF、ポスター、英語字幕、出典一覧ページを同梱しています。映像は英語、操作手順は日本語です。

## 再生成

Node.js 22以上と、H.264エンコーダーを含むFFmpegが必要です。Macでは `brew install node ffmpeg` で導入できます。APIキー・有料API・ブラウザ自動化は不要です。初回の依存取得後はオフラインで描画できます。

```bash
git clone https://github.com/crosscore/frontier-model-release-timeline.git
cd frontier-model-release-timeline
npm ci --ignore-scripts
npm test
npm run build
npm run render
npm run render -- --format portrait
npm run verify:media
npm run verify:media -- --format portrait
npm run preview
```

`http://127.0.0.1:4173` で動画と出典一覧を開きます。`build` は静止画・一覧を準備し、`render` が動画を生成します。生成先はGit管理外の `dist/` です。音も毎回ローカルで合成・マスタリングします。保存済み動画をすぐ見る場合は `npm run preview -- --out preview` を使用してください。プレビューは自動再生しません。

```bash
# 軽量版（3秒に圧縮した動作確認用。共有用には通常の長さを推奨）
npm run render -- --width 640 --fps 10 --duration 3 --no-gif

# 別のデータ・出力先、縦長720p
npm run render -- --data data/releases.json --out output --format portrait --width 720

# 同梱プレビューを更新する場合
npm run build -- --out preview
npm run render -- --out preview
npm run render -- --out preview --format portrait
```

## データを更新

1. [data/releases.json](data/releases.json) の `releases` に日付順で追加します。`sources` には公式発表または公式リリースノートのHTTPS URLを入れます。
2. 同じ会社・同じ日の同時発表は1件にまとめます。プレビューは `stage: "preview"` で明示します。
3. [選定ルール](docs/methodology.md) に照らして対象を確認し、必要に応じて `endDate` と `verifiedOn` を更新します。
4. 能力スコアを付ける場合は `capability.model` にEpoch AIのECI一覧でのモデル名を入れ、`npm run scores` でEpochの公開CSVからスコアを取り込みます（ネット接続が必要。未採点のモデルは `score: null` のまま地上の噴き出し花火になります）。対応づけの規則は[集計方法](docs/methodology.md#capability-scores)を参照してください。
5. `npm run validate && npm test` を実行してから再生成します。日付の正しさ・採否の判断は人が一次情報で確認してください。CIは出典本文の自動事実確認を行いません。

最小イベント例（既存行を編集する形で利用）:

```json
{
  "id": "openai-gpt-4",
  "date": "2023-03-14",
  "lab": "openai",
  "name": "GPT-4",
  "stage": "release",
  "capability": { "model": "GPT-4 (Mar 2023)", "score": 125.89 },
  "sources": [{
    "url": "https://openai.com/index/gpt-4-research/",
    "title": "GPT-4 — official announcement"
  }]
}
```

## 映像の読み方

- 1つの開花＝1件の選定イベント。日付は一定速度で進み、開花と破裂音が公開日の時刻に一致します。上昇は0.36秒前から始まります。
- 横軸は2023年1月〜2026年12月の通しの暦（観測終了日より後は斜線）、縦軸はECIスコアです。花火は発表日の位置から真上に上がり、そのモデルのECIの高さで開きます。開いた点はマーカーとして残り、会社ごとの「その時点の最高スコア」を階段状の線で結ぶので、能力が上がっていく様子がグラフとして積み上がります。
- Epoch AIがまだ採点していない発表（初代Claude、Gemini Ultra 1.0、Gemini 1.5 Proの2月版、GPT-5.3 Instant、GPT-6 Sol、GPT-6.1 Sol）は高さを持たず、横軸の上で低い噴き出し花火になります。一覧のスコア欄は「—」です。
- カメラは暦の「今」を追って寄りで撮り、花火が開くたびにその点へ一瞬寄って揺れます（その会社の最高スコアを更新した発表ほど強く）。開いた花火の横にはモデル名とECI（未採点は NOT YET SCORED）の名札が約1.2秒出ます。BGMの段階の切り替わりで一瞬引き、終了日の2小節前からさらに寄って、観測終了日のドロップでグラフ全体へ引きます。カメラは時刻だけで決まるので、どのフレームも単独で同じ絵になります。
- 横長ではグラフの右（縦長では下）に**発表ペース**を並べています。株価チャートと並べるRSIのような指標で、ECIのグラフと同じ暦・同じカメラで動きます。値は選定イベントの指数移動平均（時定数60日）を「1年あたりの件数」に年換算したもので、発表のたびに約6ずつ跳ね上がり（花火と同時に会社の色の輪が開き、下端に点が残ります）、次の発表まで減衰します。g日に1件の一定ペースなら平均365/gに落ち着くので、点線の目盛りは60日・30日・14日・7日に1件（年6・12・26・52件）の位置です。縦軸はペースが過去最高を更新するたびに広がるので、目盛りが下へ沈んでいくこと自体が加速を表します。このデータでは最後に年46件ほど（約8日に1件）になります。2026年の平均（12.5日に1件＝年29件）より高いのは2026年9月に発表が集中したためです。観測開始（2023-01-01）より前の発表はデータに含めていないため、曲線は0から始まり、2023年初めの値は実際より低く出ます。
- MintがOpenAI、AmberがAnthropic、青紫がGoogle。会社ごとに開花の形（牡丹・長い尾のきらめき・二重の輪）とマーカーの形（丸・ひし形・四角）が決まっていて、色に頼らず見分けられます。半径・粒子数・寿命は全発表で同じです。プレビューはモデル名の `*` と中空のマーカーで区別します。
- ECIは多数のベンチマークを1つの尺度にまとめた指数で、各スコアには数ポイント幅の不確かさがあります。数点の差は順位の根拠になりません。同時発表の複数モデルをまとめたイベントでは、最上位の階層（Claude 3ならOpus、GPT-5.6ならSol）のスコアを使います。
- モデル名の一覧は会社ごとに常に最新が一番上で、右端にECIスコア（整数に丸め）を表示します。新着は上から入り、古い名前を1行ずつ押し下げます（5件目はフェードアウト）。各名前は最新4件の中に最低1.4秒残り、最新の名前は最後の静止区間まで表示されます。縦長はOpus/Sonnet/Fableの前のClaude接頭辞を省略します（Claude 2等の数字だけの名前は維持）。全正式名は字幕と出典一覧に残ります。
- 最後の棒グラフは **観測日数 ÷ 選定イベント数**。平均発表間隔や開発期間とは異なります。2026年は275日分の途中集計です。右側（縦長では下）には、初年と最終年それぞれで選定イベント中の最高ECI（126 → 167）を表示します。

このデータでは年ごとに **60.8 / 40.7 / 26.1 / 12.5日／件** となります。数値は描画時に計算され、選定を変えると結果も変わります。参考投稿の「18日」はコピーしていません。

## 構成と検証

| パス | 役割 |
| --- | --- |
| `data/releases.json` | 更新する原本。日付・モデル名・注記・一次出典 |
| `src/data.mjs` | データ検証、UTC日付処理、年別集計 |
| `src/capability.mjs` | Epoch AIのECI CSVの読み込みとスコアの反映（`npm run scores`） |
| `src/timeline.mjs` | 等速の再生時計と正確な開花時刻 |
| `src/chart.mjs` | 日付×ECIのグラフ座標 |
| `src/pace.mjs` | 発表ペース（60日の指数移動平均を1年あたりの件数に年換算） |
| `src/camera.mjs` | 時刻だけで決まる仮想カメラ（追従・寄り・ドロップで全体へ） |
| `src/audio.mjs` | オリジナル楽曲・発表効果音の決定的な合成 |
| `src/draw.mjs` | 2つのアスペクト比の独自Canvasデザイン（2〜3社に対応） |
| `scripts/` | ビルド、FFmpeg出力、動画検証、ローカル表示 |
| `preview/` | 生成済みMP4・GIF・字幕・ポスター・出典一覧 |
| `test/` | 集計、境界日、同時発表、文字のはみ出し、決定性のテスト |

CIはmacOS / Linuxでテスト・ビルドし、Linuxでは横長・縦長を実際にH.264へエンコードして音声付きで全フレームをデコードします。`manifest-*.json` と動画の寸法・フレーム数・長さ・原本JSONのSHA-256を照合します。音声のLUFS・True Peak・LRAも最終MP4から計測し、音圧や無音・クリッピングの問題を検出します。動画のバイト列はFFmpegやOSのバージョンにより変わり得ます。

## オリジナルBGM

**Afterburn / 004** — 128 BPMのエレクトロニック。30秒がちょうど16小節（導入1・暦の進行12・到着1・結論2）です。重低音が軸で、175 Hzから50 Hzへ沈む歪ませたキック、キックのたびに大きく沈み込むサイン波のサブベース、その1オクターブ上でうねるリース・ベースで組んでいます。暦の進行中は3段階で密度が上がり（4つ打ちと白玉のサブ → 裏拍のベースとクラップ → 16分で転がるベースとスーパーソウ）、段階の頭でクラッシュが鳴ります。終了日の2小節前からスネアロールが加速し、直前の半小節はキックもベースも抜いてライザーだけで溜め、観測終了日でドロップします。ドロップ後はグルーヴを止めずに最後の3.2秒でフェードアウトし、締めの和音は置いていません。盛り上がりは日付ではなく映像の構成に合わせています。各発表には日付に同期した上昇音・破裂音・会社ごとの音程のチャイム・パチパチ音が鳴り、左右の位置も会社ごとに分けています（OpenAI左、Anthropic右、Google中央）。

[音声だけを再生・保存](preview/soundtrack-landscape.m4a) · [合成方法と権利](docs/audio.md) · [音圧・同期時刻](preview/audio-landscape.json) · [デザイン監査記録](docs/design-review.md)

既存曲・録音サンプル・音楽生成サービス・課金APIは使用していません。コード・生成曲・効果音はMITライセンスです。最終AACは約−16 LUFS / −1.5 dBTP以下に線形でマスタリングしています。Claudeによる確認は画像・ソース・音響計測が対象で、人間の耳による試聴合格を意味しません。

## 参考とライセンス

[MoniiiiのX投稿](https://x.com/miniii_codes/status/2103938407558947265)を実際に確認し、日付の密度が増していく着想を参考にしました。確認内容・独自化した点は [docs/reference.md](docs/reference.md) に記載しています。元動画・画像・音声・ロゴは含めていません。

能力スコアはEpoch AIの[Epoch Capabilities Index](https://epoch.ai/benchmarks/eci)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)、2026-10-03取得）です。映像のフッター・字幕・出典一覧ページにクレジットを表示しています。本プロジェクトはEpoch AIと提携・承認関係にありません。

生成コード・独自グラフィック・オリジナル音楽と効果音は [MIT](LICENSE)。同梱のManropeは [SIL Open Font License](assets/fonts/OFL.txt) です。[フォントの取得元](assets/fonts/README.md)を参照してください。リンク先の発表記事は各権利者に帰属します。
