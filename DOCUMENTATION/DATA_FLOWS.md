# FIRE WM — EFD / Data Flows

## 1. Kontextový tok

```mermaid
flowchart LR
    USER[Uživatel] --> FE[FIRE WM]
    FE --> AUTH[Supabase Auth]
    FE <--> DB[(Supabase PostgreSQL)]
    FE --> EDGE[Edge Functions]
    EDGE <--> EXT[Market data]
    EDGE --> DB
    CSV[CSV NAV] --> FE
```

## 2. EFD: Aktualizace tržní ceny

```mermaid
flowchart TD
    A[Trigger: první otevření dne / ruční update] --> B{app_sync_status je dnešní?}
    B -- ano --> Z[Konec]
    B -- ne --> C[invoke update-prices]
    C --> D[Načíst ceny]
    C --> E[Načíst FX]
    D --> F[Zapsat price_history]
    E --> G[Přepočítat current_value]
    F --> G
    G --> H[positions]
    H --> I[Součet live net worth]
    I --> J[Upsert portfolio_snapshots]
    J --> K[Update app_sync_status]
```

## 3. EFD: Ruční jednotková cena

```mermaid
flowchart TD
    A[Uživatel zadá NAV] --> B[Validace]
    B --> C[price_history source MANUAL]
    C --> D[quantity × NAV × FX]
    D --> E[positions.current_value]
    E --> F[Live Dashboard / Portfolio / FIRE]
    E -. "v1.0 nutno doplnit" .-> G[Dnešní snapshot]
```

## 4. EFD: CSV NAV

```mermaid
flowchart TD
    A[CSV] --> B[parseManualPriceCsv]
    B --> C{Validní řádky?}
    C -- ne --> X[Chyba importu]
    C -- ano --> D[Batch price_history]
    D --> E[Najít poslední NAV]
    E --> F[Aktualizovat pozici]
    F --> G[Analytika PriceHistory]
```

## 5. EFD: FIRE

```mermaid
flowchart LR
    POS[(positions)] --> NW[Live net worth]
    FS[(fire_settings)] --> CALC[FIRE calculations]
    NW --> CALC
    CALC --> UI[Akumulace / renta]
```

## 6. EFD: Vývoj majetku

```mermaid
flowchart LR
    SNAP[(portfolio_snapshots)] --> HIST[Historická řada]
    POS[(positions)] --> LIVE[Live net worth]
    HIST --> UI[NetWorth UI]
    LIVE -. "doporučeno v1.0.x" .-> UI
```

## 7. EFD: Backup

```mermaid
flowchart TD
    U[Uživatel] --> A[Admin]
    A --> S[backup.ts]
    S --> DB[(Supabase tables)]
    DB --> S
    S --> J[JSON Blob]
    J --> DL[Stažení do zařízení]
```

## 8. EFD: Auth

```mermaid
sequenceDiagram
    actor U as Uživatel
    participant FE as React
    participant A as Supabase Auth
    participant DB as Data API + RLS

    U->>FE: email + heslo
    FE->>A: signInWithPassword
    A-->>FE: session + JWT
    FE->>DB: dotaz s JWT
    DB-->>FE: data povolená RLS
    U->>FE: logout
    FE->>A: signOut
```
