# Security

Ta wersja repozytorium jest przygotowana do publicznego pokazania:

- nie zawiera kluczy API ani haseł,
- eksporty n8n nie zawierają przypiętych credentiali,
- adresy prywatnej infrastruktury zostały zastąpione zmiennymi środowiskowymi,
- `service_role` Supabase powinien istnieć wyłącznie w credentialach n8n / secret store,
- frontend używa wyłącznie publicznego `anon key` i ma tylko politykę odczytu RLS,
- wewnętrzne usługi mogą być chronione nagłówkiem `X-API-Key`.

Przed publicznym wdrożeniem warto dodatkowo ograniczyć porty firewallem i utrzymywać `storage-api` oraz `article-extractor` poza publicznym Internetem.

## Kontrole dodane w repozytorium

- `INTERNAL_API_KEY` jest konfiguracją wymaganą; brak klucza nie otwiera już endpointów `/api` ani `/extract`.
- Article extractor stosuje allowlistę nie tylko do URL wejściowego, ale również do kolejnych requestów wykonywanych przez Playwright.
- Testy automatyczne sprawdzają odrzucanie domen podobnych do dozwolonych oraz adresów loopback / metadata-service.
- CI uruchamia `npm audit --audit-level=high` osobno dla obu usług Node.js.
