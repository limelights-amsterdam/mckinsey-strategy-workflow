export const meta = {
  name: 'mckinsey-strategy-workflow',
  description: 'Strategy-team pipeline as a deterministic workflow: waves, opposing mandates, verifier panel with a coded tally rule',
  phases: [
    { title: 'Wave A', detail: 'diagnose + market mapping in parallel' },
    { title: 'Wave B', detail: 'options from opposing mandates' },
    { title: 'Filter & synthesis', detail: 'dedupe, score, draft recommendation' },
    { title: 'Tournament', detail: 'deep mode: pairwise-judge the shortlist' },
    { title: 'Panel', detail: '3 verifiers, one lens each' },
    { title: 'Risk loop', detail: 'deep mode: war-game until two rounds run dry' },
    { title: 'Memo', detail: 'tally rule + decision memo' },
  ],
}

// args: { ws, refs, deep }
//   ws   — workspace dir; the lead wrote ws/brief.md during intake (REQUIRED before launch)
//   refs — absolute path to this skill's references/ dir (21 framework files)
//   deep — true for high-stakes, hard-to-reverse calls; adds contrarian generator,
//          tournament, and a war-game loop that runs until risks dry up
// Guard: args can arrive JSON-encoded as a string depending on the caller.
// Without this, WS/REFS silently become "undefined" and agents improvise paths.
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
if (!A.ws || !A.refs) throw new Error(`Missing required args {ws, refs} — got: ${JSON.stringify(args)}`)
const WS = A.ws
const REFS = A.refs
const DEEP = !!A.deep
const BRIEF = `${WS}/brief.md`

const common = (role) => `You are the "${role}" teammate on a strategy team. You inherit NO context — read everything yourself.
1. First read the shared brief: ${BRIEF}
2. Apply your framework(s) strictly to THIS question. No generic theory — concrete findings, explicit assumptions where data is missing.
3. Write for the teammates who read your file next: findings first, each with its evidence, in the output language the brief specifies.`

// ── Wave A: diagnose + market (true barrier: wave B needs both) ──────────────
phase('Wave A')
const [diagnose, market] = await parallel([
  () => agent(`${common('diagnose')}
Frameworks: ${REFS}/01-diagnosis-and-framing/situation-assessment.md and ${REFS}/01-diagnosis-and-framing/growth-barriers.md
Write your output to ${WS}/diagnose.md (you own this file).
Return your 3 key conclusions as plain text.`, { label: 'diagnose', phase: 'Wave A' }),
  () => agent(`${common('market')}
Frameworks: ${REFS}/02-market-and-competitive-intelligence/market-mapping.md and ${REFS}/02-market-and-competitive-intelligence/competitive-intel.md
Write your output to ${WS}/market.md (you own this file).
Return your 3 key conclusions as plain text.`, { label: 'market', phase: 'Wave A' }),
])
log(`Wave A done — diagnose: ${diagnose ? 'ok' : 'FAILED'}, market: ${market ? 'ok' : 'FAILED'}`)

// ── Wave B: options from opposing mandates (generate-and-filter, part 1) ─────
const OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          whatMustBeTrue: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'summary', 'whatMustBeTrue'],
      },
    },
  },
  required: ['options'],
}

const optionGen = (name, mandate, file) => () => agent(`${common(name)}
Also read: ${WS}/diagnose.md and ${WS}/market.md — this is the factual floor; build on it.
Framework: ${REFS}/03-strategic-choice-and-economics/strategic-options.md (and ${REFS}/03-strategic-choice-and-economics/business-case-builder.md for rough economics).
YOUR MANDATE (follow it hard — divergence is the point): ${mandate}
Generate 2-3 distinct options, each with its "what must be true".
Write your full reasoning to ${WS}/${file} and return the options via structured output.`, { label: name, phase: 'Wave B', schema: OPTIONS_SCHEMA })

phase('Wave B')
const generators = [
  optionGen('option-bull', 'Maximize upside and growth. The boldest defensible move; assume resources can be found.', 'options-bull.md'),
  optionGen('option-lean', 'Maximize resilience and efficiency. The cheapest, lowest-risk, fastest-to-reverse path.', 'options-lean.md'),
]
if (DEEP) generators.push(
  optionGen('option-contrarian', 'Do the opposite of the obvious play — what would we do if the consensus move were forbidden?', 'options-contrarian.md'),
)
const rawSets = await parallel(generators)
const mandates = ['bull', 'lean', 'contrarian']
const allOptions = rawSets.flatMap((s, i) => (s?.options || []).map(o => ({ ...o, mandate: mandates[i] })))
log(`Wave B done — ${allOptions.length} options from ${rawSets.filter(Boolean).length} generators`)

// ── Filter + synthesis (the "lead filter" role, here one agent) ──────────────
const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    shortlist: { type: 'array', items: { type: 'string' } },
    recommendedOption: { type: 'string' },
    governingThought: { type: 'string' },
    assumptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
      },
    },
  },
  required: ['shortlist', 'recommendedOption', 'governingThought', 'assumptions'],
}

phase('Filter & synthesis')
const synth = await agent(`${common('lead-filter')}
Also read: ${WS}/diagnose.md, ${WS}/market.md, and every options-*.md file in ${WS}/.
Synthesis framework: ${REFS}/06-alignment-and-executive-communication/narrative-builder.md (Pyramid Principle / SCQA).
All generated options (JSON): ${JSON.stringify(allOptions)}
Tasks:
1. Dedupe overlapping options, drop dominated ones.
2. Score the survivors on attractiveness, feasibility, risk, economics, strategic fit. Keep the 2-3 strongest.
3. Pick the recommended option and build a draft recommendation: governing thought → 3 supporting arguments → backing.
4. Name the load-bearing assumptions EXPLICITLY, numbered A1, A2, A3... (max 7). Do not bury them — a panel attacks them next.
Write the full draft to ${WS}/draft-recommendation.md (including the numbered assumption list) and return shortlist, recommendation, governing thought and assumptions via structured output.`, { label: 'lead-filter', phase: 'Filter & synthesis', schema: SYNTH_SCHEMA })
log(`Draft ready — recommendation: "${synth.recommendedOption}", ${synth.assumptions.length} load-bearing assumptions`)

// ── Deep mode: tournament — king-of-the-hill over the shortlist ──────────────
let champion = synth.recommendedOption
if (DEEP && synth.shortlist.length >= 3) {
  phase('Tournament')
  const JUDGE_SCHEMA = {
    type: 'object',
    properties: {
      winner: { type: 'string', enum: ['champion', 'challenger'] },
      reason: { type: 'string' },
    },
    required: ['winner', 'reason'],
  }
  for (const challenger of synth.shortlist.filter(o => o !== champion)) {
    const votes = (await parallel(['economics', 'feasibility', 'strategic fit'].map(lens => () =>
      agent(`${common(`judge-${lens}`)}
Also read: ${WS}/diagnose.md, ${WS}/market.md, ${WS}/draft-recommendation.md and every options-*.md in ${WS}/.
Compare exactly two options through the lens of ${lens}:
- CHAMPION: ${champion}
- CHALLENGER: ${challenger}
Pick the stronger one for THIS case. Return your verdict via structured output.`, { label: `judge-${lens}`, phase: 'Tournament', schema: JUDGE_SCHEMA })
    ))).filter(Boolean)
    if (votes.filter(v => v.winner === 'challenger').length >= 2) champion = challenger
    log(`Tournament: ${champion === challenger ? 'challenger wins' : 'champion holds'} — "${champion}"`)
  }
  if (champion !== synth.recommendedOption) {
    await agent(`${common('re-synth')}
The tournament overturned the draft recommendation. New recommended option: "${champion}".
Read ${WS}/draft-recommendation.md and every options-*.md in ${WS}/, then REWRITE ${WS}/draft-recommendation.md around the new option — same structure (governing thought, 3 arguments, numbered assumptions A1..An, max 7). Keep assumption IDs stable where the assumption is unchanged.
Return the new governing thought as plain text.`, { label: 're-synth', phase: 'Tournament' })
  }
}

// ── Panel: 3 verifiers, one lens each (adversarial verification) ─────────────
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    fatalAssumptionIds: { type: 'array', items: { type: 'string' }, description: 'IDs (A1, A2, ...) of assumptions you judge FATAL — only if the recommendation breaks when this assumption turns out false' },
    newRisks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, severity: { type: 'string', enum: ['fatal', 'serious', 'manageable'] } }, required: ['title', 'severity'] } },
    summary: { type: 'string' },
  },
  required: ['fatalAssumptionIds', 'newRisks', 'summary'],
}

const verifier = (name, lens, frameworks, file, extra = '') => () => agent(`${common(name)}
Also read: ${WS}/draft-recommendation.md — that is your target. Attack it, do not defend it.
Your lens: ${lens}
Framework(s): ${frameworks}
The load-bearing assumptions you judge (JSON): ${JSON.stringify(synth.assumptions)}
Flag an assumption as fatal ONLY if the recommendation truly breaks when it turns out false — be strict, not theatrical.${extra}
Write your full critique to ${WS}/${file} and return your verdict via structured output.`, { label: name, phase: name.startsWith('wargame-round') ? 'Risk loop' : 'Panel', schema: VERDICT_SCHEMA })

phase('Panel')
const verdicts = (await parallel([
  verifier('verify-assumptions', 'Which load-bearing beliefs are weakest, and where does the logic break if one is wrong?', `${REFS}/01-diagnosis-and-framing/assumption-audit.md`, 'verify-assumptions.md'),
  verifier('verify-wargame', 'War-game competitor moves, market shifts, customer reactions and regulation against this recommendation.', `${REFS}/05-risk-performance-and-value-governance/war-gaming.md`, 'verify-wargame.md'),
  verifier('verify-execution', 'Can this organization actually execute this, and do the economics survive a bad case?', `${REFS}/04-operating-model-and-execution/operating-model-design.md and ${REFS}/05-risk-performance-and-value-governance/risk-and-mitigation.md`, 'verify-execution.md'),
])).filter(Boolean)

// ── Tally rule AS CODE: an assumption ≥2 independent verifiers flag is fatal ──
const counts = {}
for (const v of verdicts) for (const id of v.fatalAssumptionIds) counts[id] = (counts[id] || 0) + 1
const fatal = Object.entries(counts).filter(([, n]) => n >= 2).map(([id]) => id)
const flaggedOnce = Object.entries(counts).filter(([, n]) => n === 1).map(([id]) => id)
log(`Tally: ${verdicts.length}/3 verifiers in. Fatal (≥2 flags): ${fatal.length ? fatal.join(', ') : 'none'}. Single flags: ${flaggedOnce.length ? flaggedOnce.join(', ') : 'none'}.`)

// ── Deep mode: loop-until-done — war-game until two rounds surface nothing new ──
const loopRisks = []
if (DEEP) {
  phase('Risk loop')
  const seen = new Set(verdicts.flatMap(v => v.newRisks.map(r => r.title.toLowerCase())))
  let dry = 0, round = 0
  while (dry < 2 && round < 5) {
    round++
    const r = await verifier(`wargame-round-${round}`,
      `Round ${round} of an exhaustive war-game. Risks already found (do NOT repeat them): ${[...seen].join('; ') || 'none yet'}. Hunt for NEW fatal or serious risks only.`,
      `${REFS}/05-risk-performance-and-value-governance/war-gaming.md`, `verify-wargame-round-${round}.md`)()
    const fresh = (r?.newRisks || []).filter(x => !seen.has(x.title.toLowerCase()))
    fresh.forEach(x => seen.add(x.title.toLowerCase()))
    const freshFatal = fresh.filter(x => x.severity === 'fatal')
    loopRisks.push(...fresh)
    dry = freshFatal.length === 0 ? dry + 1 : 0
    log(`Risk loop round ${round}: ${fresh.length} new risks (${freshFatal.length} fatal) — ${dry}/2 dry rounds`)
  }
}

// ── Memo: fold surviving critique into the deliverable ───────────────────────
phase('Memo')
const memo = await agent(`${common('memo-writer')}
Read: ${WS}/draft-recommendation.md and every verify-*.md file in ${WS}/.
Frameworks: ${REFS}/06-alignment-and-executive-communication/decision-memo.md and ${REFS}/06-alignment-and-executive-communication/narrative-builder.md.
TALLY RESULT (counted deterministically across the panel — this is binding):
- Assumptions flagged fatal by ≥2 independent verifiers: ${fatal.length ? fatal.join(', ') : 'none'} → these MUST be fixed, hedged, or the recommendation changes.
- Flagged by exactly one verifier: ${flaggedOnce.length ? flaggedOnce.join(', ') : 'none'} → list as risks with mitigations.${DEEP ? `\n- Extra risks from the war-game loop (JSON): ${JSON.stringify(loopRisks)}` : ''}
Write the final decision memo to ${WS}/decision-memo.md with: decision question, recommendation (Pyramid: governing thought + 3 arguments), option trade-off table, top risks + mitigations (mark the tally-fatal ones), first 90 days, open questions, and a 60-second spoken version + 3 hostile-Q&A answers. A board member reads it before the meeting: lead with the answer, keep the reasoning to what supports it. Write it in the output language the brief specifies.
Return as plain text: the governing thought + whether the recommendation changed because of the tally, and why.`, { label: 'memo-writer', phase: 'Memo' })

return {
  recommendation: champion,
  governingThought: synth.governingThought,
  optionsGenerated: allOptions.length,
  shortlist: synth.shortlist,
  assumptions: synth.assumptions.map(a => a.id),
  tallyFatal: fatal,
  tallyFlaggedOnce: flaggedOnce,
  loopRisks: DEEP ? loopRisks : undefined,
  verdictSummaries: verdicts.map(v => v.summary),
  memoVerdict: memo,
  memoPath: `${WS}/decision-memo.md`,
}
