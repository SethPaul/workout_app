# Workout Pool Audit

Scope: `pool.json` (52 workouts), `movements.json` (71 movements), audited against
`project_docs/training_evidence.md` (R1-R29), `app/seed/profile.md`, `app/SPEC.md` §2-3, and
`project_docs/requirements.md`. Every workout was read individually; findings are traced to a rule
number and a profile.md figure wherever possible. Where the evidence brief itself flags low
confidence (R8, R16, R20, R21, R26 template), the fix below is marked **judgment call**.

One methodology note up front: `profile.py`'s aggregate counts classify `burpee` as "plyo" and
`kb_snatch` as an "olympic lift" for its 19/52 and pattern-match statistics. This audit treats
`burpee` as low-force conditioning work (not the R22/R23 plyometric-fatigue concern, which is about
high-force jumps) and treats `kb_snatch` as materially lower-risk than a loaded barbell classic lift
(R7-R9's mechanism is bar-speed/technique breakdown under external load). That divergence is called
out explicitly below rather than silently changing the numbers; it means a few rows the aggregate
flags get a lighter mechanical fix than the raw 19-count implies.

## A. Pool-level findings, ranked by impact on strength/power/stamina

**1. The mandatory deadlift + push-press day does not exist (R26).** `push_press` and `power_clean`
are two of the 14 movements in `movements.json` never referenced anywhere in `pool.json` (profile.md
"Movements ... never referenced"). Main-lift pattern coverage is `['hinge','olympic','pull','squat']`
only — `push` and `pull`-as-a-loaded-main-lift are never used as a main lift at all (profile.md
"Main-lift pattern coverage"). Requirements.md names this day mandatory, one of only four gym days a
week; it is structurally absent. This is the single biggest gap against the stated weekly structure,
and it can't be patched by editing an existing workout — it needs new content (Section D #1).

**2. Every strength block in the pool uses the same 90s rest, regardless of load or set count
(R3, R6).** Profile.md's "Strength rest intervals used" aggregate: 90s, 52/52 workouts, no
variation. R3 wants 2-3+ min rest for sets at ≥80%1RM; R6 wants 2-5 min for olympic-lift sets and
explicitly says never train them to the point rest is inadequate for bar speed. 90s is short of both
floors, and it doesn't scale with the six different set/rep schemes the pool uses (1x5 through
10x5) — a single-set 1x5 and a 10x5 block get identical rest, when if anything the higher-volume
block needs *more*. Fix: 180s for squat/hinge/press barbell main lifts, 240s for clean/snatch/
overhead-squat (olympic-tagged). Mechanical, applies to 45/52 rows.

**3. Olympic lifts and heavy barbell lifts are trained inside fatigued formats in roughly a third of
the pool (R7, R8, R9, R23).** Profile.md counts 19/52 workouts with an olympic-lift-or-plyo movement
inside emom/tabata/interval/amrap (see methodology note above for why this audit's own count of
*barbell*-classic-lift-under-fatigue instances is a bit smaller). Concretely: `clean` shows up inside
its own AMRAP conditioning block at 5 reps (r3); `snatch` appears in interval/rounds/tabata blocks at
5 reps repeatedly (r82, r177, r33, r128); `jerk` appears in tabata/rounds/AMRAP at 5 reps five
separate times (r9, r149, r70, r39, r14, r16). R8 is explicit that high-rep oly work under fatigue is
a recognized injury mechanism and that load should drop sharply (≤60-70%1RM) as fatigue rises — none
of these blocks carry a load note at all, let alone a reduced one. `box_jump` (a genuine high-force
plyo, R22/R23) appears in 8 workouts, always inside a timed conditioning block, never fresh in a
first block. Fix: cap reps to ≤3 with an explicit load-drop note wherever a barbell classic lift
survives inside a fatigued block (R-D below); replace `box_jump` with `step_up` pool-wide (R-C).

**4. Reps-per-set for the classic lifts violate Prilepin's chart wholesale (R5).** Every one of the
18 clean/snatch main-lift workouts uses `reps: 5` — the README confirms this is a blanket assumption
("the sheet never states a rep count for the main lift"), not a deliberate choice. R5 caps classic
lifts at 1-3 reps/set. Two entries push total single-session volume far past Prilepin's own ceiling:
`sheet4-r157-snatch-30-on-30-off` and `sheet4-r273-snatch-clusters` are both **10x5 = 50 total heavy
snatch reps** in one session, vs. Prilepin's 18-30 total at 70-80%1RM. Fix: reps 5→3 for clean/snatch
main lifts, and cap sets at 6 (18 total at 3 reps, inside Prilepin's band) for the two 10x5 entries
and the three 8x5 entries.

**5. Seven "strength" blocks are a single set (R1, R2).** Profile.md: "1x5: 7 workouts." A single
set of 5 at any load is not a strength stimulus under R2's 4-6-set weekly floor, and it isn't a
progression model (R27) — it's one working set with no top-of-range/reset logic possible. Six of the
seven are loaded barbell lifts (`back_squat`, `front_squat`, `overhead_squat`, `deadlift`, `snatch`,
`clean` — one workout each); the seventh, `pistol_squat`, is bodyweight, so R1's %1RM language doesn't
strictly apply to it, but a single set of 5 unloaded pistol/lunge is still inconsistent with its own
10x5 sibling workouts in the same pool. Fix: bump to 3 sets (olympic lifts, matching Prilepin) or 5
sets (everything else).

**6. Pattern stacking: the main lift's own pattern reappears in its conditioning, and per-movement
cadence lets same-pattern main lifts run back-to-back (R21).** Profile.md counts 8/52 workouts at
≥50% pattern-matching conditioning (e.g. `sheet4-r28-pistol-squat-n-rounds` at 75%: box jumps + tire
flip + two side lunges after a squat-pattern main lift). Worse, the cadence table in profile.md shows
`back_squat`, `front_squat`, `overhead_squat`, and `pistol_squat` all share the `squat` pattern but
carry *per-movement* cadences of 7/7/7/3 days — nothing stops `pistol_squat` (cadence 3) from landing
the day after `back_squat` and the day after that, running four squat-pattern days in a row with zero
gate ever tripping, since the selection algorithm (SPEC §3) only checks per-movement, never
per-pattern, cadence. Same story for `clean`/`snatch`/`overhead_squat` all sharing `olympic`. The
data-level fix (swap the offending accessory movement in the 8 flagged workouts, Section B/E) treats
the symptom; the cadence gap is a selection-algorithm bug and needs a code fix (Section C #1).

**7. No warm-up, two conditioning blocks after every strength block, olympic work never placed
first (R24, R17, R18, R20).** All 52 workouts follow the identical `Strength → Conditioning →
Finisher` shape; none has a warm-up block, none places a power/oly block before the strength block
(R7/R24's prescribed order), and every single workout stacks *two* hard conditioning blocks back to
back after the heavy lifting rather than one. R20 caps same-session heavy-strength + high-intensity-
conditioning pairing at "≤2×/wk" as a floor for interference risk; here it's the invariant shape of
100% of the pool. There is no data fix that safely shortens or removes the Finisher block for all 52
at once without either fabricating new content or gutting variety, so this is flagged for judgment:
recommend making the Finisher block optional/lower-intensity by policy (drop it for `H`-intensity
workouts, keep it light for `M`/`L`) rather than mechanically deleting it from the pool — a call for
the app/spec layer (Section C), not `revise.py`.

**8. Session length: the pool almost never reaches the recommended envelope, and some sessions are
absurdly short (R25).** R25's envelope is 45-75 min. Profile.md: max estimated session length across
all 52 workouts is 45.0 min (one workout, `sheet4-r57-pistol-squat-clusters`), mean 28.8, and 8
workouts are under 20 min including `sheet4-r69-back-squat-clusters` at **4.5 minutes** — not a
session, a warm-up. Every rest-interval fix in #2 above adds real minutes (moving 90s→180-240s across
5-10 sets adds 7.5-15 min to the strength block alone), which closes some of this gap as a side
effect, but the 4.5-minute entry can't be salvaged by a parameter tweak; it's the pool's clearest drop
candidate.

**9. No Zone 2 / long low-intensity work exists anywhere in the pool (R15).** R15 wants the bulk of
conditioning volume to be low-intensity continuous work, with true VO2max-intensity work capped at
20-40 min/wk. The three workouts tagged `slog` (`sheet4-r11-back-squat-amrap`,
`sheet4-r20-overhead-squat-amrap`, `sheet4-r99-snatch-amrap`) are the pool's only attempt at this, and
per the README the tag just means "L intensity + AMRAP conditioning block" — their AMRAP blocks are
still loaded work (thrusters, RDLs, bench press, kb_snatch), not continuous Zone 2 cardio. There is no
single-modality 20-45 min continuous row/bike/run block in the pool at all. This can't be fixed by
editing an existing workout (a real Zone 2 session doesn't have a heavy barbell main lift); it needs
new content (Section D #5).

**10. No Norwegian 4x4, and the only "Tabata" blocks are mixed-movement 20/10 circuits, not the
validated protocol (R12, R13).** R12 is explicit that the 20/10 protocol's evidence is
intensity/modality-specific to the original single-movement, supramaximal cycle-ergometer design —
"doesn't generalize to sub-maximal 20/10 circuits." Every `tabata`-format block in the pool runs 2-3
different movements per round (e.g. `sheet4-r65-back-squat-tabata`: clean + RDL + plank in the same
8-round Tabata). That's a fine 20/10 conditioning circuit on its own merits, but the pool never
contains the actual thing R12 validates, and never contains R13's Norwegian 4x4 protocol at all. This
is a naming/labeling issue, not a data error worth mechanically "fixing" 20+ rows for (leaving the
existing circuits as-is is fine); it does mean the pool is missing both genuinely-validated
high-intensity protocols and should get one of each (Section D #6, #7).

**11. No progression or deload signal anywhere in the schema, and none belongs in pool data
(R27-R29).** `BlockMovement` has no %1RM/RPE/RIR field — only a free-text `loadNote`. Progression
(R27, double progression) and deload cadence (R29, 4-8wk) are properties of a *program over time*
(the sequence of `WorkoutLog`s), not of any single `PoolWorkout`; they cannot be represented in
`pool.json` no matter how it's edited. Correctly, this is entirely a Section C (spec/code) item, not
a Section B/E (data) item — flagged here so it isn't mistaken for an oversight in the per-workout
table below.

## B. Per-workout table

Legend: rest fix "180/240" = strength-block `restSec` 90→180 (barbell squat/hinge/press) or 90→240
(olympic-tagged main lift); "cap+note" = reduce that movement's `reps` to 3 and add a `loadNote`
inside a non-strength block (R7-R9); pistol_squat main lift is exempt from the rest-interval fix
(R11: 60-90s is correct for bodyweight accessory work).

| id | verdict | rule(s) | change |
|---|---|---|---|
| sheet4-r73-back-squat-30-on-30-off | modify | R3, R21, R23 | restSec 90→180; Finisher: box_jump→step_up, lunge→dumbbell_row (breaks squat-pattern stack) |
| sheet4-r11-back-squat-amrap | modify | R3, R15 (judgment) | restSec 90→180; `slog` tag is a judgment call — AMRAP still loaded work, not Zone 2 |
| sheet4-r7-back-squat-emom | modify | R3, R8/R9 (extended) | restSec 90→180; EMOM: deadlift reps 5→3 + loadNote "reduce load, technique focus" |
| sheet4-r2-back-squat-n-rounds | modify | R3, R23 | restSec 90→180; rounds: box_jump→step_up |
| sheet4-r65-back-squat-tabata | modify | R3, R7/R8/R9 | restSec 90→180; Tabata: clean reps 5→3 + loadNote |
| sheet4-r69-back-squat-clusters | **drop** | R1/R2, R25 | 1x5 main lift + 4.5 min total session; set `enabled: false` |
| sheet4-r61-clean-30-on-30-off | modify | R5, R6 | main clean reps 5→3, restSec 90→240 |
| sheet4-r3-clean-amrap | modify | R5, R6, R8 | main clean sets 8→6, reps 5→3, restSec→240; AMRAP: clean reps 5→3 + loadNote |
| sheet4-r24-clean-emom | modify | R5, R6, R21 | main reps 5→3, restSec→240; Conditioning: star_shrug→battle_ropes (breaks pull-pattern match) |
| sheet4-r82-clean-n-rounds | modify | R5, R6, R7/R8 | main reps 5→3, restSec→240; rounds: snatch reps 5→3 + loadNote |
| sheet4-r53-clean-tabata | modify | R5, R6, R23 | main sets 8→6, reps 5→3, restSec→240; Tabata: box_jump→step_up |
| sheet4-r177-clean-clusters | modify | R5, R6, R7/R8, R21 | main reps 5→3, restSec→240; interval: snatch reps 5→3+loadNote, bent_over_row→landmine_twist |
| sheet4-r13-deadlift-30-on-30-off | modify | R3, R26 (informational) | restSec 90→180; no push_press present — doesn't satisfy the mandatory day, see D#1 |
| sheet4-r63-deadlift-amrap | modify | R3 | restSec 90→180 |
| sheet4-r67-deadlift-emom | modify | R3, R7/R8/R9 | restSec 90→180; EMOM: snatch reps 5→3 + loadNote |
| sheet4-r34-deadlift-n-rounds | modify | R3 | restSec 90→180 |
| sheet4-r5-deadlift-tabata | modify | R3, R8, R21 | restSec 90→180; Tabata: sumo_deadlift reps 5→3 + loadNote (also hinge-pattern stack w/ main lift) |
| sheet4-r9-deadlift-clusters | modify | R3, R7/R8, R25 (note) | restSec 90→180; interval: jerk reps 5→3+loadNote; session still short (13.5min), see Finding 8 |
| sheet4-r1-front-squat-30-on-30-off | modify | R3 | restSec 90→180 |
| sheet4-r35-front-squat-amrap | modify | R1/R2, R3 | sets 1→5, restSec 90→180; Finisher duplicate bent_over_row→dumbbell_row |
| sheet4-r43-front-squat-emom | modify | R3, R2 (volume, note) | restSec 90→180; 8x5=40 reps is high volume even at good rest — informational only |
| sheet4-r10-front-squat-n-rounds | modify | R3 | restSec 90→180 |
| sheet4-r101-front-squat-tabata | modify | R3, R8 | restSec 90→180; Tabata: sumo_deadlift reps 5→3 + loadNote |
| sheet4-r93-front-squat-clusters | modify | R3, R2 (note) | restSec 90→180; no oly/plyo actually present (contra profile.md's burpee/thruster tagging — see methodology note) |
| sheet4-r49-overhead-squat-30-on-30-off | modify | R6, R23 | restSec 90→240; interval: box_jump→step_up |
| sheet4-r20-overhead-squat-amrap | modify | R1/R2, R6, R15 (note) | sets 1→3, restSec 90→240; `slog` tag still not true Zone 2 |
| sheet4-r91-overhead-squat-emom | modify | R6, R23 | restSec 90→240; EMOM: box_jump→step_up |
| sheet4-r4-overhead-squat-n-rounds | modify | R6, R8 (extended), R2 (note) | restSec 90→240; rounds: deadlift reps 5→3+loadNote; 8x5=40 reps overhead-squat is very high volume |
| sheet4-r149-overhead-squat-tabata | modify | R6, R7/R8/R9 | restSec 90→240; Tabata: jerk reps 5→3 + loadNote |
| sheet4-r33-overhead-squat-clusters | modify | R6, R7/R8, R21 | restSec 90→240; interval: snatch→kb_swing (removes both the fatigue and the olympic-pattern stack) |
| sheet4-r37-pistol-squat-30-on-30-off | modify | R1/R2 (informational) | sets 1→5 for consistency with sibling 10x5 pistol workouts |
| sheet4-r8-pistol-squat-amrap | **keep** | — | no rule crossed; rest interval already correct for bodyweight accessory work (R11) |
| sheet4-r115-pistol-squat-emom | **keep** | — | no rule crossed |
| sheet4-r28-pistol-squat-n-rounds | modify | R21, R23 | rounds: box_jump→step_up; Finisher duplicate side_lunge→dumbbell_row |
| sheet4-r173-pistol-squat-tabata | **keep** | R12 (informational) | 3-movement Tabata block is a fine 20/10 circuit as-is; not the validated protocol, no fix forced |
| sheet4-r57-pistol-squat-clusters | modify | R8 (extended)/R20 | interval: deadlift reps 5→3 + loadNote "moderate load, not for time" |
| sheet4-r157-snatch-30-on-30-off | modify | R5, R6, R21 | main sets 10→6, reps 5→3, restSec→240; interval: hammer_curl→landmine_twist (breaks pull-pattern match) |
| sheet4-r99-snatch-amrap | modify | R5, R6 | main reps 5→3, restSec→240 |
| sheet4-r12-snatch-emom | modify | R5, R6, R21 | main reps 5→3, restSec→240; EMOM: kb_snatch→kb_swing |
| sheet4-r70-snatch-n-rounds | modify | R1/R2, R5, R6, R7/R8 | main sets 1→3, reps 5→3, restSec→240; rounds: jerk reps 5→3+loadNote |
| sheet4-r41-snatch-tabata | modify | R5, R6 | main reps 5→3, restSec→240 |
| sheet4-r273-snatch-clusters | modify | R5, R6 | main sets 10→6, reps 5→3, restSec→240; Finisher duplicate side_lunge→farmers_carry |
| sheet4-r15-back-squat-amrap | modify | R3, R23 | restSec 90→180; AMRAP: box_jump→step_up |
| sheet4-r40-back-squat-n-rounds | modify | R3, R21 (informational) | restSec 90→180; Finisher duplicate bent_over_row→dumbbell_row |
| sheet4-r39-front-squat-amrap | modify | R3, R7/R8 | restSec 90→180; AMRAP: jerk reps 5→3 + loadNote |
| sheet4-r14-front-squat-n-rounds | modify | R3, R7/R8 | restSec 90→180; rounds: jerk reps 5→3 + loadNote |
| sheet4-r71-deadlift-amrap | modify | R1/R2, R3, R8 (extended), R23 | sets 1→5, restSec 90→180; AMRAP: deadlift reps 5→3+loadNote, box_jump→step_up |
| sheet4-r42-deadlift-30-on-30-off | modify | R3, R2 (note) | restSec 90→180; 8x5=40 reps deadlift is high volume |
| sheet4-r235-clean-emom | modify | R1/R2, R5, R6, R8 (extended) | main sets 1→3, reps 5→3, restSec→240; EMOM: deadlift reps 5→3+loadNote; Finisher duplicate side_lunge→mountain_climber |
| sheet4-r128-snatch-amrap | modify | R5, R6, R7/R8, R21 | main reps 5→3, restSec→240; AMRAP: jerk reps 5→3+loadNote, bent_over_row→skull_crusher |
| sheet4-r16-overhead-squat-n-rounds | modify | R6, R7/R8 | restSec 90→240; rounds: jerk reps 5→3+loadNote; data fix: bike distanceM 8047→1609 (5-mile bike accessory was almost certainly an error, per README) |
| sheet4-r95-pistol-squat-amrap | **keep** | — | no rule crossed |

**Verdict counts: 1 drop, 4 keep, 47 modify** (of 52).

## C. Structural recommendations (code/spec changes, not data)

**C1. Pattern-level cadence gate in `select.ts` (Finding 6, R21). Effort: M.** Add a
`PATTERN_CADENCE_DAYS: Record<Pattern, number>` (e.g. squat/hinge/push/pull=2 days minimum) and a
`movementPatterns(movement): Pattern[]` helper mirroring `profile.py`'s tag-to-pattern mapping
(including the `legs`→squat, `carry`→core extensions and the 5 by-id overrides). Extend SPEC §3 step
1's gate: for every pattern present in a candidate workout's movements, require
`daysSince(lastPerformed(anyMovement of that pattern)) >= PATTERN_CADENCE_DAYS[pattern]`. This is the
only way to actually stop `back_squat`→`pistol_squat`→`front_squat`→`overhead_squat` on four
consecutive days, which today's per-movement-only gate allows outright.

**C2. Day-type tagging + a weekly-structure gate (R26, requirements.md §4). Effort: L.** Reuse
`PoolWorkout.tags` with a `day:*` namespace (`day:deadlift-press`, `day:strength`, `day:oly-power`,
`day:diversity`, `day:zone2`) — Section E adds these tags additively. That alone doesn't make the
mandatory day *happen* weekly; SPEC §3 needs a new pure function, e.g.
`weeklyNeed(logs, now): DayType | null`, that inspects the last 7 days of `WorkoutLog`s and returns
which `day:*` type is still owed this week (deadlift-press day not done in 7 days → return it), and
`select.ts` step 1 should filter to that day type first when one is owed, falling back to the general
gate only when nothing is owed. This is the fix that makes "4-day split, mandatory deadlift+push-press
day" (requirements.md) an enforced invariant instead of a hope.

**C3. Session ordering enforcement — power before strength (R7, R24). Effort: S now / M enforced.**
`Block.title` already supports arbitrary strings; standardize on `'Power'` for an olympic/plyo block
and require it (by convention, then by a `validate.py` check) to be `blocks[0]` whenever a workout
contains a barbell classic lift or a high-force plyo. The new Section D olympic-power workout follows
this order already. Full enforcement (rejecting a saved workout with the wrong order) is a UI/editor
validation, hence M.

**C4. A warm-up block. Effort: S (types-level) / M (enforced).** No new `Format` value is needed — a
warm-up is just a low-intensity `interval` or `rounds` block titled `'Warm-up'`. Add a
`validate.py` warning (not yet an error, to avoid breaking the legacy 52) when `blocks[0].title !==
'Warm-up'`. Because this recommendation exists, Section D's new workouts carry warm-up guidance as
real `blocks[0]` entries rather than in `notes`.

**C5. `loadPct`/`rir` on `BlockMovement` (R28). Effort: S (types + validate) / M (UI).** Add
`loadPct?: number` (0-100) and `rir?: number` (0-5) to `BlockMovement` in `types.ts`, with a
`validate.py` range check. Today's free-text `loadNote` (used throughout Section B/E's fixes) stays
as a fallback for qualitative notes; the structured fields let the Execute screen show target load
directly and let History compute real progression instead of parsing text.

**C6. Progression and deload signal (R27, R29). Effort: M each.** Both belong on `WorkoutLog`
history, not `PoolWorkout`. `progressionSuggestion(movementId, logs): 'increase load' | 'repeat' |
'deload'` (double-progression logic, R27) and `deloadDue(logs, now): boolean` (rolling 4-8wk high-
volume window, R29 — confidence low per the evidence brief, so surface as a suggestion the user can
dismiss, not an automatic pool filter) are pure functions in `domain/`, consumed by the Today screen.

## D. Proposed new workouts

Seven new `PoolWorkout` entries close the gaps in Findings 1, 9, and 10. One new `Movement`
(`weighted_pullup`) is required because no existing loadable pull movement exists for a genuine pull
main-lift day (`pull_up`/`ring_row` are `loadable: false`). All use the existing `Format` union;
warm-up guidance is carried in `notes` per Section C4 (not yet a real block type). JSON below is
written to `revise.py` verbatim and applied to copies only, per instructions.

1. **`new-deadlift-pushpress-day`** — the mandatory day (R26): deadlift 5x5 @180s rest, then
   push_press 4x3 @180s rest, then a short core finisher (plank/dead_bug). Tag `day:deadlift-press`.
2. **`new-bench-press-day`** — first push-pattern main lift in the pool: bench_press 5x5 @180s,
   bent_over_row accessory 3x8, light row-interval finisher. Tag `day:strength`.
3. **`new-weighted-pullup-day`** — first pull-pattern main lift: weighted_pullup 5x5 @180s, dip
   accessory 3x8, farmer's-carry finisher. Tag `day:strength`.
4. **`new-power-clean-day`** — olympic work first per R7/R24: power_clean EMOM 10x2 @60s
   (loadNote 65-75%1RM), then front_squat 5x5 @180s, then a short kb_swing/push_up finisher. Tag
   `day:oly-power`.
5. **`new-zone2-row`** — R15's missing Zone 2 session: single 30-min continuous row block
   (loadNote "conversational pace, 65-75% HRmax"). Tag `day:zone2`. Intensity `L`.
6. **`new-norwegian-4x4-bike`** — R13's protocol: 4x4min @90-95%HRmax bike, 3min active recovery
   between. Tag `day:zone2`. Intensity `H`.
7. **`new-tabata-bike`** — the actual validated Tabata protocol (R12): single movement (bike), 8 x
   20s/10s, supramaximal effort — contrast with the 20/10 circuits elsewhere in the pool (Finding 10).
   Tag `day:hiit`.

Full JSON for all seven plus `weighted_pullup` is embedded in `revise.py` (Section E) as
`NEW_MOVEMENTS` / `NEW_WORKOUTS` and applied additively (idempotent by `id`).

## E. `revise.py`

`app/seed/revise.py` (stdlib only) implements exactly the data-level changes from B and D:
rest-interval fixes (R-A), single-set bumps (R-B), pool-wide `box_jump`→`step_up` (R-C), fatigue-risk
rep-cap + `loadNote` (R-D), clean/snatch rep/set correction (R-J), eight hardcoded pattern-stack
substitutions (R-E), five duplicate-movement fixes (R-K), the `bike` distanceM data fix, dropping
`sheet4-r69-back-squat-clusters` (`enabled: false`), additive `day:*` tagging (R-F), and appending the
7 new workouts + 1 new movement from Section D. Every rule checks current state before writing (e.g.
only bumps `restSec` if it is still 90, only adds a tag if absent, only appends a new-workout id if
not already present), so re-running it is a no-op the second time.

It was run against copies in the scratchpad directory only — **not** against the real
`app/seed/pool.json` / `movements.json`, per instructions — and `validate.py` was run against the
copies afterward. Result: 0 errors, 1 informational warning (unused-movement count, expected — see
`README.md`). See the chat report for the exact counts.
