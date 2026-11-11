# FIRE WM: Produktový backlog a plán dalších verzí

## 1. Účel dokumentu

Tento dokument definuje doporučené pořadí dalšího vývoje FIRE WM po dokončení MVP v1.0.

Priority:

```text
P0 = kritická chyba nebo bezpečnost
P1 = vysoká hodnota, doporučeno pro nejbližší verzi
P2 = významné rozšíření
P3 = dlouhodobý rozvoj
```

## 2. Východiska

Aktuální verze umí:

- evidovat instrumenty a pozice,
- oceňovat Yahoo i ruční aktiva,
- spravovat cashflow a příjmy,
- počítat XIRR, TWR a CAGR,
- zobrazovat historii cen a majetku,
- modelovat FIRE a rentu,
- ukládat denní snapshot,
- exportovat JSON backup,
- zabezpečit data přes Auth a RLS,
- běžet v produkci na `https://fire.madocon.cz`.

Největší funkční mezera je oddělení transakcí od pozic. Aplikace dobře eviduje současný stav, ale neumí plně rekonstruovat, kdy a za kolik byla pozice vytvořena nebo prodána.

## 3. Verze v1.0.x: Stabilizace

Cíl: opravy bez zásadní změny datového modelu.

### P0: Live hodnota ve Vývoji majetku

**Problém:** Dashboard a FIRE používají live `positions.current_value`, zatímco Vývoj majetku může zobrazit starší poslední snapshot.

**Řešení:**

- načíst live net worth společně s historií,
- dnešní bod grafu nahradit live hodnotou,
- pokud dnešní snapshot neexistuje, přidat pouze virtuální bod v UI,
- při uložení snapshotu použít upsert.

**Akceptační kritéria:**

- Aktuální majetek je stejný na Dashboardu, FIRE a Vývoji majetku.
- Historické body zůstávají beze změny.
- Nevznikají duplicitní snapshoty.

### P0: Snapshot po ručním ocenění

**Problém:** po změně ručního NAV se pozice přepočítá, ale dnešní snapshot může zůstat starý.

**Řešení:** volat `saveTodaySnapshot()` po:

- ruční jednotkové ceně,
- ruční celkové hodnotě,
- CSV importu NAV,
- změně množství nebo hodnoty pozice.

### P1: Upozornění na staré ruční ceny

**Pravidla:**

- 0 až 35 dní: bez upozornění,
- 36 až 60 dní: upozornění „Starší ocenění“,
- více než 60 dní: upozornění „Neaktuální ocenění“,
- chybějící datum: kritické upozornění.

**Umístění:**

- Tržní data,
- Portfolio,
- případně Dashboard.

### P1: Audit aktualizace cen

Doplnit:

- poslední úspěšnou cenu každého instrumentu,
- datum posledního pokusu,
- zdroj ceny,
- poslední chybu,
- počet dní od poslední ceny.

### P1: Konsistenční kontrola

Servisní kontrola ve Správě dat:

```text
live net worth
vs.
dnešní snapshot
```

Výsledek:

- shoda,
- rozdíl v Kč,
- rozdíl v %,
- možnost aktualizovat dnešní snapshot.

### P1: Automatické testy kritických funkcí

Minimálně testovat:

- reálný výnos FIRE,
- akumulační projekci,
- rentovou simulaci,
- XIRR vstupy,
- TWR segmentaci,
- výpočet net worth,
- normalizaci Supabase relations,
- backup strukturu.

Doporučený nástroj:

```text
Vitest
```

### P2: Code splitting

Použít:

- `React.lazy()`,
- `Suspense`,
- lazy loading jednotlivých stránek,
- oddělený chunk pro Recharts.

Cíl:

- odstranit upozornění na chunk nad 500 kB,
- zrychlit první načtení loginu a Dashboardu.

## 4. Verze v1.1: Transaction Ledger

Cíl: propojit historii obchodů s pozicemi a instrumenty.

### P1: Rozšíření transakčního modelu

Doplnit do `cashflows` nebo vytvořit novou tabulku `transactions` s poli:

```text
id
portfolio_id
instrument_id
transaction_date
transaction_type
quantity
unit_price
currency
fx_rate
fees_czk
tax_czk
amount_czk
is_external
note
created_at
updated_at
```

Doporučení: pro čistotu modelu vytvořit novou tabulku `transactions` a externí peněžní pohyby ponechat v `cashflows` nebo je sjednotit až po migraci.

### P1: Provázání BUY/SELL s instrumentem

Každý nákup a prodej musí mít:

- instrument,
- datum,
- množství,
- jednotkovou cenu,
- měnu,
- FX kurz,
- poplatek.

### P1: Rekonstrukce množství pozice

```text
quantity = SUM(BUY quantity) - SUM(SELL quantity)
```

Aplikace má porovnat:

```text
calculated quantity
vs.
positions.quantity
```

Neshoda musí být viditelná jako upozornění.

### P1: Cost basis

Nejdřív implementovat jednu jasně definovanou metodu:

- weighted average cost pro interní reporting,
- později FIFO pro realizovaný P/L a daňové podklady.

### P1: Realizovaný a nerealizovaný P/L

Výstupy:

- realizovaný zisk z prodejů,
- nerealizovaný zisk současné pozice,
- poplatky,
- dividendy,
- total return instrumentu.

### P1: Historický import transakcí

Připravit CSV formát:

```text
date;type;ticker;quantity;unit_price;currency;fx_rate;fees_czk;amount_czk;note
```

Import musí mít:

- validaci,
- náhled,
- dry-run,
- seznam chyb,
- idempotenci nebo ochranu před duplicitami.

### P2: Detail instrumentu včetně historie

Detail má zobrazovat:

- současné množství,
- průměrnou cenu,
- nákupy,
- prodeje,
- dividendy,
- realizovaný P/L,
- nerealizovaný P/L,
- total return.

### P2: Rekonciliace

Správa dat má obsahovat kontrolu:

```text
transakce → vypočtená pozice → evidovaná pozice
```

## 5. Verze v1.2: Výkonnost a benchmarky

### P1: Total return

Historie výnosu instrumentu má zahrnout:

- změnu ceny,
- dividendy,
- kupóny,
- poplatky.

### P1: Benchmark

Podporovat minimálně:

- MSCI World ETF nebo uživatelem vybraný ticker,
- S&P 500,
- vlastní benchmark podle portfolia.

Porovnání:

- kumulativní výnos,
- CAGR,
- drawdown,
- relativní výkonnost.

### P2: TWR podle období

- YTD,
- 1Y,
- 3Y,
- 5Y,
- od počátku.

### P2: Rizikové metriky

- volatilita,
- Sharpe ratio,
- Sortino ratio,
- maximum drawdown,
- recovery time.

### P2: Výkonnost podle tříd aktiv

- akcie,
- ETF,
- fondy,
- hotovost,
- penzijní produkty,
- pasiva.

## 6. Verze v1.3: Rebalancing a plánování

### P1: Cílové váhy

Doplnit k instrumentům nebo třídám aktiv:

```text
target_weight
minimum_weight
maximum_weight
```

### P1: Rebalancing report

Zobrazit:

- aktuální váhu,
- cílovou váhu,
- odchylku,
- doporučený nákup/prodej,
- variantu pouze s novými vklady.

### P2: Plán pravidelných investic

Rozdělit měsíční investici podle:

- cílových vah,
- největších odchylek,
- minimální velikosti transakce,
- zadaných omezení.

### P2: Likvidita

Rozlišit:

- okamžitě likvidní,
- likvidní do 30 dní,
- omezeně likvidní,
- nelikvidní.

## 7. Verze v1.4: FIRE Advanced

### P1: Monte Carlo simulace

Parametry:

- očekávaný výnos,
- volatilita,
- inflace,
- počet scénářů,
- investiční horizont,
- renta,
- důchod.

Výstupy:

- pravděpodobnost úspěchu,
- medián konečného kapitálu,
- 10., 25., 75. a 90. percentil,
- pravděpodobnost vyčerpání podle věku.

### P1: Sequence-of-returns risk

Modelovat rozdílné pořadí stejných průměrných výnosů, zejména v prvních 10 letech renty.

### P2: Guardrails

Podporovat například:

- pevnou rentu,
- procentní rentu,
- Guyton-Klinger guardrails,
- dočasné snížení renty při drawdownu.

### P2: Mimořádné příjmy a výdaje

Například:

- prodej nemovitosti,
- dědictví,
- školné,
- nové auto,
- zdravotní výdaje,
- jednorázová investice.

### P2: Scénáře

- konzervativní,
- základní,
- optimistický,
- vlastní scénář.

## 8. Verze v1.5: Provoz a automatizace

### P1: Automatický scheduler cen

Aktualizace cen bez otevření aplikace.

Možnosti:

- Supabase Cron,
- plánovaná Edge Function,
- externí cron pouze jako fallback.

Po aktualizaci:

- přepočítat pozice,
- uložit snapshot,
- aktualizovat sync status,
- uložit audit chyby.

### P1: Automatizovaný Webglobe deployment

Možnosti:

- GitHub Actions + SFTP,
- build v CI,
- upload obsahu `dist/`,
- produkční smoke check.

Nutné:

- SFTP credentials v GitHub Secrets,
- ochrana produkční větve,
- oddělený preview workflow.

### P2: Monitoring

- chyba Edge Function,
- staré ceny,
- chybějící snapshot,
- neúspěšný backup,
- neúspěšný build.

### P2: Audit log

Evidovat:

- změnu pozice,
- ruční ocenění,
- import,
- smazání,
- změnu FIRE nastavení.

## 9. Verze v2.0: Multi-user platforma

### P1: Owner-based databázový model

Doplnit `user_id` nebo `owner_id` do všech relevantních tabulek.

RLS:

```sql
(select auth.uid()) = user_id
```

### P1: Více portfolií

- osobní portfolio,
- partnerské portfolio,
- dětské portfolio,
- penzijní portfolio,
- firemní portfolio.

### P1: Role

- vlastník,
- pouze čtení,
- poradce,
- administrátor.

### P2: Sdílení reportu

- časově omezený read-only odkaz,
- export PDF,
- skrytí citlivých částek,
- poradenský report.

### P2: Oddělené konfigurace

Každý uživatel nebo portfolio má vlastní:

- FIRE nastavení,
- cílové váhy,
- měnu reportingu,
- benchmark,
- pravidla aktualizace.

## 10. Technický dluh

### P1

- centralizovat formátovací funkce pro CZK, procenta a datum,
- odstranit zbývající inline styly,
- vytvořit sdílené komponenty `MetricCard`, `PageHeader`, `Panel`, `DataTable`, `FormField`,
- přidat Error Boundary,
- doplnit retry pro síťové chyby.

### P2

- generované Supabase TypeScript typy,
- odstranit `any` v backup service,
- oddělit doménové výpočty od React komponent,
- doplnit schema validaci odpovědí, například pomocí Zod,
- přidat lint a formatting v CI,
- zjednodušit dlouhé soubory `Fire.tsx`, `MarketData.tsx` a `App.tsx`.

## 11. Doporučené pořadí implementace

### Nejbližší sprint

1. Live poslední bod ve Vývoji majetku.
2. Snapshot po ručním ocenění.
3. Stáří ručních cen.
4. Konsistenční kontrola net worth.
5. Vitest pro FIRE a net worth.

### Následující hlavní epika

1. Datový návrh Transaction Ledger.
2. SQL migrace.
3. CSV import s dry-run.
4. Rekonstrukce quantity.
5. Cost basis.
6. Realizovaný P/L.
7. Total return.

## 12. Doporučená definice hotové verze v1.1

Verze v1.1 je hotová, pokud:

- každý BUY/SELL je navázán na instrument,
- transakce obsahují quantity, cenu, měnu, FX a poplatek,
- lze z transakcí spočítat současné množství,
- aplikace zobrazí neshodu proti `positions.quantity`,
- je implementovaný cost basis,
- je zobrazen realizovaný a nerealizovaný P/L,
- import historických transakcí má validaci a dry-run,
- XIRR používá pouze externí cashflow,
- nákup a prodej nejsou chybně považované za externí cashflow,
- existuje backup před migrací,
- produkční build a smoke test projdou.

## 13. Rozhodnutí, která je nutné udělat před Transaction Ledgerem

1. Zda rozšířit `cashflows`, nebo vytvořit samostatnou `transactions` tabulku.
2. Zda používat weighted average cost, FIFO, nebo obě metody.
3. Jak importovat staré obchody s neúplným FX kurzem.
4. Jak zacházet s corporate actions, split, spin-off a převody.
5. Zda mají být pozice vždy odvozené z transakcí, nebo zůstanou editovatelné s kontrolou konzistence.

Doporučení pro v1.1:

- samostatná `transactions` tabulka,
- weighted average cost pro portfolio reporting,
- FIFO jako navazující daňová vrstva,
- `positions` jako materializovaný nebo kontrolovaný agregát,
- explicitní reconciliation report.
