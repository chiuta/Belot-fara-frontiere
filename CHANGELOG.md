# Jurnal de modificări

## 2.2.0 — 2026-10-27

### Implementat
- **Verificarea nivelurilor AI prin simulare** (rămasă „neimplementată” în 2.1.0): `tests/niveluri-sim.test.mjs` extrage motorul (`BELOT` + `BELOT_AI`) din fișier și joacă mâini complete în Node, fără browser, cu locurile alternate între echipe. Rezultate (reguli românești, 240 de mâini pe pereche, 2026-10-27): nivelul 2 bate nivelul 0 cu 171–67 (z = 6,74); nivelul 1 bate nivelul 0 cu 163–74 (z = 5,78); nivelul 2 bate nivelul 1 cu 139–100, marjă medie +22,3 puncte/mână (z = 2,52, p ≈ 0,012: pozitiv, dar de-abia la limita semnificației). Testul din depozit rulează implicit 60 de mâini pe pereche (~1 min) și cere z ≥ 2,58 doar pentru 1 vs 0 și 2 vs 0, iar pentru 2 vs 1 doar marjă pozitivă (cu 60 de mâini z = 0,77, sub prag, ceea ce spunem deschis).
- Constatare: **cele trei niveluri AI și statisticile locale (meciuri jucate/câștigate, `bff_stats`) există deja** în aplicație (meniul „Adversar AI”); nu s-a adăugat nimic duplicat. README (RO, EN) documentează rezultatele simulării.

### Neimplementat și de ce
- Belot de Ardeal: căutare web repetată (2026-10-27); nu am găsit nicio sursă verificabilă cu regulile; intrarea din atlas rămâne „reguli de confirmat”, fără reguli inventate.
- Statistici comune între jocuri / multiplayer local unificat: neschimbat (aplicații separate, cu stocare izolată).

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
