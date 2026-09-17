#!/usr/bin/env python3
"""Seed revision 2: expand the workout pool with strength, power, stamina and
recovery sessions designed against project_docs/training_evidence.md.

The reboot carried forward one representative spreadsheet row per
(main lift, format) pair plus the seven AUDIT.md additions - 59 workouts, all
but seven of the same "strength -> conditioning -> finisher" shape. This
script adds the content that shape can't express: dedicated press/pull main-
lift days (Sheet3 of the spreadsheet lists bench press, push press, strict
press and jerk as main movements, none of which survived the reboot), oly-
first power days, real plyometric work done fresh, the polarized-conditioning
protocols (Zone 2, Norwegian 4x4, Billat 30/30, true Tabata), a conditioning-
priority day for the 4-day split, and active-recovery / deload / stability
sessions.

Every new entry carries the tag `seed:v2` and an id prefixed `v2-`. The tag
is what `src/storage/seed.ts`'s catch-up uses to bring these into an existing
install without resurrecting workouts the user deleted from an earlier seed
revision (see SPEC.md section 8). Idempotent: re-running adds nothing that is
already present by id.

Usage: python3 app/seed/expand.py   (then python3 app/seed/validate.py)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
POOL = os.path.join(HERE, 'pool.json')
MOVEMENTS = os.path.join(HERE, 'movements.json')

REVISION_TAG = 'seed:v2'

# --- Movements ---------------------------------------------------------------
# Warm-up / mobility movements get cadenceDays 1 on purpose: the selection
# gate checks per-movement cadence for EVERY movement in a workout, warm-up
# blocks included, so a 3-day cadence here would silently gate whole workouts.

NEW_MOVEMENTS = [
    {
        'id': 'air_squat', 'name': 'Air Squat', 'aliases': ['bodyweight squat'],
        'tags': ['bodyweight', 'squat', 'legs'], 'equipment': ['none'],
        'cadenceDays': 1, 'unit': 'reps', 'loadable': False,
    },
    {
        'id': 'inchworm', 'name': 'Inchworm', 'aliases': [],
        'tags': ['bodyweight', 'core', 'mobility'], 'equipment': ['none'],
        'cadenceDays': 1, 'unit': 'reps', 'loadable': False,
    },
    {
        'id': 'cossack_squat', 'name': 'Cossack Squat', 'aliases': [],
        'tags': ['bodyweight', 'legs', 'unilateral', 'mobility'], 'equipment': ['none'],
        'cadenceDays': 1, 'unit': 'reps', 'loadable': False,
    },
    {
        'id': 'pvc_passthrough', 'name': 'PVC Pass-through', 'aliases': ['shoulder pass through'],
        'tags': ['bodyweight', 'mobility'], 'equipment': ['none'],
        'cadenceDays': 1, 'unit': 'reps', 'loadable': False,
    },
    {
        'id': 'jumping_jack', 'name': 'Jumping Jack', 'aliases': [],
        'tags': ['bodyweight', 'cardio'], 'equipment': ['none'],
        'cadenceDays': 1, 'unit': 'reps', 'loadable': False,
    },
    {
        'id': 'kb_press', 'name': 'Kettlebell Press', 'aliases': ['single arm kb press'],
        'tags': ['accessory', 'push', 'unilateral'], 'equipment': ['kettlebell'],
        'cadenceDays': 3, 'unit': 'reps', 'loadable': True,
        'progression': 'double', 'repRange': [8, 12],
    },
    {
        'id': 'single_leg_rdl', 'name': 'Single-leg Romanian Deadlift', 'aliases': ['single leg rdl'],
        'tags': ['accessory', 'hinge', 'unilateral'], 'equipment': ['kettlebell'],
        'cadenceDays': 3, 'unit': 'reps', 'loadable': True,
        'progression': 'double', 'repRange': [8, 12],
    },
    {
        'id': 'sit_up', 'name': 'Sit-up', 'aliases': ['situps'],
        'tags': ['bodyweight', 'core'], 'equipment': ['none'],
        'cadenceDays': 3, 'unit': 'reps', 'loadable': False,
    },
]

# --- Block helpers -----------------------------------------------------------


def bm(movement_id, reps=None, **extra):
    d = {'movementId': movement_id}
    if reps is not None:
        d['reps'] = reps
    d.update(extra)
    return d


def strength(title, sets, rest_sec, *movements):
    return {'format': 'strength', 'title': title, 'sets': sets, 'restSec': rest_sec,
            'movements': list(movements)}


def rounds(title, n, *movements, cap=None):
    b = {'format': 'rounds', 'title': title, 'rounds': n, 'movements': list(movements)}
    if cap is not None:
        b['timeCapSec'] = cap
    return b


def emom(title, n, interval_sec, *movements, alternate=False):
    b = {'format': 'emom', 'title': title, 'rounds': n, 'intervalSec': interval_sec,
         'movements': list(movements)}
    if alternate:
        b['alternate'] = True
    return b


def interval(title, n, work_sec, rest_sec, *movements):
    return {'format': 'interval', 'title': title, 'rounds': n, 'workSec': work_sec,
            'restSec': rest_sec, 'movements': list(movements)}


def amrap(title, duration_sec, *movements):
    return {'format': 'amrap', 'title': title, 'durationSec': duration_sec,
            'movements': list(movements)}


def tabata(title, *movements):
    return {'format': 'tabata', 'title': title, 'rounds': 8, 'workSec': 20, 'restSec': 10,
            'movements': list(movements)}


def chipper(title, cap, *movements):
    return {'format': 'chipper', 'title': title, 'timeCapSec': cap, 'movements': list(movements)}


def death_by(title, *movements):
    return {'format': 'death_by', 'title': title, 'movements': list(movements)}


def steady(title, movement_id, seconds, note):
    """A single continuous effort (Zone 1/2 work, warm-up spin, cool-down)."""
    return interval(title, 1, seconds, 0, bm(movement_id, seconds=seconds, loadNote=note))


def cardio(movement_id):
    if movement_id == 'row':
        return bm('row', distanceM=250)
    if movement_id == 'bike':
        return bm('bike', seconds=120)
    return bm('run', distanceM=200)


def wu_lower(cardio_id):
    return rounds('Warm-up', 2, cardio(cardio_id), bm('air_squat', 10), bm('inchworm', 5),
                  bm('cossack_squat', 10), cap=480)


def wu_upper(cardio_id):
    return rounds('Warm-up', 2, cardio(cardio_id), bm('jumping_jack', 20), bm('inchworm', 5),
                  bm('pvc_passthrough', 10), cap=480)


def wu_oly(cardio_id):
    return rounds('Warm-up', 2, cardio(cardio_id), bm('air_squat', 10), bm('pvc_passthrough', 10),
                  bm('inchworm', 5), cap=480)


RAMP = 'Then 2-3 empty-bar / ramp-up sets of the main lift before the working sets (R24, R44).'
HEAVY = 'heavy, ~85-90% 1RM'
ACC = 'moderate, 1-2 reps in reserve'


def workout(id_, name, intensity, blocks, tags, notes, cadence=14):
    return {
        'id': id_,
        'name': name,
        'intensity': intensity,
        'blocks': blocks,
        'cadenceDays': cadence,
        'enabled': True,
        'tags': [*tags, REVISION_TAG],
        'source': 'manual',
        'notes': notes,
    }


# --- Workouts ----------------------------------------------------------------

STRENGTH = [
    workout(
        'v2-back-squat-5x5-press-row', 'Back Squat 5x5 + press/row accessory', 'M',
        [
            wu_lower('bike'),
            strength('Strength', 5, 180, bm('back_squat', 5, targetRpe=8)),
            strength('Accessory', 3, 90, bm('strict_press', 8, loadNote=ACC),
                     bm('dumbbell_row', 10, loadNote=ACC)),
            interval('Finisher', 8, 30, 30, bm('bike', seconds=30, loadNote='hard but repeatable')),
        ],
        ['day:squat-strength'],
        'Classic linear-progression squat day (R1-R3): 5x5 at RPE 8 with 3 min rest, then an '
        'upper-body accessory superset (R10/R11: 8-12 reps, 90 s rest) so the conditioning '
        'stays short and moderate (R20). ' + RAMP,
    ),
    workout(
        'v2-front-squat-4x6-rdl-ringrow', 'Front Squat 4x6 + RDL/ring row accessory', 'M',
        [
            wu_lower('row'),
            strength('Strength', 4, 180, bm('front_squat', 6, targetRpe=8)),
            strength('Accessory', 3, 90, bm('romanian_deadlift', 8, loadNote=ACC),
                     bm('ring_row', 10)),
            amrap('Finisher', 480, bm('row', distanceM=200), bm('kb_swing', 10), bm('push_up', 8)),
        ],
        ['day:squat-strength'],
        'Front squat at the top of the strength rep range (R1: 4-6 reps), a hinge accessory '
        'kept sub-maximal (R11), and an 8 min moderate AMRAP finisher (R16, R20). ' + RAMP,
    ),
    workout(
        'v2-back-squat-heavy-triples', 'Back Squat heavy 5x3 (DUP heavy day)', 'H',
        [
            wu_lower('bike'),
            strength('Strength', 5, 240, bm('back_squat', 3, targetRpe=9, loadNote=HEAVY)),
            strength('Accessory', 3, 90, bm('good_morning', 8, loadNote='light, hamstring stretch'),
                     bm('plank', seconds=45)),
            rounds('Finisher', 4, bm('sled_push', 1, loadNote='20 m, heavy'), bm('bike', calories=12),
                   cap=600),
        ],
        ['day:squat-strength'],
        'The heavy day of a daily-undulating wave (R34/R35): triples at ~85-90% with 4 min rest '
        '(R3). Sled and bike keep the finisher joint-friendly after heavy squats. ' + RAMP,
    ),
    workout(
        'v2-back-squat-volume-4x8', 'Back Squat 4x8 volume day', 'M',
        [
            wu_lower('row'),
            strength('Strength', 4, 150, bm('back_squat', 8, targetRpe=8, loadNote='~70-75% 1RM')),
            strength('Accessory', 3, 90, bm('lunge', 10, loadNote='goblet or bodyweight, each leg'),
                     bm('dip', 10)),
            tabata('Finisher', bm('battle_ropes', seconds=20)),
        ],
        ['day:squat-strength'],
        'The volume day of the wave: 8s for the strength-hypertrophy overlap (R1, R2), shorter '
        'rest because the load is lighter (R3). Battle-rope 20/10 finisher is a conditioning '
        'circuit, not the validated Tabata protocol (R12). ' + RAMP,
    ),
    workout(
        'v2-deadlift-heavy-triples', 'Deadlift heavy 5x3 + pull-up/KB press', 'H',
        [
            wu_lower('row'),
            strength('Strength', 5, 240, bm('deadlift', 3, targetRpe=9, loadNote=HEAVY)),
            strength('Accessory', 3, 90, bm('pull_up', 8), bm('kb_press', 10, loadNote='each arm')),
            rounds('Finisher', 3, bm('farmers_carry', 1, loadNote='40 m, heavy'), bm('dead_bug', 10),
                   cap=360),
        ],
        ['deadlift-day', 'day:hinge-strength'],
        'Heavy hinge day (R1, R3, R5-style triples). Keep >=48 h from the mandatory deadlift + '
        'push press day (R21, R26); the pattern gate enforces this. ' + RAMP,
    ),
    workout(
        'v2-deadlift-4x6-bench', 'Deadlift 4x6 + bench/ring row accessory', 'M',
        [
            wu_lower('bike'),
            strength('Strength', 4, 180, bm('deadlift', 6, targetRpe=8)),
            strength('Accessory', 3, 90, bm('bench_press', 8, loadNote=ACC), bm('ring_row', 10)),
            amrap('Finisher', 600, bm('bike', calories=10), bm('push_up', 10), bm('sit_up', 15)),
        ],
        ['deadlift-day', 'day:hinge-strength'],
        'Deadlift at 6s (top of R1\'s strength range) paired with a push/pull accessory superset '
        'so no second hinge movement stacks on the main lift (R21). ' + RAMP,
    ),
    workout(
        'v2-sumo-deadlift-press-row', 'Sumo Deadlift 5x5 + press/row accessory', 'M',
        [
            wu_lower('row'),
            strength('Strength', 5, 180, bm('sumo_deadlift', 5, targetRpe=8)),
            strength('Accessory', 3, 90, bm('strict_press', 8, loadNote=ACC),
                     bm('bent_over_row', 8, loadNote=ACC)),
            tabata('Finisher', bm('row', seconds=20, loadNote='hard')),
        ],
        ['deadlift-day', 'day:hinge-strength'],
        'Sumo variant for hinge-pattern variety at the same 5x5 / 3 min prescription (R1-R3). '
        + RAMP,
    ),
    workout(
        'v2-bench-press-heavy-triples', 'Bench Press heavy 5x3 + row/fly accessory', 'H',
        [
            wu_upper('row'),
            strength('Strength', 5, 240, bm('bench_press', 3, targetRpe=9, loadNote=HEAVY)),
            strength('Accessory', 4, 90, bm('dumbbell_row', 10, loadNote=ACC), bm('chest_fly', 12)),
            interval('Finisher', 8, 30, 30, bm('row', seconds=30, loadNote='hard but repeatable')),
        ],
        ['day:press-strength'],
        'Heavy horizontal press day (R1, R3). Bench press was a main movement in the '
        'spreadsheet\'s Sheet3 reference table but never made it into the rebooted pool. ' + RAMP,
    ),
    workout(
        'v2-strict-press-5x5-pullups', 'Strict Press 5x5 + pull-up/skull crusher', 'M',
        [
            wu_upper('bike'),
            strength('Strength', 5, 180, bm('strict_press', 5, targetRpe=8)),
            strength('Accessory', 4, 90, bm('pull_up', 8), bm('skull_crusher', 10, loadNote=ACC)),
            rounds('Finisher', 4, bm('farmers_carry', 1, loadNote='40 m'), bm('plank', seconds=45),
                   cap=480),
        ],
        ['day:press-strength'],
        'Vertical press main lift (Sheet3: strict press -> skull crushers). Small upper-body '
        'increments apply (R32: ~2-2.5% per progression step). ' + RAMP,
    ),
    workout(
        'v2-push-press-5x3-rings', 'Push Press 5x3 + ring row/dip accessory', 'M',
        [
            wu_upper('row'),
            strength('Strength', 5, 180, bm('push_press', 3, loadPct=80, targetRpe=8)),
            strength('Accessory', 3, 90, bm('ring_row', 10), bm('dip', 10)),
            amrap('Finisher', 600, bm('wall_ball', 10), bm('kb_swing', 10), bm('row', distanceM=150)),
        ],
        ['day:press-strength'],
        'Push press as a standalone main lift (Sheet3), triples at ~80% so leg drive and bar '
        'speed stay crisp (R5: 3-5 reps for derivatives). ' + RAMP,
    ),
    workout(
        'v2-weighted-pullup-heavy-triples', 'Weighted Pull-up heavy 5x3 + bench/curl', 'H',
        [
            wu_upper('bike'),
            strength('Strength', 5, 240, bm('weighted_pullup', 3, targetRpe=9, loadNote=HEAVY)),
            strength('Accessory', 3, 90, bm('bench_press', 8, loadNote=ACC), bm('hammer_curl', 12)),
            interval('Finisher', 6, 30, 30, bm('bike', seconds=30, loadNote='hard but repeatable')),
        ],
        ['day:pull-strength'],
        'Heavy vertical pull day (R1, R3): the pull counterpart to the heavy bench day. ' + RAMP,
    ),
    workout(
        'v2-bent-over-row-5x5', 'Bent Over Row 5x5 + press/goblet squat', 'M',
        [
            wu_upper('row'),
            strength('Strength', 5, 150, bm('bent_over_row', 5, targetRpe=8,
                                            loadNote='strict, no torso swing')),
            strength('Accessory', 3, 90, bm('strict_press', 8, loadNote=ACC), bm('goblet_squat', 10)),
            amrap('Finisher', 480, bm('burpee', 5), bm('ring_row', 5), bm('lunge', 10)),
        ],
        ['day:pull-strength'],
        'Horizontal pull as the main lift, 5x5 with 2.5 min rest (R3: 2-3 min at >=80%). ' + RAMP,
    ),
    workout(
        'v2-deadlift-pushpress-volume', 'Deadlift 4x6 + Push Press 5x5 (mandatory day, volume)', 'M',
        [
            wu_lower('row'),
            strength('Strength', 4, 180, bm('deadlift', 6, targetRpe=8)),
            strength('Strength', 5, 180, bm('push_press', 5, targetRpe=8)),
            rounds('Core', 3, bm('ghd_situp', 10), bm('russian_twist', 20), cap=360),
        ],
        ['day:deadlift-press', 'mandatory', 'deadlift-day'],
        'Volume variant of the mandatory deadlift + push press day (R26). Keep >=48 h from any '
        'other heavy hinge or overhead press; make the next day conditioning-only or rest. '
        'cadenceDays 6 so a mandatory-day variant is always eligible each week. ' + RAMP,
        cadence=6,
    ),
    workout(
        'v2-deadlift-pushpress-heavy', 'Deadlift 5x3 + Push Press 4x3 (mandatory day, heavy)', 'H',
        [
            wu_lower('bike'),
            strength('Strength', 5, 240, bm('deadlift', 3, targetRpe=9, loadNote=HEAVY)),
            strength('Strength', 4, 180, bm('push_press', 3, loadPct=85)),
            rounds('Finisher', 3, bm('farmers_carry', 1, loadNote='40 m, heavy'), bm('plank', seconds=45),
                   cap=360),
        ],
        ['day:deadlift-press', 'mandatory', 'deadlift-day'],
        'Heavy variant of the mandatory day (R26): triples on both lifts, 4 min rest on the pull '
        '(R3). Next day lower intensity. cadenceDays 6. ' + RAMP,
        cadence=6,
    ),
]

POWER = [
    workout(
        'v2-power-snatch-back-squat', 'Power Snatch EMOM + Back Squat 5x5', 'H',
        [
            wu_oly('row'),
            emom('Power', 10, 60, bm('power_snatch', 2, loadPct=70,
                                     loadNote='crisp, full extension; rest inside the minute')),
            strength('Strength', 5, 180, bm('back_squat', 5, targetRpe=8)),
            amrap('Finisher', 360, bm('kb_swing', 10), bm('push_up', 10)),
        ],
        ['day:oly-power', 'day:squat-strength'],
        'R26 D1 template: oly pull first while fresh (R7, R24), 1-3 reps at 50-75% inside an EMOM '
        '(R9), then the heavy squat, then a short finisher. ' + RAMP,
    ),
    workout(
        'v2-hang-clean-strict-press', 'Hang Clean 6x2 + Strict Press 5x5', 'M',
        [
            wu_oly('bike'),
            strength('Power', 6, 150, bm('hang_clean', 2, loadPct=75)),
            strength('Strength', 5, 180, bm('strict_press', 5, targetRpe=8)),
            rounds('Finisher', 3, bm('ring_row', 10), bm('step_up', 10), cap=480),
        ],
        ['day:oly-power'],
        'R26 D4 template: oly technique/power then press strength. Doubles at ~75% with 2.5 min '
        'rest (R5, R6), never to failure. ' + RAMP,
    ),
    workout(
        'v2-clean-and-jerk-complex', 'Clean + Jerk complex 8x(1+1)', 'H',
        [
            wu_oly('row'),
            strength('Power', 8, 180, bm('clean', 1, loadNote='1 clean + 1 jerk per set, build to ~80%'),
                     bm('jerk', 1)),
            strength('Accessory', 3, 90, bm('dip', 8), bm('turkish_getup', 2, loadNote='each side')),
            interval('Finisher', 6, 30, 30, bm('bike', seconds=30, loadNote='hard but repeatable')),
        ],
        ['day:oly-power'],
        'Classic-lift singles inside Prilepin\'s 70-90% band (R5: 8 total lifts at 80-90%), 3 min '
        'rest (R6). Sheet3 pairs jerk with dips and Turkish get-ups. ' + RAMP,
    ),
    workout(
        'v2-snatch-technique-overhead-squat', 'Snatch technique 8x2 + Overhead Squat 3x5', 'L',
        [
            wu_oly('bike'),
            strength('Power', 8, 180, bm('snatch', 2, loadPct=65,
                                         loadNote='technique: speed under the bar, not load')),
            strength('Strength', 3, 240, bm('overhead_squat', 5, targetRpe=7)),
            strength('Accessory', 3, 90, bm('pull_up', 8)),
            interval('Finisher', 4, 30, 30, bm('bike', seconds=30, loadNote='moderate')),
        ],
        ['day:oly-power'],
        'Sub-maximal snatch practice (R5/R8: 65% keeps technique intact) followed by overhead '
        'squat for receiving-position strength. Low intensity: this is a skill day. ' + RAMP,
    ),
    workout(
        'v2-plyo-front-squat', 'Jumps (30 contacts) + Front Squat 5x3', 'H',
        [
            wu_lower('row'),
            rounds('Power', 5, bm('broad_jump', 3, loadNote='max intent, full recovery between'),
                   bm('box_jump', 3, loadNote='step down, never rebound'), cap=600),
            strength('Strength', 5, 240, bm('front_squat', 3, targetRpe=9, loadNote=HEAVY)),
            rounds('Finisher', 4, bm('sled_push', 1, loadNote='20 m'), bm('row', distanceM=200), cap=600),
        ],
        ['day:squat-strength', 'power', 'plyo'],
        'Plyometrics done fresh, first in the session (R23), 30 contacts inside R22\'s 20-80 '
        'recreational floor. Jumps are the only place box_jump appears in the pool; it never '
        'goes in a fatigued block (AUDIT.md finding 3). ' + RAMP,
    ),
    workout(
        'v2-power-clean-push-press', 'Power Clean EMOM + Push Press 5x3', 'M',
        [
            wu_oly('row'),
            emom('Power', 8, 60, bm('power_clean', 2, loadPct=70, loadNote='rest inside the minute')),
            strength('Strength', 5, 180, bm('push_press', 3, loadPct=80)),
            strength('Accessory', 3, 90, bm('ring_row', 10)),
            rounds('Finisher', 3, bm('farmers_carry', 1, loadNote='40 m'), cap=300),
        ],
        ['day:oly-power'],
        'Pull-then-press power day (R7, R9). Counts as heavy push for the pattern gate, so it '
        'sits >=48 h from the mandatory deadlift + push press day automatically (R21). ' + RAMP,
    ),
    workout(
        'v2-kettlebell-power-day', 'Kettlebell power: heavy swings + snatch EMOM', 'M',
        [
            wu_lower('bike'),
            emom('Power', 10, 60, bm('kb_swing', 8, loadNote='heavy bell, hip snap'),
                 bm('kb_snatch', 3, loadNote='each arm'), alternate=True),
            strength('Strength', 4, 90, bm('goblet_squat', 8, targetRpe=8)),
            rounds('Accessory', 3, bm('turkish_getup', 2, loadNote='each side'),
                   bm('kb_press', 8, loadNote='each arm'), cap=480),
        ],
        ['diversity', 'power'],
        'Ballistic hip power without a barbell: alternating EMOM keeps reps low and rest built '
        'in (R9 logic applied to kettlebell work). A diversity day per requirements.md.',
    ),
    workout(
        'v2-jerk-front-squat', 'Jerk 6x2 + Front Squat 4x5', 'M',
        [
            wu_oly('row'),
            strength('Power', 6, 180, bm('jerk', 2, loadPct=80, loadNote='from the rack')),
            strength('Strength', 4, 180, bm('front_squat', 5, targetRpe=8)),
            strength('Accessory', 3, 90, bm('dip', 8), bm('turkish_getup', 2, loadNote='each side')),
            interval('Finisher', 6, 45, 30, bm('row', seconds=45, loadNote='moderate')),
        ],
        ['day:oly-power'],
        'Jerk as its own main movement (Sheet3), doubles at ~80% with 3 min rest (R5, R6), then '
        'front squats for the rack position. ' + RAMP,
    ),
    workout(
        'v2-speed-deadlift-jumps-bench', 'Speed Deadlift + jumps EMOM, Bench 4x5', 'M',
        [
            wu_lower('bike'),
            emom('Power', 8, 60, bm('deadlift', 2, loadPct=60, loadNote='speed pull, fast off the floor'),
                 bm('broad_jump', 3, loadNote='max intent'), alternate=True),
            strength('Strength', 4, 180, bm('bench_press', 5, targetRpe=8)),
            amrap('Finisher', 360, bm('kb_swing', 10), bm('sit_up', 10)),
        ],
        ['deadlift-day', 'day:hinge-strength', 'power'],
        'Dynamic-effort hinge: 60% pulls for bar speed alternated with broad jumps (24 contacts, '
        'R22/R23), then bench. Counts as heavy hinge for the pattern gate. ' + RAMP,
    ),
]

STAMINA = [
    workout(
        'v2-zone2-bike-45', 'Zone 2 Bike, 45 min', 'L',
        [steady('Conditioning', 'bike', 2700, 'conversational pace, 65-75% HRmax')],
        ['day:zone2', 'slog'],
        'Low-intensity continuous work is where most conditioning volume belongs (R15). First 5 '
        'min easy is the warm-up.',
        cadence=7,
    ),
    workout(
        'v2-zone2-run-40', 'Zone 2 Run, 40 min', 'L',
        [steady('Conditioning', 'run', 2400, 'conversational pace, 65-75% HRmax')],
        ['day:zone2'],
        'Running interferes with strength more than cycling (R17), so keep this one truly easy '
        'and away from heavy squat days.',
        cadence=7,
    ),
    workout(
        'v2-zone2-row-bike-50', 'Zone 2 Row + Bike, 50 min', 'L',
        [rounds('Conditioning', 1, bm('row', seconds=1500, loadNote='65-75% HRmax'),
                bm('bike', seconds=1500, loadNote='65-75% HRmax'), cap=3000)],
        ['day:zone2', 'slog'],
        'Split-modality Zone 2 to spread the orthopedic load (R15).',
        cadence=7,
    ),
    workout(
        'v2-slog-row-bike-run-60', 'The Slog: row / bike / run, 60 min', 'L',
        [rounds('Conditioning', 1, bm('row', seconds=1200, loadNote='steady'),
                bm('bike', seconds=1200, loadNote='steady'),
                bm('run', seconds=1200, loadNote='steady'), cap=3600)],
        ['day:zone2', 'slog'],
        'The monthly long moderate effort (patterns_and_rules.md), kept at Zone 2 so it adds '
        'aerobic base rather than a third hard day (R15).',
        cadence=21,
    ),
    workout(
        'v2-norwegian-4x4-row', 'Norwegian 4x4 Row', 'H',
        [
            steady('Warm-up', 'row', 600, 'easy, build to moderate in the last 2 min'),
            interval('Conditioning', 4, 240, 180,
                     bm('row', seconds=240, loadNote='90-95% HRmax; paddle easy for the 3 min recovery')),
        ],
        ['day:hiit', 'hiit'],
        'Helgerud\'s 4x4 protocol (R13): the best-evidenced VO2max session, 2-3x/wk max. Counts '
        'toward the ~20-40 min/wk of true high-intensity work (R15).',
        cadence=7,
    ),
    workout(
        'v2-norwegian-4x4-run', 'Norwegian 4x4 Run', 'H',
        [
            steady('Warm-up', 'run', 600, 'easy jog'),
            interval('Conditioning', 4, 240, 180,
                     bm('run', seconds=240, loadNote='90-95% HRmax; walk/jog the 3 min recovery')),
        ],
        ['day:hiit', 'hiit'],
        'Running version of R13. Higher impact than the bike/row versions (R17), so not the day '
        'after heavy squats.',
        cadence=7,
    ),
    workout(
        'v2-billat-30-30-bike', 'Billat 30/30 Bike', 'H',
        [
            steady('Warm-up', 'bike', 480, 'easy spin'),
            interval('Conditioning', 20, 30, 30,
                     bm('bike', seconds=30, loadNote='30 s at vVO2max effort / 30 s easy spin')),
        ],
        ['day:hiit', 'hiit'],
        'R14: 30/30 accumulates time near VO2max at lower orthopedic cost than long intervals. '
        'Stop early if the 30 s work pace can no longer be held.',
        cadence=7,
    ),
    workout(
        'v2-billat-30-30-row', 'Billat 30/30 Row', 'H',
        [
            steady('Warm-up', 'row', 480, 'easy'),
            interval('Conditioning', 16, 30, 30,
                     bm('row', seconds=30, loadNote='30 s hard / 30 s easy paddle')),
        ],
        ['day:hiit', 'hiit'],
        'Rowing version of R14, 16 reps.',
        cadence=7,
    ),
    workout(
        'v2-true-tabata-row', 'True Tabata Row', 'H',
        [
            steady('Warm-up', 'row', 300, 'easy, two 10 s pick-ups at the end'),
            tabata('Conditioning', bm('row', seconds=20, loadNote='supramaximal, all-out')),
        ],
        ['day:hiit', 'hiit'],
        'Single-movement 8x20/10 at supramaximal intensity (R12). Only 4 min of work; if it '
        'feels easy the intensity was wrong, not the duration.',
        cadence=7,
    ),
    workout(
        'v2-bike-2min-repeats', 'Bike 6x2 min repeats', 'H',
        [
            steady('Warm-up', 'bike', 480, 'easy spin'),
            interval('Conditioning', 6, 120, 120, bm('bike', seconds=120, loadNote='hard, even pacing')),
        ],
        ['day:hiit', 'hiit'],
        '12 min of work at VO2max-ish intensity with equal recovery, between the 4x4 and 30/30 '
        'protocols in interval length (R13-R15).',
        cadence=7,
    ),
    workout(
        'v2-conditioning-priority-upper-accessory', 'Conditioning-priority day + upper accessory', 'M',
        [
            wu_upper('row'),
            amrap('Conditioning', 1200, bm('row', distanceM=250), bm('kb_swing', 15), bm('push_up', 10),
                  bm('step_up', 10, loadNote='steady ~80% effort, repeatable rounds')),
            rounds('Accessory', 3, bm('ring_row', 10), bm('dumbbell_row', 10, loadNote='light'), cap=480),
        ],
        ['day:conditioning'],
        'R26 D2: the conditioning-priority day of the 4-day split, with light upper accessory '
        'work and no heavy barbell so the mandatory day stays fresh.',
    ),
    workout(
        'v2-chipper-work-capacity', 'Work-capacity chipper', 'M',
        [
            wu_lower('row'),
            chipper('Conditioning', 1500, bm('row', distanceM=1000), bm('wall_ball', 40),
                    bm('kb_swing', 30), bm('burpee', 20), bm('pull_up', 10), bm('row', distanceM=500)),
        ],
        ['day:conditioning'],
        'A mixed-modal for-time piece (R16): legitimate work-capacity training, deliberately '
        'without a heavy lift in front of it (R20).',
    ),
    workout(
        'v2-death-by-burpees', 'Death by Burpees', 'H',
        [
            rounds('Warm-up', 2, bm('jumping_jack', 20), bm('air_squat', 10), bm('inchworm', 5), cap=300),
            death_by('Conditioning', bm('burpee', 1)),
            steady('Cool-down', 'bike', 300, 'easy spin'),
        ],
        ['day:conditioning'],
        'Progressive-rep anaerobic test (workout_formats.md). Short, no equipment beyond the '
        'cool-down bike.',
    ),
    workout(
        'v2-emom-aerobic-30', 'Aerobic EMOM 30: row / bike / burpee', 'M',
        [
            emom('Conditioning', 30, 60, bm('row', calories=12), bm('bike', calories=10),
                 bm('burpee', 8, loadNote='finish each minute with >=15 s rest'), alternate=True),
        ],
        ['day:conditioning'],
        'Moderate steady work with built-in rest. R15 caps moderate "grey zone" volume, so use '
        'this instead of, not in addition to, a hard interval day that week.',
        cadence=7,
    ),
]

RECOVERY = [
    workout(
        'v2-active-recovery-bike-mobility', 'Active recovery: easy bike + mobility', 'L',
        [
            steady('Conditioning', 'bike', 1200, 'Zone 1, nose-breathing pace'),
            rounds('Mobility', 3, bm('inchworm', 5), bm('cossack_squat', 10), bm('air_squat', 10),
                   bm('pvc_passthrough', 10), cap=600),
        ],
        ['day:recovery'],
        'The lower-intensity day R26 asks for after the mandatory deadlift + push press day. '
        'Nothing here counts as heavy loading for the pattern gate.',
        cadence=7,
    ),
    workout(
        'v2-active-recovery-row-carries', 'Active recovery: easy row + carries', 'L',
        [
            steady('Conditioning', 'row', 900, 'Zone 1, easy'),
            rounds('Carries', 4, bm('farmers_carry', 1, loadNote='40 m, light'),
                   bm('bear_crawl', 1, loadNote='20 m'), bm('plank', seconds=30), cap=600),
        ],
        ['day:recovery'],
        'Blood flow and trunk work without loading the hinge/squat/press patterns (R21).',
        cadence=7,
    ),
    workout(
        'v2-recovery-walk-jog-30', 'Recovery walk / jog, 30 min', 'L',
        [steady('Conditioning', 'run', 1800, 'walk or easy jog, conversational, Zone 1')],
        ['day:recovery'],
        'No-equipment recovery day. Keep it genuinely easy (R15, R17).',
        cadence=7,
    ),
    workout(
        'v2-deload-squat-technique', 'Deload: squat technique at 60%', 'L',
        [
            wu_lower('bike'),
            strength('Strength', 3, 120, bm('back_squat', 5, loadPct=60, targetRpe=6,
                                            loadNote='technique and bar speed')),
            rounds('Accessory', 2, bm('ring_row', 10), bm('push_up', 10), cap=300),
            steady('Cool-down', 'bike', 600, 'easy spin'),
        ],
        ['day:recovery', 'deload'],
        'A deload-week session (R29, R41: volume -40-60%, intensity -10-20%). Also useful as the '
        'one-session 10% back-off after a stall (R33).',
        cadence=7,
    ),
    workout(
        'v2-deload-hinge-technique', 'Deload: hinge technique, light RDL + swings', 'L',
        [
            wu_lower('row'),
            strength('Strength', 3, 120, bm('romanian_deadlift', 8, loadPct=50, targetRpe=6,
                                            loadNote='slow eccentric, feel the hamstrings')),
            rounds('Accessory', 2, bm('kb_swing', 10, loadNote='light'), bm('dead_bug', 10), cap=300),
            steady('Cool-down', 'row', 600, 'easy'),
        ],
        ['day:recovery', 'deload'],
        'Hinge-pattern deload session (R29, R41).',
        cadence=7,
    ),
    workout(
        'v2-deload-press-pull-technique', 'Deload: press + pull technique at 60%', 'L',
        [
            wu_upper('bike'),
            strength('Strength', 3, 120, bm('strict_press', 5, loadPct=60, targetRpe=6)),
            rounds('Accessory', 2, bm('ring_row', 10), bm('kb_press', 8, loadNote='light, each arm'),
                   cap=300),
            steady('Cool-down', 'bike', 600, 'easy spin'),
        ],
        ['day:recovery', 'deload'],
        'Upper-body deload session (R29, R41).',
        cadence=7,
    ),
    workout(
        'v2-core-stability-diversity', 'Core & stability diversity day', 'L',
        [
            wu_lower('row'),
            rounds('Stability', 4, bm('turkish_getup', 2, loadNote='each side, light'),
                   bm('landmine_twist', 8, loadNote='each side'), bm('dead_bug', 10),
                   bm('plank', seconds=45), bm('farmers_carry', 1, loadNote='40 m'), cap=900),
            steady('Cool-down', 'row', 600, 'easy'),
        ],
        ['diversity', 'day:recovery'],
        'requirements.md\'s technical/diversity day: stability muscles, no heavy barbell.',
        cadence=7,
    ),
    workout(
        'v2-unilateral-diversity', 'Unilateral diversity: pistols / single-leg RDL', 'M',
        [
            wu_lower('bike'),
            strength('Strength', 4, 60, bm('pistol_squat', 8,
                                           loadNote='pistol, lunge or side lunge - pick one per set')),
            strength('Accessory', 3, 60, bm('single_leg_rdl', 8, loadNote='each leg'), bm('step_up', 10)),
            interval('Finisher', 6, 30, 30, bm('bike', seconds=30, loadNote='moderate')),
        ],
        ['diversity'],
        'Single-leg strength and balance (requirements.md diversity day); bodyweight rest '
        'intervals per R11.',
    ),
]

NEW_WORKOUTS = STRENGTH + POWER + STAMINA + RECOVERY


def main():
    with open(MOVEMENTS) as f:
        movements = json.load(f)
    with open(POOL) as f:
        pool = json.load(f)

    movement_ids = {m['id'] for m in movements}
    added_movements = [m for m in NEW_MOVEMENTS if m['id'] not in movement_ids]
    movements.extend(added_movements)

    pool_ids = {w['id'] for w in pool}
    added_workouts = [w for w in NEW_WORKOUTS if w['id'] not in pool_ids]
    pool.extend(added_workouts)

    with open(MOVEMENTS, 'w') as f:
        json.dump(movements, f, indent=2)
        f.write('\n')
    with open(POOL, 'w') as f:
        json.dump(pool, f, indent=2)
        f.write('\n')

    print(f'movements: +{len(added_movements)} -> {len(movements)}')
    print(f'pool:      +{len(added_workouts)} -> {len(pool)}')


if __name__ == '__main__':
    main()
