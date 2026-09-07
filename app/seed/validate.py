#!/usr/bin/env python3
"""Validate app/seed/movements.json and app/seed/pool.json against the SPEC.md
domain model (Section 2) and seed data rules (Section 8). Stdlib only.

Usage: python3 app/seed/validate.py
Exit code 0 and "OK" summary on success; prints every error found and exits
non-zero otherwise.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

EQUIPMENT = {
    'barbell', 'kettlebell', 'dumbbell', 'rack', 'bench', 'pullup_bar', 'rings',
    'rower', 'bike', 'box', 'jump_rope', 'medball', 'wall', 'sandbag', 'sled',
    'ghd', 'ab_wheel', 'trx', 'cable', 'landmine', 'plyo_box', 'none',
}
UNITS = {'reps', 'meters', 'calories', 'seconds'}
FORMATS = {
    'strength', 'emom', 'tabata', 'interval', 'amrap', 'rounds', 'chipper', 'death_by',
}
INTENSITIES = {'H', 'M', 'L'}
SOURCES = {'spreadsheet', 'manual'}

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(name):
    path = os.path.join(HERE, name)
    with open(path) as f:
        return json.load(f)


def validate_movement(m, idx):
    ctx = f"movements.json[{idx}] (id={m.get('id')!r})"
    for field in ("id", "name", "tags", "equipment", "cadenceDays", "unit", "loadable"):
        if field not in m:
            err(f"{ctx}: missing required field '{field}'")
    if "id" in m and not isinstance(m["id"], str):
        err(f"{ctx}: id must be a string")
    if "name" in m and not isinstance(m["name"], str):
        err(f"{ctx}: name must be a string")
    if "aliases" in m and not isinstance(m["aliases"], list):
        err(f"{ctx}: aliases must be a list")
    if "tags" in m:
        if not isinstance(m["tags"], list) or not all(isinstance(t, str) for t in m["tags"]):
            err(f"{ctx}: tags must be a list of strings")
    if "equipment" in m:
        if not isinstance(m["equipment"], list):
            err(f"{ctx}: equipment must be a list")
        else:
            for e in m["equipment"]:
                if e not in EQUIPMENT:
                    err(f"{ctx}: equipment value {e!r} not in Equipment union")
    if "cadenceDays" in m and not isinstance(m["cadenceDays"], int):
        err(f"{ctx}: cadenceDays must be an integer")
    if "unit" in m and m["unit"] not in UNITS:
        err(f"{ctx}: unit {m.get('unit')!r} not in Unit union")
    if "loadable" in m and not isinstance(m["loadable"], bool):
        err(f"{ctx}: loadable must be a boolean")


def validate_block_movement(bm, ctx, movement_ids):
    if "movementId" not in bm:
        err(f"{ctx}: BlockMovement missing movementId")
        return
    mid = bm["movementId"]
    if mid is None:
        err(f"{ctx}: BlockMovement has null movementId (unresolved accessory)")
    elif mid not in movement_ids:
        err(f"{ctx}: movementId {mid!r} not found in movements.json")
    for numeric_field in ("reps", "distanceM", "calories", "seconds"):
        if numeric_field in bm and not isinstance(bm[numeric_field], (int, float)):
            err(f"{ctx}: {numeric_field} must be numeric")
    if "repScheme" in bm and not isinstance(bm["repScheme"], list):
        err(f"{ctx}: repScheme must be a list")
    if "loadPct" in bm:
        if not isinstance(bm["loadPct"], (int, float)):
            err(f"{ctx}: loadPct must be numeric")
        elif not (0 <= bm["loadPct"] <= 100):
            err(f"{ctx}: loadPct {bm['loadPct']!r} out of range (must be 0-100)")
    if "rir" in bm:
        if not isinstance(bm["rir"], (int, float)):
            err(f"{ctx}: rir must be numeric")
        elif not (0 <= bm["rir"] <= 5):
            err(f"{ctx}: rir {bm['rir']!r} out of range (must be 0-5)")


def validate_block(b, ctx, movement_ids):
    if "format" not in b:
        err(f"{ctx}: Block missing 'format'")
        return
    if b["format"] not in FORMATS:
        err(f"{ctx}: format {b['format']!r} not in Format union")
    if "movements" not in b or not isinstance(b["movements"], list):
        err(f"{ctx}: Block missing 'movements' list")
        return
    if len(b["movements"]) == 0:
        err(f"{ctx}: Block has an empty movements list")
    for i, bm in enumerate(b["movements"]):
        validate_block_movement(bm, f"{ctx}.movements[{i}]", movement_ids)
    # light numeric-field sanity checks
    for f in ("sets", "rounds", "intervalSec", "workSec", "restSec", "durationSec", "timeCapSec"):
        if f in b and not isinstance(b[f], (int, float)):
            err(f"{ctx}: field '{f}' must be numeric")
    if "alternate" in b and not isinstance(b["alternate"], bool):
        err(f"{ctx}: alternate must be a boolean")


def validate_pool_workout(w, idx, movement_ids):
    ctx = f"pool.json[{idx}] (id={w.get('id')!r})"
    for field in ("id", "name", "intensity", "blocks", "cadenceDays", "enabled", "source"):
        if field not in w:
            err(f"{ctx}: missing required field '{field}'")
    if "intensity" in w and w["intensity"] not in INTENSITIES:
        err(f"{ctx}: intensity {w['intensity']!r} not in Intensity union")
    if "source" in w and w["source"] not in SOURCES:
        err(f"{ctx}: source {w['source']!r} not in allowed source values")
    if "enabled" in w and not isinstance(w["enabled"], bool):
        err(f"{ctx}: enabled must be a boolean")
    if "cadenceDays" in w and not isinstance(w["cadenceDays"], int):
        err(f"{ctx}: cadenceDays must be an integer")
    if "tags" in w and not isinstance(w["tags"], list):
        err(f"{ctx}: tags must be a list")
    if "blocks" not in w or not isinstance(w["blocks"], list):
        err(f"{ctx}: blocks must be a list")
        return
    if len(w["blocks"]) == 0:
        err(f"{ctx}: workout has zero blocks")
    for i, b in enumerate(w["blocks"]):
        validate_block(b, f"{ctx}.blocks[{i}]", movement_ids)

    # C3/C4 (warning, not error): a workout containing a strength block
    # should lead with a Warm-up, Power, or the Strength block itself.
    has_strength = any(isinstance(b, dict) and b.get("format") == "strength" for b in w["blocks"])
    if has_strength and w["blocks"] and isinstance(w["blocks"][0], dict):
        first_title = w["blocks"][0].get("title")
        if first_title not in ("Warm-up", "Power", "Strength"):
            warn(
                f"{ctx}: has a strength block but blocks[0].title is {first_title!r}, "
                "expected one of 'Warm-up', 'Power', 'Strength' (C3/C4)"
            )


def main():
    movements = load("movements.json")
    pool = load("pool.json")

    if not isinstance(movements, list):
        err("movements.json: top level must be a JSON array")
    if not isinstance(pool, list):
        err("pool.json: top level must be a JSON array")

    for i, m in enumerate(movements):
        validate_movement(m, i)

    movement_ids = {m["id"] for m in movements if isinstance(m, dict) and "id" in m}
    dupe_ids = [mid for mid in movement_ids if sum(1 for m in movements if m.get("id") == mid) > 1]
    if dupe_ids:
        err(f"movements.json: duplicate movement ids: {sorted(set(dupe_ids))}")

    for i, w in enumerate(pool):
        validate_pool_workout(w, i, movement_ids)

    pool_ids = [w.get("id") for w in pool]
    dupes = {x for x in pool_ids if pool_ids.count(x) > 1}
    if dupes:
        err(f"pool.json: duplicate workout ids: {sorted(dupes)}")

    # referenced-but-unused movements (informational only)
    referenced = set()
    for w in pool:
        for b in w.get("blocks", []):
            for bm in b.get("movements", []):
                if bm.get("movementId"):
                    referenced.add(bm["movementId"])
    unused = movement_ids - referenced
    if unused:
        warn(f"{len(unused)} movements defined but never referenced by pool.json: {sorted(unused)}")

    print("=== Seed validation summary ===")
    print(f"movements.json: {len(movements)} movements")
    print(f"pool.json:      {len(pool)} workouts")
    print(f"distinct movementIds referenced by pool: {len(referenced)}")
    print(f"errors:   {len(errors)}")
    print(f"warnings: {len(warnings)}")

    if warnings:
        print("\n--- warnings ---")
        for w in warnings:
            print(" -", w)

    if errors:
        print("\n--- errors ---")
        for e in errors:
            print(" -", e)
        print(f"\nFAILED with {len(errors)} error(s)")
        sys.exit(1)

    print("\nOK: all checks passed")


if __name__ == "__main__":
    main()
