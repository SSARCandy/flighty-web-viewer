# Flighty Web Viewer

A single-file web viewer for [Flighty](https://flighty.com) CSV exports — a Flighty-style personal flight log for the web.

## Loading your data

Open the page and **drag-and-drop** your Flighty export CSV onto it (your data stays in the
browser via `localStorage` — nothing is uploaded). If you self-host, you can also drop a
`demo.csv` next to `index.html` to set the default dataset. A bundled sample is shown until
you load your own.

## CSV format

The file is a standard **Flighty** export (Flighty app → *Settings → Export → Export Flights*).
It is comma-separated with a header row on line 1; timestamps have **no timezone** and use
`YYYY-MM-DDTHH:MM` (interpreted as local airport time). Below are all the columns Flighty
produces, in order.

### Required columns

The header row **must** contain these five columns or the whole file is rejected. Each data
row must also have a non-empty value for `Date`, `Airline`, `From`, and `To` (and `Date` must
match `YYYY-MM-DD`) — otherwise that row is silently skipped. `Flight` may be blank.

| Column | Description | Example |
| --- | --- | --- |
| `Date` | Flight date, `YYYY-MM-DD`. | `2023-09-29` |
| `Airline` | Operating airline **ICAO** code (3 letters). Drives the airline logo/name. | `CPA` |
| `Flight` | Flight number (digits only, no airline prefix). Value may be blank. | `471` |
| `From` | Departure airport **IATA** code (3 letters). | `TPE` |
| `To` | Scheduled arrival airport **IATA** code (3 letters). | `HKG` |

### Optional columns

All of these may be left blank. Missing values simply mean the related detail/analysis is
omitted for that flight.

| Column | Description | Example |
| --- | --- | --- |
| `Dep Terminal` | Departure terminal. | `1` |
| `Dep Gate` | Departure gate. | `B6` |
| `Arr Terminal` | Arrival terminal. | `1` |
| `Arr Gate` | Arrival gate. | `31` |
| `Canceled` | `true` / `false`. Canceled flights are excluded from the map and distances. | `false` |
| `Diverted To` | Actual arrival airport IATA if diverted; overrides `To` for the route drawn and flags a "diverted" badge. | `KIX` |
| `Gate Departure (Scheduled)` | Scheduled push-back time. | `2023-09-29T15:55` |
| `Gate Departure (Actual)` | Actual push-back time. | `2023-09-29T16:04` |
| `Take off (Scheduled)` | Scheduled wheels-up time. | `2023-09-29T16:20` |
| `Take off (Actual)` | Actual wheels-up time. | `2023-09-29T16:31` |
| `Landing (Scheduled)` | Scheduled wheels-down time. | `2023-09-29T20:30` |
| `Landing (Actual)` | Actual wheels-down time. | `2023-09-29T20:41` |
| `Gate Arrival (Scheduled)` | Scheduled gate-in time. Used with the actual for on-time analysis. | `2023-09-29T20:45` |
| `Gate Arrival (Actual)` | Actual gate-in time. Delay is measured against the scheduled value. | `2023-09-29T20:52` |
| `Aircraft Type Name` | Aircraft model. Powers the "Top aircraft" ranking. | `Boeing 787-9` |
| `Tail Number` | Aircraft registration. | `B-HNL` |
| `PNR` | Booking reference. | `X7K2QP` |
| `Seat` | Seat number. | `40K` |
| `Seat Type` | Seat position. *(Present in the export; not shown by the viewer.)* | `WINDOW` |
| `Cabin Class` | Cabin. | `ECONOMY` |
| `Flight Reason` | Trip reason. *(Present in the export; not shown by the viewer.)* | `LEISURE` |
| `Notes` | Free-text notes. | `Upgraded at gate` |

### Flighty internal IDs

Flighty also appends these UUID columns. They are kept as-is on export but are **not used** by
the viewer — you can leave them blank or drop them entirely.

`Flight Flighty ID`, `Airline Flighty ID`, `Departure Airport Flighty ID`,
`Arrival Airport Flighty ID`, `Diverted To Airport Flighty ID`, `Aircraft Type Flighty ID`

Example: `4256f3d8-2653-4977-962c-766c6d1e3041`

### Minimal example

The five required columns are enough to render the map and most stats:

```csv
Date,Airline,Flight,From,To
2023-09-29,TGW,899,TPE,SIN
2023-09-30,TGW,712,SIN,ATH
2023-10-02,VOE,4080,ATH,JTR
```

See [`demo.csv`](demo.csv) for a full-format sample.
