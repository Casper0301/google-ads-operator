---
name: google-ads-operator
description: End-to-end Google Ads skill for Claude Code. Auto-detects setup state and either walks the user through getting API access and installing the google-ads-mcp server, or operates existing Google Ads accounts with deep source-grounded practitioner wisdom. Use when user says "Google Ads", "set up Google Ads", "install google-ads-mcp", "campaign setup", "bidding strategy", "negative keywords", "Performance Max", "conversion tracking", "quality score", or any Google Ads question.
when-to-use:
  - Setting up Google Ads management from scratch on a new machine
  - Applying for Google Ads API developer token
  - Installing the google-ads-mcp server locally
  - Connecting a client's Google Ads account via OAuth
  - Proposing or executing campaign changes (negatives, pause, budget)
  - Running the weekly search terms / negative keyword workflow
  - Choosing a bidding strategy or deciding when to switch
  - Auditing conversion tracking setup
  - Planning campaign structure for a new account
  - Deciding PMax vs Search, or whether to enable Smart Bidding
  - Evaluating Google rep recommendations or auto-applied suggestions
  - Diagnosing poor performance (low impressions, low CTR, high CPC, no conversions)
  - Any "should we do what Google suggested?" question
trigger-keywords:
  - google ads
  - adwords
  - google ads mcp
  - google-ads-mcp
  - set up google ads
  - install google ads
  - google ads api
  - developer token
  - search campaign
  - shopping campaign
  - performance max
  - pmax
  - smart bidding
  - target cpa
  - target roas
  - max conversions
  - quality score
  - negative keywords
  - search terms report
  - responsive search ads
  - rsa
  - enhanced conversions
  - consent mode
  - auto-applied recommendations
  - match types
  - broad match
  - phrase match
  - exact match
---

# Google Ads Operator

This skill does two things in one continuous flow:

1. **Setup path** — guides the user through applying for Google Ads API access, setting up OAuth, installing the google-ads-mcp server locally, and connecting their first account. Step-by-step, with copy-paste templates and lessons learned from real applications.
2. **Operator mode** — once the MCP is live, operates Google Ads accounts using deep source-grounded practitioner wisdom (Fred Vallaeys, John Moran, Brad Geddes, Jyll Saskin Gales, Kirk Williams, Miles McNair, Aaron Young, Navah Hopkins, Sarah Stemen, Andrew Hales, plus PPC Town Hall and r/PPC community) — explicitly deprioritising Google's own Skillshop material because Google's incentives and client ROAS diverge on recurring points.

**Always begin by detecting phase.** Don't assume the user is in operator mode. A user who says "help me with Google Ads" might have nothing installed yet; start at Phase 0 to figure out where they are.

Cite sources inline when a specific claim or threshold is load-bearing. If only one practitioner says X, flag it. If 3+ agree, it's a principle.

---

## Phase 0 — Detect current state

Run these checks in order before advising or acting:

### 0.1 — Is the MCP registered with Claude?

```bash
grep -l "google-ads-mcp" ~/.claude.json "$HOME/Library/Application Support/Claude/claude_desktop_config.json" 2>/dev/null
```

- No match → not installed. Go to **Phase 1**.
- Match found → continue to 0.2.

### 0.2 — Is the MCP actually responding?

Try calling the `list_clients` MCP tool.

- "Unknown tool" or tool not listed → registered but broken; jump to **Phase 3** step 3.3 (env / build check).
- Returns an array (even empty) → MCP is live; continue to 0.3.

### 0.3 — How many clients are connected?

From `list_clients` result:

- Empty array `[]` → MCP is live but no Google Ads OAuth done yet; go to **Phase 4**.
- One or more clients → full setup complete; go to **Phase 5 (operator mode)**.

Announce to the user what phase they're in and ask if they want to proceed. Example:

> "Looks like you don't have the google-ads-mcp installed yet. I'll walk you through the setup in four phases — takes 1–3 days total, but most of that is waiting for Google to approve your API access. Ready to start?"

---

## Phase 1 — Apply for Google Ads API developer token

This is a blocking step — without a developer token, nothing else works. Approval typically takes **1–3 business days**. Plan accordingly.

### 1.1 — Check for an MCC (Manager Account)

Google Ads API access attaches to a Manager Account (MCC), not to individual ad accounts. Ask the user:

- "Do you already have a Google Ads Manager Account (MCC)?"
- If no → direct them to create one at `https://ads.google.com/aw/signup/manager`. **The user must do this themselves** — you cannot create accounts on their behalf. Once created, they link their existing client ad accounts under the MCC.

### 1.2 — Gather application inputs

Before pointing them at the application form, collect and confirm these:

- **Business email on own domain.** Critical. `gmail.com` / `outlook.com` get routinely rejected. Must be something like `name@theircompany.com`.
- **Company name and org number** (organization number — e.g., Norwegian org.nr, US EIN, UK company number).
- **Business website URL** — must match the email domain.
- **Vertical / business description** — one sentence the user gives in their own words.

If any of those is missing, help the user understand what they need before they hit the form.

### 1.3 — Lessons learned (these are not in Google's docs)

**DO:**
- Use an email on the same domain as the business website.
- Put the org number clearly in the company details.
- Select **Basic access** (not Test). Basic = production + 15 000 ops/day.
- Write the use case in operational English (not marketing speak).

**DON'T:**
- Submit with a gmail.com / outlook.com / yahoo.com contact email.
- Leave the use case vague. "General marketing tool" gets rejected.
- Mix domains (email on one domain, website on another).

### 1.4 — Use case template (proven to be approved)

Offer this to the user as a starting point. They should customize the bracketed parts with their own business context:

> *Internal operator tool for managing Google Ads accounts for [type of businesses, e.g. small and medium-sized Norwegian businesses]. Primary use cases: automated search terms reporting, negative keyword management, campaign status and budget changes with human approval gate, conversion tracking audits. The tool implements a plan → preview → confirm → execute pattern for all write operations — nothing writes to an account without explicit user approval. Full audit log and rollback on every change. No resale of access; single-operator [agency / in-house] use.*

### 1.5 — Walk through the submission

1. User logs into their MCC.
2. **Admin → API Center → Apply for Basic access**.
3. Fills in all fields using the inputs from 1.2.
4. Pastes the use case from 1.4.
5. API call volume estimate: `100–1 000 operations/day` is realistic for a typical SMB agency. If they manage 10+ clients, increase to `1 000–5 000/day`.
6. Submits.

### 1.6 — After submission

Tell the user:
- Expect email from Google within 1–3 business days.
- Approved → proceed to Phase 2.
- Rejected → common reasons are gmail.com email, vague use case, or domain mismatch. Help the user fix the specific feedback and resubmit. Round-2 approvals after addressing feedback are very common.

If rejected multiple times with unclear feedback, suggest the user writes a longer, more detailed use case describing *each* operation the tool will perform, with specific client examples.

---

## Phase 2 — Google Cloud OAuth setup

Once the developer token is approved, set up OAuth so the MCP can authenticate per-account with Google.

### 2.1 — Create or select a Google Cloud project

1. Open `https://console.cloud.google.com`.
2. Top bar → project picker → **New Project**.
3. Name: `google-ads-mcp` (or reuse an existing one).
4. **APIs & Services → Library** → search "Google Ads API" → **Enable**.

### 2.2 — Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User Type: **External** (required for any Gmail account that isn't part of a Google Workspace org).
3. App information:
   - App name: `Google Ads MCP` (or similar)
   - User support email: user's business email
   - App logo: optional
   - Authorized domains: the business domain
   - Developer contact: user's business email
4. **Scopes** → add `https://www.googleapis.com/auth/adwords`.
5. **Test users** → add the user's own Google account email. Add any other emails that will log in to connect accounts (e.g., if a teammate will onboard a client).

**CRITICAL:** Do NOT click "Publish app". The `adwords` scope is sensitive and publishing triggers a Google verification process that takes weeks. Keep the app in **Testing** mode. Testing mode works fine for internal / agency use — the only restriction is that the authenticating user must be in the test users list.

### 2.3 — Create OAuth client credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `google-ads-mcp-oauth`.
4. **Authorized redirect URIs**: add `http://localhost:5432/oauth/google/callback`.
5. Click Create.
6. Download or copy **Client ID** and **Client secret** — save these; they go in the MCP's `.env.local`.

### 2.4 — Save what was captured

At this point the user should have:
- Developer token (from Phase 1)
- OAuth Client ID
- OAuth Client secret
- MCC ID (digits only, no dashes, e.g. `1234567890` for MCC `123-456-7890`)

If they're fuzzy on the MCC ID, have them go back to MCC → Admin → Account settings → Manager account ID.

---

## Phase 3 — Install the google-ads-mcp server locally

### 3.1 — Prerequisites check

```bash
node --version    # must be 20+
git --version
```

If Node < 20: install Node 20+ via `nvm`, Homebrew, or the official installer before continuing.

### 3.2 — Clone the repo

Ask the user where they want to put projects. A common default is `~/Projects`. Then:

```bash
cd ~/Projects  # or wherever
git clone https://github.com/Casper0301/google-ads-operator.git
cd google-ads-operator/mcp
npm install
```

### 3.3 — Set up Supabase (free tier is plenty)

The MCP uses Supabase as its persistence layer for OAuth tokens (encrypted), clients, changes pipeline, and audit log.

1. User creates a project at `https://supabase.com`. Suggest Stockholm (`eu-north-1`) region for Norwegian users, Frankfurt (`eu-central-1`) for EU generally.
2. Project Settings → API → copy:
   - **Project URL** → becomes `SUPABASE_URL`
   - **service_role** secret → becomes `SUPABASE_SERVICE_ROLE_KEY` (NEVER commit this)
3. Settings → Access Tokens → **Generate new token** → saves as `SUPABASE_ACCESS_TOKEN` (used by the Supabase CLI for migrations).
4. Install the Supabase CLI locally if not present: `npm install -g supabase` (or `brew install supabase/tap/supabase`).

### 3.4 — Generate encryption key

The MCP encrypts OAuth refresh tokens at-rest using AES-256-GCM. Generate a 32-byte hex key:

```bash
openssl rand -hex 32
```

Save the output — it goes in `.env.local` as `GOOGLE_ADS_MCP_ENCRYPTION_KEY`. If lost, previously-stored tokens become unrecoverable. Treat it as a master key.

### 3.5 — Configure environment

```bash
cp .env.example .env.local
```

Walk the user through editing `.env.local` with the values collected in Phases 1–2 and the Supabase/encryption values from 3.3–3.4:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_SCHEMA=public
GOOGLE_ADS_MCP_ENCRYPTION_KEY=<hex from step 3.4>
GOOGLE_ADS_DEVELOPER_TOKEN=<from Phase 1>
GOOGLE_ADS_CLIENT_ID=<from Phase 2>
GOOGLE_ADS_CLIENT_SECRET=<from Phase 2>
GOOGLE_ADS_MCC_ID=<digits only>
GOOGLE_ADS_REDIRECT_URI=http://localhost:5432/oauth/google/callback
```

Never commit `.env.local`.

### 3.6 — Run database migrations

Link the local project to the Supabase project:

```bash
supabase link --project-ref <project-ref>   # project-ref is the xxx in xxx.supabase.co
```

Then push the schema:

```bash
SUPABASE_ACCESS_TOKEN=<token> npm run db:migrate
```

Verify in the Supabase dashboard → Table Editor that tables `clients`, `platform_connections`, `campaigns`, `changes`, `playbooks`, `audit_log` all exist.

### 3.7 — Build the MCP server

```bash
npm run build
```

This compiles TypeScript to `dist/`. Any errors here are typically missing env vars — re-check `.env.local` against the error message.

### 3.8 — Register the MCP with Claude Code

Add an entry to `~/.claude.json` under `mcpServers`. If the file doesn't exist or doesn't have that section, create/add:

```json
{
  "mcpServers": {
    "google-ads-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/google-ads-operator/mcp/dist/mcp/server.js"],
      "env": {
        "SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
        "SUPABASE_SCHEMA": "public",
        "GOOGLE_ADS_MCP_ENCRYPTION_KEY": "...",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "...",
        "GOOGLE_ADS_CLIENT_ID": "...",
        "GOOGLE_ADS_CLIENT_SECRET": "...",
        "GOOGLE_ADS_MCC_ID": "...",
        "GOOGLE_ADS_REDIRECT_URI": "http://localhost:5432/oauth/google/callback"
      }
    }
  }
}
```

Use the same env values as `.env.local`. Absolute path is required in `args`.

For **Claude Desktop**, same JSON structure but in:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### 3.9 — Restart Claude

Exit the current Claude Code session (or restart Claude Desktop). Launch again. The MCP should now be picked up.

### 3.10 — Smoke test

In a new Claude session:

> "What google-ads-mcp tools do you have?"

Expected response lists: `list_clients`, `get_client`, `list_pending_changes`, `get_change`, `approve_change`, `reject_change`, `execute_change`, `propose_rollback`, `google_ads_search_terms_report`, `google_ads_propose_negative_keywords`, `google_ads_propose_pause_campaign`, `google_ads_propose_resume_campaign`, `google_ads_propose_campaign_budget`.

If the list appears → Phase 3 complete; proceed to Phase 4.

If errors:
- "Unknown tool" → MCP didn't register. Re-check the JSON config path is absolute and the `dist/mcp/server.js` file exists.
- Connection errors → check env vars in the MCP config match `.env.local` exactly.
- Schema / RLS errors → confirm the migration ran (3.6).

---

## Phase 4 — Connect the first client

Now that the MCP is alive, do the OAuth dance for a real Google Ads account.

### 4.1 — Create the client record

From inside the MCP directory, run a simple insert via the Supabase SQL editor, or via psql:

```sql
insert into clients (slug, name, industry, tier, monthly_retainer_nok)
values ('client-slug', 'Client Name AS', 'car_dealer', 1, 6000);
```

Alternatively, have the user go to Supabase Table Editor → `clients` → Insert row.

### 4.2 — Run OAuth script

```bash
cd ~/Projects/google-ads-operator/mcp
npm run oauth:google -- client-slug 1234567890 "Client Name AS" <MCC-ID>
```

Arguments:
1. `client-slug` — the slug you just inserted
2. `1234567890` — the Google Ads customer ID (digits only, no dashes) for the client's ad account
3. `"Client Name AS"` — display name
4. `<MCC-ID>` — optional; include if the account is managed under an MCC (which it usually is)

### 4.3 — Complete OAuth in browser

The script prints a Google authorization URL. User:

1. Opens the URL in the same browser where they're logged into the test-user Google account (from Phase 2.2).
2. Grants access.
3. Gets redirected to `http://localhost:5432/oauth/google/callback?state=...&code=...`.
4. The page may show "connection refused" or similar — that's fine, the MCP isn't running a local server on that port by default. They just need the URL.
5. Copies the `code` parameter value from the redirect URL.
6. Pastes it at the script's prompt.

**If "Access blocked: App has not completed Google verification"**: the user isn't in the test users list (Phase 2.2). Have them log in as one of the test users, or add their current email as a test user and retry.

### 4.4 — Verify

Back in Claude:

> "List clients"

Should return the client you just created.

> "Pull search terms report for client-slug last 7 days"

If the campaign is live and has data, you get results. Victory.

### 4.5 — Save state

Suggest the user add `.env.local`, OAuth credentials backup, and encryption key backup to their password manager (1Password, Bitwarden, etc.). If they lose `GOOGLE_ADS_MCP_ENCRYPTION_KEY`, stored refresh tokens become garbage.

---

## Phase 5 — Operator mode (deep skill)

Below is the full operator knowledge base. Everything from here onward is the practitioner-sourced deep skill. When the user is in Phase 5, draw on this as the decision framework. Cite sources inline when a claim is load-bearing.

Scope: running Google Ads on small Norwegian SMB budgets (typically 2–20 000 NOK/month, some up to 50 000) where the operator is strong on Meta/Snap/TikTok and less confident on Google. Built from practitioner sources — Fred Vallaeys (Optmyzr, ex-Google 10 yrs), John Moran (Solutions 8), Brad Geddes (Adalysis, "Advanced Google AdWords"), Jyll Saskin Gales (ex-Google rep, now coach), Kirk Williams (Zato Marketing), Miles McNair (PPC Mastery), Aaron Young (Define Digital Academy), Navah Hopkins, Sarah Stemen, Andrew Hales, plus community wisdom from PPC Town Hall and r/PPC — explicitly deprioritising Google's own Skillshop material because Google's incentives and the client's incentives diverge on several recurring points.

## Operating principles

### Sustainable ROAS over vanity metrics

Clicks, impressions, CTR and conversion *counts* are leading indicators, not the product. The product is qualified revenue at or above the client's break-even CAC. The first question before any change: "does this decision move sustainable ROAS up, or does it move Google's revenue up at our expense?" Those two answers agree often enough that Google Ads is worth running, and diverge often enough that you must keep asking.

### Where Google's interests and the client's interests diverge

These are the pressure points where Google's default nudge is wrong for a small Norwegian SMB:

1. **Performance Max push for small budgets.** Google's default UX aggressively funnels new advertisers into PMax because PMax quietly includes Display/YouTube/Gmail/Discover inventory that would otherwise be hard to sell at the same CPM. For a 5 000 NOK/month Search-intent account, PMax is a black box that hides where the money went. More below.
2. **Smart Bidding from day one.** Google recommends Max Conversions or tCPA on brand-new campaigns with zero conversion history. This is mathematically incoherent — the algorithm has nothing to optimise against. Fred Vallaeys and Jyll Saskin Gales both flag this: you need signal before you can automate on signal.
3. **Auto-applied recommendations.** Enabled by default, opt-*out* rather than opt-*in*, and skewed toward changes that increase spend (raise budgets, switch to broader match, remove negatives, enable partner networks). Jyll Saskin Gales — who worked at Google for six years — is categorical: turn them off.
4. **"Broad match with Smart Bidding is the new default."** Technically true in some ecom contexts (Miles McNair, Aaron Young, Fred Vallaeys have all endorsed this framework). But the *prerequisites* Google downplays — a strong conversion signal, robust negatives, budget that can absorb the learning period — are exactly what a 3 000 NOK/month used-car dealer doesn't have.
5. **Google reps' recommendations.** Jyll Saskin Gales: reps are salespeople, not support staff. Their KPI is your spend, not your ROAS. A small percentage of reps are genuinely helpful; assume the default case is not, and require a practitioner-grounded reason before implementing anything a rep suggests.

### Acknowledge where Google is right

Google's practitioner guidance is not uniformly self-serving. The following are genuinely correct and should be done:

- **Use RSAs with many high-quality headlines and descriptions** — the algorithm really does find combinations humans miss. With caveats on pinning (below).
- **Enable Enhanced Conversions and Consent Mode v2** — first-party signal genuinely recovers attribution that would otherwise be lost, especially in EEA/Norway where non-compliance disables conversion tracking entirely.
- **Ad assets (sitelinks, callouts, structured snippets, images, lead forms)** — multiple independent studies (Adalysis, PPC Hero) show measurable CTR/CVR lifts. Sitelinks alone: "people are twice as likely to interact with sitelinks in the latest format" (Google, corroborated by third-party studies).
- **RSA structure (15 headlines × 30 chars, 4 descriptions × 90 chars)** — fill it out. An account with half-empty RSAs is leaving ad-strength signal on the table.

### Decision frameworks over rules

The reference pattern in this document: **When X, do Y, because Z (source: practitioner)**. Hard rules ("always use phrase match") die on contact with reality. Frameworks survive.

## Maturity tiers (Norwegian SMB mapping)

Tier is about **data maturity**, not just age. It maps roughly to the operator's three-tier system but with specific thresholds tuned to NOK budgets.

### Tier 1 — Validation (2 000–5 000 NOK/month, typically 0–20 conversions/month)

**Goal:** Prove Google Ads can produce qualified conversions at a defensible cost. Do not try to scale yet.

**Structure:**
- Brand campaign + one non-brand Search campaign. That's it.
- Manual CPC or Enhanced CPC (eCPC). Do **not** use tCPA/tROAS yet — insufficient data (Fred Vallaeys, Jyll Saskin Gales, Adalysis all agree on the 30-conversions-in-30-days floor before Smart Bidding has something to learn from).
- 3–5 exact-match keywords on the core intent, tightly themed. Phrase match for the 2–3 highest-intent variants where exact is too narrow.
- No Performance Max. No Display. No partner networks. No auto-apply recommendations.
- Aggressive negatives from day one — seed from the industry list below.

**What you're looking for:** Does the conversion action actually fire? Is the search terms report showing intent-aligned queries? Is the landing page converting at >2% for paid traffic? If any of those is no, pause and fix before spending more.

### Tier 2 — Scaling (5 000–20 000 NOK/month, 20–80 conversions/month)

**Goal:** The account converts reliably. Now expand controlled.

**Structure:**
- Brand campaign (separate, non-negotiable — see below).
- Non-brand Search with 3–6 tightly themed ad groups (STAG model — see structure section).
- Maximize Conversions (no target) is acceptable once you have ~15–20 conversions/month (Adalysis, John Moran). At 30+/month you can transition to tCPA set 10–15% above actual CPA.
- Still no PMax unless the client has Shopping inventory and >10 000 NOK/month (John Moran's threshold: under $10K/month with PMax working, leave it; over $10K, add Standard Shopping as a "feeder").
- Weekly search terms review + negative sweep. See workflow below.

### Tier 3 — Optimization (20 000+ NOK/month, 80+ conversions/month)

**Goal:** The account has proven unit economics. Now press for efficiency at scale.

**Structure:**
- Brand, non-brand Search, optionally PMax for Shopping-heavy catalogs, Retargeting/Demand Gen.
- tCPA or tROAS with meaningful targets. Portfolio bidding across ad groups with similar economics.
- Budget pacing monitored daily (anomaly alerts).
- Experiments via Google Ads drafts & experiments (the one Google-native feature that's unambiguously pro-advertiser). 10–20% budget in tests always.

### Norwegian-specific caveat on tier thresholds

NOK budgets look small in USD terms but serve a market with lower search volume and lower CPCs for most verticals (cars, dealer service, local trades). A 10 000 NOK/month used-car dealer campaign in Stjørdal may generate 20–30 conversions — mid-Tier 2. In the US equivalent that budget barely pays for the learning period. **Don't apply US-blog thresholds uncritically.**

## Account & campaign structure

### Brand vs non-brand — non-negotiable

Every source consulted — John Moran, Kirk Williams, Fred Vallaeys, PPC Hero, Store Growers, Echelonn — puts this first. Reasons:

1. **Reporting integrity.** Branded keywords typically convert at 2–4× non-brand rates (industry average ROAS gap cited by PPC Pitbulls, Stellar Active: brand ~1299% ROAS vs non-brand ~68%). Mixed in one campaign, brand drags non-brand's apparent performance up — you over-invest in bad non-brand queries because the blended number lies.
2. **Bid strategy mismatch.** Brand should be cheap and near-100% impression share; non-brand should be rigorously tCPA/tROAS-controlled. Different strategies, different campaigns.
3. **Smart Bidding contamination.** If a non-brand campaign's Smart Bidding sees brand conversions mixed in, it miscalibrates and overspends on non-brand.
4. **Competitor brand bidding.** If you ever bid on competitor brands, that *must* be a third isolated campaign — different intent, different QS dynamics, different legal risk.

**Implementation:** Create two campaigns at minimum. Brand campaign contains only brand-term keywords (exact + phrase). Add the brand as a **negative** in non-brand campaigns to prevent overlap. Revisit the negatives each month because new close variants and misspellings drift in.

### Modern thematic ad groups (STAG) over legacy SKAG

**SKAGs (Single Keyword Ad Groups)** were the 2014–2019 gold standard: one keyword per ad group for maximum relevance. The consensus shift from Adalysis, PPC Mastery, Greenlane Marketing, Search Scientists, and Site Centre is that SKAGs are now actively hindering performance because:

- Google's close-variant matching means "exact match" now matches many variants anyway — SKAG granularity is mostly illusory.
- RSAs + Smart Bidding prefer consolidation; data fragmented across 50 SKAGs can't exit the learning period.
- Maintenance cost vs benefit is terrible for solo operators.

**STAG (Single Theme Ad Groups):** 5–10 closely related keywords per ad group sharing a theme + RSA matched to that theme. Most of the QS benefit of SKAGs, a fraction of the overhead. This is the current default.

For a used-car dealer in Stjørdal, example STAG structure for non-brand:

- Ad group: "bruktbil [område]" — bruktbil stjørdal, bruktbil trøndelag, brukte biler stjørdal, bruktbil til salgs stjørdal
- Ad group: "brand + bruktbil" — volvo bruktbil stjørdal, volkswagen bruktbil stjørdal, etc. if inventory supports it
- Ad group: "bruktbil finansiering" — bil på avbetaling, billån, bruktbil finansiering
- Brand ad group: [dealer name] (separate campaign, see above)

### When Search-only is the right account type

Performance-Max-first accounts are Google's nudge. Search-only is often correct for:

- Service businesses with no product feed (plumbers, dentists, lawyers, accountants).
- Low-budget accounts (<10 000 NOK/month) where PMax can't exit learning.
- Lead-gen where the conversion is a form or a phone call, not a purchase.
- Any account where the operator needs to see search terms to sleep at night.

Used-car dealers are a middle case. Finn.no dominates the head terms; Google Search for "bruktbil [model] [location]" is often the 2nd-best channel after Finn, but a Merchant Center feed of inventory can unlock Shopping and (later) PMax. Until the feed exists, stay on Search.

### Single-campaign accounts — never

Any account with one giant campaign containing 50 ad groups is broken by definition. Reasons:

- One budget, so high-cost queries starve everything else.
- One bidding strategy, so brand and non-brand collide.
- One set of settings (geo, schedule, device bids, network) applied to intents that need different treatment.

Fix: split by intent theme, bidding strategy, or geographic priority. Minimum viable structure is 2 campaigns (brand + non-brand). A "correct" structure for most SMBs is 3–6 campaigns.

### Campaign budget allocation

Default starting split for a used-car dealer on 10 000 NOK/month:

- Brand: ~10–20% (1 000–2 000 NOK). Target near-100% impression share. Brand is cheap and the ROAS is inflated but real enough to fund itself.
- Non-brand: ~70% (7 000 NOK). This is where growth happens.
- Experimental / retargeting: ~10–20% (1 000–2 000 NOK) if audiences are large enough. Otherwise fold into non-brand.

Revisit monthly. If non-brand is capped at the budget and still converting at target, raise it 10–20% (Dilate, ALM Corp: larger jumps destabilize Smart Bidding for 1–2 weeks with 25–50% CPA increase).

## Match type framework

### Decision table

| Tier | Primary match | Secondary | Use broad when |
|------|---------------|-----------|----------------|
| 1 (validation) | Exact | Phrase on 2–3 core intents | Never (unless you're happy burning 30% of budget exploring) |
| 2 (scaling) | Phrase | Exact for brand + high-CPC defensive terms | Testing a new theme, tightly negatived, small budget share |
| 3 (optimization) | Phrase or Broad + Smart Bidding | Exact for brand | Primary scaling lever **if** conversion signal is robust |

### Why phrase has won the middle ground

Google has compressed all three match types (Search Engine Land 2024 analysis corroborated by Aaron Young, Darren Taylor on Define Digital Academy):

- Exact now matches many close variants — it's no longer "exact."
- Broad now respects more intent context than it did pre-2021 — less useless.
- Phrase sits in the narrower-than-broad / wider-than-exact sweet spot and, in most SMB contexts, has the best cost-to-conversion ratio at low volume.

### The broad match trap (unqualified endorsement warning)

Fred Vallaeys, Miles McNair, Aaron Young: **broad match + Smart Bidding + strong conversion signal + disciplined negatives = scaling framework**. Everyone who endorses broad match attaches all four conditions. Remove any one and you're Google's favourite customer.

**Miles McNair / PPC Mastery's principle:** "never use Broad Match without Smart Bidding — broad match without Smart Bidding equals a money pit."

**Sarah Stemen, practitioners on r/PPC:** the common SMB failure is enabling broad match at Tier 1 (no conversion signal), Google's algorithm has nothing to steer with, and the budget evaporates on "free [product]", "how to [thing]", job queries, and tangentially related commercial intent.

**Decision rule:** broad match is a Tier 3 tool. At Tier 1–2, phrase match is safer and usually cheaper per conversion, even if total volume is lower.

### Modified broad (BMM) — dead

Removed by Google in 2021. If you see +modifier syntax in a handover account, migrate to phrase and retest.

## Keyword research for SMB (Norwegian market)

### Low-volume keyword reality

Google Keyword Planner will mark many Norwegian long-tail keywords as "Low search volume" and refuse to serve them until traffic picks up (Google Ads Help documentation, Optmyzr, PPC Hero). Implications:

- **Don't reject a keyword because Keyword Planner shows zero volume in Norway.** The tool's threshold hides the long tail where your highest-intent queries live.
- **Group low-volume keywords with higher-volume siblings** in the same ad group so the ad group accrues enough impressions to stay active.
- **Phrase or broad match** can catch the same intent even when the exact term is suppressed.

### Norwegian-specific gotchas

1. **Compound words.** Norwegian compounds on spaces aggressively: *bruktbil* (used car), *bilverksted* (car workshop), *dekkskifte* (tire change). Google's close-variant matching usually handles *bruktbil* ≈ *brukt bil*, but don't rely on it — include both forms explicitly for your core terms. For negatives, both forms must be added separately if you want to block both.
2. **Bokmål vs nynorsk.** Bokmål dominates (~85% of written Norwegian). Nynorsk is geographically concentrated (Western Norway). For national campaigns, bokmål is the primary; add nynorsk variants only for clients serving Vestland/Hordaland/Sogn og Fjordane. Some terms differ meaningfully: *ikkje* vs *ikke*, *eg* vs *jeg*, *kva* vs *hva*.
3. **Dialectal spellings in queries.** Users type how they speak. For auto: *bruktbil* dominates but *brukte biler*, *bruktbiler*, *brukt bil* all appear. Include the natural plurals.
4. **English loanwords.** Norwegians mix English commercial terms freely: *leasing*, *service*, *garantisert*. Keyword Planner undercounts these because they appear in mixed-language queries.
5. **Regional targeting granularity.** Google Ads supports both fylke (county) and kommune (municipality) level targeting. For a Stjørdal-based dealer, target Stjørdal kommune + surrounding kommuner (Malvik, Meråker, Levanger, Frosta, Trondheim) rather than just Trøndelag fylke — you'll waste budget on Namsos otherwise.

### Competitor keyword analysis (low-budget approach)

Paid tools (SEMrush, Ahrefs) are 1 500+ NOK/month — hard to justify at this budget tier. Free/cheap substitutes:

- **Auction Insights** inside Google Ads itself — shows who else is showing on your keywords. Free, directly from auction data.
- **Google Search Console** for organic — keywords you already rank for are candidates for paid too.
- **Manual SERP checks** in incognito for top 5 keywords. Note who shows, what their ad copy emphasises, what their landing page looks like.
- **Finn.no's own "Anbefalte søk" / popular searches** in the target vertical. Real buyer queries.

### Brand keyword expansion

Beyond the dealer name itself:

- Dealer name + [location] variants
- Dealer name + [vertical word]: "[dealer] bruktbil", "[dealer] service", "[dealer] åpningstider"
- Common misspellings
- Staff names if senior salespeople have SEO presence

For small dealers, the brand campaign might have 20–40 keywords total. That's fine.

## Negative keyword discipline

### Weekly workflow (Sarah Stemen, Navah Hopkins, Adalysis all converge)

**Day 1 of the week (15–30 min):**
1. Open Search Terms Report, filter to last 7 days, sort by cost descending.
2. Skim top 20 cost queries. For each:
   - Intent-aligned and converting? → add to **positive** keyword list if not already there (this is how non-SKAG ad groups grow).
   - Intent-aligned but not converting? → leave it for now, check again next week.
   - Not intent-aligned? → add as **negative exact** (one-off) or start a **negative pattern**.
3. Scan the bottom of the list for job queries, competitor brand names, "free", "cheap", "how to", "DIY", "tutorial", "review", "meaning" — fast pattern negatives.
4. Move proven patterns from exact to **phrase negative** after the 3rd–4th variant gets flagged.

**Monthly (30–60 min):**
- Consolidate ad-group-level negatives to campaign or account level if they apply broadly.
- Prune duplicate negatives.
- Check **shared negative keyword lists** — one master list applied to all non-brand campaigns.

### Shared negative keyword lists — essential

Built once per account, then applied to every non-brand campaign. This is the scalable way (Adalysis, Store Growers, Clixtell 45-min audit). A solo operator managing 10+ accounts *must* do this or they're rebuilding the same negatives for every client.

### Industry seed lists

**Used car dealer (for Stjørdal Autosalg and similar):**
- Job/DIY: jobb, job, ledig, karriere, kurs, utdanning, opplæring, lærling, skole, studere, mekaniker jobb
- Free/informational: gratis, tips, tutorial, how to, hvordan, forklaring, meaning, betydning, wiki, wikipedia, youtube
- Price/research: prissjekk, verdi, verdivurdering, kalkulator (unless you offer valuation), sammenligning, test, anmeldelse, review
- Parts/service (unless dealer does both): reservedeler, deler, felger separate, dekk separate, olje, batteri, service manual
- Competitor dealers and Finn.no itself as negative (don't bid against your source channel)
- Wrong intent: for sale by owner, privat, bytte, bytt mot, leie (unless you do leasing)
- Wrong vehicle types (if dealer is cars only): båt, mc, motorsykkel, traktor, tilhenger, lastebil, campingvogn, bobil

**Service business (plumber, electrician, dentist, etc.):**
- jobb, karriere, lærling, kurs, utdanning
- gratis, selv, DIY, hvordan gjøre, how to
- Anmeldelse, review, erfaring, klage, sur/dårlig
- Price-only queries: pris (standalone), billig (often), "hva koster" — keep these if conversion; otherwise negative at campaign level

**E-commerce:**
- gratis, free, crack, torrent, download
- manual, tutorial, how to install, review
- jobs, career, employment
- Competitor brands you don't carry
- Wrong product categories

**B2B SaaS:**
- jobs, careers, internship
- alternatives (unless running a competitor campaign)
- free, open source, cracked, nulled
- login, sign in, sign up (these are existing users — different intent)
- pricing (sometimes; depends on model)

### Negative match type selection

- **Negative exact:** for single specific queries that must not match. Minimally disruptive, highest precision.
- **Negative phrase:** for proven patterns (e.g., "jobb" as phrase catches "mekaniker jobb", "bilselger jobb", "bruktbil jobb"). Medium precision, high efficiency.
- **Negative broad:** rare. Too aggressive — can block legitimate queries that happen to contain the word in other contexts. Use only when a word is universally disqualifying (e.g., "porn" or "illegal" for most consumer businesses).

### Adjustment: do NOT mass-delete legacy negatives

Fred Vallaeys / Optmyzr research on 2024 accounts: "In 80–90% of cases, deleting all negative keywords when taking over accounts blows everything out of the water. Something may have needed to be a negative in the past because of less sophisticated bid automation, but now that bidding has improved, some of those negatives might actually be okay to let trigger ads."

**Practical rule:** when taking over an account, audit the negative list but don't nuke it. Remove entries that are obviously obsolete (stale competitor brands, outdated product names). Test re-enabling 5–10 at a time with controlled budget if you suspect over-negativization.

## Bidding strategy decision tree

### The strategies, ranked by signal requirement

1. **Manual CPC** — zero signal required. You set bids.
2. **Enhanced CPC (eCPC)** — some signal; Google adjusts your manual bid up to 30% based on conversion likelihood.
3. **Maximize Clicks** — traffic goal, no conversion signal needed. Almost always the wrong choice for a conversion-focused account (it optimizes for clicks, not outcomes).
4. **Maximize Conversions (no target)** — minimum 15–20 conversions/month (Adalysis, John Moran). Spends full budget to get as many conversions as possible. Good "intermediate" strategy once signal exists but before you know what a defensible CPA is.
5. **Target CPA (tCPA)** — minimum 30 conversions in last 30 days per campaign (Google's own threshold, corroborated by Fred Vallaeys, Jyll Saskin Gales, Adalysis, Defined Digital). Can now be set as a soft target on Max Conversions; functionally similar.
6. **Target ROAS (tROAS)** — minimum 50 conversions/month *with value* (not just counts — each conversion needs a revenue value). For ecom with feed data; rarely applicable to service/lead-gen SMBs.
7. **Target Impression Share** — brand-defensive tactical bidding. Use for brand campaigns targeting "top of page" or "absolute top." Not for non-brand except in specific defensive contexts.

### Decision flow

```
Is this a brand campaign?
├─ YES → Target Impression Share (absolute top, 80–95%), or Manual CPC with aggressive bids.
└─ NO → continue

Does the campaign have 30+ conversions in last 30 days?
├─ NO, 0–15/mo  → Manual CPC or eCPC. Too little signal for Smart Bidding.
├─ NO, 15–30/mo → Maximize Conversions (no target). Let Google spend the budget efficiently.
└─ YES, 30+/mo  → continue

Is CPA roughly stable month-over-month (±25%)?
├─ NO  → Stay on Max Conversions; fix conversion variance first (attribution gaps, bad tracking, seasonality).
└─ YES → continue

Do conversions have per-unit revenue values that are reliable?
├─ NO  → Target CPA, set 10–15% above current actual CPA (Jyll's exception rule).
└─ YES → Target ROAS, set at break-even ROAS for now, tighten over time.
```

### When to switch — and when not to

- **Switch between strategies no more than once every 2–4 weeks.** Every switch triggers a 7–14 day learning period during which CPA can swing 25–50% (Dilate, Savvy Revenue). Whiplash bidding is a common cause of "it was working, why did it stop?"
- **Don't switch during a seasonal peak.** Switching on Black Friday is reckless; the learning period overlaps the highest-value week.
- **Fred Vallaeys' guardrails principle:** "Automation doesn't eliminate risk; it changes the type of risk. Without guardrails, a data glitch can quietly sabotage your bids." Set tCPA with a ceiling (use the "bid limits" or "portfolio with max CPC" feature) if you don't trust Google alone.

### Bidding portfolios vs individual campaigns

Portfolios bundle multiple campaigns under one strategy — useful when you have many similar-CPA campaigns and want Google to share signal. For SMBs with 2–4 campaigns, portfolios add complexity without benefit. Stay with individual campaign-level strategies until you have 6+ campaigns sharing unit economics.

## Smart Bidding — prerequisites and honest reality

### The 30-conversion floor — why it exists

Google's own documentation: tCPA needs 30 conversions in 30 days at the campaign level. tROAS needs 50+ with values. Max Conversions "works" with 15–20 but performs measurably better with more.

**Practitioner reasoning (Fred Vallaeys, Jyll Saskin Gales, Adalysis):** Smart Bidding builds a predictive model. With <30 signal points/month, the model is overfit to noise. The CPA "target" becomes a fiction Google pretends to hit while burning budget on actually-unrelated queries.

### When Smart Bidding silently wastes money

- **Conversion definition is loose.** If your "conversion" includes form-view, phone-click-event, scroll-depth, and an actual sale, Smart Bidding optimises for the cheapest one (scroll-depth). The "CPA" reported is meaningless.
- **Conversion volume dropped below threshold.** A seasonal dip from 35/mo to 18/mo means Smart Bidding now has insufficient data but doesn't tell you — it still runs, worse.
- **Value inputs are zero or inconsistent.** tROAS with all conversions valued at 0 does nothing useful.
- **Attribution model changed recently.** GA4 migration, tag disruptions, or Consent Mode changes destabilise the signal. Smart Bidding sees the new noise as real and miscalibrates.

### Diagnostic workflow: is Smart Bidding working?

1. Pull last 90 days: daily conversion count, CPA, cost.
2. Did CPA drop and hold after the strategy learning period ended? → working.
3. Did CPA rise and stay up, or oscillate ±40%? → not working.
4. Check Search Terms Report: what % of cost went to queries with 0 conversions in the same period? Above 30% is a red flag.
5. Check conversion action setup: primary vs secondary, micro vs macro, values attached. Fix before blaming the algorithm.

## Performance Max — honest assessment

### When PMax works

- **Shopping-heavy ecom** with a healthy Merchant Center feed, >15 000 NOK/month spend, established conversion history.
- **Multi-channel retargeting** where the client has large first-party audience lists (Customer Match).
- **Seasonal demand capture** where you want wide inventory reach during peak (holiday, Black Friday, product launches) — run alongside Search, with brand exclusions.

### When PMax is a trap

- **Small Search-only accounts (<10 000 NOK/month).** PMax cannot exit the learning period; you see random Display junk and convinced-you've-seen-conversions that are actually brand-search cannibalization. Brad Geddes' Adalysis data: across thousands of accounts, when PMax and Search show for the same query, Search has better CTR 65% of the time and better CVR 84% of the time — yet PMax takes 61% of impressions. It's winning credit, not driving net-new.
- **B2B with long sales cycles.** The conversion lag breaks Smart Bidding's learning. PMax will optimise for lead volume, not qualified lead value — and the rep you wanted is buried.
- **Local service businesses.** Display and YouTube inventory isn't relevant; most spend goes to low-quality placements.
- **Used-car dealers without a feed.** Without Merchant Center inventory, PMax's Shopping leg is dead weight.

### PMax cannibalization and brand exclusions

**Problem (Brad Geddes / Adalysis, Kirk Williams / Zato):** PMax outranks your Search campaigns on brand queries and takes credit for conversions that would have happened anyway. You think PMax is driving ROI; actually it's reporting ROI.

**Fix:**
1. Enable **brand exclusions** on PMax campaigns (Google Ads → PMax campaign → settings → brand exclusions). This excludes your brand terms from PMax so they route to the Search brand campaign where you can see them and control them.
2. Run a dedicated brand Search campaign in parallel.
3. Check query-level cannibalization monthly via the PMax insights → search themes report and Optmyzr-style scripts.

Kirk Williams' nuance: "Excluding brand from every PMax campaign isn't always the right call." The exceptions are rare — small accounts where the brand traffic is the only way PMax gets enough signal to work at all. Default is exclude.

### Asset groups and signals

- One asset group per distinct product theme or service line. Don't lump everything into one.
- Audience signals are hints, not constraints (unlike old Display targeting). Give PMax real first-party audiences (customer lists, converters, site visitors) rather than Google's generic in-market segments.
- Rotate creative every 4–6 weeks to avoid fatigue.

### Budget fencing tactics

When PMax and Search compete:
- **Campaign priority (for Shopping).** Set Standard Shopping to High priority, PMax implicit to Low. Your high-intent Shopping queries route to Standard where you have keyword-level control.
- **Aggressive brand/competitor brand exclusions on PMax.**
- **Separate budgets.** Never use shared budgets between PMax and Search — PMax will eat.

## Ad copy frameworks

### RSA structure — fill it all

- Up to **15 headlines × 30 characters**. Fill at least 10.
- Up to **4 descriptions × 90 characters**. Fill all 4.
- Google chooses combinations. Your job is making sure *every* combination is respectable.

**Headline archetypes** (aim for variety):
1. Keyword-matched (exact intent): "Bruktbil Stjørdal | X biler på lager"
2. USP / differentiator: "Byttegaranti på bruktbil"
3. Social proof: "4,9★ av 200+ kunder"
4. Offer / urgency: "Nye biler hver uke"
5. Call to action: "Bestill prøvetur i dag"
6. Trust signal: "Autorisert forhandler siden 1998"
7. Brand name: "Stjørdal Autosalg"
8. Location-specific: "Bruktbil i Trøndelag"
9. Category-specific: "SUV, Familiebil & Stasjonsvogn"
10. Price-anchored: "Fra 89 000 kr"

**Description archetypes:**
1. Expanded USP with CTA.
2. Inventory/selection with scale.
3. Trust / guarantee / process.
4. Offer or time-bound promotion.

### Pinning — discipline over obsession

Adalysis consensus (Brad Geddes and team have written the definitive RSA guide):

- **Pinning reduces Ad Strength** (Google penalises it) but if done carefully, **can improve actual CTR and CVR** (Adalysis own studies).
- **Never pin everything.** If all slots are pinned, you've built an ETA (expanded text ad) inside an RSA with none of the algorithm's combinatorial benefit.
- **Do pin when required:**
  - Legal disclaimers (pin to description position 2).
  - Brand name in a specific position (pin to headline 1 if non-negotiable).
  - A core keyword that must always show (pin 2–3 variants to headline 1 *position* — not a single asset — so the algorithm still chooses).
- **Pin 2–3 assets per position, not 1.** This preserves combinatorial exploration.

### Dynamic Search Ads (DSAs) — narrow use case

DSAs auto-generate headlines from your landing page. Useful when:
- Large catalog with long-tail coverage, inventory changes fast, writing individual ad groups is infeasible.
- Filling keyword gaps in an existing account (the catchall).

Not useful when:
- Small account where you can manually cover intent.
- Landing pages are poorly optimized (DSAs inherit the page's weaknesses).
- You need tight messaging control.

### Ad extensions / assets — what actually matters

Ranked by impact for SMB:

1. **Sitelinks** — always on. Minimum 4, ideally 6–8. Google data + third-party (PPC Hero, Adalysis): 2× engagement lift.
2. **Callouts** — always on. Minimum 4, ideally 6–10. Short USPs. ~10% CTR lift on average.
3. **Structured Snippets** — on when you have clear category lists (inventory types, services offered). Lower lift than sitelinks/callouts but easy wins.
4. **Call extensions** — on if phone is a legitimate conversion channel. Measure call tracking separately.
5. **Location extensions** — on for any local business.
6. **Images (image assets)** — on when you have decent photos. Meaningful lift for local/e-com, muted for pure service.
7. **Lead form extensions** — conditional. For lead-gen where speed matters. Form quality tends to be lower than site-form.
8. **Promotion extensions** — on during actual promotions only.
9. **Price extensions** — on if prices are competitive and comparable. Off if you'd rather get them on-site first.
10. **App extension** — only if you have an app that matters.

Treat "all available assets filled" as a Tier-1 checklist item. Adalysis / Navah Hopkins / PPC Hero converge: a 40% CVR / 221% CTR lift study on ecom accounts that went from no callouts to full callouts is on the high end, but directionally right.

## Quality Score mechanics

### Components (official, then the honest version)

Google publishes three components on a 1–10 scale: **Expected CTR, Ad Relevance, Landing Page Experience.** What they actually mean:

- **Expected CTR** is a prediction, not history. Based on your keyword + ad + SERP context compared to the auction population. A new keyword gets a prediction based on similar keywords' historical behavior.
- **Ad Relevance** is roughly "does the ad text include the keyword or close semantic variants, and is the messaging aligned." Easy to fix by writing the keyword into at least one headline.
- **Landing Page Experience** is roughly "does the LP answer the intent quickly, load fast, not look spammy, and have the keyword on the page." Also harder to game than the other two.

### Real impact on CPC

Navah Hopkins, PPC Hero, Store Growers, Shopify's own 2026 guide: ads rated "Above average" for both Ad Relevance and Landing Page Experience have ~**36% lower CPC than average**. That's the practical reason to care. Quality Score is not a vanity metric — it directly reduces what you pay per click.

### What Google's QS column hides

- **It's a retrospective diagnostic,** not a forward-looking prediction. By the time you see a low QS keyword, you've already spent more on it than you should have.
- **It applies only to Search** (and loosely Shopping). It doesn't apply to Display or PMax, despite operators often blaming "Quality Score" when those don't work.
- **"Impression-weighted QS"** via scripts or Optmyzr is more useful than the raw column — shows QS weighted by actual spend, not by keyword count.

### Diagnosing low QS

1. Is the keyword present in the ad headline or description? If no → fix first.
2. Is the landing page actually about this keyword's topic? If a used-car dealer's ad for "bruktbil Volvo" lands on a generic homepage, LP Experience will tank.
3. Is the LP under 2s LCP and has reasonable INP / CLS? Pull CrUX / PageSpeed data.
4. Is expected CTR low because the keyword has terrible actual CTR (<1%)? Rewrite the ad, try RSAs with different hooks.
5. Is the keyword too broad for the ad? Tighten match type or move to its own STAG ad group with a matched ad.

### The "increase bids to fix Quality Score" trap

Common failure mode (every source agrees): operator sees low QS → QS affects CPC → increase bids → keep paying for the same bad quality → CPA worse. Fix the underlying three components; don't try to out-bid Quality Score.

## Landing page alignment

### Signals Google actually values

Based on the 2025 Google prediction model update (Search Engine Land coverage, Navah Hopkins analysis):

- **Navigation clarity** — Google now scores how easily a user finds what they came for after clicking. Hidden forms, popup-gated content, 3+ clicks to goal — all penalties.
- **Core Web Vitals** — LCP, CLS, INP all feed in. A used-car dealer landing page at 4s LCP on mobile is losing QS and CTR.
- **Keyword presence on page** — literal text match remains surprisingly weighty. If the ad is for "bruktbil Stjørdal" and the page has no visible text containing "bruktbil Stjørdal," QS drops.
- **Mobile usability** — >70% of Norwegian mobile traffic now. Mobile LP quality dominates.
- **SSL + standard security headers** — baseline, not a differentiator.

### Message match — the cheapest lift

If the ad says "Byttegaranti på bruktbil", the landing page H1 or first visible line must say "Byttegaranti" or "Bytt tilbake garantert." This is 2-minute work and routinely lifts QS from 5→7 on the ad in question.

### Form friction

Every additional form field costs ~10% completion rate (multiple sources, directional). For lead gen, the defensible minimum is name + phone + one context field. Address collection at first contact is a conversion killer.

### When the LP is the bottleneck vs the ad

Diagnostic:
- CTR high, CVR low → LP problem. Users want the ad's promise; the page doesn't deliver.
- CTR low, CVR high → ad problem. Users who do click are right fit; you're not attracting enough of them.
- Both low → intent mismatch. You're showing to the wrong queries.
- CTR high, CVR high, but cost too high → bidding/competition problem, not ad or LP.

## Conversion tracking done right

### Primary vs secondary — the Stjørdal case

Recent fix on Stjørdal Autosalg account: form_submit (primary, used for bidding), phone_click (primary), session_start / page_view / scroll (all **secondary**, observational only).

The mistake we were fixing: when GA4 events are imported into Google Ads, Google defaults them to secondary (correct) *unless* someone in the account has promoted a micro-event like scroll_depth to primary. If scroll_depth is primary, Smart Bidding optimises for scrolls — the cheapest possible "conversion" — and your CPA-by-bidding-strategy looks great while real leads dry up.

**Rule:** primary conversions are *only* the events that map to revenue or qualified leads. Everything else is secondary.

### GA4 import vs native GTM tags

Both work; trade-off is:

- **Native Google Ads conversion tag via GTM** — fires cleanly, is primary by default, best for bidding. Use for your 1–3 core conversion actions.
- **GA4 import into Google Ads** — imports as secondary by default (Google's own design). Good for observational signal and enabling cross-device / GA4-attributed conversions as *reporting* data, not bidding signal.

**Best practice (Adswerve, Stape, Google's own docs):** use native Google Ads tag as primary for bidding, import GA4 key events as secondary for observation/reporting.

### Enhanced Conversions — always on in EEA

Enhanced Conversions hashes first-party data (email, name, phone) with SHA-256 and sends it alongside the standard conversion ping. Google matches hashed identifiers to logged-in user signals and recovers attribution that would otherwise be lost to ITP/cookie restrictions.

For Norwegian / EEA advertisers this is near-mandatory. Recovery rate varies but 10–30% conversion uplift in the Google Ads column is common once enabled. Setup: via GTM (preferred) or Google tag — Google's Help Center has a working step-by-step and Stape has an end-to-end guide.

### Consent Mode v2 — mandatory

Google disabled ads personalization and conversion tracking for non-compliant EEA advertisers (including Norway) as of July 21 2025 (Search Engine Land, PPC Land). Required components:

- A certified CMP that sends `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` consent signals.
- GTM consent mode initialised before any Google tag fires.
- Ideally **advanced** consent mode (loads tags, adjusts behavior based on consent) rather than **basic** (blocks tags entirely when no consent). Advanced recovers cookieless pings and modeled conversions; basic loses that signal.

For operators running multiple Norwegian clients: standardise on one CMP (Cookiebot, Consentmanager, CookieScript are the common certified picks) and replicate across clients.

### What counts as a conversion (and what doesn't — as primary)

**Primary candidates** (map to revenue or qualified lead):
- Form submit (with spam filtering)
- Phone click (desktop + mobile, tracked via call extension or GTM phone number replacement)
- Purchase (ecom)
- Booking confirmation
- Test-drive scheduled (auto-vertical)
- Trade-in valuation requested (auto-vertical)
- Quote requested (service)

**Secondary only** (observation):
- Page view
- Session start
- Scroll depth
- Video play
- PDF download (unless the PDF is the conversion)
- Button click that isn't a purchase/booking/form

**Never a conversion:**
- "All pageviews" as a conversion action (still seen in handover accounts — immediate red flag).

## Auto-applied recommendations — per-setting decision

Google defaults these on at account creation. Jyll Saskin Gales' position, which this skill adopts: "turn them off." Here's the per-setting breakdown.

| Recommendation | Default | Correct choice | Why |
|---------------|---------|----------------|-----|
| Add new keywords | On | **Off** | Google adds broad-match keywords that spike spend. You lose control over what you're bidding on. |
| Remove non-serving keywords | On | **Safe on** | Low-risk cleanup. Accept this one. |
| Use optimized ad rotation | On | **Off** | Usually fine, but costs you rotation A/B test data. |
| Upgrade to responsive search ads | On | **Off** | Only if you want control over headlines; if you're happy with auto-generated, on is fine. Most operators: off, then do it manually. |
| Remove redundant keywords | On | **Conditional** | Usually fine but check before accepting, as "redundant" sometimes means removing a tracked high-performer. |
| Improve your mobile site speed | On | **Off** | It's a notification, not an action — but some Google accounts auto-apply LP changes which is alarming. |
| Use broad match keywords | On | **OFF OFF OFF** | This is the revenue-generating one for Google. Auto-broadens your exact/phrase keywords into broad. Always off. |
| Bid more efficiently with Maximize conversions / Max conversion value | On | **Off** | Auto-switches bidding strategy without your consent. Off unconditionally. |
| Use Target CPA / Target ROAS | On | **Off** | Same reason. Bidding strategy is yours to choose. |
| Add responsive search ad assets | On | **Off** | Will add auto-generated headlines to your RSAs. Off; add assets manually with intent. |
| Enable URL options at campaign level | On | **Off** | Edge case. Off unless you know you want this. |
| Upgrade your conversion tracking | On | **Off** | Sometimes breaks custom setups. Off. |

**Default stance: disable all auto-apply.** Review recommendations manually in the Recommendations tab, accept case-by-case. Jyll Saskin Gales' framing: "By disabling the Auto Apply Recommendations feature, you can regain control over your campaigns and ensure that any changes are made with your explicit approval."

## Reporting cadence

### Daily (automated only)

Do not log in daily and look around. That's bait for fiddling. Automate:

- **Spend anomaly alerts** — notify if a campaign spent >150% of average daily budget (check for budget bugs, runaway broad match, tracking break).
- **Zero-conversion alerts** — notify if a normally-converting campaign has gone 24–48h with zero conversions (tracking break, landing page down, ad disapproval).
- **Disapproved ads / policy issues** — daily email digest.

Tools: Google Ads scripts (free, custom), Opteo / Optmyzr (paid, SMB-affordable from ~$200/mo), or a simple Zapier/Make workflow pulling the Ads API.

### Weekly (15–30 min per account)

1. **Search terms report** (see negative workflow above) — 10 min.
2. **Pacing check** — are we on track for the monthly budget? Adjust daily budgets if 20%+ off pace.
3. **Top 10 keyword performance** — any new underperformers to investigate? Any new winners to expand?
4. **Ad-level check** — any ads disapproved, low ad strength, or poorly rotating?
5. **Competitor awareness** — Auction Insights pull. Has a new competitor entered the top 3?

### Monthly (60–90 min per account)

1. **Strategic review** — did this month's results match expectations? What did we learn?
2. **Budget reallocation** — between campaigns, based on CPA trend.
3. **Bidding strategy review** — do thresholds still hold? Is it time to switch?
4. **Experiment review** — what did we test, what won, what's next?
5. **Client report** — plain-English summary for non-expert clients. Leading with lead count and cost per lead, not CTR and impressions.

### Quarterly (deeper)

- Full account audit against the anti-pattern list below.
- Competitor landscape review.
- Landing page audit against QS components.
- Conversion tracking integrity audit.

## Norwegian SMB specifics

### Small budgets force trade-offs

Under 5 000 NOK/month, you cannot run: PMax + Search + Display + Retargeting + experiments + tROAS. You have to pick. The hierarchy:

1. Brand campaign (cheap, always on).
2. Non-brand Search with tight keyword control.
3. One retargeting campaign if audience >500 users.
4. Nothing else until budget grows.

### Finn.no as a competitor

For auto, property, jobs, and increasingly general classifieds, Finn.no dominates organic and runs its own paid. Implications:

- You will usually be position 2–4 on head terms, not 1. That's expected.
- Don't bid on "Finn.no [keyword]" — you're bidding against people looking for Finn specifically. Add "finn" and "finn.no" as phrase negatives.
- Long-tail and local-specific queries ("bruktbil Stjørdal [dealer name]") are where you win. Head terms ("bruktbil") are Finn's.

### Lower search volumes

A US blog saying "target 300+ searches/month per keyword" is irrelevant. Norwegian long-tail commonly sits at 20–100/month and still converts. Don't filter keywords by volume alone; filter by intent and conversion evidence.

### Regional targeting — kommune, not fylke

Google's location settings default to country or region; for local SMBs, drill down to kommune level. A Stjørdal dealer targeting all of Trøndelag (500k+ people, including Trondheim itself) will waste budget on Trondheim buyers who'd drive to a Trondheim dealer. Target Stjørdal + driving-radius kommuner (Malvik, Meråker, Levanger, Frosta) + manual exclusion of Trondheim city if you're genuinely small-town focused.

### Seasonal patterns (Norway-specific)

- **Car sales:** Spring peak (March–May, after winter, before summer holiday). Secondary peak September. Trough: December–February and July.
- **Home services:** April–June (outdoor/garden), September–October (pre-winter).
- **Retail:** Black Friday, Christmas (surprisingly concentrated November 1 through December 20), Easter.
- **Fellesferie (July):** national collective holiday. Most verticals go cold. Reduce budgets 30–50% for July unless you're tourism/retail.

### Holiday calendar (Norway)

Dates most commonly affecting ads (reduce budgets or pause):
- 1. mai (Labour Day)
- 17. mai (Constitution Day) — national holiday, reduced commercial intent but high branded traffic
- Easter (Maundy Thursday + Good Friday + Easter Monday — full week disruption)
- Ascension, Pentecost
- Christmas (23–26 December)
- New Year (31 December, 1 January)

Auto-pause scripts for these dates are worth setting up once per account.

### GDPR and Consent Mode v2 compliance

Already covered above — restating because it's the single most important Norwegian-specific technical item. No CMP + consent mode v2 = no conversion tracking = broken bidding. Non-negotiable.

## Anti-patterns and red flags

The following, in any inherited account, should trigger a "fix now, don't scale" response:

1. **Auto-applied recommendations enabled.** Disable all. Read the change history for the last 90 days to reverse damaging auto-applies.
2. **Performance Max running on <10 000 NOK/month with no brand exclusion.** Pause PMax or add brand exclusion + run dedicated brand Search; check that the revenue PMax is "driving" isn't brand cannibalization.
3. **Smart Bidding with <20 conversions/month.** Switch to Max Conversions (no target) or manual CPC until signal stabilises.
4. **Single campaign with 20+ ad groups.** Split by intent/theme/bidding strategy.
5. **Brand and non-brand in same campaign.** Separate now.
6. **No negative keywords or fewer than 20.** Add industry seed list immediately. Run 60-day backfill search terms review for additional.
7. **Stale ad copy (>6 months no change).** RSAs benefit from iteration; refresh headlines.
8. **RSAs with <5 headlines filled.** Fill to at least 10, ideally 15.
9. **All RSA slots pinned.** Unpin all except legally required.
10. **Display Network "Search Partners" / "Include Google search partners"** enabled on Search campaign. Turn off. This is separate from GDN auto-enable but same trap — low-quality traffic bundled in.
11. **Google Display Network enabled by default on a Search campaign ("Expand your reach with Display Network")** — turn off. It's 2 million random sites at Google's discretion (Treat Marketing, Herd Marketing, MarlinSEM).
12. **Auto-expand targeting ("add more people who are likely to convert") on Search campaign.** Turn off.
13. **Quality Score below 5 on core keywords.** Triage: rewrite ad, restructure ad group, fix landing page.
14. **Conversion actions marked primary that shouldn't be** (scroll_depth, page_view, session_start, click_outbound). Re-mark secondary.
15. **No Enhanced Conversions enabled** in an EEA account. Set up.
16. **No Consent Mode v2** in an EEA account. Fix immediately — Google disables tracking otherwise.
17. **Same budget shared across PMax and Search.** Separate.
18. **Ad schedule running 24/7 when business hours are 9–17.** Trim to business hours + 1–2 hour buffer for lead-gen.
19. **One conversion action for "contact" and "purchase" with same value.** Separate actions, different values.
20. **No Auction Insights or Search Terms review in 30+ days.** Run now.

## Working with Google reps and account managers

### What reps typically push (and typical correct response)

Jyll Saskin Gales' framework — she worked at Google 6 years and knows the playbook:

| Rep suggestion | What they get from it | Correct response |
|---------------|----------------------|-----------------|
| "Enable Performance Max" | Upsell to broader inventory including Display/YouTube | Only if Tier 3 + has Shopping feed + can accept brand cannibalization |
| "Use Smart Bidding" on a brand-new campaign | Algorithmic spend lift | No — need 30+ conversions/mo first |
| "Broaden your match types" | More impressions = more spend | Only at Tier 2+ with signal + negatives |
| "Increase budget by X%" | Direct revenue | Accept only if CPA is within target AND impression share <80% |
| "Add these keyword suggestions" | Broader targeting | Manual review each one — many are broad-match variants of your existing keywords |
| "Drop your CPA target to let the algorithm breathe" | More impressions | Only if actually supported by data; often this is rep-speak for "spend more" |
| "Add Search Partners" | Junk traffic | No |
| "Enable Display Expansion" | Junk traffic | No |
| "Bid on competitor brands" | Revenue from conflict-prone queries | Sometimes yes, but only with full disclosure to client about brand-war dynamics |

### When a rep is actually helpful (rare but real)

- Tactical support: policy disapprovals, billing issues, tool bugs — genuinely useful.
- Early access to beta features that can genuinely help your vertical — occasionally.
- Industry benchmarks — with skepticism; they're aggregated and often average-down.

### How to say no diplomatically

- "Thanks — we're holding on Performance Max until we hit $X/month and have [specific milestone]."
- "I want to make sure we don't switch bidding strategies mid-quarter. Let's revisit after [date]."
- "The data doesn't support that change yet — can we put it on the list for the next review?"

### Rep handover protocol

When you inherit a client whose previous agency had a Google rep who made changes, check **change history** for the last 90 days. Reverse auto-apply recommendations. Document the rollback so you can explain to the client why performance should stabilise.

## Budget escalation ladder

### When to increase budget

Green lights (all four):
1. CPA ≤ target.
2. Impression share <80% (i.e., budget is leaving money on the table).
3. Auction insights show you're not being outcompeted on price (if competitors are 2× your bids, budget increase won't help).
4. Client confirms capacity to absorb more leads / sales.

Increase in **10–20% increments** with 7–14 days between jumps (Dilate, ALM Corp). Larger jumps destabilise Smart Bidding for up to 2 weeks with 25–50% CPA increase.

### When to expand targeting instead of budget

- Impression share is 90%+ and CPA is good → you're already capturing head demand. Now broaden: new keyword themes, wider geography, new ad formats, new audiences.
- Budget is saturated but adding more doesn't produce more conversions → diminishing returns; expand scope.

### When to launch a new campaign

- You've identified a distinct theme (product line, geography, intent) that deserves its own budget, schedule, or bidding strategy.
- You're testing a new bidding strategy and want to isolate the test from proven performers.
- Client has a seasonal initiative that should not contaminate baseline campaigns.

### Signs of saturation / diminishing returns

- CPA rising while budget rises, despite no other changes.
- Search Impression Share Lost (rank) rising — you're now priced out of the incremental auctions.
- New keywords / search terms in top spend have lower CVR than established terms.
- Conversion rate trend is flat while spend grows.

## Diagnostics playbook

### Low impressions

Pull segments and check in order:
1. **Budget-limited?** Campaign has "Limited by budget" status → budget is the cap; daily average is hitting the daily budget limit. Either increase budget or lower bids.
2. **Bid too low?** Average position and top-of-page impression share < desired. Increase bid or switch to Target Impression Share.
3. **Quality Score too low?** Low QS means higher effective bid needed to enter auction. Fix the three components.
4. **Match type too narrow?** Exact or narrow phrase may not be matching close variants. Test phrase or add variant keywords.
5. **Ad disapproved?** Check ad status. Even one disapproved ad group can halt ad group impressions.
6. **Keyword marked "Low Search Volume"?** Group with siblings or broaden match type.
7. **Audience or geographic targeting too narrow?** Widen and measure.
8. **Schedule too restricted?** Ads paused during business hours due to custom schedule?

### Low CTR

1. **Ad relevance issue.** Does the ad headline literally contain the keyword or close variant?
2. **Expected CTR is low.** Compare your ad to the top 3 competitors on the same query via Auction Insights or manual SERP check. What do they offer that you don't?
3. **Position too low.** If you're position 4–5, CTR will naturally be low. Fix QS and/or bid to move up.
4. **Message mismatch.** Is the keyword intent actually what your ad promises?
5. **Asset extension missing.** Ads without sitelinks/callouts take up less SERP real estate and attract fewer clicks.

### High CPC but low conversions

1. **Intent mismatch.** Check the Search Terms Report — are you paying for queries that don't match buyer intent?
2. **LP bottleneck.** High CTR but low CVR = LP is not converting. Audit message match, form friction, load speed.
3. **Bidding strategy wrong.** Are you on Maximize Clicks (bids up for traffic) when you should be on CPA? Check.
4. **Competitor auction pressure.** Are you bidding against high-LTV competitors who can afford more per click than your business model supports?
5. **Conversion window too short.** If your sales cycle is 14–30 days and your conversion window is 7, you're missing late conversions.

### High spend, no results

1. **Broad match abuse.** Sorted by cost descending in Search Terms, you'll see it immediately.
2. **Wrong bidding strategy.** Maximize Clicks on a conversion-focused campaign = spend with no correlation to outcomes.
3. **Wrong audience / geographic targeting.** Serving ads in regions you can't deliver to.
4. **Landing page broken.** Check that the LP actually loads, the form submits, the conversion event fires.
5. **Tracking broken.** Run a test conversion end-to-end. If GTM/gtag tracking broke 2 weeks ago, "no results" might mean "conversions are happening but not measured."
6. **Fraud / bot clicks.** Rare on Search but check device/IP patterns if nothing else explains it.
7. **Account too new / learning period.** First 14 days of a new campaign or after bidding strategy change: expect noise. Don't panic-adjust daily.

### Zero conversions on a campaign that used to convert

Priority order to check:
1. **Tracking.** Did a site change, GTM push, or consent tool update break the conversion tag? Test a conversion end-to-end right now.
2. **Ad disapproval** or ad group paused.
3. **Landing page.** Did it change? Did the form break? Is it 404ing?
4. **Budget pacing.** Is the campaign spending at all? Maybe it's budget-starved because another campaign's budget blew up.
5. **Competitive shift.** Did a new competitor enter, lowering your impression share below threshold?
6. **Seasonal / calendar.** Is it a holiday week?

Only after 1–5 eliminated: blame the algorithm.

---

## Closing principle

Google Ads rewards operators who act like investors: spend deliberately on theses that are measurable, walk away from bets that don't validate, and ignore the house's suggestions to bet more until they can prove the odds. Most of the damage done to small Norwegian SMB accounts is not from bad ads — it's from defaults, auto-applies, rep upsells, and Smart Bidding on accounts that don't have the signal to feed it. The discipline is: opt *in* to every decision, explicitly, with a reason grounded in practitioner evidence rather than Google's marketing.

When advising on any Google Ads question, cite *which* practitioner or framework underwrites the recommendation. If no practitioner source exists for a specific claim, say so. Clients (and the operator) deserve to know the difference between battle-tested wisdom and polished opinion.
