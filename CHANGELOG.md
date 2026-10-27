# Jurnal de modificări

## 2.1.0 — 2026-10-27 (anterior: v2.0.0)

Recenzie 2026-10-27.

### Implementat
- Explicația deciziilor AI: sugestia (💡) arată acum cartea aleasă, diferența medie de puncte pe mână, numărul de lumi simulate și alternativele (fără a schimba alegerea AI).
- Atlas: intrare «Belot de Ardeal (reguli de confirmat)», marcată ca atare, fără reguli inventate.
- Test nou `tests/explicatii-ai.test.mjs` (9 verificări).

### Neimplementat și de ce
- Regulile belotului de Ardeal: nu au fost verificate din surse web, deci nu au fost scrise; intrarea e doar un substituent «de confirmat».
- AI cu niveluri de dificultate: neimplementat în această rundă (necesită calibrare și teste dedicate pe motorul jocului).
- Statistici comune între jocuri: neimplementat (ar cere un spațiu de stocare partajat între aplicații separate, contrar izolării actuale).
- Mod multiplayer local unificat între jocuri: **planificat**, NU acum; jocurile rămân separate.
