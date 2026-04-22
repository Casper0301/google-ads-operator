# Google Ads Operator

**Open-source operator skill + MCP setup for Claude Code.** Turn Claude into a deep Google Ads operator that thinks like a senior PPC consultant, not like a Google rep. Built for small-to-mid-budget accounts where getting the fundamentals right matters more than chasing every shiny Google feature.

Free. MIT licensed. No strings attached.

![Status](https://img.shields.io/badge/status-production-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Language](https://img.shields.io/badge/language-English%20%7C%20Norsk-lightgrey)

## What it is

A deep, source-grounded skill for Claude Code that covers the full Google Ads operator's job — account structure, match types, negative keywords, bidding strategy, Smart Bidding readiness thresholds, Performance Max traps, Quality Score mechanics, conversion tracking, Consent Mode v2, landing-page alignment, and more. Sourced from 15+ practitioners who have actually run accounts at scale: Fred Vallaeys, John Moran, Brad Geddes, Jyll Saskin Gales, Kirk Williams, Miles McNair, Aaron Young, Navah Hopkins, Sarah Stemen, and others — **explicitly deprioritizing Google's own Skillshop material** because Google's incentives and your client's ROAS don't always align.

Paired with optional MCP setup so Claude can read from and propose changes to your actual Google Ads accounts through a plan → preview → confirm → execute pipeline. Every write operation requires your approval. Full audit log. Rollback on any change.

## Why it exists

Most Google Ads agencies charge 6 000–15 000 NOK/month to manage a single SMB account with a 5 000 NOK/month ad budget. Half the work is routine (search terms review, negative keywords, budget pacing) and the other half is judgment calls that require real expertise. AI leverage collapses the routine half while preserving — and sharpening — the judgment half. This bundle gives you both.

If you're a solo PPC operator, a small agency trying to scale without hiring, or a marketing generalist who's strong on Meta but weak on Google, this closes that gap.

## What's inside

| File | Purpose |
|------|---------|
| [`SKILL.md`](./SKILL.md) | Deep operator skill, 850+ lines, sourced inline. This is the brain. |
| [`README.md`](./README.md) | This file. |
| [`SETUP.md`](./SETUP.md) | Step-by-step install. Claude Code → developer token → OAuth → Supabase → MCP connection. Norwegian — translate if needed. |
| [`MCP_TOOLS.md`](./MCP_TOOLS.md) | Reference for all MCP tools with example prompts. Norwegian. |
| [`LICENSE`](./LICENSE) | MIT. |

## Two ways to use it

### Level 1 — skill only (15-minute install)

Drop `SKILL.md` into `~/.claude/skills/google-ads-operator/` and you're done. Claude now reasons about Google Ads decisions using the operator skill — bidding-strategy selection, Smart Bidding readiness, match-type framework, negative keyword discipline, Performance Max fit assessment, Norwegian market specifics (Finn.no dynamics, kommune-level targeting, fellesferie, Consent Mode v2 compliance).

Ask Claude questions like:
- *"Should we switch this campaign from Max Conversions to tCPA? 30-day stats: 42 conversions, 340 kr CPA, stable."*
- *"My Google rep is pushing Performance Max. Should I do it?"*
- *"Give me a negative keyword seed list for a Norwegian used-car dealer on Tier 1 budget."*
- *"My Ad Strength is 'Poor' — what's actually worth fixing?"*

Answers are grounded in sourced practitioner wisdom, not Google's default advice.

### Level 2 — skill + MCP (2–4 hours install)

Claude gets direct Google Ads API access through a local MCP server. Now he can:

- Pull search terms reports for any client on demand
- Propose negative keywords with reasoning — you confirm, then execute
- Propose campaign pauses and budget changes with preview + undo data
- Roll back any prior change in one command
- Audit-log everything in your own Supabase

All write operations go through **plan → preview → confirm → execute**. Claude never writes to an ad account without showing you exactly what's going to happen.

*Note: Level 2 requires a Google Ads Developer Token (free, 1–3 day approval), a Google Cloud project for OAuth, and optionally a Supabase project for persistence. Full walkthrough in `SETUP.md`.*

## Quickstart (Level 1)

```bash
# Clone the repo
git clone https://github.com/Casper0301/google-ads-operator.git
cd google-ads-operator

# Install the skill into Claude Code
mkdir -p ~/.claude/skills/google-ads-operator
cp SKILL.md ~/.claude/skills/google-ads-operator/

# Launch Claude Code and test
claude
```

Then in Claude: *"What's your framework for deciding between Smart Bidding and Manual CPC?"* — if the skill is loaded, the answer will cite the 30-conversion floor (Vallaeys/Saskin Gales) and explain the tier-dependent decision.

## Who this is for

- **Solo PPC operators** managing 3–15 SMB accounts who need AI leverage to stay profitable per account.
- **Small agencies** tired of junior PPC hires making avoidable mistakes on auto-apply recommendations, Performance Max defaults, and premature Smart Bidding.
- **Meta-strong, Google-weak marketers** who need a trusted second brain for Google Ads specifically.
- **Norwegian / Nordic operators** who want localized guidance on kommune targeting, Finn.no dynamics, fellesferie patterns, Consent Mode v2, and NOK-budget realities.
- **Freelancers and in-house marketers** who want to sanity-check what their Google rep is telling them before acting on it.

## Who it's not for

- Enterprise account managers running 8-figure USD ad spend — your problems are different.
- Anyone hoping for magic automation that runs without human judgment. This skill makes the operator smarter; it doesn't replace them.
- Pure e-commerce at massive scale where Performance Max + Shopping feed economics dominate — the skill covers these but isn't optimized for them.

## Status and roadmap

**What's in the current release:**
- Operator skill (850+ lines, production-ready)
- Full SETUP.md walkthrough for skill + MCP
- MCP tool reference documentation

**What's coming:**
- The MCP server source code itself — currently documented, reference implementation ships soon
- Meta Ads operator skill (same framework, applied to Meta's quirks)
- Additional industry-specific playbooks (used-car dealers, home services, local restaurants)
- Tracking-integrity audit workflows

Watch the repo or follow [@casperschive](https://casperschive.no) for updates.

## About the author

Built by [Casper Schive](https://casperschive.no) — Norwegian AI-forward marketer and operator. Runs [AutoPromo](https://autopromo.no) (car dealer marketing) and [casperschive.no](https://casperschive.no) (AI community + custom software). Open-sources tools that he'd otherwise charge 15 000+ NOK/month to build for a single client.

## License

MIT. Use it. Modify it. Ship it in your own tooling. No attribution required, though a link back is appreciated if you find it useful.

## Contributing

Issues and pull requests welcome. The skill is a living document — if you're a PPC practitioner with a specific insight that belongs in here, open a PR with sources cited. Keep the tone practical and source-anchored; vague wisdom without attribution will be rejected politely.

## Questions

GitHub Issues for anything technical or content-related. For direct contact about custom implementation or agency work, see [casperschive.no](https://casperschive.no).

---

*Not affiliated with Google. Google Ads is a trademark of Google LLC.*
