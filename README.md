# Google Ads Operator — skill + MCP bundle

Et selvstendig sett med verktøy for å operere Google Ads-kontoer gjennom Claude Code / Claude Desktop. Bygget for å gi en PPC-konsulent eller byråoperatør kraftig AI-leverage på både daglig drift (søketerm-analyse, negative søkeord, kontoaudit) og strategisk arbeid (kontostruktur, bud-strategi, konverteringssporing).

## Hva du får i denne bundle-en

| Fil | Hva det er | Hvorfor du trenger det |
|-----|------------|-----------------------|
| `SKILL.md` | Deep operator-skill (9 000+ ord, 20 seksjoner) | Claude bruker denne som sin kunnskapsbase for alle Google Ads-beslutninger. Sourced fra Fred Vallaeys, John Moran, Brad Geddes, Jyll Saskin Gales, Kirk Williams m.fl. — unngår Google-blessede anbefalinger som optimerer for Googles inntekt over klientens ROAS. |
| `SETUP.md` | Steg-for-steg installasjon | Installere Claude Code, søke om Google Ads developer token, sette opp OAuth, koble til MCP |
| `MCP_TOOLS.md` | Referanse over alle MCP-verktøyene | Se hvilke handlinger Claude kan utføre på dine vegne — både lese-operasjoner og write-operasjoner med approval-gate |

## To brukssett

### Nivå 1 — bare skill (15 min oppsett)

Du får Claude til å tenke som en erfaren PPC-operatør. Han hjelper deg resonere om bud-strategi, kontostruktur, match-typer, Smart Bidding-readiness, PMax-fallgruver, Norge-spesifikke forhold (fellesferie, kommune-targeting, Finn.no-dynamikk). Ingen API-tilgang, ingen skrivetilgang — bare en veldig dyktig rådgiver.

### Nivå 2 — skill + MCP (2–4 timer oppsett)

Du gir Claude direkte tilgang til Google Ads API-en din gjennom en lokal MCP-server. Han kan da:

- Hente search terms-rapporter for hvilken som helst kunde på kommando
- Foreslå negative søkeord med begrunnelse — du bekrefter før det skrives
- Foreslå kampanje-pauser og budsjett-endringer med forhåndsvisning
- Revertere tidligere endringer via rollback
- Loggføre alt i audit-log (din egen Supabase)

Hele skrive-flyten går gjennom **plan → preview → confirm → execute** — Claude skriver aldri direkte til en konto uten at du har godkjent nøyaktig hva som skjer. Undo-data lagres på hver handling, så du kan rulle tilbake om noe blir feil.

## Hva du må ha for å kjøre dette

**For nivå 1 (skill only):**
- Claude Code installert (gratis CLI fra Anthropic)
- En Anthropic-konto (Pro/Max eller API-key)

**For nivå 2 (skill + MCP):**
- Alt over
- Google Ads developer token (Basic access er nok — gratis, godkjennes på 1–3 dager)
- Google Cloud-prosjekt for OAuth 2.0 credentials
- (Valgfritt, men anbefalt) Supabase-prosjekt for å lagre tokens, changes og audit-log
- Node.js 20+
- Ditt eget MCC (Manager Account) hvis du styrer flere klienter

Alt gratis eller fremforhandlet i Google-økosystemet.

## Hvordan komme i gang

1. Les `SETUP.md` fra topp til bunn før du begynner. Ikke hopp over developer token-søknaden — den har et par fallgruver (business-domene i kontakt-e-post, org.nr, klar beskrivelse av use case).
2. Start med nivå 1. Få skillen til å fungere i Claude Code og bruk den noen dager. Når du kjenner hva den kan, vil du forstå hvorfor MCP-tilkobling er neste nivå.
3. Deretter følg MCP-installasjonen i `SETUP.md` seksjon 4.

## Om kildegrunnlaget i skillen

Skillen siterer inline der en påstand er load-bearing. Når flere praktikere er enige om noe, er det behandlet som prinsipp. Når kun én operatør står bak en påstand, er det flagget som sådan. Googles eget Skillshop-materiale er eksplisitt deprioritert fordi Googles incentiver og klientens ROAS-incentiver divergerer på flere tilbakevendende punkter (PMax-push, Smart Bidding-terskler, auto-applied recommendations, match-type-anbefalinger).

Primære kilder:
- Fred Vallaeys (Optmyzr, ex-Google 10 år)
- John Moran (Solutions 8)
- Brad Geddes (Adalysis, forfatter av *Advanced Google AdWords*)
- Jyll Saskin Gales (ex-Google rep, coach)
- Kirk Williams (Zato Marketing)
- Miles McNair (PPC Mastery)
- Aaron Young (Define Digital Academy)
- Navah Hopkins, Sarah Stemen, Andrew Hales
- PPC Town Hall, r/PPC community-wisdom

## Norsk SMB-kontekst

Skillen er tunet for NOK-budsjetter (typisk 2 000–20 000 kr/mnd, noen opp til 50 000) og norsk markedsstruktur: lavere søkevolum, Finn.no som dominerende kanal i flere vertikaler, bokmål/nynorsk-hensyn, kommune-nivå targeting, fellesferie-sesongmønster, GDPR + Consent Mode v2-krav. US-baserte terskler er eksplisitt diskontert der de ikke oversettes.

## Lisens og bruk

Privat bundle. Bruk fritt i din egen operasjon. Ikke distribuer videre uten avsender-samtykke.

## Support

For tekniske spørsmål: kontakt avsender direkte. Skillen er en levende ressurs — nye praktiker-innsikter legges til underveis.
