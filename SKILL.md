---
name: mckinsey-strategy-workflow
description: >
  Pressure-tests a strategic question with McKinsey-style frameworks, orchestrated as a
  deterministic multi-agent workflow (no experimental features needed). The lead runs intake
  inline, then launches one workflow that runs the team in waves: diagnose + map the market in
  parallel, generate competing strategic options from opposing mandates and filter them to a
  shortlist, synthesize a recommendation, and turn a panel of adversarial verifiers loose on the
  load-bearing assumptions — with the "≥2 verifiers flag it = fatal" tally rule enforced as code,
  not judgment. Output: a board-ready decision memo + narrative that survives the meeting. Use to
  prepare a leadership or board session, structure a merger/M&A or major strategic choice, or
  stress-test / war-game an existing strategy. Triggers on: strategy workflow, pressure-test
  strategy, war game, prepare a board decision, stress-test our plan, merger/M&A structuring,
  where-to-play decision. NOT for applying a single framework on its own, or a quick question
  that doesn't justify a multi-agent run.
---

# Strategy Workflow

The sister of `mckinsey-strategy-team`, rebuilt on the **Workflow tool** instead of agent teams.
Same structure — waves, **opposing option-mandates** (so no false binary), an **adversarial
verifier panel** — but the orchestration is a deterministic script, not lead-improvisation. The
biggest upgrade: the **tally rule** ("an assumption ≥2 verifiers independently flag as fatal does
not survive") is four lines of code instead of the lead eyeballing it. No experimental flags, no
version gate, and the run is resumable if it breaks halfway.

What you give up versus the team version: steering a named teammate mid-run. Steering here
happens at the checkpoints (before launch, between runs) — which is where it happened in
practice anyway.

Built on the 21 McKinsey-style frameworks in `references/`
(source: github.com/aapersh/strategy-skills-for-claude).

---

## When to use / not

**Use it for:**
- Preparing a leadership or board session where a real decision gets made.
- Structuring a merger/M&A or major strategic choice (where to play, build/buy/partner).
- Stress-testing / war-gaming an existing strategy before commitment.

**Don't use it for:** applying one framework on its own, or a quick question that doesn't justify
a multi-agent run — a single session is cheaper there.

**Note on opt-in:** the Workflow tool requires explicit user opt-in to multi-agent orchestration.
The user invoking this skill IS that opt-in. Still tell them the scale up front (~8 agents
standard, ~15+ in deep mode).

---

## The pipeline

### Step 1 — Intake (lead + user, inline — this is the checkpoint)
The workflow runs unattended once launched, so pull ALL context now:
- The problem in one line, and the real **decision question** (what must be decided, by whom?).
- The audience and the **output language** (state it explicitly in the brief).
- Constraints (time, money, politics), what's already known, available data/sources.
- The **stakes → run mode**. Default **standard**. Offer **deep mode** when the decision is hard
  to reverse or bet-the-company: it adds a contrarian option-generator, a tournament that
  pairwise-judges the shortlist, and a war-game loop that keeps hunting risks until two
  consecutive rounds come up empty — at a real token premium. Confirm the mode with the user.

→ **Checkpoint:** summarize the engagement plan ("I'll launch the workflow with this brief, in
<standard|deep> mode — OK?") before any tokens burn. This replaces the team version's spawn plan.

### Step 2 — Workspace + brief
1. Slug the topic, `mkdir -p /tmp/strat-wf-<slug>/`.
2. Write `/tmp/strat-wf-<slug>/brief.md` with ALL intake context: decision question, audience,
   **output language**, constraints, known facts (mark assumptions explicitly) and run mode.
   Workflow agents inherit nothing — the brief is their entire world.

### Step 3 — Resolve the skill root (critical for portability)
The skill may be installed user-level *or* per-project; keep the first that resolves:
```
realpath ~/.claude/skills/mckinsey-strategy-workflow 2>/dev/null \
  || realpath "$PWD/.claude/skills/mckinsey-strategy-workflow"
```
Call it `<ROOT>`. Never hardcode a user-specific path — resolve at runtime.

### Step 4 — Launch the workflow
One call does the whole engagement:
```
Workflow({
  scriptPath: "<ROOT>/workflow.js",
  args: { ws: "/tmp/strat-wf-<slug>", refs: "<ROOT>/references", deep: <true|false> }
})
```
It runs in the background; progress is visible via `/workflows`. The script executes:
1. **Wave A** — `diagnose` + `market` in parallel (the factual floor; options are NOT generated
   here on purpose).
2. **Wave B** — `option-bull` (maximize upside) + `option-lean` (cheapest reversible path), deep
   mode adds `option-contrarian` (consensus move forbidden). Structured output, each 2-3 options
   with "what must be true".
3. **Filter & synthesis** — one agent dedupes, drops dominated options, scores survivors, picks a
   recommendation, and numbers the load-bearing assumptions A1..An.
4. **Tournament** (deep, if 3+ survive) — three judges (economics, feasibility, strategic fit)
   pairwise-judge champion vs each challenger; an overturned draft is re-synthesized.
5. **Panel** — `verify-assumptions`, `verify-wargame`, `verify-execution` attack the draft in
   parallel, each returning fatal assumption IDs via schema.
6. **Tally rule as code** — IDs flagged by ≥2 verifiers are fatal; the memo agent receives the
   tally as *binding* input.
7. **Risk loop** (deep) — extra war-game rounds until two consecutive rounds surface no new
   fatal risk (capped at 5).
8. **Memo** — folds surviving critique into `decision-memo.md`: decision question, Pyramid
   recommendation, option trade-off table, risks + mitigations, first 90 days, 60-second story,
   3 hostile-Q&A answers.

### Step 5 — Deliver
When the workflow completes, read its return value + `decision-memo.md`:
- Report the recommendation, the tally outcome (which assumptions died), and whether the
  recommendation changed because of the panel.
- `/tmp` is volatile — copy the memo to a durable path (ask the user, or default to
  `./strategy-sessions/<slug>/decision-memo.md`) and show the core in chat.
- If the user wants changes, edit the brief or the script copy the Workflow tool persisted and
  **resume** with `resumeFromRunId` — completed waves return cached, only the changed part reruns.

---

## Guardrails
- **File ownership:** each agent owns exactly one output file in the workspace → no conflicts.
- **Barriers are real here:** Wave B genuinely needs both Wave A files; the tally genuinely needs
  all verdicts. Don't "optimize" them into a pipeline — the waves are the method.
- **Token-aware:** standard ≈ 8 agents, deep ≈ 15+. Default to standard; scale depth to the
  decision, not by habit.
- **The structure is the value:** generate-then-filter (options aren't one agent's first idea)
  and the coded ≥2 tally (no lone verifier vetoes, no weak assumption survives) are what make
  the output robust rather than merely confident. Don't skip them to save an agent.
- **Don't edit workflow.js per engagement** — everything case-specific flows through `brief.md`
  and `args`. The script stays generic.

---

## Framework index
See `references/` — 21 frameworks across 6 domains (diagnosis & framing, market & competitive
intelligence, strategic choice & economics, operating model & execution, risk & value
governance, alignment & executive communication). The workflow wires the core ones; for a
one-off single framework, just read that file directly instead of running this skill.
