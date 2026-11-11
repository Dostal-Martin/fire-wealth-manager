# ADR-002: Jeden denní snapshot přes upsert

## Status
Accepted

## Decision
Kombinace `portfolio_id + snapshot_date` je unikátní. Dnešní snapshot se zapisuje přes upsert.

## Rationale
Více aktualizací za den nesmí vytvořit více bodů denního grafu.

## Consequence
Pozdější ruční ocenění musí dnešní snapshot aktualizovat, jinak může historie dočasně zaostávat za live stavem.
