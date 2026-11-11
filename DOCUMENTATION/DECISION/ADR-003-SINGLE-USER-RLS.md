# ADR-003: Single-user RLS pro MVP

## Status
Accepted for v1.0

## Decision
Anon přístup je blokovaný, authenticated role má přístup k datům FIRE WM.

## Trade-off
Model neodděluje více autentizovaných uživatelů. Veřejný signup proto nesmí být povolen.

## Migration path
Před multi-user provozem doplnit owner/user ID a owner-based RLS.
