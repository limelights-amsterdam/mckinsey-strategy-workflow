# mckinsey-strategy-workflow

A Claude Code **skill** that pressure-tests a strategic question with McKinsey-style frameworks,
orchestrated as a **deterministic multi-agent workflow**. The lead runs intake with you, then one
workflow runs the whole engagement in waves: diagnose + map the market in parallel, generate
**competing options from opposing mandates** and filter them to a shortlist, synthesize a
recommendation, then turn a **panel of adversarial verifiers** loose on its load-bearing
assumptions. The house rule — *an assumption ≥2 verifiers independently flag as fatal does not
survive* — is enforced as code, not judgment. Output: a board-ready **decision memo + narrative**
that survives a leadership or board meeting.

This is the sister of
[`mckinsey-strategy-team`](https://github.com/limelights-amsterdam/mckinsey-strategy-team), which
runs the same structure on Claude Code's experimental **agent teams** feature. This version needs
no experimental flags and no version gate.

## Team vs workflow — which one?

| | `mckinsey-strategy-team` | `mckinsey-strategy-workflow` (this repo) |
|---|---|---|
| Orchestration | Live agent team, lead improvises per wave | Deterministic script (`workflow.js`) |
| Steering | Message any teammate mid-run | At checkpoints (before launch / between runs) |
| Tally rule (≥2 = fatal) | Lead counts by judgment | **Four lines of code** |
| Prerequisites | Experimental flag + Claude Code ≥ 2.1.32 | Workflow tool (no flags) |
| If it breaks halfway | Re-run the wave by hand | **Resume** — finished waves return cached |
| Best for | Watching + steering the engagement live | Reproducible runs, lower ceremony |

Same 21 frameworks, same waves, same adversarial structure. Pick by how hands-on you want to be.

## What's inside

```
mckinsey-strategy-workflow/
├── SKILL.md        # the lead recipe: intake → brief → launch → deliver
├── workflow.js     # the engagement as a workflow script (waves, schemas, tally rule, deep mode)
├── README.md       # this file
├── WHY.txt         # the design rationale (what, how, value)
└── references/     # 21 McKinsey-style frameworks, 6 domains (method docs)
```

The 21 frameworks come from github.com/aapersh/strategy-skills-for-claude. They are not installed
as separate skills — the workflow agents **read them as files**.

## Prerequisites

- Claude Code with the **Workflow tool** (Fable models). No experimental flags, no env vars.
- Note: the Workflow tool requires explicit opt-in to multi-agent orchestration — invoking this
  skill is that opt-in, and the lead will tell you the scale before launching (~8 agents
  standard, ~15+ in deep mode).

## Install

**Option A — user skill (available everywhere):**
```sh
# put this folder wherever you like, then symlink it:
ln -s "$(pwd)/mckinsey-strategy-workflow" ~/.claude/skills/mckinsey-strategy-workflow
```

**Option B — per project:**
```sh
cp -R mckinsey-strategy-workflow .claude/skills/mckinsey-strategy-workflow
```

> At runtime the lead resolves the skill root, trying the user-level install first and falling
> back to a per-project install — so either option works. The only requirement is that the
> install folder keeps the name `mckinsey-strategy-workflow`.

## Use

Start a Claude Code session and say, for example:

> *"Use the strategy workflow to prepare a leadership decision on whether we do [X] or [Y].
> Here's the context: …"*

The lead runs a short intake (decision question, audience, constraints, output language,
standard vs deep mode), writes everything to a shared brief, shows you the plan, and launches
one workflow:

**Wave A** diagnose + market in parallel → **Wave B** options from opposing mandates (bull /
lean, + contrarian in deep mode) → **filter & synthesis** (dedupe, score, Pyramid draft with
numbered assumptions) → *(deep: tournament over the shortlist)* → **verifier panel**
(assumptions / war-game / execution) → **coded tally rule** → *(deep: war-game loop until two
rounds run dry)* → **decision memo** with a 60-second story and 3 hostile-Q&A answers.

Watch progress with `/workflows`. A standard run is ~8 agents — noticeably more tokens than an
ordinary chat. Use it for real decisions, not quick questions.

## Not for this

- Applying a single framework on its own → just read that framework file directly.
- A quick question that doesn't justify a multi-agent run → use a single session.
