# FIRE WM — Business Rules and Invariants

## INV-001: Live net worth
Aktuální čisté jmění je odvozené z `positions.current_value`.

## INV-002: Snapshots are history
`portfolio_snapshots` jsou historická řada, ne autorita aktuální hodnoty.

## INV-003: One snapshot per day
Pro kombinaci portfolio + datum smí existovat nejvýše jeden snapshot.

## INV-004: Reporting currency
`positions.current_value`, historické net worth a hlavní reporting jsou v CZK.

## INV-005: Native market price
Tržní cena může zůstat v nativní měně instrumentu.

## INV-006: External cashflow
`CONTRIBUTION` a `WITHDRAWAL` jsou externí cashflow pro portfolio performance.

## INV-007: Trades are internal
BUY a SELL nejsou externí cashflow celého portfolia. Jde o přesun mezi cash a instrumentem.

## INV-008: Unit-price manual valuation
Ruční `unit_price` používá quantity × NAV × FX.

## INV-009: Total-value manual valuation
Ruční `total_value` je přímá celková hodnota pozice v CZK.

## INV-010: Real market data only
`price_history` nemá obsahovat vymyšlené mezilehlé NAV body.

## INV-011: XIRR versus net-worth growth
XIRR a CAGR čistého jmění nejsou zaměnitelné metriky.

## INV-012: Security secret boundary
Privilegované serverové credentials nesmí být dostupné v browseru.

## INV-013: Backup before destructive migrations
Před destruktivní změnou DB vytvořit ověřený JSON backup.

## INV-014: Manual valuation freshness
Před finálním denním snapshotem zkontrolovat ruční NAV.

## INV-015: Transaction ledger future rule
Po zavedení Transaction Ledger musí být možné vysvětlit quantity pozice jako součet BUY minus SELL po zohlednění corporate actions.
