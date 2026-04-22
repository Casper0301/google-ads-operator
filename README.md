# Google Ads Operator

**One skill for Claude Code that sets itself up and then runs your Google Ads.**

Drop the skill folder into `~/.claude/skills/`, tell Claude you want Google Ads management, and it walks you through the whole thing:

1. Applying for a Google Ads API developer token (with lessons learned from real applications — business-email requirement, use-case template that gets approved, common rejection reasons)
2. Setting up Google Cloud OAuth credentials
3. Installing the bundled `google-ads-mcp` server locally (clone → npm install → Supabase → env → register with Claude)
4. Connecting your first client via OAuth
5. Operating accounts with deep source-grounded practitioner knowledge — match types, bidding strategies, negatives, Performance Max traps, Consent Mode v2, Norwegian market specifics, and more

The skill auto-detects where you are and picks up from the right phase. First-time users get the full onboarding. Returning users go straight to operator mode.

Free. MIT licensed. No strings.

![Status](https://img.shields.io/badge/status-production-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Language](https://img.shields.io/badge/language-TypeScript-blue)

## What's in this repo

```
google-ads-operator/
├── SKILL.md          # The unified skill — setup flow + operator knowledge
├── mcp/              # The google-ads-mcp server (TypeScript)
│   ├── src/          # MCP tools, Google Ads platform wrapper, operations
│   ├── supabase/     # Database schema migration
│   ├── scripts/      # OAuth helper script
│   ├── package.json
│   └── .env.example
├── LICENSE           # MIT
└── README.md         # This file
```

## Why it exists

Small-budget Google Ads accounts (5 000–20 000 NOK/month) live in an awkward gap. Big agencies won't touch them. Freelancers charge 6 000+ NOK/month to manage them and half the work is routine that doesn't need a human. AI leverage collapses the routine half — search terms review, negative keyword sweeps, budget pacing, report generation — while sharpening the judgment half, where practitioner-sourced decision frameworks matter more than Google's own Skillshop material.

This skill gives you both: a local MCP server that talks to Google Ads API through a safe plan → preview → confirm → execute pipeline, plus deep operator knowledge so Claude reasons like a senior PPC consultant, not like a Google rep.

## Quickstart

```bash
# Clone the repo
git clone https://github.com/Casper0301/google-ads-operator.git
cd google-ads-operator

# Install the skill into Claude Code
mkdir -p ~/.claude/skills/google-ads-operator
cp SKILL.md ~/.claude/skills/google-ads-operator/

# Launch Claude Code
claude
```

In Claude, tell it:

> "I want to set up Google Ads management for my business."

The skill activates, detects you have nothing installed, and walks you through Phase 1 (developer token application). From there, follow its lead.

Already have a developer token and Google Cloud OAuth? The skill skips ahead to the install phase automatically.

## Requirements

- **Claude Code** (CLI or Desktop) — Pro/Max subscription or API key. Free from claude.com.
- **Google Ads Manager Account (MCC)** — free; create at `ads.google.com/aw/signup/manager` if you don't have one.
- **Google Ads API Basic access** — free, 1–3 day approval. The skill walks you through it.
- **Google Cloud account** — free tier is enough.
- **Supabase account** — free tier is plenty (stores encrypted OAuth tokens, changes pipeline, audit log).
- **Node 20+** — for running the MCP server.
- A domain and business email on that domain — needed for Google Ads API approval.

## What the MCP can do

**Read operations (autonomous, no approval needed):**
- Pull search terms reports for any connected client
- List clients, pending changes, audit log

**Write operations (always go through plan → preview → confirm → execute):**
- Propose negative keywords to campaigns or shared sets
- Propose campaign pause / resume
- Propose daily budget changes
- Rollback any previously-executed change

Every write has undo data stored before execution. Nothing happens in your Google Ads account without your explicit approval.

## Who this is for

- **Solo PPC operators** managing 3–15 SMB accounts who want AI leverage per client without losing operator-level control.
- **Small agencies** tired of junior hires tripping on auto-apply recommendations, Performance Max defaults, and premature Smart Bidding.
- **Meta-strong, Google-weak marketers** who want a trusted second brain for the Google side specifically.
- **Norwegian / Nordic operators** — the skill is tuned for NOK budgets, kommune-level targeting, Finn.no dynamics, fellesferie seasonality, Consent Mode v2 compliance. Works globally too.
- **Anyone** who wants to sanity-check what their Google rep is suggesting before acting on it.

## What makes the operator knowledge different

Sourced inline from real practitioners, not Google's marketing material:

- Fred Vallaeys (Optmyzr, ex-Google 10 years)
- John Moran (Solutions 8)
- Brad Geddes (Adalysis, author of *Advanced Google AdWords*)
- Jyll Saskin Gales (ex-Google rep, now coach)
- Kirk Williams (Zato Marketing)
- Miles McNair (PPC Mastery)
- Aaron Young (Define Digital Academy)
- Navah Hopkins, Sarah Stemen, Andrew Hales
- PPC Town Hall and r/PPC community wisdom

Google's own Skillshop material is explicitly deprioritized. Google's incentives (more spend, broader match, Performance Max adoption, auto-applied recommendations) diverge from client ROAS on multiple recurring points. The skill flags those divergences and cites which practitioner underwrites each counter-recommendation.

## License

MIT. Use it. Modify it. Ship it in your own tooling. No attribution required, though a link back is appreciated.

## About the author

Built by [Casper Schive](https://casperschive.no) — Norwegian AI-forward marketer and operator. Runs [AutoPromo](https://autopromo.no) (car dealer marketing) and [casperschive.no](https://casperschive.no) (custom software + AI community). Open-sources tools that would otherwise cost clients 15 000+ NOK/month to build.

## Contributing

Issues and pull requests welcome. The skill is a living document — if you're a PPC practitioner with a specific insight that belongs in the operator section, open a PR with sources cited. Keep the tone practical and source-anchored; vague wisdom without attribution will be rejected politely.

For MCP code contributions, keep the plan → preview → confirm → execute pattern intact for any new write operation. No direct API writes.

## Questions

GitHub Issues for anything technical. For direct contact about custom implementation work, see [casperschive.no](https://casperschive.no).

---

*Not affiliated with Google. Google Ads is a trademark of Google LLC.*
