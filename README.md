# Frontier Model Release Timeline

[![Validate and render](https://github.com/crosscore/frontier-model-release-timeline/actions/workflows/ci.yml/badge.svg)](https://github.com/crosscore/frontier-model-release-timeline/actions/workflows/ci.yml)

Frontier AIモデルの発表が重なっていく様子を、編集可能なJSONから動画にするローカル生成ツールです。OpenAI / Anthropic / Google（Gemini）/ DeepSeek / Meta の**79件の選定イベント（2023-01-01〜2026-10-19）**を、公式出典付きで収録しています。ECIあり71件、未採点8件です。業界全体を網羅したデータではありません。花火は横軸＝発表日、縦軸＝[Epoch AIのEpoch Capabilities Index（ECI）](https://epoch.ai/benchmarks/eci)の2次元グラフ上で、各モデルのスコアの高さで開きます。

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
npm run verify:artifacts
npm run qa:visual
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
  "capability": { "model": "GPT-4 (Mar 2023)", "score": 125.88 },
  "sources": [{
    "url": "https://openai.com/index/gpt-4-research/",
    "title": "GPT-4 — official announcement"
  }]
}
```

## 映像の読み方

- 1つの開花＝1件の選定イベント。日付は一定速度で進み、開花と破裂音が公開日の時刻に一致します。上昇は0.36秒前から始まります。
- 横軸は2023年1月〜2026年12月の通しの暦（観測終了日より後は斜線）、縦軸はECIスコアです。花火は発表日の位置から真上に上がり、そのモデルのECIの高さで開きます。開いた点はマーカーとして残り、会社ごとの「その時点の最高スコア」を階段状の線で結ぶので、能力が上がっていく様子がグラフとして積み上がります。
- Epoch AIがまだ採点していない発表（初代Claude、Gemini Ultra 1.0、Gemini 1.5 Proの2月版、DeepSeek V2.5 / R1-Lite-Preview / V4.1 Flash-1017、GPT-5.3 Instant、Muse Wonder）は高さを持たず、横軸の上で低い噴き出し花火になります。一覧のスコア欄は「—」です。
- カメラは暦の「今」と最近のスコアを滑らかに追い、構成に合わせてゆっくり寄ります。拍・小節・発表ごとの拡大、周期的な引き、揺れをすべて外しました。開いた花火の横にはモデル名とECI（未採点は NOT YET SCORED）の名札が最大約1.2秒出ます。名札は花火と階段線の手前に重ね、暗い背景板と会社色の細い枠で読みやすくしています。0.3秒以内の近接発表は最大3行にまとめ、次の名札と重なる前に切り替えます。終了日の2小節前からさらにゆっくり寄り、観測終了日のドロップでグラフ全体へ引きます。カメラは時刻だけで決まるので、どのフレームも単独で同じ絵になります。
- 横長ではグラフの右（縦長では下）に**発表ペース**を並べています。株価チャートと並べるRSIのような指標で、ECIのグラフと同じ暦・同じカメラで動きます。値は選定イベントの指数移動平均（時定数60日）を「1年あたりの件数」に年換算したもので、発表のたびに約6ずつ跳ね上がり（花火と同時に会社の色の輪が開き、下端に会社別の形のマーカーが5段で残ります）、次の発表まで減衰します。g日に1件の一定ペースなら平均365/gに落ち着くので、点線の目盛りは60日・30日・14日・7日に1件（年6・12・26・52件）の位置です。縦軸はペースが過去最高を更新するたびに広がるので、目盛りが下へ沈んでいくこと自体が加速を表します。このデータでは最後に年62.8件ほど（約5.8日に1件）になります。2026年の平均（9.1日に1件＝年40.0件）より高いのは2026年9月下旬〜10月に発表が集中したためです。観測開始（2023-01-01）より前の発表はデータに含めていないため、曲線は0から始まり、2023年初めの値は実際より低く出ます。
- MintがOpenAI、AmberがAnthropic、青紫がGoogle、銅色がDeepSeek、ローズがMeta。既存3色を保ち、5社それぞれに異なる開花とマーカーの形を割り当て、色に頼らず見分けられます。半径・粒子数・寿命は全発表で同じです。プレビューはモデル名の `*` と中空のマーカーで区別します。
- ECIは多数のベンチマークを1つの尺度にまとめた指数で、各スコアには数ポイント幅の不確かさがあります。数点の差は順位の根拠になりません。同時発表の複数モデルをまとめたイベントでは、最上位の階層（Claude 3ならOpus、GPT-5.6ならSol）のスコアを使います。
- モデル名の一覧は横長で5列、縦長で3社＋2社の2段です。各社とも常に最新が一番上で、右端にECIスコア（整数に丸め）を表示します。新着は上から入り、古い名前を1行ずつ押し下げます（5件目はフェードアウト）。各名前は最新4件の中に最低1.4秒残り、最新の名前は最後の静止区間まで表示されます。狭い一覧ではClaude・DeepSeekの反復する会社名を省略します（Claude 2等の数字だけの名前は維持）。日付は名前と別行に表示します。全正式名は字幕と出典一覧に残ります。
- 最後の棒グラフは **観測日数 ÷ 選定イベント数**。平均発表間隔や開発期間とは異なります。2026年は292日分の途中集計です。右側（縦長では下）には、初年と最終年それぞれで選定イベント中の最高ECI（126 → 167）を表示します。

| 会社 | 色 | マーカー | 開花 |
| --- | --- | --- | --- |
| OpenAI | Mint `#76D3B2` | 丸 | 牡丹 |
| Anthropic | Amber `#FFB547` | ひし形 | 長い尾のきらめき |
| Google | 青紫 `#9AA5FF` | 四角 | 二重の輪 |
| DeepSeek | 銅色 `#D2823C` | 三角 | 上方へ広がる扇 |
| Meta | ローズ `#DC50A0` | 十字 | 四方向の星 |

このデータでは年ごとに **40.6 / 21.5 / 17.4 / 9.1日／件** となります。数値は描画時に計算され、選定を変えると結果も変わります。参考投稿の数値を転用せず、原本から毎回計算します。

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
| `src/draw.mjs` | 2つのアスペクト比の独自Canvasデザイン（2〜5社に対応） |
| `scripts/` | ビルド、FFmpeg出力、動画検証、ローカル表示 |
| `preview/` | 生成済みMP4・GIF・字幕・ポスター・出典一覧 |
| `test/` | 集計、境界日、同時発表、文字のはみ出し、決定性のテスト |

CIはmacOS / Linuxでテスト・ビルドし、Linuxでは横長・縦長を実際にH.264へエンコードして音声付きで全フレームをデコードします。`manifest-*.json` と動画の寸法・フレーム数・長さ・原本JSONのSHA-256を照合します。音声のLUFS・True Peak・LRAも最終MP4から計測し、音圧や無音・クリッピングの問題を検出します。動画のバイト列はFFmpegやOSのバージョンにより変わり得ます。

5社の配色はMachado方式の1型・2型（最大強度）を線形sRGBでシミュレーションし、Oklabの色距離と暗い背景へのコントラストを検査しています。最小距離は通常0.151、1型0.122、2型0.139、文字の最小コントラスト比は5.38です。識別には形と会社名も併用します。再現用の `npm run qa:visual`（`scripts/visual-checks.mjs`）は両形式の主要場面のコンタクトシート、原寸PNG、輝度・カメラ指標、配色の比較画像と数値をGit管理外の `output/qa/real/` に保存します。

[2026-10-19の検収資料](docs/reviews/2026-10-19-update.md)に、追加28件の出典・採否・既存42件のECI変更表・計測結果をまとめています。主系統のオープンウェイト（Llama・DeepSeek）は対象で、GPT-oss・Gemmaなどの副系統とは区別します。未採点8件を含む採否の境界は[方法論](docs/methodology.md#main-families-access-and-the-expanded-labs)に残しています。

## オリジナルBGM

**Deep Field / 005** — 128 BPM・G短調のオリジナル曲です。4案のうちUndertowの脈打つモノラルの低音を土台に、Low Orbitの疎なダブ和音と暗い残響を合わせました。Pressureの硬さとNight Shiftの旋律性は比較し、映像の発表音とぶつかる連続した上声を減らしています。旧曲は「Afterburn / 004」です。

30秒＝16小節（導入1・暦の進行12・到着1・結論2）は維持。約210 Hzから49 Hzへ落ちるキック、キックで深く沈んで拍間に膨らむサブ／中低音、少数の和音で進み、観測終了日の24.375秒で全体へ引く映像と同時にドロップします。ドロップで初めて短い旋律が前へ出て、最後の3.2秒をフェードアウトします。発表日は拍へ寄せず、各発表の上昇音と破裂音を同じ時計で鳴らします。

発表音は5社ごとに異なる音程と定位です（OpenAI左・D6、DeepSeek左寄り・C6、Google中央・G5、Meta右寄り・F6、Anthropic右・B♭5）。近接した発表ではゲインとパチパチ音の数・長さを抑え、発表時だけ高域・和音・中低音をダックしてチャイムの帯域を空けます。波形の決定性、帯域別RMS、SFX/BGM比、ラウドネス推移、スペクトログラムで確認し、試聴での合格とは区別しています。

[音声だけを再生・保存](preview/soundtrack-landscape.m4a) · [合成方法と権利](docs/audio.md) · [音圧・同期時刻](preview/audio-landscape.json) · [デザイン監査記録](docs/design-review.md)

既存曲・録音サンプル・音楽生成サービス・課金APIは使用していません。コード・生成曲・効果音はMITライセンスです。最終AACは約−16 LUFS / −1.5 dBTP以下に線形でマスタリングしています。Claudeによる確認は画像・ソース・音響計測が対象で、人間の耳による試聴合格を意味しません。

## 参考とライセンス

[MoniiiiのX投稿](https://x.com/miniii_codes/status/2103938407558947265)を実際に確認し、日付の密度が増していく着想を参考にしました。確認内容・独自化した点は [docs/reference.md](docs/reference.md) に記載しています。元動画・画像・音声・ロゴは含めていません。

能力スコアはEpoch AIの[Epoch Capabilities Index](https://epoch.ai/benchmarks/eci)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)、2026-10-19取得）です。映像のフッター・字幕・出典一覧ページにクレジットを表示しています。本プロジェクトはEpoch AIと提携・承認関係にありません。

生成コード・独自グラフィック・オリジナル音楽と効果音は [MIT](LICENSE)。同梱のManropeは [SIL Open Font License](assets/fonts/OFL.txt) です。[フォントの取得元](assets/fonts/README.md)を参照してください。リンク先の発表記事は各権利者に帰属します。
