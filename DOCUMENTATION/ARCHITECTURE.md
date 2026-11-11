# FIRE WM — Technická architektura

## 1. Účel

Tento dokument je technický handover pro dalšího vývojáře nebo nový vývojový chat. Popisuje současnou produkční architekturu FIRE WM v1.0 a pravidla, která další vývoj nesmí porušit.

## 2. Kontext systému

```mermaid
flowchart TB
    U[Uživatel] --> W[fire.madocon.cz]
    W --> FE[React + TypeScript + Vite]
    FE --> AUTH[Supabase Auth]
    FE --> DB[(Supabase PostgreSQL)]
    FE --> EF[Supabase Edge Functions]
    EF --> YF[Yahoo Finance / market feeds]
    EF --> DB
    CSV[Ruční NAV / CSV] --> FE
    FE --> DB
```

## 3. Komponenty

### Frontend
- React + TypeScript + Vite
- Recharts
- `src/App.tsx` jako shell, Auth Gate a navigace
- `src/pages/*` jako obrazovky
- `src/services/*` jako datová a integrační vrstva
- `src/styles/app.css` jako hlavní design systém

### Backend
- Supabase PostgreSQL
- Supabase Auth
- PostgreSQL Row Level Security
- Supabase Edge Functions

### Hosting
- Webglobe
- produkční URL: `https://fire.madocon.cz`
- nasazuje se statický obsah `dist/`

## 4. Logické vrstvy

```text
Page / Component
      ↓
Service
      ↓
Supabase JS client / Edge Function
      ↓
Auth + RLS
      ↓
PostgreSQL / externí market feed
```

UI nemá implementovat databázové normalizace. Například nejednoznačné Supabase embedded relations se normalizují v service vrstvě.

## 5. Mapování obrazovek na služby

| Obrazovka | Hlavní zdroje |
|---|---|
| Dashboard | positions, instruments, FIRE metrics, net-worth stats, allocation |
| Portfolio | `portfolio.ts`, positions + instruments |
| Výkonnost | XIRR, TWR, net-worth snapshots |
| Tržní data | price updater, manual valuation, price history |
| Historie cen | `priceHistory.ts`, price_history |
| Vývoj majetku | portfolio_snapshots, postupně i live net worth |
| FIRE | fire_settings + live net worth |
| Cashflow | cashflows |
| Příjmy | dividend / coupon cashflows |
| Pozice | position manager |
| Instrumenty | instrument manager |
| Data | import services + backup |

## 6. Hlavní běhové toky

### Automatické ceny

```mermaid
sequenceDiagram
    actor User
    participant FE as FIRE WM
    participant Sync as app_sync_status
    participant Edge as update-prices
    participant Yahoo as Market feed
    participant DB as PostgreSQL

    User->>FE: Otevře aplikaci / ruční update
    FE->>Sync: Proběhl dnešní update?
    alt update není hotový
        FE->>Edge: invoke update-prices
        Edge->>Yahoo: ceny + FX
        Yahoo-->>Edge: market data
        Edge->>DB: price_history
        Edge->>DB: positions.current_value
        Edge-->>FE: statistiky update
        FE->>DB: upsert dnešního snapshotu
        FE->>Sync: uložit stav synchronizace
    end
```

### Ruční NAV

```mermaid
sequenceDiagram
    actor User
    participant FE as MarketData
    participant DB as PostgreSQL

    User->>FE: NAV / CSV
    FE->>DB: price_history
    FE->>DB: update positions.current_value
    Note over FE,DB: v1.0 známá mezera: snapshot se musí synchronizovat po ruční změně
```

## 7. Aktuální versus historický stav

**Autorita současného stavu:**

```text
SUM(positions.current_value)
```

**Autorita historického stavu:**

```text
portfolio_snapshots
```

Poslední historický snapshot se nesmí používat jako autorita aktuálního majetku.

## 8. Nasazení

```mermaid
flowchart LR
    DEV[VS Code] --> BUILD[npm run build]
    BUILD --> DIST[dist/]
    DIST --> WG[Webglobe fire.madocon.cz]
    DEV --> GH[GitHub]
    WG --> SB[Supabase Cloud]
```

## 9. Non-goals v1.0

- multi-user databázový model
- automatická rekonstrukce pozic z transakcí
- FIFO a daňový engine
- Monte Carlo FIRE
- automatický restore backupu
- plně automatizovaný deployment
