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
| `build.js` | 組裝：template + datasets + airlines + 原始 CSV → `../index.html` |
| `test.js` | 驗證組出來的 index.html 內的解析/統計邏輯（45 項測試） |

## 重建步驟

```sh
cd tools
node build.js   # 讀取 ../FlightyExport-2026-07-05.csv，輸出 ../index.html
node test.js    # 驗證
```

- 要換內建預設資料：把新 CSV 放到專案根目錄，改 `build.js` 裡的檔名後重建。
  （`test.js` 內的基準數字是針對 2026-07-05 那份 66 筆資料，換資料後需自行更新。）
- 要更新機場資料庫：下載以下檔案到本資料夾後執行 `node gen.js`：
  - https://davidmegginson.github.io/ourairports-data/airports.csv
  - https://davidmegginson.github.io/ourairports-data/countries.csv
  - https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat （檔名存成 openflights.dat）
  - https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical/ne_110m_land.json （檔名存成 land110m.json）
