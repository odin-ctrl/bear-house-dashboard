# Bear House Dashboard — Prosjektstatus

DENNE FILEN ER KILDEN TIL SANNHET. LES DEN FØR DU GJØR NOE.

## Arkitektur

To tjenester:

1. favrit-data-service (Fly.io)
   - Henter historiske orderlines fra Favrit CSV endpoint
   - Lagrer i Postgres på Fly.io
   - Endpoint: GET /api/daysales?locationId=...&date=YYYY-MM-DD
   - Returnerer: { location_id, date, orders, items, sales, avg_ticket }
   - MERK: Alle felter er snake_case
   - Health: https://favrit-data-service.fly.dev/health
   - Data: https://favrit-data-service.fly.dev/api/daysales

2. bear-house-dashboard (Fly.io)
   - Prod URL: https://team.bearhouse.no
   - Fly app: bearhouse-team
   - Kode: /Users/odingaze/.openclaw/workspace/bear-house-dashboard/
   - Backend: Node.js + Express (server.js)
   - Frontend: public/index.html, public/style.css, public/dashboard.js

## Lokasjon-IDer

- Nesbyen: 113593088
- Hemsedal: 248457994

## Dataflyt

- Dagens data: favrit.getTodaySales(location) → live fra Favrit API
  - Felter: liveData.summary.totalSales, .uniqueOrders, .totalItems
- Historisk data: favrit.getDaySales(location, dateStr) → fra favrit-data-service
  - Felter: historicalData.sales, .orders, .items, .avg_ticket (SNAKE_CASE)
- Helper: getSalesForDate(location, dateStr) brukes av weekly/yoy/streak

## KPI Endpoint

GET /api/kpi/:location?date=YYYY-MM-DD
- Linje ~1254 i server.js
- Bruker requireAuth
- Live: beregner avgTicket og itemsPerOrder fra summary
- Historikk: mapper snake_case fra data-service
- Attach rates: null for historikk, beregnet fra bestsellers for live
- Returnerer: { location, date, isLive, sales, orders, items, avgTicket, itemsPerOrder, coffeeAttachRate, bunAttachRate, note }

## Weekly Vibes

GET /api/weekly/:location
- Linje ~1182 i server.js
- Beregner mandag som ukestart (norsk standard)
- Henter alle 7 dager parallelt via getSalesForDate
- Frontend rendering: updateWeeklyChart() i public/index.html (~linje 842)
- VIKTIG: dashboard.js skal IKKE røre #week-bars. All rendering skjer i index.html.

## KPI-mål

| KPI | Mål |
|-----|-----|
| Snittkurv | 200 kr |
| Varer per ordre | 3.1 |
| Kaffe attach | 35% |
| Bakevare attach | 100% |

## Kjente begrensninger

1. Attach rates er estimater (produktantall / ordrer, ikke unike ordrer med produktet)
2. Ekte attach rates krever order_reference-gruppering (fase 4)
3. Historisk attach rate returnerer null

## Ting du IKKE skal gjøre

- IKKE endre HTML-struktur i Weekly Vibes uten å oppdatere CSS
- IKKE la dashboard.js overskrive #week-bars (den buggen er fikset, ikke gjeninnfør den)
- IKKE bruk camelCase for historisk data fra data-service (den bruker snake_case)
- IKKE fjern requireAuth fra noen endpoint
- IKKE legg secrets i kode eller repo

## Fly.io deploy

cd /Users/odingaze/.openclaw/workspace/bear-house-dashboard
fly deploy

## Fikset bugs (ikke gjeninnfør)

1. Field mapping: KPI endpoint brukte camelCase for historisk data, rettet til snake_case
2. Weekly Vibes ukestart: Endret fra søndag til mandag
3. Weekly Vibes rendering: dashboard.js overskrev #week-bars med gammel HTML-struktur (week-day, week-bar-fill) som ikke matchet CSS (week-bar-day, week-bar-container, week-bar.budget, week-bar.sales). Løst ved å fjerne updateWeekOverview() fra dashboard.js.
4. day-bar høyde: .day-bar manglet height: 100%, fikset i CSS

## Neste steg (prioritert rekkefølge)

1. Fjern duplikat snittkurv-kort (øverste rad har "SNITT" som er samme som KPI "SNITTKURV")
2. Sett min_machines_running=1 på Fly for begge apper
3. Verifiser at cron-import i data-service kjører daglig
4. Fase 4: Ekte attach rates med order_reference
