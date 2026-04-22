# Setup — Google Ads Operator + MCP

Steg-for-steg installasjon. Regn med 15 min for nivå 1 (kun skill) og 2–4 timer for nivå 2 (skill + MCP med Google Ads API-tilkobling og OAuth). Developer token-godkjenning tar 1–3 virkedager og er blokker mellom nivå 1 og 2.

## Nivå 1 — kun skill (15 min)

### 1. Installer Claude Code

Krever macOS, Linux eller Windows med WSL. Node 20+.

```bash
npm install -g @anthropic-ai/claude-code
```

Alternativt: last ned fra [claude.com/claude-code](https://www.claude.com/claude-code).

Logg inn med Anthropic-kontoen din (Pro- eller Max-abonnement gir rikelig med kvote for daglig Google Ads-arbeid; alternativt bruk API-key).

```bash
claude
```

Første gang: du blir bedt om å autentisere. Følg flyten.

### 2. Installer operator-skillen

Lag skills-mappa hvis den ikke finnes:

```bash
mkdir -p ~/.claude/skills/google-ads-operator
```

Kopier `SKILL.md` inn i den mappa:

```bash
cp /sti/til/bundle/SKILL.md ~/.claude/skills/google-ads-operator/SKILL.md
```

Verifiser at Claude ser skillen:

```bash
claude
```

Inne i Claude Code, be om: *"List available skills"* eller bare start en samtale som trigger skillen: *"What's your take on Performance Max for a 5 000 NOK/month Norwegian car dealer?"* — hvis skillen er lastet, vil svaret reflektere kildematerialet (Brad Geddes' cannibalization-data, Kirk Williams, John Moran's terskel, osv).

### 3. Brukspattern — nivå 1

På dette nivået er Claude en rådgiver, ikke en operatør. Typiske bruksområder:

- *"Audit min kontostruktur for [klient]. Her er kampanjene: [lim inn skjermbilde eller eksport]"*
- *"Bør jeg bytte fra Max Conversions til tCPA på denne kampanjen? Siste 30 dager: 45 konverteringer, CPA 320 kr, ganske stabil"*
- *"Gi meg en negativ søkeordsliste for norsk bilverksted Tier 1-kampanje"*
- *"Mitt Ad Strength er 'Poor' — hva gjør jeg?"*
- *"Google-repen min pusher PMax. Skal jeg hopp på?"* (Spoiler: nei, med mindre spesifikke vilkår er oppfylt — skillen forklarer hvilke.)

Du kan stoppe her hvis du vil. Skillen alene gir betydelig løft. Fortsett til nivå 2 når du vil gi Claude direkte API-tilgang til kontoene.

---

## Nivå 2 — skill + MCP (2–4 timer oppsett)

### 4. Søk om Google Ads developer token

Uten token kan du ikke kalle Google Ads API-en. Token knyttes til en MCC (Manager Account).

**Forutsetninger:**
- Du må ha (eller opprette) et MCC — Google Ads Manager Account. Opprett på [ads.google.com/aw/signup/manager](https://ads.google.com/aw/signup/manager) hvis du ikke har ett.
- Din klient-kontoer må være koblet under MCC.

**Steg:**

1. Logg inn på MCC-en din.
2. Admin → API Center → søk om token. Velg **Basic access** (ikke Test; Basic gir produksjon-tilgang, 15 000 operasjoner/dag, nok for de fleste byråer).
3. Fyll ut Developer Token Application. De viktige feltene:
   - **Business website:** domenet ditt. Må ikke være gmail.com-adresse i kontakt-feltet.
   - **Business email:** bruk et e-post på ditt eget domene (f.eks. post@domenet.no). gmail.com-adresser blir rutinemessig avvist.
   - **Organization number / company info:** fyll ut norsk org.nr hvis aktuelt.
   - **Use case description:** beskriv *hva* du skal gjøre med API-en. Eksempel:
     > *"Internal tool for managing Google Ads accounts for small and medium-sized Norwegian businesses. Primary use cases: automated search terms reporting, negative keyword management, campaign status and budget changes with human approval gate, conversion tracking audits. Tool includes plan-preview-confirm-execute pattern for all write operations. No resale of access; single-operator agency use."*
   - **API call volume estimate:** realistisk — 100–1 000 ops/dag er typisk for et SMB-byrå.

4. Send inn. Behandlingstid: typisk 1–3 virkedager. Du får svar på oppgitt e-post.

**Hvis avvist:** vanligste grunner er gmail.com kontakt-e-post, vag use case-beskrivelse, eller manglende klar kobling mellom firma og domene. Fiks og send inn på nytt — det er vanlig å bli godkjent etter runde 2.

### 5. Sett opp Google Cloud OAuth

MCP-en bruker OAuth 2.0 for å hente refresh tokens per klient-konto (aldri passord).

1. Gå til [console.cloud.google.com](https://console.cloud.google.com). Opprett nytt prosjekt (f.eks. `google-ads-mcp`) eller bruk eksisterende.
2. APIs & Services → Library → søk "Google Ads API" → Enable.
3. APIs & Services → OAuth consent screen:
   - User Type: **External**
   - App name: `Google Ads MCP` (eller tilsvarende)
   - Support email: din business-e-post
   - Scopes: legg til `https://www.googleapis.com/auth/adwords`
   - Test users: legg til din egen Google-bruker og eventuelle klientkontoer du vil koble
   - **Ikke publiser appen** — hold den i Testing-mode. Publishing krever Google-verifisering for sensitive scopes (adwords) og tar uker. Testing-mode + test users fungerer i produksjon for internt byråverktøy.
4. APIs & Services → Credentials → Create Credentials → OAuth client ID:
   - Application type: **Web application**
   - Name: `google-ads-mcp-oauth`
   - Authorized redirect URI: `http://localhost:5432/oauth/google/callback`
   - Lagre **Client ID** og **Client secret**.

### 6. Sett opp Supabase (eller hopp over hvis du vil kjøre uten lagring)

MCP-en bruker Supabase for å lagre:
- OAuth refresh tokens (kryptert med AES-256-GCM før insert)
- Klient-liste og plattform-tilkoblinger
- Changes-pipeline (plan → preview → confirm → execute)
- Audit-logg

Gratis-tier på Supabase holder rikelig for SMB-byråer.

1. Opprett prosjekt på [supabase.com](https://supabase.com). Norsk region: Stockholm (eu-north-1) er nærmest.
2. Project Settings → API → noter:
   - `Project URL` → blir `SUPABASE_URL`
   - `anon public` → blir `SUPABASE_ANON_KEY`
   - `service_role` → blir `SUPABASE_SERVICE_ROLE_KEY` (hemmelig — bare server-side)
3. Settings → Access Tokens → generer personlig access token → blir `SUPABASE_ACCESS_TOKEN` (brukes av CLI for migreringer).

### 7. Klon og installer MCP-en

Avsender deler deg et GitHub-repo (`google-ads-mcp`). Klon lokalt:

```bash
git clone https://github.com/[avsender]/google-ads-mcp.git
cd google-ads-mcp
npm install
```

### 8. Konfigurer miljøvariabler

```bash
cp .env.example .env.local
```

Rediger `.env.local`:

```bash
# Supabase
SUPABASE_URL=https://din-prosjekt.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ACCESS_TOKEN=sbp_...

# Token-kryptering (generer en 32-byte hex string)
# Kommando: openssl rand -hex 32
GOOGLE_ADS_MCP_ENCRYPTION_KEY=...

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=...         # fra steg 4
GOOGLE_ADS_CLIENT_ID=...               # fra steg 5
GOOGLE_ADS_CLIENT_SECRET=...           # fra steg 5
GOOGLE_ADS_MCC_ID=123-456-7890         # ditt MCC ID uten bindestreker: 1234567890
GOOGLE_ADS_REDIRECT_URI=http://localhost:5432/oauth/google/callback
```

### 9. Kjør database-migreringer

```bash
npm run db:migrate
```

Dette setter opp alle tabellene i Supabase-prosjektet ditt (`clients`, `platform_connections`, `campaigns`, `changes`, `playbooks`, `audit_log`).

### 10. Legg til din første klient

Via Supabase SQL editor, eller direkte:

```sql
insert into clients (slug, name, industry, tier, monthly_retainer_nok)
values ('testklient', 'Testklient AS', 'car_dealer', 1, 6000);
```

### 11. Koble en Google Ads-konto via OAuth

```bash
npm run oauth:google
```

Dette starter en lokal server på `localhost:5432`, åpner browseren mot Google OAuth-flyten, og lagrer refresh token + customer ID mot den klienten du velger. Test-bruker på OAuth consent screen må inkludere Google-kontoen du logger inn med.

**Hvis du får "Access blocked: App has not completed Google verification":** Du logget inn med en bruker som ikke er test-user. Gå til OAuth consent screen i Google Cloud, legg til brukeren under Test users, prøv igjen.

### 12. Koble MCP-en til Claude Code

Rediger `~/.claude.json`. Legg til under `mcpServers`:

```json
{
  "mcpServers": {
    "google-ads-mcp": {
      "command": "node",
      "args": ["/full/sti/til/google-ads-mcp/dist/mcp/server.js"],
      "env": {
        "SUPABASE_URL": "https://din-prosjekt.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
        "GOOGLE_ADS_MCP_ENCRYPTION_KEY": "...",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "...",
        "GOOGLE_ADS_CLIENT_ID": "...",
        "GOOGLE_ADS_CLIENT_SECRET": "...",
        "GOOGLE_ADS_MCC_ID": "1234567890"
      }
    }
  }
}
```

Først: bygg TypeScript:

```bash
npm run build
```

Restart Claude Code. Verifiser at MCP-en er lastet:

```bash
claude
```

I chatten: *"What google-ads-mcp tools do you have?"* — du skal se listen `list_clients`, `list_pending_changes`, `google_ads_search_terms_report`, `google_ads_propose_negative_keywords`, osv.

### 13. Testkjør: hent søketerm-rapport

I Claude Code:

```
Hent søketerm-rapport for testklient siste 7 dager
```

Claude skal kalle `google_ads_search_terms_report`, returnere rader, og være klar til å foreslå negative søkeord. Herfra følger du skillen — se `MCP_TOOLS.md` for full verktøy-referanse.

---

## For Claude Desktop (valgfritt)

Samme MCP-konfigurasjon som Claude Code, men i Claude Desktop sin config-fil:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Samme JSON-struktur som over. Restart Claude Desktop etter endring.

---

## Feilsøking

**"no active Google Ads connection for client [slug]"**
→ OAuth-flyten fullførte ikke, eller klienten ble markert inaktiv. Kjør `npm run oauth:google` på nytt.

**"UNIMPLEMENTED: GRPC target method can't be resolved"**
→ `google-ads-api` npm-pakken er for gammel. Oppgrader til v23+: `npm install google-ads-api@latest`

**"Expects filters on the following field to limit a finite date range"**
→ GAQL-spørring mangler dato-filter. Sjekk at BETWEEN-syntaksen brukes (skillen har eksempler).

**MCP-server starter ikke i Claude**
→ Sjekk Claude Code logs: `~/Library/Logs/Claude/*.log` (macOS). Vanlig feil: feil absolutt sti i `args`, eller env-variabler mangler i MCP-config.

**Supabase-migrasjon feiler med ON CONFLICT-feil**
→ Tabellen finnes allerede med avvikende skjema. Reset: `npm run db:reset`. Advarsel: sletter all data — kjør kun på fersk prosjekt.

---

## Drift og daglig bruk

Når alt er oppe:

- MCP-en kjører automatisk hver gang du åpner Claude Code eller Claude Desktop. Ingen manuell oppstart.
- `npm run mcp:dev` kan brukes for debugging med watch-mode under utvikling.
- Rollback er alltid én kommando unna: *"propose_rollback change_id [id]"* → approve → execute.
- Audit-log lever i Supabase, aldri slettet. Hvis en klient spør "hva gjorde du i forrige uke", har du svar på sekunder.

---

## Neste steg

Du har nå et operatør-system som matcher (eller overgår) hva store byrå-plattformer tilbyr for 10 000+ kr/mnd i SaaS. Neste utvidelser du kan vurdere:

- Meta Ads MCP (samme pattern, ligger utenfor denne bundle-en)
- Weekly review-arbeidsflyter som aggregerer på tvers av klienter
- Custom playbooks per vertikal (bilforhandler, restaurant, tannlege) lagret som seed-data i Supabase
- Web-UI for approval-flyten (Vite + React + Tailwind) — bare hvis chat-godkjenning blir utilstrekkelig

Disse er alle åpne forlengelser. Grunn-MCP-en som følger med gir deg full Google Ads-operativ kapasitet med én gang.
