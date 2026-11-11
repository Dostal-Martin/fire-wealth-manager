# FIRE WM — Integrace

## 1. Katalog integrací

| Integrace | Směr | Účel | Autentizace | Selhání |
|---|---|---|---|---|
| Supabase Auth | FE ↔ Supabase | session, login/logout | publishable key + credentials/JWT | zobrazit login/error |
| Supabase Data API | FE ↔ PostgreSQL | CRUD finančních dat | user JWT + RLS | error state, nepokračovat destruktivně |
| Supabase Edge Functions | FE → server | update a backfill cen | frontend invoke; serverové secrets uvnitř Edge | zachovat poslední cenu |
| Yahoo / market feed | Edge ↔ external | ceny veřejných instrumentů | server-side implementace | partial errors, poslední dostupné ceny |
| FX feed | Edge ↔ external | USD/CZK, EUR/CZK | server-side | neposílat nevalidní FX do pozic |
| CSV NAV | lokální soubor → FE | ruční historie fondů | bez autentizace souboru, ale FE vyžaduje Auth | validace, odmítnout chybný import |
| Webglobe | deployment | produkční statický frontend | SFTP/WebFTP účet | před uploadem produkční build |
| GitHub | development | verzování | GitHub účet | není runtime závislost |

## 2. Supabase

Frontend používá pouze:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Do browseru nesmí přijít:

```text
service_role
sb_secret_...
database password
```

## 3. Market feed

### Trigger
- automaticky jednou denně podle `app_sync_status`
- ručně z Tržních dat

### Výstup
- price_history
- FX
- positions.current_value
- následně snapshot a sync status

### Failure policy
- dílčí chyby evidovat v `error_count`
- portfolio používá poslední dostupnou cenu
- nedělat nulování pozice při chybě feedu

## 4. Ruční NAV

### Jednotková cena
- ukládá se do `price_history`
- poslední NAV přeceňuje pozici

### Total value
- přímý zápis celkové CZK hodnoty pozice

### Budoucí požadavek
- stale-price warning 35/60 dní
- snapshot update po ručním ocenění

## 5. Webglobe

Produkční adresa:

```text
https://fire.madocon.cz
```

Nasazuje se obsah `dist/`, nikoliv zdrojový projekt.
