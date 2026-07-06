# 建置工具（選用）

`index.html` 是自包含的成品，**平常不需要任何 build**——更新資料只要把新的
Flighty CSV 拖進網頁即可。這個資料夾只在你想「重建 index.html」時使用，
例如：想把新的 CSV 換成內建預設資料、更新機場資料庫、或修改頁面本身。

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.template.html` | 頁面原始碼（含佔位符 `/*__DATASETS__*/`、`/*__DEFAULT_CSV__*/`） |
| `gen.js` | 從 OurAirports / OpenFlights / Natural Earth 產生 `datasets.gen.js`（機場座標+UTC偏移、國名、世界陸地 SVG path） |
| `datasets.gen.js` | 上述產出（已生成，可直接用） |
| `gen-flags.js` | 從 circle-flags（HatScripts/circle-flags）下載 82 國圓形國旗 SVG → `flags.gen.js` |
| `flags.gen.js` | 上述產出（已生成，可直接用）；查無的國家頁面會退回幾何近似旗/字母圓 |
| `airlines.js` | ICAO→[IATA, 中文名, 英文名, 品牌色] 航空公司對照表（手動維護） |
| `dl-logos.js` / `pack-logos.js` | 從 Jxck-S/airline-logos（FlightAware 版，`{ICAO}.png` 90×90）下載全部航空 logo，縮成 48×48 後打包精選 66 家 → `logos.gen.js`（縮圖需 PowerShell System.Drawing，見檔內註解） |
| `logos.gen.js` | 上述產出（已生成，可直接用）；查無 logo 的航空退回品牌色字母徽章 |
| `build.js` | 組裝 + 壓縮：template + Preact/htm runtime + datasets + airlines + 原始 CSV → `../index.html`（單檔、自包含、已 minify HTML/CSS/JS） |
| `test.js` | 驗證出貨 index.html 內的解析/統計「純邏輯」（45 項，Node `vm`） |
| `test.ui.js` | 用 jsdom 開啟出貨 index.html，驗證 Preact 儀表板實際渲染＋互動（篩選、展開、切語言…共 23 項） |

## 前端架構

- **純邏輯區**（`/*__LOGIC_START__*/`…`/*__LOGIC_END__*/`）：CSV 解析、統計、地理運算，無 DOM，`test.js` 直接測。
- **命令式區**：世界地圖繪製、縮放/平移、航跡播放、分享成 SVG/PNG、資料載入、主題——這些是 SVG/rAF/pointer 重活，Preact 幫不上忙，維持原樣。
- **Preact 元件層**：地圖以下的資料區塊（統計磚、年份長條、準點、排行、航班列表、頁尾、狀態列）改用 [Preact](https://preactjs.com/) + [htm](https://github.com/developit/htm) 元件，掛在 `#dash` / `#yearFilter` / `#statusLine` 三個根。狀態變更呼叫 `renderWidgets()` 讓 Preact **diff** 出差異，取代原本「`textContent=''` 全部重建」，切年份/語言時不再閃爍、focus/scroll 不重置。

## 建置管線

1. **Preact/htm runtime**：`build.js` 直接讀 `node_modules` 內 `preact` / `preact/hooks` / `htm` 的 UMD 版，接一小段 glue 把 `html()`/`render()`/hooks 掛上 `window`，注入 `/*__RUNTIME__*/` 這個獨立 `<script>`（載入順序：preact → hooks → htm → glue）。成品仍**零外部相依**。
2. **壓縮**：用 [`html-minifier-terser`](https://www.npmjs.com/package/html-minifier-terser)（內部走 `terser` + `clean-css`）把 CSS、JS、HTML 一次壓縮成**單一自包含 `index.html`**。保留 `/*__LOGIC_*__*/` 兩個標記註解，讓 `test.js` 能對「實際出貨的壓縮版」切邏輯測試；頂層函式名與全域 `html`/`render` **不 mangle**，確保分享 SVG 時 `document.querySelector('style')` 抓 CSS、以及元件引用的全域都不壞。

首次使用先安裝相依（只需一次，`node_modules/` 已 gitignore）：

```sh
npm install         # preact + htm（會內嵌進成品）、html-minifier-terser + jsdom（build/test 用）
```

## 重建步驟

```sh
npm run build       # = node tools/build.js　→ 壓縮版 ../index.html（出貨用）
npm run build:dev   # = node tools/build.js --no-min　→ 可讀未壓縮版，方便除錯
npm test            # 先 build（壓縮版）再跑 test.js（邏輯）+ test.ui.js（UI）
```

- Preact + htm + hooks 內嵌後約 +17 KB（壓縮前）/ +7 KB（gzip）。壓縮只影響手寫的 CSS/JS；
  整檔約省 3%，因為 8 成體積是已接近不可壓的 base64 logo/國旗/地理資料
  （GitHub Pages 會再用 gzip 傳輸，實際下載約 302 KB）。

- 內嵌預設資料即 `demo.csv`（部署時頁面也會 fetch 它，換檔即可更新線上資料，無需重建）。
  （`test.js` 內的基準數字是針對 2026-07-05 那份 66 筆資料，換資料後需自行更新。）
- 要更新機場資料庫：下載以下檔案到本資料夾後執行 `node gen.js`：
  - https://davidmegginson.github.io/ourairports-data/airports.csv
  - https://davidmegginson.github.io/ourairports-data/countries.csv
  - https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat （檔名存成 openflights.dat）
  - https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json （檔名存成 land110m.json）
