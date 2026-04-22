# MCP-verktøy referanse — google-ads-mcp

Alle verktøy som eksponeres av `google-ads-mcp` til Claude. Lese-operasjoner er autonome (Claude kjører uten å spørre). Skrive-operasjoner følger **plan → preview → confirm → execute** pipeline — Claude foreslår, du godkjenner, Claude eksekverer.

## Klient-styring

### `list_clients`
Lister alle aktive klienter i systemet.

**Argumenter:** ingen.

**Eksempel-prompt:** *"Hvilke klienter har vi i google-ads-mcp?"*

### `get_client`
Detaljer om én spesifikk klient — tilkoblede plattformer, tier, månedlig retainer, notater.

**Argumenter:** `{ client_slug: string }`

**Eksempel-prompt:** *"Vis full info om stjordal-autosalg"*

---

## Lese-operasjoner (Google Ads)

### `google_ads_search_terms_report`
Henter search terms-rapport for en klient. Returnerer faktiske søkefrasene som trigget annonser, med klikk, kostnad, konverteringer.

**Argumenter:**
- `client_slug: string` (påkrevd)
- `days: number` (valgfri, 1–90, default 7)

**Returnerer:** Per rad: search term, match type, klikk, impressions, kostnad (NOK), konverteringer. Aggregert sum-rad på topp.

**Eksempel-prompt:** *"Hent search terms siste 14 dager for testklient, sortert etter kostnad"*

**Typisk arbeidsflyt:** Claude henter rapporten → identifiserer waste-mønstre (jobb-queries, gratis-queries, konkurrent-navn, irrelevante kjøretøy-typer) → foreslår negative søkeord med begrunnelse.

---

## Skrive-operasjoner (Google Ads — alle krever approval)

### `google_ads_propose_negative_keywords`
Foreslår å legge til negative søkeord på kampanje eller shared set. Oppretter en rad i `changes` med status `pending_approval`. Ingenting eksekveres før du godkjenner.

**Argumenter:**
```json
{
  "client_slug": "stjordal-autosalg",
  "scope": {
    "type": "campaign",
    "campaign_id": "1234567890"
  },
  "candidates": [
    { "text": "jobb", "match_type": "PHRASE", "rationale": "Job-queries, ikke kjøpere" },
    { "text": "gratis", "match_type": "PHRASE", "rationale": "Informational intent" }
  ],
  "rationale": "Ukens negative sweep fra search terms report"
}
```

**Scope-alternativer:**
- `{ type: "campaign", campaign_id: "..." }` — gjelder én kampanje
- `{ type: "shared_set", shared_set_id: "..." }` — gjelder shared negative list (anbefalt for byråer med flere kampanjer)

**Eksempel-prompt:** *"Legg til følgende negative søkeord på non-brand-kampanjen til testklient: jobb (phrase), gratis (phrase), mekaniker kurs (exact), bytte (exact)"*

### `google_ads_propose_pause_campaign`
Foreslår å pause en kampanje.

**Argumenter:** `{ client_slug, campaign_id, campaign_name?, rationale }`

**Eksempel-prompt:** *"Pause kampanje 'Display Experiment' på testklient — CPA er 4× over target i 14 dager"*

### `google_ads_propose_resume_campaign`
Foreslår å reaktivere en pauset kampanje.

**Argumenter:** `{ client_slug, campaign_id, campaign_name?, rationale }`

### `google_ads_propose_campaign_budget`
Foreslår å endre daglig budsjett (NOK). NB: endrer den koblede budget-ressursen — hvis flere kampanjer deler budsjett, påvirker endringen alle.

**Argumenter:** `{ client_slug, campaign_id, campaign_name?, new_daily_nok, previous_daily_nok?, rationale }`

**Eksempel-prompt:** *"Øk daglig budsjett på brand-kampanjen til testklient fra 100 til 150 kr — impression share på absolute top er 65%, rom for å ta mer brand-trafikk"*

---

## Change-pipeline (godkjenning og eksekvering)

### `list_pending_changes`
Lister alle changes med status `pending_approval`, nyeste først.

**Argumenter:** `{ client_slug?: string }`

**Eksempel-prompt:** *"Hvilke endringer venter på godkjenning?"*

### `get_change`
Full detaljer for en spesifikk change, inkludert plan-JSON og undo-data.

**Argumenter:** `{ change_id: string }`

### `approve_change`
Godkjenner en pending change. Status blir `approved`, men ingenting eksekveres enda.

**Argumenter:** `{ change_id: string, approved_by?: string }`

**Eksempel-prompt:** *"Godkjenn change [id]"* — etter at du har bekreftet i chat

### `reject_change`
Avviser en pending change uten å eksekvere.

**Argumenter:** `{ change_id: string, reason?: string }`

### `execute_change`
Eksekverer en godkjent change mot Google Ads API. Dispatcher til riktig platform-handler basert på `operation_type`. Skriver result + undo-data tilbake til change-raden.

**Argumenter:** `{ change_id: string }`

**Eksempel-prompt:** *"Eksekver change [id]"* — etter approve

### `propose_rollback`
Oppretter en pending rollback change for en tidligere eksekvert change. Rollbacken går gjennom samme approve → execute-flyt.

Støtter i dag:
- Status-endringer (pause → resume, resume → pause)
- Budsjett-endringer (reversere tilbake til previous_daily_nok)
- Negative keyword-tilføyelser (fjerner criteria by resource_name)

**Argumenter:** `{ change_id: string }` — ID-en til den allerede eksekverte changen du vil reversere.

**Eksempel-prompt:** *"Rull tilbake den siste budget-endringen på testklient"*

---

## Typisk ukentlig arbeidsflyt

1. *"Hent search terms siste 7 dager for alle klienter"* → Claude henter, oppsummerer på tvers
2. *"Foreslå negatives for testklient basert på waste-mønstre"* → Claude foreslår med begrunnelse, lagrer som pending_approval
3. *"Vis forhåndsvisning av den foreslåtte changen"* → Claude viser preview-teksten
4. Du bekrefter *"ja, godkjenn og kjør"*
5. Claude: `approve_change` → `execute_change` → rapporterer resultat
6. Alt loggført i audit_log, rollback tilgjengelig hvis noe går galt

## Sikkerhetsmodell

- **Reads:** autonome, ingen approval. Claude kan hente data når som helst.
- **Writes:** alltid `plan → preview → confirm → execute`. Ingenting skjer automatisk.
- **Rollback:** alle writes har undo_data lagret. Én kommando for å reversere.
- **Audit:** hver operation logges med aktør, handling, detaljer, tidsstempel. Immutabel.
- **Token-kryptering:** OAuth refresh tokens krypteres med AES-256-GCM før lagring i Supabase. Kun service_role-nøkkelen din kan dekryptere.
- **RLS:** Row Level Security aktivert. Kun service role har tilgang.

## Når du trenger flere verktøy

MCP-en er lett å utvide. Mønsteret for en ny write-operasjon:

1. Skriv `src/operations/[operation].ts` med `propose()` + `execute()` + `rollback()`-funksjoner
2. Legg til en ny tool i `src/mcp/tools/google-ads.ts` (eller ny fil for annen plattform)
3. Registrer i `src/mcp/server.ts`
4. Migrasjon om nødvendig (ny operation_type-verdi)

Standarden: hver ny operation følger samme plan/preview/confirm/execute-pipeline. Ingen direkte API-writes.

## Claude-tips

- Gi Claude klare, intent-baserte kommandoer. Ikke *"kjør tool X"* — heller *"analyser hva som sløser budsjett på testklient denne uka og foreslå fix"*.
- Claude bruker operator-skillen som kunnskapsbase for alle beslutninger — du trenger sjelden fortelle ham hva som er riktig praksis, han vet det allerede.
- Ved tvil om en foreslått endring, spør *"hvorfor akkurat denne?"*. Claude vil begrunne med kilde (Fred Vallaeys, Jyll Saskin Gales, Adalysis, osv) fra skillen.
- Stol aldri blindt på approve → execute. Ta de 30 sekundene det tar å lese preview-teksten hver gang. Det er billig forsikring.
