# Flighty Web Viewer

A single-file web viewer for [Flighty](https://flighty.com) CSV exports — a Flighty-style personal flight log for the web.
單一 HTML 檔的 Flighty 個人飛行紀錄檢視器：世界地圖航線圖、統計儀表板、排行榜、準點分析與航班列表。

**Live**: https://ssarcandy.github.io/flighty-web-viewer/

## Features

- 🗺 World map with great-circle routes, zoom/pan, and a chronological flight-path playback mode (camera follows when zoomed)
- 📊 Stats dashboard: distance (≈ N× around Earth), estimated flight hours, routes, countries (circular flags), airlines (real logos)
- 🏆 Top routes / airlines / aircraft / airports; yearly bar chart with year filtering that scopes the whole dashboard
- ⏱ On-time analysis (avg departure/arrival delay, on-time rate, longest delay) with sample sizes
- 🌓 Dark / light theme · 中文 / English · fully responsive (mobile card layout)
- 📁 Drag & drop a new Flighty CSV export to update — persisted in localStorage

## Usage

- **Online**: open the live page. Data loads from [`demo.csv`](demo.csv); replace that file to update the deployed data (no rebuild needed).
- **Local**: double-click `index.html` — works fully offline over `file://` (falls back to the embedded dataset).
- **Your data**: in the Flighty app, export CSV (Settings → Export Data), then drag the file onto the page.

Data priority: last uploaded (localStorage) → `demo.csv` → embedded.

## Rebuilding `index.html`

Not needed for data updates. To change the page itself or refresh the embedded datasets, see [`tools/README.md`](tools/README.md).

## Credits

Airports: [OurAirports](https://ourairports.com) · UTC offsets: [OpenFlights](https://openflights.org) · Land shapes: [Natural Earth](https://www.naturalearthdata.com) · Flags: [circle-flags](https://github.com/HatScripts/circle-flags) · Airline logos: [Jxck-S/airline-logos](https://github.com/Jxck-S/airline-logos) (FlightAware) · Icons: [Material Icons](https://fonts.google.com/icons)
