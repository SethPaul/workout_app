#!/usr/bin/env python3
"""Apply the data-level fixes from AUDIT.md (Sections B and D) to movements.json
and pool.json. Stdlib only. Idempotent: every rule checks current state before
writing, so running this twice produces the same result as running it once.

Usage:
    python3 revise.py <seed_dir>

<seed_dir> must contain movements.json and pool.json. Both files are read,
patched in memory, and written back to the SAME directory. Per the audit
instructions this script must be tested against COPIES (e.g. in the scratch
directory), never against the real app/seed/ directly, until a human has
reviewed AUDIT.md and approved applying it.

Prints a change summary (counts per rule) and exits 0. Does not itself run
validate.py -- run that separately against the same directory afterward.
"""
import copy
import json
import os
import sys

# --------------------------------------------------------------------------
# Rule tables (see AUDIT.md Section A/B for the evidence citations)
# --------------------------------------------------------------------------

# R-A: strength-block rest interval by main-lift character.
OLY_MAIN_LIFTS = {"clean", "snatch", "overhead_squat"}          # R6: 2-5min -> 240s
BARBELL_MAIN_LIFTS = {"back_squat", "front_squat", "deadlift",   # R3: 2-3+min -> 180s
                      "sumo_deadlift"}

# R-B: single-set ("1x5") strength blocks are not a real stimulus.
OLY_BUMP_SETS = 3     # Prilepin-consistent (3x3) for clean/snatch/overhead_squat
BARBELL_BUMP_SETS = 5  # standard 5x5 for other loadable barbell main lifts
PISTOL_BUMP_SETS = 5   # consistency bump only (bodyweight, not an R1 fix)

# R-C: box_jump is a high-force plyo movement that never appears fresh in this
# pool (always inside a fatigued conditioning block) -- replace pool-wide.
PLYO_REPLACEMENT = {"box_jump": "step_up"}

# R-D: barbell classic lifts / heavy hinge-squat lifts inside a fatigued block
# (i.e. NOT the dedicated 'Strength' block) get their reps capped and a load
# note added, per R7-R9's "drop load sharply under fatigue" guidance.
FATIGUE_RISK_LIFTS = {
    "clean", "snatch", "jerk", "power_clean", "power_snatch", "hang_clean",
    "deadlift", "sumo_deadlift",
}
FATIGUE_REP_CAP = 3
FATIGUE_LOAD_NOTE = "cap ≤60-70% 1RM under fatigue, technique focus (R8/R9)"

# R-J: clean/snatch main-lift reps must follow Prilepin (1-3 reps/set for
# classic lifts, R5), and total volume must stay inside the 18-30 total-lift
# band at 70-80%1RM -- so cap sets at 6 as well.
OLY_MAIN_LIFT_REPS = {"clean", "snatch"}
OLY_MAIN_LIFT_REPS_TARGET = 3
OLY_MAIN_LIFT_SETS_CAP = 6

# R-E: targeted pattern-stack substitutions for the 8 workouts profile.md
# flags at >=50% pattern-matching conditioning (Finding 6 / R21). Also used
# to simultaneously resolve an R7/R8 fatigue instance where the swapped-out
# movement was a FATIGUE_RISK_LIFTS entry (e.g. r33's snatch->kb_swing).
# Each entry: (workout_id, block_title, old_movement_id, new_movement_id,
#              which_occurrence) -- which_occurrence picks the Nth (0-based)
# BlockMovement with old_movement_id inside that block, so a duplicate
# (e.g. two side_lunge entries) can be targeted precisely.
PATTERN_STACK_FIXES = [
    ("sheet4-r73-back-squat-30-on-30-off", "Finisher", "lunge", "dumbbell_row", 0),
    ("sheet4-r24-clean-emom", "Conditioning", "star_shrug", "battle_ropes", 0),
    ("sheet4-r177-clean-clusters", "Conditioning", "bent_over_row", "landmine_twist", 0),
    ("sheet4-r33-overhead-squat-clusters", "Conditioning", "snatch", "kb_swing", 0),
    ("sheet4-r157-snatch-30-on-30-off", "Conditioning", "hammer_curl", "landmine_twist", 0),
    ("sheet4-r12-snatch-emom", "Conditioning", "kb_snatch", "kb_swing", 0),
    ("sheet4-r128-snatch-amrap", "Conditioning", "bent_over_row", "skull_crusher", 0),
]

# R-K: exact-duplicate BlockMovement entries within one block (a data-quality
# artifact of the spreadsheet import, not itself a training-evidence rule,
# but fixed here because it's a mechanical, low-risk change and several
# coincide with an R21 pattern-stack fix). Each entry: (workout_id,
# block_title, movement_id_to_dedupe, replacement_for_the_SECOND_occurrence).
DUPLICATE_FIXES = [
    ("sheet4-r35-front-squat-amrap", "Finisher", "bent_over_row", "dumbbell_row"),
    ("sheet4-r28-pistol-squat-n-rounds", "Finisher", "side_lunge", "dumbbell_row"),
    ("sheet4-r273-snatch-clusters", "Finisher", "side_lunge", "farmers_carry"),
    ("sheet4-r40-back-squat-n-rounds", "Finisher", "bent_over_row", "dumbbell_row"),
    ("sheet4-r235-clean-emom", "Finisher", "side_lunge", "mountain_climber"),
]

# Misc single data-quality fix: a "5 mile bike" (8047m) accessory item inside
# a 4-round "N rounds" block is an unrealistic outlier the README itself
# flags as likely a spreadsheet-era error. Bring it down to a sane distance.
BIKE_DISTANCE_FIX = ("sheet4-r16-overhead-squat-n-rounds", "Conditioning", 8047, 1609)

# Drop: unsalvageable via mechanical fixes (R1/R2 1x5 + R25 4.5min session).
DROP_WORKOUT_IDS = {"sheet4-r69-back-squat-clusters"}

# R-F: additive day-type tags (Section C2) -- purely additive, never removes
# an existing tag. Helps a future weekly-structure gate actually find these.
DAY_TAG_BY_MAIN_LIFT = {
    "clean": "day:oly-power",
    "snatch": "day:oly-power",
}
DEADLIFT_DAY_EXTRA_TAG = "day:hinge-strength"
SQUAT_STRENGTH_EXTRA_TAG = "day:squat-strength"


def main_lift_movement_id(workout):
    for b in workout.get("blocks", []):
        if b.get("title") == "Strength" and b.get("movements"):
            return b["movements"][0].get("movementId")
    return None


def find_block(workout, title):
    for b in workout.get("blocks", []):
        if b.get("title") == title:
            return b
    return None


# --------------------------------------------------------------------------
# New movement + new workouts (AUDIT.md Section D)
# --------------------------------------------------------------------------

NEW_MOVEMENTS = [
    {
        "id": "weighted_pullup",
        "name": "Weighted Pull-up",
        "aliases": ["weighted pull up", "weighted pullups", "weighted pull-up"],
        "tags": ["compound", "pull"],
        "equipment": ["pullup_bar"],
        "cadenceDays": 7,
        "unit": "reps",
        "loadable": True,
    },
]

NEW_WORKOUTS = [
    {
        "id": "new-deadlift-pushpress-day",
        "name": "Deadlift + Push Press (mandatory day)",
        "intensity": "H",
        "blocks": [
            {
                "format": "strength",
                "title": "Strength",
                "movements": [{"movementId": "deadlift", "reps": 5, "loadNote": "70-85% 1RM"}],
                "sets": 5,
                "restSec": 180,
            },
            {
                "format": "strength",
                "title": "Strength",
                "movements": [{"movementId": "push_press", "reps": 3, "loadNote": "75-85% 1RM"}],
                "sets": 4,
                "restSec": 180,
            },
            {
                "format": "rounds",
                "title": "Finisher",
                "movements": [
                    {"movementId": "plank", "seconds": 30},
                    {"movementId": "dead_bug", "reps": 10},
                ],
                "rounds": 3,
            },
        ],
        "cadenceDays": 14,
        "enabled": True,
        "tags": ["day:deadlift-press", "mandatory"],
        "source": "manual",
        "notes": (
            "Warm-up: 8-10 min easy row/bike + barbell-only ramp-up sets before the "
            "Deadlift block. Per R26, keep >=48h from any other heavy hinge or heavy "
            "overhead-press session; treat the next day as lower-intensity/rest (R21)."
        ),
    },
    {
        "id": "new-bench-press-day",
        "name": "Bench Press strength day",
        "intensity": "M",
        "blocks": [
            {
                "format": "strength",
                "title": "Strength",
                "movements": [{"movementId": "bench_press", "reps": 5, "loadNote": "75-85% 1RM"}],
                "sets": 5,
                "restSec": 180,
            },
            {
                "format": "strength",
                "title": "Accessory",
                "movements": [{"movementId": "bent_over_row", "reps": 8}],
                "sets": 3,
                "restSec": 90,
            },
            {
                "format": "interval",
                "title": "Finisher",
                "movements": [{"movementId": "row", "distanceM": 250}],
                "workSec": 30,
                "restSec": 30,
                "rounds": 6,
            },
        ],
        "cadenceDays": 14,
        "enabled": True,
        "tags": ["day:strength"],
        "source": "manual",
        "notes": "Warm-up: 8-10 min general + bar-only bench ramp-up sets.",
    },
    {
        "id": "new-weighted-pullup-day",
        "name": "Weighted Pull-up strength day",
        "intensity": "M",
        "blocks": [
            {
                "format": "strength",
                "title": "Strength",
                "movements": [
                    {"movementId": "weighted_pullup", "reps": 5, "loadNote": "RPE 7-8 (R28)"}
                ],
                "sets": 5,
                "restSec": 180,
            },
            {
                "format": "strength",
                "title": "Accessory",
                "movements": [{"movementId": "dip", "reps": 8}],
                "sets": 3,
                "restSec": 90,
            },
            {
                "format": "rounds",
                "title": "Finisher",
                "movements": [{"movementId": "farmers_carry", "reps": 1}],
                "rounds": 4,
            },
        ],
        "cadenceDays": 14,
        "enabled": True,
        "tags": ["day:strength"],
        "source": "manual",
        "notes": "Warm-up: 8-10 min general + dead-hang/scap-pull activation.",
    },
    {
        "id": "new-power-clean-day",
        "name": "Power Clean + Front Squat (olympic power day)",
        "intensity": "H",
        "blocks": [
            {
                "format": "emom",
                "title": "Power",
                "movements": [
                    {"movementId": "power_clean", "reps": 2, "loadNote": "65-75% 1RM, technique focus"}
                ],
                "intervalSec": 60,
                "rounds": 10,
            },
            {
                "format": "strength",
                "title": "Strength",
                "movements": [{"movementId": "front_squat", "reps": 5, "loadNote": "75-85% 1RM"}],
                "sets": 5,
                "restSec": 180,
            },
            {
                "format": "rounds",
                "title": "Finisher",
                "movements": [
                    {"movementId": "kb_swing", "reps": 10},
                    {"movementId": "push_up", "reps": 8},
                ],
                "rounds": 3,
            },
        ],
        "cadenceDays": 14,
        "enabled": True,
        "tags": ["day:oly-power"],
        "source": "manual",
        "notes": (
            "Warm-up: 8-10 min general + empty-bar clean pulls/front-rack mobility. "
            "Power block goes first per R7/R24 (peak neural precision before fatigue)."
        ),
    },
    {
        "id": "new-zone2-row",
        "name": "Zone 2 Row (monthly slog)",
        "intensity": "L",
        "blocks": [
            {
                "format": "interval",
                "title": "Conditioning",
                "movements": [
                    {
                        "movementId": "row",
                        "distanceM": 7000,
                        "loadNote": "conversational pace, 65-75% HRmax (R15)",
                    }
                ],
                "workSec": 1800,
                "restSec": 0,
                "rounds": 1,
            },
        ],
        "cadenceDays": 30,
        "enabled": True,
        "tags": ["day:zone2", "slog"],
        "source": "manual",
        "notes": "Warm-up is built into the first 5 min of the row at an easy pace.",
    },
    {
        "id": "new-norwegian-4x4-bike",
        "name": "Norwegian 4x4 Bike Intervals",
        "intensity": "H",
        "blocks": [
            {
                "format": "interval",
                "title": "Conditioning",
                "movements": [
                    {"movementId": "bike", "seconds": 240, "loadNote": "90-95% HRmax (R13)"}
                ],
                "workSec": 240,
                "restSec": 180,
                "rounds": 4,
            },
        ],
        "cadenceDays": 7,
        "enabled": True,
        "tags": ["day:zone2", "hiit"],
        "source": "manual",
        "notes": "Warm-up: 10 min easy bike before round 1. 3 min active recovery pedal between rounds.",
    },
    {
        "id": "new-tabata-bike",
        "name": "True Tabata Bike Protocol",
        "intensity": "H",
        "blocks": [
            {
                "format": "tabata",
                "title": "Conditioning",
                "movements": [
                    {"movementId": "bike", "seconds": 20, "loadNote": "supramaximal effort (R12)"}
                ],
                "rounds": 8,
                "workSec": 20,
                "restSec": 10,
            },
        ],
        "cadenceDays": 7,
        "enabled": True,
        "tags": ["day:hiit"],
        "source": "manual",
        "notes": (
            "Warm-up: 5-8 min easy bike. Single movement only, supramaximal intensity -- "
            "this is the actual validated Tabata protocol (R12), unlike the pool's other "
            "mixed-movement 20/10 circuits."
        ),
    },
]


# --------------------------------------------------------------------------
# Change log
# --------------------------------------------------------------------------

changes = []


def log(rule, msg):
    changes.append((rule, msg))


# --------------------------------------------------------------------------
# Rule application
# --------------------------------------------------------------------------

def apply_rest_and_set_fixes(workout):
    """R-A, R-B, R-J on the workout's dedicated 'Strength' block(s)."""
    wid = workout["id"]
    for b in workout.get("blocks", []):
        if b.get("format") != "strength" or b.get("title") != "Strength":
            continue
        if not b.get("movements"):
            continue
        mid = b["movements"][0].get("movementId")

        # R-J: clean/snatch main-lift reps -> Prilepin-consistent 3, sets capped at 6.
        if mid in OLY_MAIN_LIFT_REPS:
            bm = b["movements"][0]
            if bm.get("reps") != OLY_MAIN_LIFT_REPS_TARGET:
                old = bm.get("reps")
                bm["reps"] = OLY_MAIN_LIFT_REPS_TARGET
                log("R-J", f"{wid}: main lift {mid} reps {old}->{OLY_MAIN_LIFT_REPS_TARGET}/set (R5)")
            if isinstance(b.get("sets"), (int, float)) and b["sets"] > OLY_MAIN_LIFT_SETS_CAP:
                old = b["sets"]
                b["sets"] = OLY_MAIN_LIFT_SETS_CAP
                log("R-J", f"{wid}: main lift {mid} sets {old}->{OLY_MAIN_LIFT_SETS_CAP} (R5 volume cap)")

        # R-B: single-set strength blocks get bumped to a real dose.
        if b.get("sets") == 1:
            if mid in OLY_MAIN_LIFTS or mid in OLY_MAIN_LIFT_REPS:
                target = OLY_BUMP_SETS
            elif mid == "pistol_squat":
                target = PISTOL_BUMP_SETS
            else:
                target = BARBELL_BUMP_SETS
            b["sets"] = target
            log("R-B", f"{wid}: main lift {mid} sets 1->{target} (R1/R2)")

        # R-A: rest interval by main-lift character. pistol_squat exempt (R11).
        if b.get("restSec") == 90:
            if mid in OLY_MAIN_LIFTS or mid in OLY_MAIN_LIFT_REPS:
                b["restSec"] = 240
                log("R-A", f"{wid}: main lift {mid} restSec 90->240 (R6)")
            elif mid in BARBELL_MAIN_LIFTS:
                b["restSec"] = 180
                log("R-A", f"{wid}: main lift {mid} restSec 90->180 (R3)")
            # pistol_squat (bodyweight accessory): no change, R11 already satisfied.


def apply_plyo_replacement(workout):
    """R-C: box_jump -> step_up, pool-wide, in every block (never the dedicated
    strength block since box_jump never appears there)."""
    wid = workout["id"]
    for b in workout.get("blocks", []):
        for bm in b.get("movements", []):
            old_id = bm.get("movementId")
            if old_id in PLYO_REPLACEMENT:
                bm["movementId"] = PLYO_REPLACEMENT[old_id]
                log("R-C", f"{wid}: {b.get('title')} block {old_id}->{PLYO_REPLACEMENT[old_id]} (R23)")


def apply_fatigue_rep_cap(workout):
    """R-D: barbell classic/heavy lifts inside a non-'Strength' block get reps
    capped and a load note, per R7-R9."""
    wid = workout["id"]
    for b in workout.get("blocks", []):
        if b.get("title") == "Strength":
            continue
        for bm in b.get("movements", []):
            mid = bm.get("movementId")
            if mid not in FATIGUE_RISK_LIFTS:
                continue
            reps = bm.get("reps")
            if isinstance(reps, (int, float)) and reps > FATIGUE_REP_CAP:
                bm["reps"] = FATIGUE_REP_CAP
                bm["loadNote"] = FATIGUE_LOAD_NOTE
                log("R-D", f"{wid}: {b.get('title')} block {mid} reps {reps}->{FATIGUE_REP_CAP} + loadNote (R7/R8/R9)")
            elif "loadNote" not in bm:
                # already <=3 reps but still no load-drop note (R8's explicit ask)
                bm["loadNote"] = FATIGUE_LOAD_NOTE
                log("R-D", f"{wid}: {b.get('title')} block {mid} loadNote added (R8)")


def apply_pattern_stack_fixes(pool_by_id):
    for wid, block_title, old_mid, new_mid, occurrence in PATTERN_STACK_FIXES:
        w = pool_by_id.get(wid)
        if not w:
            continue
        b = find_block(w, block_title)
        if not b:
            continue
        seen = 0
        for bm in b.get("movements", []):
            if bm.get("movementId") == old_mid:
                if seen == occurrence:
                    bm["movementId"] = new_mid
                    log("R-E", f"{wid}: {block_title} block {old_mid}->{new_mid} (R21 pattern-stack fix)")
                    break
                seen += 1


def apply_duplicate_fixes(pool_by_id):
    for wid, block_title, dup_mid, replacement in DUPLICATE_FIXES:
        w = pool_by_id.get(wid)
        if not w:
            continue
        b = find_block(w, block_title)
        if not b:
            continue
        seen = 0
        for bm in b.get("movements", []):
            if bm.get("movementId") == dup_mid:
                seen += 1
                if seen == 2:
                    bm["movementId"] = replacement
                    log("R-K", f"{wid}: {block_title} block duplicate {dup_mid} (2nd) -> {replacement}")
                    break


def apply_bike_distance_fix(pool_by_id):
    wid, block_title, old_dist, new_dist = BIKE_DISTANCE_FIX
    w = pool_by_id.get(wid)
    if not w:
        return
    b = find_block(w, block_title)
    if not b:
        return
    for bm in b.get("movements", []):
        if bm.get("movementId") == "bike" and bm.get("distanceM") == old_dist:
            bm["distanceM"] = new_dist
            log("data-fix", f"{wid}: {block_title} block bike distanceM {old_dist}->{new_dist} (README-flagged outlier)")


def apply_drop(pool_by_id):
    for wid in DROP_WORKOUT_IDS:
        w = pool_by_id.get(wid)
        if w and w.get("enabled") is not False:
            w["enabled"] = False
            log("drop", f"{wid}: enabled -> false (R1/R2 1x5 + R25 4.5min session, unsalvageable)")


def apply_day_tags(workout):
    """R-F: additive day-type tags. Never removes an existing tag."""
    wid = workout["id"]
    tags = workout.setdefault("tags", [])
    mid = main_lift_movement_id(workout)

    if mid in DAY_TAG_BY_MAIN_LIFT:
        tag = DAY_TAG_BY_MAIN_LIFT[mid]
        if tag not in tags:
            tags.append(tag)
            log("R-F", f"{wid}: + tag '{tag}'")
        return

    if "deadlift-day" in tags:
        if DEADLIFT_DAY_EXTRA_TAG not in tags:
            tags.append(DEADLIFT_DAY_EXTRA_TAG)
            log("R-F", f"{wid}: + tag '{DEADLIFT_DAY_EXTRA_TAG}'")
        return

    if mid in {"back_squat", "front_squat", "overhead_squat"} and "diversity" not in tags:
        if SQUAT_STRENGTH_EXTRA_TAG not in tags:
            tags.append(SQUAT_STRENGTH_EXTRA_TAG)
            log("R-F", f"{wid}: + tag '{SQUAT_STRENGTH_EXTRA_TAG}'")


def apply_new_content(movements, pool):
    existing_movement_ids = {m["id"] for m in movements}
    for nm in NEW_MOVEMENTS:
        if nm["id"] not in existing_movement_ids:
            movements.append(copy.deepcopy(nm))
            log("D", f"movements.json: + movement '{nm['id']}'")

    existing_workout_ids = {w["id"] for w in pool}
    for nw in NEW_WORKOUTS:
        if nw["id"] not in existing_workout_ids:
            pool.append(copy.deepcopy(nw))
            log("D", f"pool.json: + workout '{nw['id']}'")


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def revise(seed_dir):
    movements_path = os.path.join(seed_dir, "movements.json")
    pool_path = os.path.join(seed_dir, "pool.json")

    with open(movements_path) as f:
        movements = json.load(f)
    with open(pool_path) as f:
        pool = json.load(f)

    # Movement-identity substitutions (R-E pattern-stack fixes, R-K duplicate
    # fixes, the bike-distance data fix) run BEFORE the fatigue-rep-cap rule
    # (R-D), so a lift that gets swapped out for a non-barbell derivative
    # (e.g. r33's snatch -> kb_swing) is judged by what it becomes, not what
    # it used to be -- otherwise kb_swing would incorrectly inherit a
    # "cap <=60-70% 1RM" note meant for the barbell lift it replaced.
    pool_by_id = {w["id"]: w for w in pool}
    apply_pattern_stack_fixes(pool_by_id)
    apply_duplicate_fixes(pool_by_id)
    apply_bike_distance_fix(pool_by_id)
    apply_drop(pool_by_id)

    for w in pool:
        apply_rest_and_set_fixes(w)
        apply_plyo_replacement(w)
        apply_fatigue_rep_cap(w)

    # New content must be appended BEFORE day-tagging, so tagging is applied
    # uniformly to the final pool (legacy + new) on every run regardless of
    # whether this is the first or a later pass -- otherwise a first-run
    # "add workout" and a later-run "add its day tag" would happen on
    # different passes, breaking idempotency (a rerun would find one more
    # change than a from-scratch run).
    apply_new_content(movements, pool)

    for w in pool:
        apply_day_tags(w)

    with open(movements_path, "w") as f:
        json.dump(movements, f, indent=2)
        f.write("\n")
    with open(pool_path, "w") as f:
        json.dump(pool, f, indent=2)
        f.write("\n")

    return movements, pool


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 revise.py <seed_dir>", file=sys.stderr)
        sys.exit(2)
    seed_dir = sys.argv[1]

    revise(seed_dir)

    print("=== revise.py change summary ===")
    by_rule = {}
    for rule, msg in changes:
        by_rule.setdefault(rule, []).append(msg)

    total = len(changes)
    for rule in sorted(by_rule):
        print(f"\n[{rule}] {len(by_rule[rule])} change(s)")
        for msg in by_rule[rule]:
            print(f"  - {msg}")

    print(f"\nTOTAL: {total} change(s) across {len(by_rule)} rule categories")
    if total == 0:
        print("(no changes -- already applied; script is idempotent)")


if __name__ == "__main__":
    main()
