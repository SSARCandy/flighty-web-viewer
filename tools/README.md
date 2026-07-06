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
| `build.js` | 組裝 + 壓縮：template + datasets + airlines + 原始 CSV → `../index.html`（單檔、自包含、已 minify HTML/CSS/JS） |
| `test.js` | 驗證組出來的 index.html 內的解析/統計邏輯（45 項測試） |

## 建置管線

用 [`html-minifier-terser`](https://www.npmjs.com/package/html-minifier-terser)（內部走 `terser` + `clean-css`）
把內嵌的 CSS、JS 與 HTML 一次壓縮，成品仍是**單一自包含的 `index.html`**（不含任何外部
CDN / 檔案相依）。JS 保留 `/*__LOGIC_START__*/`、`/*__LOGIC_END__*/` 兩個標記註解，讓
`test.js` 能直接對「實際出貨的壓縮版」切出純邏輯區測試。頂層函式名稱不做 mangle，
確保分享成 SVG 時 `document.querySelector('style')` 抓 CSS、以及測試引用的函式名都不會壞掉。

首次使用先安裝相依（只需一次，`node_modules/` 已 gitignore）：

```sh
npm install
```

## 重建步驟

```sh
npm run build       # = node tools/build.js　→ 壓縮版 ../index.html（出貨用）
npm run build:dev   # = node tools/build.js --no-min　→ 可讀未壓縮版，方便除錯
npm test            # 先 build（壓縮版）再跑 test.js 驗證
```

- 壓縮只影響手寫的 CSS/JS（約省 32%）；整檔約省 3%，因為 8 成體積是已接近不可壓的
  base64 logo/國旗/地理資料（GitHub Pages 會再用 gzip 傳輸，實際下載約 295 KB）。

- 內嵌預設資料即 `demo.csv`（部署時頁面也會 fetch 它，換檔即可更新線上資料，無需重建）。
  （`test.js` 內的基準數字是針對 2026-07-05 那份 66 筆資料，換資料後需自行更新。）
- 要更新機場資料庫：下載以下檔案到本資料夾後執行 `node gen.js`：
  - https://davidmegginson.github.io/ourairports-data/airports.csv
  - https://davidmegginson.github.io/ourairports-data/countries.csv
  - https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat （檔名存成 openflights.dat）
  - https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json （檔名存成 land110m.json）
