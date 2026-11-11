# ADR-001: Live net worth pochází z positions

## Status
Accepted

## Context
Historický snapshot může být starší než poslední přecenění pozic.

## Decision
Aktuální čisté jmění se počítá z `positions.current_value`. Snapshoty slouží pouze jako historie.

## Consequences
Dashboard a FIRE nesmí číst poslední snapshot jako současnou autoritu. NetWorth UI má v budoucí stabilizační verzi zobrazovat live současný bod.
