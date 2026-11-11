# FIRE WM — Deployment a provoz

## 1. Prostředí

### Development
```text
npm run dev
http://localhost:5173
```

### Production preview
```text
npm run build
npm run preview
```

### Production
```text
https://fire.madocon.cz
```

## 2. Environment

Vite klient potřebuje:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

`.env.local` necommitovat a nenahrávat na Webglobe.

## 3. Build

```powershell
npm run build
```

Build musí skončit bez TypeScript errors. Výstup je `dist/`.

Známé neblokující upozornění: hlavní JS chunk může být >500 kB před gzipem.

## 4. Webglobe upload

Do document root subdomény nahrát obsah:

```text
dist/index.html
dist/assets/*
```

Ne nahrát samotnou vnořenou složku `dist`.

## 5. Supabase Auth URL

```text
Site URL: https://fire.madocon.cz
Redirect URL: https://fire.madocon.cz/**
Redirect URL: http://localhost:5173/**
```

## 6. Release checklist

1. vytvořit backup
2. `npm run build`
3. `npm run preview`
4. smoke test
5. commit přes GitHub Desktop
6. push na GitHub
7. upload `dist/` na Webglobe
8. produkční smoke test
9. test z telefonu přes mobilní data
10. nový backup po datových migracích

## 7. Rollback

Frontend rollback:
- uchovat předchozí `dist` nebo znovu buildnout předchozí Git commit
- nahrát předchozí statické soubory

Databázový rollback:
- před migrací vždy backup
- preferovat forward migration před ručním mazáním
- destruktivní restore zatím není automatizovaný
