# 個人飛行紀錄網頁 — 實作規格書

> 本文件為完整的開發交接規格，供任何 AI 或工程師直接據此實作，不需額外背景知識。
> 資料來源：iOS Flighty App 的 CSV 匯出檔（`FlightyExport-2026-01-14.csv`，隨附）。
> 撰寫日期：2026-07-06

---

## 1. 專案目標

Flighty 是 iOS 上的航班追蹤 App，內建漂亮的個人飛行統計畫面，但沒有網頁版。本專案要做一個**單一 HTML 檔案的網頁應用**，重現並擴充 Flighty 的個人飛行紀錄展示，包含世界地圖航線圖與各項統計。

核心產品決策（已與使用者確認）：

- **架構採「CSV 檢視器」模式（方案 A）**：網頁不寫死航班資料。使用者將 Flighty 匯出的 CSV 拖曳（或點選）上傳，網頁即時解析並渲染所有畫面。未來新增航班只需重新匯出、重新拖入，零程式修改。
- **內建預設資料**：將使用者目前這份 53 筆的資料以 JS 常數形式嵌入，網頁打開時直接顯示；拖入新 CSV 後覆蓋顯示。
- **選配持久化**：若執行環境允許，將最後一次上傳的 CSV 內容存入 `localStorage`，重新開啟時自動載入。**注意：Claude.ai 的 artifact 預覽環境不支援 localStorage**，必須用 feature-detection 包 try/catch，失敗時靜默降級為「僅本次會話有效」，不可讓整頁掛掉。

## 2. 交付物

一個自包含的 `index.html`：

- 所有 CSS、JS 內嵌，無 build step。
- 允許從 CDN（cdnjs.cloudflare.com）載入函式庫，但斷網時頁面核心功能仍應可用為佳（CSV 解析可手寫，見 §6.2）。
- 深色主題，視覺風格參考 Flighty：深藍黑背景、霓虹感的航線弧線、卡片式統計、大數字排版。
- 響應式：手機直向與桌面皆可正常瀏覽。

## 3. 輸入資料規格（Flighty CSV Export）

### 3.1 欄位定義

CSV 為 UTF-8、逗號分隔、含表頭，共 33 欄。與本專案相關的欄位：

| 欄位 | 型別 | 說明 | 本份資料完整度 (n=53) |
|---|---|---|---|
| `Date` | `YYYY-MM-DD` | 出發日期（當地） | 53/53 |
| `Airline` | string | **ICAO 三碼**航空公司代碼（注意：不是 IATA 兩碼） | 53/53 |
| `Flight` | int | 航班號數字部分 | 53/53 |
| `From` / `To` | string | IATA 三碼機場代碼 | 53/53 |
| `Canceled` | bool (`True`/`False`) | 是否取消 | 53/53（本份全為 False） |
| `Diverted To` | string | 改降機場 IATA 碼 | 0/53 |
| `Gate Departure (Scheduled)` / `(Actual)` | `YYYY-MM-DDTHH:MM` | 離開登機門時間 | 53 / 45 |
| `Take off (Scheduled)` / `(Actual)` | 同上 | 起飛時間 | 40 / 42 |
| `Landing (Scheduled)` / `(Actual)` | 同上 | 落地時間 | 40 / 40 |
| `Gate Arrival (Scheduled)` / `(Actual)` | 同上 | 抵達登機門時間 | 53 / 37 |
| `Aircraft Type Name` | string | 機型全名，如 `Boeing 777-300 ER` | 53/53 |
| `Tail Number` | string | 機身編號 | 43/53 |
| `Dep/Arr Terminal`, `Dep/Arr Gate` | string | 航廈與登機門 | 26–39/53 |

其餘欄位（`PNR`, `Seat`, `Seat Type`, `Cabin Class`, `Flight Reason`, `Notes`, 各種 `Flighty ID` UUID）在本份資料幾乎全空，解析時保留但 UI 不需呈現；若未來資料有值可在航班明細列出。

### 3.2 關鍵陷阱（實作必讀）

1. **所有時間戳為機場當地時間，且不含時區偏移**（如 `2014-08-16T08:55`）。
   - **同機場**的 Scheduled vs Actual 相減 → 正確的延誤分鐘數。✅
   - **跨機場**直接相減（落地 − 起飛）→ 錯誤的飛行時間。❌
   - 正確做法見 §5.4：內建機場 UTC 偏移表，或用距離估算飛行時數。
2. **`Airline` 是 ICAO 碼**：`CPA`=國泰、`EVA`=長榮、`CAL`=中華、`TTW`=台灣虎航⋯⋯UI 顯示需要 ICAO→中文/英文名稱對照表（本份資料出現的 18 家見 §附錄 B，另建議內建更大的常用表以支援未來資料）。
3. **缺值極多且分布不均**：任何統計都必須在該筆缺值時跳過該筆、且統計卡片註明樣本數（例如「準點率（42 筆有實際起飛資料）」），不可因缺值產生 `NaN` 或崩潰。
4. **`Flight` 是純數字**：顯示航班號時組合為 `IATA/ICAO 碼 + 數字`（如 `CPA 471`，或查表轉成 `CX471` 更佳）。
5. 未來資料可能出現 `Canceled=True` 或 `Diverted To` 有值：取消航班不計入距離/時數統計但顯示於列表（標紅）；改降航班的目的地以 `Diverted To` 計算實際航線。
6. CSV 可能含引號包裹的欄位（`Notes` 可能有逗號、換行），解析器必須符合 RFC 4180。

## 4. 功能需求

### 4.1 世界地圖航線圖（首屏主視覺）
- SVG 世界地圖（等距長方投影 equirectangular 即可，內嵌簡化版世界陸地輪廓 GeoJSON→path）。
- 每條「不重複航線（無向 pair）」畫一條大圓航線投影後的弧線；飛行次數越多線越粗或越亮。
- 機場畫成發光圓點，大小按起降次數；hover/tap 顯示機場代碼與次數。
- **跨反子午線（180°）處理**：例如未來可能出現跨太平洋航線，弧線需在 ±180° 斷開成兩段，不可橫貫整張地圖。
- 大圓插值公式：對起訖點做 slerp（球面線性插值）取 ~64 個中間點再投影。

### 4.2 統計儀表板（大數字卡片）
- 總航班數（排除 Canceled）。
- 總飛行距離：機場座標的大圓距離加總（Haversine），顯示 km 及「≈ 繞地球 N 圈」（地球周長 40,075 km）。
- 總飛行時數（估算，方法見 §5.4）。
- 機場數、國家/地區數（IATA→國家對照，見 §5.3）、航空公司數、機型數。

### 4.3 排行榜（卡片列表，各取前 5–10）
- 最常飛航線（無向 pair，如 `TPE ⇌ SIN`）。
- 最常搭航空公司（顯示名稱＋次數＋佔比條）。
- 最常搭機型。
- 最常出入機場。

### 4.4 年度時間軸
- 每年航班數長條圖（本份資料：2014–2026，中間 2017、2020、2021 為 0，**缺年份也要畫出 0 的空位**，不可跳過）。

### 4.5 準點分析
- 平均出發延誤（Gate Departure Actual − Scheduled，僅計有兩者的筆數）。
- 平均抵達延誤（Gate Arrival 同理）。
- 最長延誤的一筆（顯示航班、日期、延誤分鐘）。
- 準點率定義：抵達延誤 ≤ 15 分鐘視為準點（業界慣例）。
- 提早抵達以負數/綠色呈現。

### 4.6 航班列表
- 依日期倒序的完整列表：日期、航班號、航線（含城市名更佳）、機型、延誤標記。
- 點擊展開單筆明細（航廈/登機門/機身編號/各時間戳）。

### 4.7 CSV 上傳
- 頁面頂部有明顯的「更新資料」入口：拖曳區 + `<input type="file">`。
- 解析成功 → 全頁重繪，顯示「已載入 N 筆（YYYY-MM-DD 至 YYYY-MM-DD）」。
- 解析失敗（表頭不符）→ 顯示錯誤訊息並保留原資料，列出偵測到的表頭以利除錯。
- 表頭驗證以「至少包含 `Date, Airline, Flight, From, To`」為準，容忍 Flighty 未來新增欄位。

## 5. 參考資料表（需內嵌於 HTML）

### 5.1 機場座標表
- 內嵌一份 **IATA → {lat, lon, city, country}** 的表。為支援未來新機場，建議涵蓋全球主要機場（可用開源 OurAirports / openflights 資料裁剪出有 IATA 碼的大型+中型機場，約 2,000–4,000 筆，壓成緊湊 JS 物件約 100–200 KB，可接受）。
- **最低要求**：附錄 A 的 33 個機場必須正確（已驗證座標）。
- 查無座標的機場：地圖略過該航線並在頁面上列出「未知機場代碼：XXX」，其他統計（不需座標者）照常計入；距離統計需註明排除筆數。

### 5.2 航空公司對照表
- ICAO → {IATA, 中文名, 英文名}。最低要求涵蓋附錄 B 的 18 家；建議內建常用數百家。查無者直接顯示 ICAO 碼。

### 5.3 國家統計
- 由機場座標表的 `country` 欄位推得，無需另建表。

### 5.4 飛行時數估算（因時間戳無時區）
擇一實作，建議 (a)：
- **(a) 機場 UTC 偏移表**：座標表加一欄該機場的標準 UTC 偏移（不處理日光節約時間，誤差 ≤1 小時可接受，UI 註明「估算值」）。有實際起飛+落地時間戳者：`(落地當地時間 − 落地偏移) − (起飛當地時間 − 起飛偏移)`。缺時間戳者退回 (b)。
- **(b) 距離推估**：`時數 ≈ 大圓距離 km ÷ 750 km/h + 0.4h`（涵蓋爬升下降），全部航班一律適用，簡單且對總時數的誤差可接受。

## 6. 技術規範

### 6.1 技術選型
- 純 HTML + CSS + vanilla JS（或內嵌 React via CDN 亦可，但 vanilla 更輕）。
- 地圖：手寫 SVG（不建議引入 Leaflet/Mapbox——不需要互動地圖磚，且要離線可用）。
- 圖表：手寫 SVG 長條圖即可，或 CDN 載入 Chart.js。

### 6.2 CSV 解析
- 首選 CDN 載入 PapaParse；若要零依賴則手寫 RFC 4180 狀態機解析器（必須處理引號內逗號與換行）。

### 6.3 資料流
```
內嵌預設 CSV 字串 ──┐
localStorage（若可用）─┼─→ parseCSV() → normalize() → FlightRecord[] → renderAll()
使用者拖入的檔案 ────┘
```
`FlightRecord` 正規化結構建議：
```js
{
  date: "2014-08-16",            // string, 原樣保留
  airlineIcao: "CPA",
  flightNumber: 471,
  from: "TPE", to: "HKG",
  effectiveTo: "HKG",            // Diverted To 有值時取代
  canceled: false,
  times: {                        // 每項皆可能為 null，值為 "YYYY-MM-DDTHH:MM"
    gateDepSched, gateDepActual,
    takeoffSched, takeoffActual,
    landingSched, landingActual,
    gateArrSched, gateArrActual
  },
  aircraft: "Airbus A340-300",
  tail: null,
  depTerminal, depGate, arrTerminal, arrGate  // 皆可 null
}
```

### 6.4 錯誤處理原則
- 任何單筆資料異常（日期格式錯、機場查無）→ 跳過該功能對該筆的計算，不可整頁崩潰。
- `localStorage` 全部操作包 try/catch。

## 7. 驗收標準

1. 直接以瀏覽器開啟本機 `index.html`（`file://`）即可完整運作，含預設資料渲染。
2. 拖入隨附的 `FlightyExport-2026-01-14.csv`，數字與預設一致，且與附錄 C 的基準統計相符。
3. 地圖上可看見 TPE 為中心的放射航線，含 TPE–AKL（跨南半球長程）與歐洲（ATH/JTR/CHQ/LCA/PFO）航段。
4. 刻意餵入缺 `Take off (Actual)` 的資料列，準點分析不出現 NaN。
5. 手機寬度（375px）下所有卡片可讀、地圖可完整顯示。

## 8. 基準統計（附錄 C：用於驗收比對）

以隨附 CSV 計算應得：
- 總航班：**53**（無取消、無改降）。
- 日期範圍：**2014-08-16 ~ 2026-01-26**。
- 機場數：**33**；航空公司：**18**；機型：**19**。
- 年度分布：2014:5, 2015:2, 2016:6, 2017:0, 2018:2, 2019:6, 2020:0, 2021:0, 2022:2, 2023:12, 2024:10, 2025:5, 2026:3。
- 前五機場（起+降合計）：TPE 31、HKG 6、SIN 6、BKI 4、AKL 4（ATH、XMN、MEL 亦為 4，並列時依字母序或全部列出皆可）。
- 前三航空公司：TTW 7、EVA 5、ANZ 5。
- 出發延誤樣本數 45、抵達延誤樣本數 37、起飛/落地實際時間樣本數 42/40（供 §4.5 樣本數標註驗證）。

---

## 附錄 A：本份資料出現的 33 個機場（座標已驗證，作為最低內建集）

| IATA | 城市 | 國家/地區 | lat | lon | UTC偏移 |
|---|---|---|---|---|---|
| AKL | Auckland | New Zealand | -37.008 | 174.792 | +12 |
| ATH | Athens | Greece | 37.936 | 23.947 | +2 |
| AYQ | Ayers Rock (Yulara) | Australia | -25.186 | 130.976 | +9.5 |
| BKI | Kota Kinabalu | Malaysia | 5.937 | 116.051 | +8 |
| CHC | Christchurch | New Zealand | -43.489 | 172.532 | +12 |
| CHQ | Chania | Greece | 35.532 | 24.150 | +2 |
| DPS | Denpasar (Bali) | Indonesia | -8.748 | 115.167 | +8 |
| FUK | Fukuoka | Japan | 33.586 | 130.451 | +9 |
| GMP | Seoul Gimpo | South Korea | 37.558 | 126.791 | +9 |
| HKG | Hong Kong | Hong Kong | 22.308 | 113.918 | +8 |
| HND | Tokyo Haneda | Japan | 35.549 | 139.780 | +9 |
| IBR | Ibaraki | Japan | 36.181 | 140.415 | +9 |
| ICN | Seoul Incheon | South Korea | 37.469 | 126.451 | +9 |
| JOG | Yogyakarta (Adisutjipto) | Indonesia | -7.788 | 110.432 | +7 |
| JTR | Santorini | Greece | 36.399 | 25.479 | +2 |
| KCH | Kuching | Malaysia | 1.485 | 110.347 | +8 |
| KIX | Osaka Kansai | Japan | 34.427 | 135.244 | +9 |
| LCA | Larnaca | Cyprus | 34.875 | 33.625 | +2 |
| MEL | Melbourne | Australia | -37.669 | 144.841 | +10 |
| MFM | Macau | Macau | 22.150 | 113.592 | +8 |
| MYY | Miri | Malaysia | 4.322 | 113.987 | +8 |
| MZV | Mulu | Malaysia | 4.048 | 114.805 | +8 |
| NRT | Tokyo Narita | Japan | 35.772 | 140.393 | +9 |
| NSN | Nelson | New Zealand | -41.298 | 173.221 | +12 |
| OKJ | Okayama | Japan | 34.757 | 133.855 | +9 |
| PFO | Paphos | Cyprus | 34.718 | 32.486 | +2 |
| PUS | Busan | South Korea | 35.180 | 128.938 | +9 |
| SIN | Singapore Changi | Singapore | 1.350 | 103.994 | +8 |
| SUB | Surabaya | Indonesia | -7.380 | 112.787 | +7 |
| SZX | Shenzhen | China | 22.639 | 113.811 | +8 |
| TPE | Taipei Taoyuan | Taiwan | 25.078 | 121.233 | +8 |
| TSA | Taipei Songshan | Taiwan | 25.069 | 121.552 | +8 |
| XMN | Xiamen | China | 24.544 | 118.128 | +8 |

註：JOG 若未來資料出現新雅加達機場 YIA 屬不同機場，勿混淆。UTC 偏移為標準時間；NZ/AU 有日光節約，估算時數時允許 ±1h 誤差。

## 附錄 B：本份資料出現的 18 家航空公司（ICAO 對照）

| ICAO | IATA | 名稱 |
|---|---|---|
| AEE | A3 | Aegean Airlines 愛琴海航空 |
| ANA | NH | All Nippon Airways 全日空 |
| ANZ | NZ | Air New Zealand 紐西蘭航空 |
| AXM | AK | AirAsia 亞洲航空 |
| CAL | CI | China Airlines 中華航空 |
| CPA | CX | Cathay Pacific 國泰航空 |
| CXA | MF | Xiamen Airlines 廈門航空 |
| EVA | BR | EVA Air 長榮航空 |
| JJA | 7C | Jeju Air 濟州航空 |
| JST | JQ | Jetstar Airways 捷星航空 |
| LNI | JT | Lion Air 獅子航空 |
| MAS | MH | Malaysia Airlines 馬來西亞航空 |
| RYR | FR | Ryanair 瑞安航空 |
| SJX | — | Starlux? **注意**：星宇航空 ICAO 實為 SJX、IATA 為 JX |
| TGW | TR | Scoot 酷航 |
| TTW | IT | Tigerair Taiwan 台灣虎航 |
| TWB | TW | T'way Air 德威航空 |
| VOE | V7 | Volotea 沃洛泰航空 |

## 附錄 D：隨附檔案

1. `FlightyExport-2026-01-14.csv` — 原始匯出檔（33 欄完整版），作為內嵌預設資料來源。
2. 本規格書。

實作時直接讀取原始 CSV 內嵌即可；勿手動改寫資料內容。
