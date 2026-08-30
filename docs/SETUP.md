# Setup

## 1. Lokalne usługi / VPS

Skopiuj konfigurację:

```bash
cp .env.example .env
```

Ustaw przede wszystkim:

```env
DB_PASSWORD=...
INTERNAL_API_KEY=...
```

Następnie:

```bash
docker compose up -d --build
```

Domyślnie usługi są wystawione tylko na `127.0.0.1`:

- storage API: `http://127.0.0.1:8900`
- article extractor: `http://127.0.0.1:10420`

Test:

```bash
curl http://127.0.0.1:10420/health
curl http://127.0.0.1:8900/health
```

## 2. Supabase

W SQL Editor uruchom:

```text
supabase/schema.sql
```

Powstaną tabele:

- `posts` — gotowe podsumowania,
- `dashboard` — dane rynkowe dla frontendu.

Frontend powinien korzystać tylko z publicznego `anon key`. Credential używany przez n8n do zapisu powinien być przechowywany w n8n i nie może trafić do repozytorium.

## 3. n8n

Zaimportuj:

1. `workflows/01-ingest-coindesk.json`
2. `workflows/02-ingest-cointelegraph.json`
3. `workflows/03-build-digest.json`
4. `workflows/04-market-dashboard.json` — opcjonalny

W n8n utwórz credentiale:

- **Mistral Cloud**,
- **Supabase**.

Workflowy portfolio używają `mistral-small-latest`. Mistral udostępnia Free mode z limitami, więc do demonstracyjnego uruchomienia nie trzeba od razu wracać do Mistral Large.

### Zmienne środowiskowe n8n

Workflowy nie zawierają adresu konkretnego VPS. Ustaw w środowisku kontenera/procesu n8n:

```env
STRESZCZARKA_STORAGE_API_URL=http://host.docker.internal:8900
STRESZCZARKA_EXTRACTOR_URL=http://host.docker.internal:10420
STRESZCZARKA_INTERNAL_API_KEY=ten-sam-klucz-co-w-.env
STRESZCZARKA_MARKETS_API_URL=https://twoj-serwis-rynkowy.example/api/markets
```

Jeżeli n8n działa bezpośrednio na hoście zamiast w Dockerze, użyj `http://127.0.0.1:8900` i `http://127.0.0.1:10420`.

Jeżeli instalacja n8n blokuje dostęp do `$env` w node'ach, zastąp te wyrażenia ręcznie adresami usług po imporcie workflowów.

## 4. Frontend

Frontend czyta `posts` i opcjonalnie `dashboard` z Supabase.

Lokalny build:

```bash
cd frontend
SUPABASE_URL=https://PROJECT.supabase.co \
SUPABASE_ANON_KEY=PUBLIC_ANON_KEY \
npm run build
```

Powstanie `frontend/index.html`.

### Render Static Site

Najprościej:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Publish Directory: `.`
- Environment Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## 5. Jak płyną dane

### Ingest

`RSS → deduplikacja po URL → Playwright → czyszczenie tekstu → Mistral → INFORMACJA/SZUM → PostgreSQL`

### Digest

`PostgreSQL.Artykuly → Mistral → gotowy digest → Supabase.posts → wyczyszczenie bufora Artykuly`

Tabela `Szum` pozostaje jako osobny zapis treści odfiltrowanych z głównego digestu.

### Dashboard

Opcjonalny workflow pobiera ceny i dane rynkowe z kilku źródeł i aktualizuje `Supabase.dashboard`.

## 6. Lockfile zależności

Obie usługi Node.js są niezależnymi pakietami. Po zmianie zależności wygeneruj i commituj ich lockfile osobno:

```bash
cd services/article-extractor
npm install
cd ../storage-api
npm install
```

Do repozytorium powinny trafić odpowiednie `package-lock.json`. Pozwala to później przejść w CI i Dockerfile z `npm install` na deterministyczne `npm ci`.
