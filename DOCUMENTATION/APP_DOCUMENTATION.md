# FIRE WM: Dokumentace aplikace

## 1. Účel aplikace

FIRE WM je soukromá webová aplikace pro správu osobního majetku a investičního portfolia. Spojuje evidenci instrumentů a pozic, tržní a ruční ocenění, cashflow, historickou výkonnost a plánování finanční nezávislosti.

Produkční adresa:

```text
https://fire.madocon.cz
```

Aplikace je určena pro jednoho uživatele a pracuje s finančními údaji uloženými v Supabase Cloud.

## 2. Hlavní funkce

### Dashboard

Dashboard poskytuje souhrn:

- aktuální hodnoty portfolia,
- investovaného kapitálu,
- nerealizovaného výsledku,
- XIRR,
- FIRE progressu,
- CAGR čistého jmění,
- historického maxima,
- drawdownu,
- struktury portfolia,
- největších pozic.

### Portfolio

Portfolio zobrazuje aktuální pozice a jejich:

- instrument,
- ticker,
- typ aktiva,
- počet jednotek,
- váhu v portfoliu,
- pořizovací náklady,
- aktuální hodnotu,
- nerealizovaný výsledek,
- procentní výnos.

Kliknutím na instrument se otevře detail pozice.

### Výkonnost

Obrazovka Výkonnost obsahuje:

- XIRR jako money-weighted výnos,
- TWR očištěný o externí vklady a výběry,
- CAGR čistého jmění,
- celkový růst majetku,
- historické maximum,
- drawdown.

CAGR čistého jmění není čistý investiční výnos, protože zahrnuje také nové úspory a výběry.

### Vývoj majetku

Vývoj majetku používá historické body z tabulky `portfolio_snapshots`.

Zobrazuje:

- aktuální hodnotu posledního snapshotu,
- celkový růst,
- CAGR,
- ATH,
- drawdown,
- období 1Y, 3Y, 5Y a MAX.

Aktuální živá hodnota portfolia vzniká ze součtu `positions.current_value`. Historický graf vychází ze snapshotů.

### Historie cen

Historie cen podporuje:

- instrumenty oceňované přes Yahoo Finance,
- ručně oceňované instrumenty s jednotkovou cenou,
- NAV importované z CSV.

Zobrazuje:

- aktuální cenu,
- YTD,
- 1Y price return,
- 3Y a 5Y CAGR,
- ATH,
- drawdown,
- období 1Y, 3Y, 5Y a MAX.

Výnosy v této obrazovce jsou price return. Nezahrnují dividendy ani kupóny.

### Tržní data

Tržní data obsahují dvě skupiny ocenění:

#### Automatické ocenění

- ceny veřejně obchodovaných instrumentů,
- měnové kurzy USD/CZK a EUR/CZK,
- datum poslední ceny,
- zdroj ceny.

#### Ruční ocenění

- cena za jednotku nebo NAV,
- celková hodnota pozice,
- datum ocenění,
- CSV import historických NAV.

### FIRE

FIRE má dvě podzáložky.

#### Akumulace

Modeluje:

- současný věk,
- aktuální kapitál,
- měsíční investici,
- FIRE cíl,
- nominální výnos,
- inflaci,
- reálný výnos,
- datum dosažení FIRE,
- věk při FIRE,
- podíl vkladů a výnosů.

Reálný výnos se počítá:

```text
(1 + nominální výnos) / (1 + inflace) - 1
```

#### Simulátor renty

Modeluje:

- počáteční kapitál,
- věk začátku renty,
- požadovanou měsíční rentu,
- očekávaný výnos,
- inflaci,
- délku modelu,
- státní důchod,
- inflační indexaci,
- dynamické čerpání,
- konečný kapitál,
- věk vyčerpání kapitálu.

Simulace je deterministická. Neobsahuje volatilitu, sequence-of-returns risk, daně ani poplatky.

### Cashflow

Cashflow eviduje:

- nákupy,
- prodeje,
- dividendy,
- kupóny,
- externí vklady,
- externí výběry,
- poplatky,
- daně,
- úroky.

Externí vklady a výběry jsou důležité pro XIRR a TWR. Nákup a prodej jsou interní přesuny uvnitř portfolia.

Aktuální omezení: cashflow zatím není plně propojeno s pozicemi a instrumenty tak, aby z transakcí automaticky rekonstruovalo množství, cost basis a realizovaný zisk.

### Příjmy

Příjmy zobrazují:

- dividendy,
- kupóny,
- celkový pasivní příjem,
- příjem posledního roku,
- meziroční změnu,
- strukturu příjmů,
- historii podle kalendářních let.

### Správa pozic

Umožňuje:

- vytvořit pozici,
- upravit pozici,
- smazat pozici,
- zadat počet jednotek,
- zadat pořizovací náklady,
- zadat aktuální hodnotu.

U automaticky oceňovaných instrumentů může být aktuální hodnota při příští aktualizaci přepočtena podle množství, ceny a FX kurzu.

### Správa instrumentů

Umožňuje spravovat:

- název,
- ticker,
- typ aktiva,
- měnu,
- zdroj ceny,
- režim ocenění.

Podporované zdroje:

```text
yahoo
manual
```

Podporované režimy:

```text
unit_price
total_value
```

### Správa dat

Obsahuje:

- import historických snapshotů,
- import historického cashflow,
- JSON export zálohy,
- volitelné zahrnutí cenové historie.

Záloha není šifrovaná a má být ukládána pouze do důvěryhodného úložiště.

## 3. Oceňování portfolia

### Yahoo instrument

```text
current_value = quantity × market_price × fx_rate
```

### Ruční jednotková cena

```text
current_value = quantity × manual_price × fx_rate
```

### Ruční celková hodnota

```text
current_value = ručně zadaná hodnota v CZK
```

Ruční NAV je nutné pravidelně aktualizovat. Neaktuální NAV může podhodnotit Portfolio, Dashboard, FIRE i denní snapshot.

## 4. Denní aktualizace a snapshoty

Při úspěšné aktualizaci cen:

1. Edge Function načte ceny a FX.
2. Aktualizuje `price_history`.
3. Přepočítá `positions.current_value`.
4. Frontend uloží dnešní čisté jmění do `portfolio_snapshots`.
5. Frontend aktualizuje `app_sync_status`.

Kombinace `portfolio_id + snapshot_date` je unikátní. Další aktualizace ve stejný den dnešní snapshot přepíše pomocí upsertu.

## 5. Přihlášení a zabezpečení

Aplikace používá:

- Supabase Auth,
- přihlášení e-mailem a heslem,
- Auth Gate v Reactu,
- Row Level Security v databázi,
- odhlášení ze sidebaru.

Současný model je single-user:

```text
anon          → bez přístupu
authenticated → přístup k datům aplikace
service role  → Edge Functions
```

Veřejná registrace nových uživatelů nesmí být povolená.

## 6. Zálohování

Ve Správě dat lze stáhnout soubor:

```text
fire-wm-backup-YYYY-MM-DD.json
```

Standardní export zahrnuje:

- instrumenty,
- pozice,
- cashflow,
- historii majetku,
- FIRE nastavení,
- FX historii,
- stav synchronizace.

Cenovou historii lze zahrnout volitelně.

Doporučení:

- vytvářet zálohu před změnou databázového schématu,
- vytvářet zálohu před hromadným importem,
- uchovávat alespoň jednu poslední ověřenou zálohu mimo hosting.

## 7. Provoz a deployment

### Produkční build

```powershell
npm run build
```

Výstup:

```text
dist/
```

### Lokální kontrola produkčního buildu

```powershell
npm run preview
```

### Deployment na Webglobe

Na hosting `fire.madocon.cz` se nahrává pouze obsah `dist/`:

```text
index.html
assets/
```

Nenahrávají se:

- `src/`,
- `node_modules/`,
- `.git/`,
- `.env.local`,
- `supabase/`,
- serverové secret keys.

### Doporučený release postup

1. Upravit kód.
2. Spustit `npm run build`.
3. Spustit `npm run preview`.
4. Provést lokální smoke test.
5. Commitnout změny přes GitHub Desktop.
6. Pushnout na GitHub.
7. Nahrát nový obsah `dist/` na Webglobe.
8. Provést produkční smoke test.
9. Vytvořit nový JSON backup.

## 8. Produkční smoke test

Po deploymentu ověřit:

- odhlášený stav zobrazí pouze Login,
- login funguje,
- session přežije reload,
- Dashboard načte data,
- Portfolio odpovídá live pozicím,
- FIRE odpovídá live čistému jmění,
- Tržní data zobrazí ceny a FX,
- ruční ocenění funguje,
- Vývoj majetku obsahuje aktuální bod,
- změna FIRE nastavení se uloží,
- backup se stáhne,
- logout vrátí Login,
- aplikace funguje na telefonu přes mobilní data.

## 9. Řešení běžných problémů

### Portfolio je nižší než očekávání

Zkontrolovat:

1. ruční NAV,
2. datum ručního ocenění,
3. režim `unit_price` nebo `total_value`,
4. množství pozice,
5. FX kurz,
6. zda se `current_value` přepočítalo.

### Vývoj majetku ukazuje méně než Dashboard

Pravděpodobná příčina:

- Dashboard používá live pozice,
- Vývoj majetku používá starší snapshot.

Řešení:

- uložit nebo aktualizovat dnešní snapshot po ručním ocenění,
- v další verzi doplnit live poslední bod grafu.

### Aktualizace cen se nespouští

Zkontrolovat `app_sync_status`. Pokud je `last_success_date` dnešní datum, aplikace automatický update znovu nespustí.

### Build selže

Spustit:

```powershell
npm run build
```

Opravit všechny TypeScript chyby před deploymentem. Vývojový server může některé typové chyby nezastavit, produkční build ano.

## 10. Omezení současné verze

- cashflow není plně provázané s pozicemi a instrumenty,
- pozice se neregenerují automaticky z BUY/SELL transakcí,
- není implementovaný realizovaný P/L a FIFO,
- Historie cen používá price return bez dividend,
- FIRE simulace není Monte Carlo,
- restore backupu není implementovaný,
- ruční NAV nemá upozornění na stáří,
- deployment na Webglobe je ruční,
- single-user RLS nerozlišuje vlastníky dat.

## 11. Hlavní soubory

```text
src/App.tsx
src/lib/supabase.ts
src/styles/app.css

src/pages/Login.tsx
src/pages/Dashboard.tsx
src/pages/Portfolio.tsx
src/pages/Performance.tsx
src/pages/MarketData.tsx
src/pages/PriceHistory.tsx
src/pages/NetWorth.tsx
src/pages/Fire.tsx
src/pages/Cashflow.tsx
src/pages/Income.tsx
src/pages/PositionManager.tsx
src/pages/InstrumentManager.tsx
src/pages/Admin.tsx
src/pages/InstrumentDetail.tsx

src/components/AssetAllocationChart.tsx

src/services/netWorth.ts
src/services/fireSettings.ts
src/services/priceUpdater.ts
src/services/priceHistory.ts
src/services/portfolio.ts
src/services/topPositions.ts
src/services/backup.ts
```
