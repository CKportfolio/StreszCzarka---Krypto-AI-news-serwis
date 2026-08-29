# Security

Ta wersja repozytorium jest przygotowana do publicznego pokazania:

- nie zawiera kluczy API ani haseł,
- eksporty n8n nie zawierają przypiętych credentiali,
- adresy prywatnej infrastruktury zostały zastąpione zmiennymi środowiskowymi,
- `service_role` Supabase powinien istnieć wyłącznie w credentialach n8n / secret store,
- frontend używa wyłącznie publicznego `anon key` i ma tylko politykę odczytu RLS,
- wewnętrzne usługi mogą być chronione nagłówkiem `X-API-Key`.

Przed publicznym wdrożeniem warto dodatkowo ograniczyć porty firewallem i utrzymywać `storage-api` oraz `article-extractor` poza publicznym Internetem.
