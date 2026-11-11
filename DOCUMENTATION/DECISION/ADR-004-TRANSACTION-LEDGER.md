# ADR-004: Transaction Ledger jako priorita v1.1

## Status
Proposed

## Context
Současné positions představují aktuální stav, ale BUY/SELL historie není autoritativně propojená s množstvím a cost basis.

## Proposed decision
Zavést samostatnou `transactions` tabulku s instrumentem, quantity, unit price, currency, FX, fees a type.

## Recommended model
- transactions = auditovatelná historie obchodů
- positions = agregovaný současný stav
- reconciliation = kontrola vypočtené quantity proti positions.quantity
- weighted average cost jako první reporting metoda
- FIFO jako pozdější daňová vrstva
