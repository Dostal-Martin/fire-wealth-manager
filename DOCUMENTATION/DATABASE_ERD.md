# FIRE WM — Databáze a ERD

## 1. ERD současné verze

> Typy níže dokumentují logický model. Přesné SQL typy je při migracích nutné ověřit proti živému Supabase schématu.

```mermaid
erDiagram
    INSTRUMENTS ||--o{ POSITIONS : "instrument_id"
    INSTRUMENTS ||--o{ PRICE_HISTORY : "instrument_id"
    INSTRUMENTS ||--o{ CASHFLOWS : "optional instrument relation"

    INSTRUMENTS {
        uuid id PK
        text name
        text ticker
        text isin
        text asset_type
        text currency
        text pricing_source
        text valuation_mode
    }

    POSITIONS {
        uuid id PK
        uuid instrument_id FK
        numeric quantity
        numeric total_cost
        numeric current_value
    }

    PRICE_HISTORY {
        bigint id PK
        uuid instrument_id FK
        date price_date
        numeric close_price
        text source
    }

    CASHFLOWS {
        uuid id PK
        uuid instrument_id FK
        date transaction_date
        text transaction_type
        numeric amount_czk
        boolean is_external
        text note
    }

    PORTFOLIO_SNAPSHOTS {
        uuid id PK
        uuid portfolio_id
        date snapshot_date
        numeric net_worth
    }

    FIRE_SETTINGS {
        uuid portfolio_id
        numeric annual_expenses
        numeric withdrawal_rate
        numeric target_fire_number
        numeric monthly_contribution
        numeric expected_return
        numeric inflation_rate
    }

    FX_HISTORY {
        bigint id PK
        date rate_date
        text pair
        numeric rate
    }

    APP_SYNC_STATUS {
        text sync_key PK
        date last_success_date
        timestamptz last_success_at
        integer processed
        integer updated_count
        integer error_count
        jsonb details
    }
```

## 2. Tabulky

### instruments
Master data aktiv. Důležitá pravidla:
- `pricing_source`: `yahoo` nebo `manual`
- `valuation_mode`: `unit_price` nebo `total_value`
- ticker je povinný pro Yahoo instrumenty

### positions
Aktuální agregovaný stav portfolia.
- `quantity` je současný počet jednotek
- `total_cost` je současný evidovaný cost basis v CZK
- `current_value` je současná hodnota v CZK
- záporný `current_value` představuje pasivum

### price_history
Časová řada cen a NAV.
- nevytvářet syntetické denní NAV mezi skutečnými NAV body
- ruční CSV a Yahoo používají stejnou analytickou vrstvu

### cashflows
Historické peněžní pohyby.

**Známé omezení v1.0:** BUY/SELL nejsou dosud autoritativním ledgerem pro `positions`. Pozici tedy nelze spolehlivě zrekonstruovat pouze z cashflow.

### portfolio_snapshots
Historie čistého jmění.

Požadovaný unikátní constraint:

```sql
unique (portfolio_id, snapshot_date)
```

### fire_settings
Single-portfolio nastavení FIRE a rentové simulace.

### app_sync_status
Globální stav synchronizace tržních cen. Klíč `market_prices`.

## 3. Známé referenční mezery

```mermaid
flowchart LR
    TX[BUY / SELL cashflows] -. "není autoritativní" .-> POS[positions]
```

To je hlavní datová mezera pro v1.1.

## 4. Navržený ERD v1.1: Transaction Ledger

```mermaid
erDiagram
    INSTRUMENTS ||--o{ TRANSACTIONS : instrument_id
    INSTRUMENTS ||--o{ POSITIONS : instrument_id
    TRANSACTIONS }o--|| PORTFOLIOS : portfolio_id
    POSITIONS }o--|| PORTFOLIOS : portfolio_id

    TRANSACTIONS {
        uuid id PK
        uuid portfolio_id FK
        uuid instrument_id FK
        date transaction_date
        text transaction_type
        numeric quantity
        numeric unit_price
        text currency
        numeric fx_rate
        numeric fees_czk
        numeric tax_czk
        numeric amount_czk
        boolean is_external
        text note
    }
```

Doporučení: `positions` ponechat jako agregovaný stav, ale zavést reconciliation vůči transakcím.
