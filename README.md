# Bear House Dashboard 🐻🥐

Motiverende sanntids dashboard for medarbeiderne på Nes Bakeri / Bear House.

## Funksjoner

### ✅ Implementert
- **Dagens salg vs budsjett** - Stor visuell progress bar
- **Timeomsetning** - Sammenligning med gjennomsnitt
- **Ukens oversikt** - Visuell dag-for-dag fremgang
- **Rekorder** - Dagrekord, beste lørdag, timerekord
- **Nesbyen vs Hemsedal** - Vennlig konkurranse
- **Beskjeder** - Martin kan sende via API
- **Været** - Vises med tips
- **Bestselgere** - Topp 3 produkter
- **Fun facts** - Roterende morsomme fakta
- **Konfetti-feiring** - Ved nye rekorder!

### ⏳ Venter på integrasjon
- **Favrit API** - Sanntids salgsdata (venter på ClientId/SecretId)
- **Planday API** - Hvem er på jobb (trenger app setup)
- **All Gravy** - Opplæringsbeskjeder

## Kjøring

```bash
# Installer avhengigheter
npm install

# Start server
npm start

# Åpne i nettleser
open http://localhost:3000
```

## API Endpoints

### GET /api/data/:location
Hent nåværende salgsdata for en lokasjon.
```bash
curl http://localhost:3000/api/data/nesbyen
```

### POST /api/messages
Legg til en beskjed (brukes av Odin).
```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"text": "Husk å fylle på kanelboller! 🥐"}'
```

### POST /api/sales/:location
Oppdater salg manuelt (inntil Favrit er koblet til).
```bash
curl -X POST http://localhost:3000/api/sales/nesbyen \
  -H "Content-Type: application/json" \
  -d '{"sales": 45000, "hourly": 5000}'
```

### POST /api/celebration
Trigger feiering ved rekord.
```bash
curl -X POST http://localhost:3000/api/celebration \
  -H "Content-Type: application/json" \
  -d '{"type": "Dagrekord slått!", "value": 130000}'
```

## Datakilder

### Google Sheets (Budsjett)
- Nesbyen: `1YxuhNZVscP-TFwuuRmIqR5Z4iYRJuiIvVfYGjEeD-ss`
- Hemsedal: `1shNAXvDNcvHk60Z5LdFIfldTXH0tVFulg0z0XGyVJHE`
- Produksjon: `1-SWuvlBWrtidiPMic-aTgcivIeGAaSjCRbM4kwwhgzs`

### Favrit (Kassesystem) - VENTER
- OAuth 2.0: https://accounting-api-auth.favrit.com/oauth/token
- Scope: prod/user prod/accounting prod/transaction
- Docs: https://support.favrit.com/developer

### Planday (Vaktplan) - VENTER
- API Docs: https://developer.planday.com
- Domains: HR, Scheduling, Payroll

## Design

- **Mørkt tema** - Ser bra ut på skjerm i butikk
- **Store tall** - Lesbart fra 3 meters avstand
- **Farger**: 
  - Grønn = over budsjett
  - Gul = nært budsjett
  - Rød = under budsjett
- **Auto-refresh**: Hvert minutt
- **Responsivt**: TV, nettbrett, mobil

## Neste steg

1. [ ] Få Favrit API-tilgang (venter på support@favrit.com)
2. [ ] Sette opp Planday-integrasjon
3. [ ] Koble til ekte budsjettdata fra Google Sheets
4. [ ] Legge til WebSocket for sanntids-oppdateringer
5. [ ] Implementere rekord-deteksjon og automatisk feiring
6. [ ] Legge til bursdager og jubileum

## Laget av
Odin 🐻 for MSG Eiendom / Bear House
