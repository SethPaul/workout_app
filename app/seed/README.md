# Seed data — how it was derived

Source: `xlsx_version/workouts_data.json` (Sheet4, the ~1000-row daily log). Sheet1 and Sheet3
were inspected but not used directly — see "Other sheets" below.

## Column mapping (Sheet4)

The header row (row 0) has empty/placeholder names for two columns; content was inferred from the
data itself:

| pandas key      | meaning                                             |
|------------------|-----------------------------------------------------|
| `Unnamed: 0`    | row index (1..1000)                                  |
| `Unnamed: 1`    | date (`Day`)                                         |
| `Unnamed: 2`    | strength-progression count = number of sets for the main lift |
| `Unnamed: 3`    | main movement name                                   |
| `Unnamed: 5`    | first accessory/conditioning list (comma-separated, e.g. `"5 high pulls, 5 bench press, 5 flys"`) |
| `Unnamed: 7`    | intensity (`H`/`M`/`L`)                              |
| `Unnamed: 8`    | format string (`AMRAP`, `N rounds`, `30 on 30 off`, `EMOM`, `Tabata`, `clusters`) |
| `Unnamed: 9`    | second accessory/conditioning list, same shape as `Unnamed: 5` |

997 of 1000 rows have a main movement populated; 3 are blank rest-day rows and were skipped.

Only **7 distinct main movements** and **6 distinct format strings** appear in the whole sheet
(42 `(movement, format)` combinations), but the two accessory lists are re-randomized almost every
day, so 997 of the "full" `(movement, accessories, format, intensity)` tuples are effectively
unique. Per SPEC §8 ("30 to 60 good pool entries is plenty", "quality over coverage") we did not
try to emit one workout per row. Instead:

- One representative row was chosen for each of the 42 `(main movement, format)` combinations.
- 10 additional rows were added for the three highest-traffic lifts (back squat, front squat,
  deadlift) plus clean/snatch/overhead-squat/pistol-group, each picked at an **intensity not
  already represented** for that combination, to give the pool some H/M/L spread per movement.
- Total: **52 pool workouts**, covering all 7 main movements × all 6 formats, at a mix of H/M/L.

## Workout structure per row

Each `PoolWorkout` has:
- **Block 1 ("Strength")**: `format: "strength"`, the main movement, `reps: 5` (assumed — the
  sheet never states a rep count for the main lift, only the set count), `sets` = the
  strength-progression column, `restSec: 90` (assumed, not in source data).
- **Block 2 ("Conditioning")**: the movements parsed from `Unnamed: 5`, in the mapped `Format`
  (see below). This is the block whose movements appear in the workout `name`, matching the
  worked example in the task brief (e.g. "Front squat 3x5 + high pulls/bench press/flys, 30 on 30
  off").
- **Block 3 ("Finisher")**, when `Unnamed: 9` is non-empty: the second accessory list, run in the
  *same* format/timing as block 2. The sheet gives only one format field per day, so this is a
  judgment call — the alternative (inventing a second, different format) seemed less faithful to
  the source than reusing the stated one.

Rep counts inside each accessory item were parsed from the raw string (see "Format Union
mapping" below for unit handling), e.g. `"5 high pulls"` → `{movementId: "high_pull", reps: 5}`,
`"500m row"` → `{movementId: "row", distanceM: 500}`, `"20s assault bike"` → `{movementId: "bike",
seconds: 20}`.

## Format Union mapping (judgment calls — no timing/round counts exist in the sheet)

The sheet's format column has 6 distinct strings; the domain's `Format` union has 8 members and no
"clusters" or generic "N rounds" (it has `rounds`, not "N rounds") member, so:

| sheet string     | → `Format`  | parameters (judgment call, sheet gives none) |
|------------------|-------------|------------------------------------------------|
| `AMRAP`          | `amrap`     | `durationSec` by intensity: H=600, M=1200, L=1800 (per SPEC §8, matches `intensity_levels.md`'s H=5-15min / M=15-30min / L=30+min guidance) |
| `N rounds`       | `rounds`    | `rounds` by intensity: H=3, M=4, L=5 (assumed — fewer, harder rounds at H; more, easier rounds at L) |
| `30 on 30 off`   | `interval`  | `workSec: 30, restSec: 30` (from the string itself); `rounds` by intensity: H=8, M=10, L=12 (assumed) |
| `EMOM`           | `emom`      | `intervalSec: 60`; `rounds` by intensity: H=10, M=12, L=16 (assumed) |
| `Tabata`         | `tabata`    | `rounds: 8, workSec: 20, restSec: 10` (the standard Tabata definition from `workout_formats.md`) |
| `clusters`       | `interval`  | No format in the union corresponds to "cluster sets" directly. `workout_formats.md` defines Clusters as "multiple sets with short rest periods... e.g. 5 sets of 3 reps with 30s rest" — closest existing member is `interval`. Mapped to `workSec: 45, restSec: 30, rounds` = the day's strength-progression count (or 3 if absent). **This is the least confident mapping in the seed — flag for review.** The word "clusters" is preserved in the workout `name` so it stays traceable to source. |

## Movement mapping

`movements.json` has **71 movements**: the 7 main lifts, ~50 accessory movements that appear in
the 59 distinct accessory-list item strings found across the whole sheet, plus ~14 common
movements from `project_docs/movements.md` that aren't in this particular log but round out the
library (e.g. `power_clean`, `muscle_up`, `double_unders`, `push_press`, `handstand_pushup`) —
these show up as a validator warning ("defined but never referenced"), which is expected and not
an error.

**Every one of the 59 distinct accessory strings in Sheet4 resolved to a movement** — 0 unresolved
strings, so there is no "raw rows we could not map" list. Some choices worth reviewing:

- **`pistols/lunge/side lunge`** (a main-movement value in the sheet) is a grouped label, not a
  single exercise. Modeled as one movement, `pistol_squat` ("Pistol / Lunge / Side Lunge"), with
  aliases covering all three spellings plus the standalone `"3 pistols"` accessory string. Tagged
  `diversity`. This is a simplification — the original spreadsheet meant "pick one of these three"
  for the day, which the new schema doesn't represent per-workout.
- **`5 mile bike`** (row `Unnamed:5`/`Unnamed:9` value): parsed literally as 5 miles (≈8047 m) of
  biking as an *accessory* item, which is unusually long for a supplemental block sandwiched
  between strength sets. Likely a spreadsheet-era shorthand or typo, but nothing in the source
  clarifies intent, so it was kept literal and is flagged here rather than guessed away.
- **Typos preserved as aliases, not corrected**: `"sumo deadift"` (missing "l"), `"dumbell rows"`
  (missing "b"... i.e. missing an "l"), `"seated russion twists"` ("russian" misspelled). These are
  stored as literal `aliases` on `sumo_deadlift`, `dumbbell_row`, and `russian_twist` respectively
  so future spreadsheet imports carrying the same typo still resolve.
- **Equipment gaps**: the `Equipment` union has no entry for a battle-rope or a tire specifically.
  - `battle_ropes` (from `"10s ropes"` / `"ropes"`) is given `equipment: ["none"]` — an
    approximation; ropes are in fact a piece of equipment but nothing in the union fits.
  - `tire_flip` is given `equipment: ["sled"]` as the nearest strongman-implement stand-in.
  Both are documented here rather than silently misrepresented as truly equipment-free.
- **`landmine_twist`** uses `["barbell", "landmine"]` (a landmine attachment holds a barbell, so
  both pieces of equipment are actually required).
- **Loadability defaults**: bodyweight/gymnastics movements (pull-up, dip, push-up, box step-up,
  ring row, core work, etc.) are marked `loadable: false` even though some can be weighted in
  practice (e.g. a weighted pull-up) — the sheet never logs added load for these, so the simpler
  default was kept.
- **Units**: `row` → `meters`, `run` → `meters`, `bike` → `calories` (assault-bike work is usually
  scored in calories even though the sheet's `"1 mile bike"` / `"1 minute bike"` are time/distance
  strings — the block-level `BlockMovement.seconds`/`distanceM` fields carry the actual logged
  value regardless of the movement's *default* unit, so this doesn't lose information).

## Cadence

- Compound barbell lifts (squats, deadlift variants, bench/press variants): `cadenceDays: 7`.
- Olympic lifts (clean, snatch, jerk, and their power/hang variants): `cadenceDays: 3`.
- Barbell/dumbbell/kettlebell/bodyweight accessories: `cadenceDays: 3`.
- Cardio (row, run, bike, jump rope, sprints): `cadenceDays: 1`.
- All 52 pool workouts: `cadenceDays: 14` (per SPEC §8's explicit instruction).

## Tags

- `deadlift-day`: main movement is `deadlift`, `sumo_deadlift`, or `romanian_deadlift` (8 workouts).
- `diversity`: main movement is an olympic lift (`clean`, `snatch`) or the pistol/lunge group, or
  the workout is one of the 10 extra intensity-variant entries (28 workouts — most of the "extra"
  set overlaps with clean/snatch/pistols, which is why the count is high).
- `slog`: intensity `L` **and** the conditioning block mapped to `amrap` (i.e. a 30-minute L AMRAP)
  — 3 workouts. Matches `patterns_and_rules.md`'s "monthly slog workout (long, moderate effort)".

## Other sheets

- **Sheet1** (33 rows, dated 2017 — an earlier/prototype version of the log) uses a different,
  looser 3-block text format (e.g. `"- 5 x 3 Snatch to OHS\n- 5 x 5 star shrugs with 6 skull
  crushers\n- 2000 M row"`). It was used only as a reference to confirm the block-pairing
  intuition (main lift + one paired accessory, then a separate finisher) — no rows from it were
  imported, since Sheet4 is the canonical, clean, and far larger source the spec names.
- **Sheet3** (20 rows) is a reference table of "Main Movements" paired with "Supplemental
  movements" and available formats (e.g. Deadlift → Hammer curls / KB swings / renegade
  manmakers → AMRAP). It confirmed movement-pairing and format vocabulary already inferred from
  Sheet4 and `movements.md`; no rows were imported from it directly.
- **Sheet2** (997 rows) duplicates Sheet4's content for the same dates (verified row 1: front
  squat / `30 on 30 off` / same accessories) but adds ~14 extra "look-ahead" columns previewing
  future days' plans. Since it carries no additional distinct workouts beyond Sheet4 and the task
  brief says 30-80 good entries is the target, it was not separately mined.

## Counts

- `movements.json`: 71 movements.
- `pool.json`: 52 workouts (target was 30-80; well within SPEC §8's "30-60 is plenty").
- `validate.py` run: **0 errors**, 1 informational warning (14 movements in the library that no
  pool workout currently references — expected, since they're included for library coverage per
  the task brief rather than pulled from this particular log).

## Unresolved / not confidently mapped

None outright unresolved — all 59 distinct accessory strings and all 7 main-movement strings in
Sheet4 mapped cleanly to a movement id. The items flagged above (`5 mile bike`, the `clusters`
format mapping, the `pistols/lunge/side lunge` grouping, and the `battle_ropes`/`tire_flip`
equipment approximations) are the places where a human should sanity-check the judgment call
rather than assume it's exactly right.

## Post-curation adjustment (orchestrator)

Rows with two accessory lists produce two conditioning blocks (Conditioning + Finisher). For AMRAP
workouts each block originally received the full intensity duration, doubling the session length.
The AMRAP budget is now split evenly across the AMRAP blocks: H 12 min, M 20 min, L 30 min total.
Interval and rounds blocks were left as-is (10 x 30/30 per block; H 3 / M 4 / L 5 rounds per block).
