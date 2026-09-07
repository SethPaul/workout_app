#!/usr/bin/env python3
"""
Quantitative profile of app/seed/pool.json against app/seed/movements.json.

Schema reference: app/SPEC.md section 2 (PoolWorkout / Block / Movement).
Numbers only -- no editorial judgment except where noted under PATTERN
MAPPING EXTENSIONS below (movement tags don't fully determine a movement-
pattern for a handful of movements, so those are pinned by movement id).

Run: python3 profile.py > profile.md
"""
import json
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
POOL_PATH = os.path.join(HERE, "pool.json")
MOVES_PATH = os.path.join(HERE, "movements.json")

PATTERNS = ["squat", "hinge", "push", "pull", "olympic", "core", "cardio", "plyo"]

# --- PATTERN MAPPING ---------------------------------------------------
# Base rule: a movement tag maps directly to a pattern of the same name.
# Extension #1: tag 'legs' -> 'squat'. The Movement.tags vocabulary in
#   SPEC.md has no dedicated lower-body/leg-day pattern; every 'legs'
#   tagged movement in this pool (lunges, box jumps, step-ups, sled push,
#   thrusters, wall balls, pistol/lunge/side lunge) is leg-drive work, so
#   it is folded into 'squat' for this 8-pattern taxonomy.
# Extension #2: tag 'carry' -> 'core'. Loaded-carry work (farmer's carry,
#   and additively sled push via its 'carry' tag) is core/trunk-stability
#   dominant with no better home in the 8 patterns.
TAG_TO_PATTERN = {
    "squat": "squat", "legs": "squat",
    "hinge": "hinge",
    "push": "push",
    "pull": "pull",
    "olympic": "olympic",
    "core": "core", "carry": "core",
    "cardio": "cardio",
    "plyo": "plyo",
}

# Extension #3: by-movement-id overrides. These 5 movements carry only
# tags ('accessory', 'compound') that don't resolve to any of the 8
# patterns via TAG_TO_PATTERN, so the mapping is extended by judgment:
#   bar_complex        -> hinge   (barbell complexes here are built off a
#                                   deadlift/high-pull chain)
#   sandbag_drop        -> hinge   (loaded hinge-and-drop movement)
#   tire_flip           -> hinge   (loaded hip-hinge flip)
#   renegade_manmaker    -> pull    (renegade row is the signature element)
#   turkish_getup        -> core    (total-body stability/anti-rotation move)
ID_OVERRIDE_PATTERN = {
    "bar_complex": "hinge",
    "sandbag_drop": "hinge",
    "tire_flip": "hinge",
    "renegade_manmaker": "pull",
    "turkish_getup": "core",
}

OLYMPIC_LIFT_IDS = {"clean", "power_clean", "hang_clean", "snatch", "power_snatch", "kb_snatch"}
PLYO_IDS = {"box_jump", "box_jump_over", "broad_jump", "burpee"}


def load_data():
    with open(POOL_PATH) as f:
        pool = json.load(f)
    with open(MOVES_PATH) as f:
        moves = json.load(f)
    return pool, {m["id"]: m for m in moves}


def movement_patterns(mv):
    """Return the set of patterns a movement contributes to."""
    if mv["id"] in ID_OVERRIDE_PATTERN:
        return {ID_OVERRIDE_PATTERN[mv["id"]]}
    pats = {TAG_TO_PATTERN[t] for t in mv["tags"] if t in TAG_TO_PATTERN}
    return pats


def block_movement_reps(bm, block):
    """Estimate total reps contributed by one BlockMovement across the block."""
    reps = bm.get("reps")
    if reps is None:
        return 0  # distance/calorie/seconds-only entries carry no rep count
    fmt = block["format"]
    if fmt == "strength":
        return reps * (block.get("sets") or 1)
    if fmt in ("emom", "interval", "rounds", "tabata"):
        rounds = block.get("rounds") or (8 if fmt == "tabata" else 1)
        return reps * rounds
    if fmt == "amrap":
        # Can't know actual rounds completed; report reps-per-round-through
        # the movement list once as a lower bound / cannot compute total.
        return None
    return reps


def strength_block(workout):
    for b in workout["blocks"]:
        if b["format"] == "strength":
            return b
    return None


def main_lift_id(workout):
    sb = strength_block(workout)
    return sb["movements"][0]["movementId"] if sb else None


def estimate_block_minutes(block):
    fmt = block["format"]
    if fmt == "strength":
        sets = block.get("sets") or 1
        rest = block.get("restSec") or 0
        return sets * (30 + rest) / 60.0
    if fmt == "emom":
        interval = block.get("intervalSec") or 60
        rounds = block.get("rounds") or 1
        return interval * rounds / 60.0
    if fmt == "tabata":
        rounds = block.get("rounds") or 8
        work = block.get("workSec") or 20
        rest = block.get("restSec") or 10
        n_mv = max(len(block["movements"]), 1)
        return n_mv * rounds * (work + rest) / 60.0
    if fmt == "interval":
        rounds = block.get("rounds") or 1
        work = block.get("workSec") or 30
        rest = block.get("restSec") or 30
        return rounds * (work + rest) / 60.0
    if fmt == "amrap":
        return (block.get("durationSec") or 0) / 60.0
    if fmt == "rounds":
        rounds = block.get("rounds") or 1
        n_mv = max(len(block["movements"]), 1)
        return rounds * n_mv * 60 / 60.0  # ~60s per movement per round
    if fmt == "chipper":
        n_mv = max(len(block["movements"]), 1)
        return n_mv * 60 / 60.0
    if fmt == "death_by":
        return 0.0  # open-ended; not present in this pool
    return 0.0


def format_strength_summary(block):
    sets = block.get("sets")
    reps = block["movements"][0].get("reps")
    rest = block.get("restSec")
    return f"{sets}x{reps}, rest {rest}s"


def format_cond_summary(block):
    fmt = block["format"]
    if fmt == "emom":
        return f"EMOM {block.get('intervalSec',60)}s x {block.get('rounds')} rounds"
    if fmt == "tabata":
        return f"Tabata {block.get('rounds',8)} x ({block.get('workSec',20)}on/{block.get('restSec',10)}off)"
    if fmt == "interval":
        return f"Interval {block.get('rounds')} x ({block.get('workSec')}on/{block.get('restSec')}off)"
    if fmt == "amrap":
        return f"AMRAP {block.get('durationSec')}s"
    if fmt == "rounds":
        return f"{block.get('rounds')} rounds for time"
    if fmt == "chipper":
        return "Chipper (for time)"
    if fmt == "death_by":
        return "Death by"
    return fmt


def main():
    pool, moves = load_data()
    move_ids = set(moves.keys())

    lines = []
    def p(s=""):
        lines.append(s)

    p("# Workout Pool Quantitative Profile")
    p()
    p(f"Pool size: {len(pool)} workouts. Movement library: {len(moves)} movements.")
    p()
    p("Pattern-mapping extensions used (tags in `movements.json` don't fully")
    p("determine a pattern on their own):")
    p("- tag `legs` counted as pattern **squat** (no dedicated leg-day pattern in the 8-pattern taxonomy)")
    p("- tag `carry` counted as pattern **core** (loaded-carry work is trunk-stability dominant)")
    p("- by movement id (tags are `accessory`/`compound` only, no pattern tag present):")
    p("  `bar_complex`->hinge, `sandbag_drop`->hinge, `tire_flip`->hinge, `renegade_manmaker`->pull, `turkish_getup`->core")
    p()

    # ---------------- Per-workout section ----------------
    p("## Per-workout detail")
    p()

    agg_strength_scheme = Counter()
    agg_rest = Counter()
    agg_pattern_movecount = Counter()
    agg_pattern_repcount = Counter()
    total_minutes_list = []
    over_60 = []
    under_20 = []
    oly_or_plyo_under_time_pressure = []
    main_lift_pattern_match = []
    main_lift_patterns_used = set()
    movement_appearance = Counter()
    movement_as_main_lift = Counter()
    main_lift_cadence = {}
    main_lift_pattern_of = {}

    for w in pool:
        p(f"### {w['id']}")
        p(f"- name: {w['name']}")
        p(f"- intensity: {w['intensity']}")

        sb = strength_block(w)
        if sb is None:
            # Conditioning-only workout (e.g. Zone 2, 4x4, single-movement Tabata): use the first movement
            # of the first block as the "main" movement and skip strength aggregates.
            main_id = w["blocks"][0]["movements"][0]["movementId"]
            main_mv = moves[main_id]
            sets = reps = rest = total_heavy_reps = 0
            p(f"- main lift: none (conditioning-only); first movement {main_id} ({main_mv['name']})")
        else:
            main_id = sb["movements"][0]["movementId"]
            main_mv = moves[main_id]
            sets = sb.get("sets") or 1
            reps = sb["movements"][0].get("reps") or 0
            rest = sb.get("restSec") or 0
            total_heavy_reps = sets * reps
            p(f"- main lift: {main_id} ({main_mv['name']}) -- {sets}x{reps}, rest {rest}s between sets, {total_heavy_reps} total heavy reps")
            agg_strength_scheme[f"{sets}x{reps}"] += 1
            agg_rest[rest] += 1
        movement_appearance[main_id] += 1
        movement_as_main_lift[main_id] += 1
        main_lift_pattern_of[main_id] = movement_patterns(main_mv)
        if main_id not in main_lift_cadence:
            main_lift_cadence[main_id] = main_mv["cadenceDays"]
        main_lift_patterns_used |= movement_patterns(main_mv)

        total_minutes = estimate_block_minutes(sb) if sb else 0.0

        cond_blocks = [b for b in w["blocks"] if b["format"] != "strength"]
        cond_pattern_ids = set()
        has_oly_or_plyo_time_pressure = False
        for b in cond_blocks:
            mv_names = []
            for bm in b["movements"]:
                mid = bm["movementId"]
                mv_names.append(mid)
                movement_appearance[mid] += 1
                if mid in OLYMPIC_LIFT_IDS or mid in PLYO_IDS:
                    if b["format"] in ("emom", "tabata", "interval", "amrap"):
                        has_oly_or_plyo_time_pressure = True
                mv = moves[mid]
                for pat in movement_patterns(mv):
                    cond_pattern_ids.add(pat)
                    agg_pattern_movecount[pat] += 1
                    r = block_movement_reps(bm, b)
                    if r:
                        agg_pattern_repcount[pat] += r
            p(f"- conditioning [{b.get('title','')}]: {format_cond_summary(b)} -- movements: {', '.join(mv_names)}")
            total_minutes += estimate_block_minutes(b)

        # also count main lift movement into pattern table
        for pat in movement_patterns(main_mv):
            agg_pattern_movecount[pat] += 1
            agg_pattern_repcount[pat] += total_heavy_reps

        p(f"- estimated total session minutes: {round(total_minutes,1)}")
        p()

        total_minutes_list.append((w["id"], total_minutes))
        if total_minutes > 60:
            over_60.append((w["id"], round(total_minutes, 1)))
        if total_minutes < 20:
            under_20.append((w["id"], round(total_minutes, 1)))
        if has_oly_or_plyo_time_pressure:
            oly_or_plyo_under_time_pressure.append(w["id"])

        main_pat = movement_patterns(main_mv)
        cond_movement_total = 0
        cond_movement_matching = 0
        for b in cond_blocks:
            for bm in b["movements"]:
                cond_movement_total += 1
                if movement_patterns(moves[bm["movementId"]]) & main_pat:
                    cond_movement_matching += 1
        match_ratio = (cond_movement_matching / cond_movement_total) if cond_movement_total else 0.0
        if match_ratio >= 0.5:
            main_lift_pattern_match.append((w["id"], round(match_ratio, 2)))

    # ---------------- Aggregates ----------------
    p("## Aggregates")
    p()

    p("### Strength set/rep scheme distribution (sets x reps)")
    for k, v in sorted(agg_strength_scheme.items(), key=lambda x: -x[1]):
        p(f"- {k}: {v} workouts")
    p()

    p("### Strength rest intervals used")
    for k, v in sorted(agg_rest.items()):
        p(f"- {k}s: {v} workouts")
    p()

    p(f"### Workouts whose conditioning includes an olympic lift or plyo movement under time pressure (emom/tabata/interval/amrap)")
    p(f"- count: {len(oly_or_plyo_under_time_pressure)} / {len(pool)}")
    for wid in oly_or_plyo_under_time_pressure:
        p(f"  - {wid}")
    p()

    p("### Workouts where conditioning pattern load matches the main lift's pattern (>=50% of conditioning")
    p("### movement-instances share a pattern with the main lift, e.g. squat main lift + lunges + box jumps)")
    p(f"- count: {len(main_lift_pattern_match)} / {len(pool)}")
    for wid, ratio in main_lift_pattern_match:
        p(f"  - {wid}: {int(ratio*100)}% pattern-matching conditioning")
    p()

    p("### Session length outliers")
    p(f"- sessions over 60 min (estimated): {len(over_60)}")
    for wid, m in over_60:
        p(f"  - {wid}: {m} min")
    p(f"- sessions under 20 min (estimated): {len(under_20)}")
    for wid, m in under_20:
        p(f"  - {wid}: {m} min")
    all_min = [m for _, m in total_minutes_list]
    p(f"- min: {round(min(all_min),1)}  max: {round(max(all_min),1)}  mean: {round(sum(all_min)/len(all_min),1)}")
    p()

    p("### Main-lift pattern coverage")
    never_main = sorted(set(PATTERNS) - main_lift_patterns_used)
    p(f"- patterns used as a main lift: {sorted(main_lift_patterns_used)}")
    p(f"- patterns NEVER used as a main lift: {never_main if never_main else 'none'}")
    p()

    p("### Movements in the pool that never appear as a main lift")
    used_movement_ids = {mid for mid in movement_appearance}
    never_main_lift_movements = sorted(used_movement_ids - set(movement_as_main_lift))
    p(f"- count: {len(never_main_lift_movements)} / {len(used_movement_ids)} movements used in the pool")
    for mid in never_main_lift_movements:
        p(f"  - {mid}")
    p()

    p("### Per-movement appearance counts (main lift + conditioning, across whole pool)")
    for mid, c in sorted(movement_appearance.items(), key=lambda x: (-x[1], x[0])):
        tag = " [main-lift-capable]" if mid in movement_as_main_lift else ""
        p(f"- {mid}: {c}{tag}")
    p()

    p("### Per-pattern appearance counts across the pool (movement-instances, not unique movements)")
    for pat in PATTERNS:
        p(f"- {pat}: {agg_pattern_movecount.get(pat,0)} movement-appearances, {agg_pattern_repcount.get(pat,0)} total reps (where rep-countable)")
    p()

    p("### Cadence settings per main lift, and which main lifts share a pattern")
    pattern_to_lifts = defaultdict(list)
    for mid, pats in main_lift_pattern_of.items():
        for pat in pats:
            pattern_to_lifts[pat].append(mid)
    for mid in sorted(main_lift_cadence):
        pats = sorted(main_lift_pattern_of[mid])
        p(f"- {mid}: cadenceDays={main_lift_cadence[mid]}, pattern(s)={pats}")
    p()
    p("Main lifts sharing a pattern (same-pattern days could be scheduled back-to-back under per-movement cadence alone):")
    for pat, lifts in pattern_to_lifts.items():
        uniq = sorted(set(lifts))
        if len(uniq) > 1:
            p(f"- {pat}: {uniq}")
    p()

    p("## Movements in movements.json never referenced by any pool workout")
    unused = sorted(move_ids - used_movement_ids)
    p(f"- count: {len(unused)}")
    for mid in unused:
        p(f"  - {mid}")
    p()

    print("\n".join(lines))


if __name__ == "__main__":
    main()
