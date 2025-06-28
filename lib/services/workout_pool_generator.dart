import 'dart:math' as math;
import 'package:workout_app/data/models/workout_pool.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:logger/logger.dart';

/// Comprehensive workout pool generator that creates extensive default pools
/// using movement.json data and documented workout patterns
class WorkoutPoolGenerator {
  final Logger _logger = Logger();

  /// Generate extensive default workout pools using template-based approach
  Future<List<WorkoutPool>> generateExtensiveWorkoutPools(List<Movement> movements) async {
    _logger.i('Generating extensive workout pools from ${movements.length} movements...');

    final pools = <WorkoutPool>[];
    final now = DateTime.now();

    // Group movements by patterns for efficient combinatorics
    final movementGroups = _categorizeMovements(movements);

    // 1. Core Strength Templates (Weekly Cadence)
    pools.addAll(await _generateStrengthWorkouts(movementGroups, now));

    // 2. Olympic Lift Templates (Bi-weekly Cadence)
    pools.addAll(await _generateOlympicLiftWorkouts(movementGroups, now));

    // 3. MetCon Templates (2-3x per week)
    pools.addAll(await _generateMetConWorkouts(movementGroups, now));

    // 4. EMOM Templates (2x per week)
    pools.addAll(await _generateEMOMWorkouts(movementGroups, now));

    // 5. AMRAP Templates (2x per week)
    pools.addAll(await _generateAMRAPWorkouts(movementGroups, now));

    // 6. Bodyweight Templates (Daily potential)
    pools.addAll(await _generateBodyweightWorkouts(movementGroups, now));

    // 7. Cardio Templates (2-3x per week)
    pools.addAll(await _generateCardioWorkouts(movementGroups, now));

    // 8. Hybrid Templates (Weekly)
    pools.addAll(await _generateHybridWorkouts(movementGroups, now));

    // 9. Specialty Templates (Monthly/Bi-weekly)
    pools.addAll(await _generateSpecialtyWorkouts(movementGroups, now));

    _logger.i('Generated ${pools.length} workout pools');
    return pools;
  }

  /// Categorize movements into functional groups for template generation
  MovementGroups _categorizeMovements(List<Movement> movements) {
    final groups = MovementGroups();

    for (final movement in movements) {
      // Primary categorization by movement ID patterns and categories
      final id = movement.id.toLowerCase();
      final name = movement.name.toLowerCase();

      // Deadlift variations
      if (id.contains('deadlift') || name.contains('deadlift')) {
        groups.deadlifts.add(movement);
      }

      // Squat variations
      if (id.contains('squat') || name.contains('squat')) {
        groups.squats.add(movement);
      }

      // Press movements
      if (id.contains('press') || name.contains('press') || name.contains('push')) {
        groups.presses.add(movement);
      }

      // Pull movements
      if (id.contains('pull') || id.contains('row') || name.contains('pull') || name.contains('row')) {
        groups.pulls.add(movement);
      }

      // Olympic lifts
      if (id.contains('clean') || id.contains('snatch') || id.contains('jerk') ||
          name.contains('clean') || name.contains('snatch') || name.contains('jerk')) {
        groups.olympicLifts.add(movement);
      }

      // Bodyweight movements
      if (movement.requiredEquipment.isEmpty || 
          movement.requiredEquipment.contains(EquipmentType.bodyweight) ||
          id.contains('push-up') || id.contains('burpee') || id.contains('sit-up')) {
        groups.bodyweight.add(movement);
      }

      // Cardio movements
      if (movement.categories.contains(MovementCategory.cardio) ||
          id.contains('bike') || id.contains('row') || id.contains('run')) {
        groups.cardio.add(movement);
      }

      // Kettlebell movements
      if (movement.requiredEquipment.contains(EquipmentType.kettlebell) ||
          id.contains('kettlebell') || name.contains('kettlebell')) {
        groups.kettlebell.add(movement);
      }

      // Gymnastic movements
      if (movement.categories.contains(MovementCategory.bodyweight) ||
          id.contains('ring') || id.contains('muscle-up') || id.contains('handstand')) {
        groups.gymnastic.add(movement);
      }

      // Accessory movements
      if (movement.categories.contains(MovementCategory.accessory) ||
          movement.difficultyLevel == DifficultyLevel.beginner) {
        groups.accessory.add(movement);
      }

      // Core movements
      if (movement.muscleGroups.contains(MuscleGroup.core) ||
          id.contains('sit-up') || id.contains('plank')) {
        groups.core.add(movement);
      }
    }

    _logger.i('Categorized movements: ${groups.summary()}');
    return groups;
  }

  /// Generate strength-focused workouts (weekly cadence)
  Future<List<WorkoutPool>> _generateStrengthWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    // Heavy Deadlift + Push Press (as specified in requirements)
    if (groups.deadlifts.isNotEmpty && groups.presses.isNotEmpty) {
      pools.add(WorkoutPool(
        id: 'pool_heavy_deadlift_press_${now.millisecondsSinceEpoch}_1',
        name: 'Heavy Deadlift + Push Press',
        description: 'Classic strength combination - deadlifts every 7 days as specified',
        format: WorkoutFormat.forReps,
        intensity: IntensityLevel.high,
        movements: [
          WorkoutMovement(movementId: groups.deadlifts.first.id, reps: 5),
          WorkoutMovement(movementId: groups.presses.first.id, reps: 5),
        ],
        duration: 45,
        cadenceDays: 7, // Weekly as specified
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Squat + Pull combinations
    if (groups.squats.isNotEmpty && groups.pulls.isNotEmpty) {
      for (int i = 0; i < math.min(groups.squats.length, 3); i++) {
        for (int j = 0; j < math.min(groups.pulls.length, 2); j++) {
          pools.add(WorkoutPool(
            id: 'pool_squat_pull_${now.millisecondsSinceEpoch}_${i}_${j}',
            name: '${groups.squats[i].name} + ${groups.pulls[j].name}',
            description: 'Lower body and pulling strength focus',
            format: WorkoutFormat.forReps,
            intensity: IntensityLevel.high,
            movements: [
              WorkoutMovement(movementId: groups.squats[i].id, reps: 8),
              WorkoutMovement(movementId: groups.pulls[j].id, reps: 8),
            ],
            duration: 40,
            cadenceDays: 7,
            createdAt: now,
            updatedAt: now,
          ));
        }
      }
    }

    // Bench + Accessory combinations
    final benchMovements = groups.presses.where((m) => m.id.contains('bench')).toList();
    if (benchMovements.isNotEmpty && groups.accessory.isNotEmpty) {
      for (int i = 0; i < math.min(benchMovements.length, 2); i++) {
        for (int j = 0; j < math.min(groups.accessory.length, 3); j++) {
          pools.add(WorkoutPool(
            id: 'pool_bench_accessory_${now.millisecondsSinceEpoch}_${i}_${j}',
            name: '${benchMovements[i].name} + ${groups.accessory[j].name}',
            description: 'Upper body strength with accessory work',
            format: WorkoutFormat.forReps,
            intensity: IntensityLevel.medium,
            movements: [
              WorkoutMovement(movementId: benchMovements[i].id, reps: 8),
              WorkoutMovement(movementId: groups.accessory[j].id, reps: 12),
            ],
            duration: 35,
            cadenceDays: 7,
            createdAt: now,
            updatedAt: now,
          ));
        }
      }
    }

    return pools;
  }

  /// Generate Olympic lift workouts (bi-weekly cadence)
  Future<List<WorkoutPool>> _generateOlympicLiftWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    if (groups.olympicLifts.isEmpty) return pools;

    // Clean variations
    final cleanMovements = groups.olympicLifts.where((m) => m.id.contains('clean')).toList();
    for (final clean in cleanMovements) {
      // EMOM Clean (as specified in requirements)
      pools.add(WorkoutPool(
        id: 'pool_emom_${clean.id}_${now.millisecondsSinceEpoch}',
        name: 'EMOM 10 minutes 5 ${clean.name}',
        description: 'Every minute on the minute ${clean.name.toLowerCase()} practice',
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        movements: [
          WorkoutMovement(movementId: clean.id, reps: 5),
        ],
        duration: 10,
        formatSpecificSettings: {'minutes': 10, 'intervalSeconds': 60},
        cadenceDays: 3,
        createdAt: now,
        updatedAt: now,
      ));

      // Clean + Front Squat complex
      if (groups.squats.isNotEmpty) {
        final frontSquats = groups.squats.where((s) => s.name.toLowerCase().contains('front')).toList();
        if (frontSquats.isNotEmpty) {
          pools.add(WorkoutPool(
            id: 'pool_clean_front_squat_${now.millisecondsSinceEpoch}',
            name: '${clean.name} + ${frontSquats.first.name}',
            description: 'Olympic lift complex with front squat',
            format: WorkoutFormat.forReps,
            intensity: IntensityLevel.high,
            movements: [
              WorkoutMovement(movementId: clean.id, reps: 3),
              WorkoutMovement(movementId: frontSquats.first.id, reps: 5),
            ],
            duration: 30,
            cadenceDays: 10,
            createdAt: now,
            updatedAt: now,
          ));
        }
      }
    }

    // Snatch variations
    final snatchMovements = groups.olympicLifts.where((m) => m.id.contains('snatch')).toList();
    for (final snatch in snatchMovements) {
      pools.add(WorkoutPool(
        id: 'pool_snatch_skill_${snatch.id}_${now.millisecondsSinceEpoch}',
        name: '${snatch.name} Skill Work',
        description: 'Technical ${snatch.name.toLowerCase()} practice',
        format: WorkoutFormat.forReps,
        intensity: IntensityLevel.medium,
        movements: [
          WorkoutMovement(movementId: snatch.id, reps: 3),
        ],
        duration: 25,
        cadenceDays: 14,
        createdAt: now,
        updatedAt: now,
      ));
    }

    return pools;
  }

  /// Generate MetCon (Metabolic Conditioning) workouts
  Future<List<WorkoutPool>> _generateMetConWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    // High-intensity mixed modality workouts
    final movements = [
      ...groups.bodyweight.take(5),
      ...groups.kettlebell.take(3),
      ...groups.cardio.take(2),
    ];

    if (movements.length >= 3) {
      // 3-movement MetCons
      for (int i = 0; i < movements.length - 2; i++) {
        for (int j = i + 1; j < movements.length - 1; j++) {
          for (int k = j + 1; k < movements.length; k++) {
            // Skip if all movements are the same category
            final movs = [movements[i], movements[j], movements[k]];
            if (_areMovementsDiverse(movs)) {
              pools.add(WorkoutPool(
                id: 'pool_metcon_3_${now.millisecondsSinceEpoch}_${i}_${j}_${k}',
                name: 'MetCon: ${movements[i].name}/${movements[j].name}/${movements[k].name}',
                description: 'High-intensity metabolic conditioning',
                format: WorkoutFormat.roundsForTime,
                intensity: IntensityLevel.high,
                movements: [
                  WorkoutMovement(movementId: movements[i].id, reps: _getOptimalReps(movements[i])),
                  WorkoutMovement(movementId: movements[j].id, reps: _getOptimalReps(movements[j])),
                  WorkoutMovement(movementId: movements[k].id, reps: _getOptimalReps(movements[k])),
                ],
                rounds: 5,
                duration: 15,
                timeCapInMinutes: 15,
                cadenceDays: 3,
                createdAt: now,
                updatedAt: now,
              ));
            }
          }
        }
      }
    }

    return pools.take(15).toList(); // Limit to prevent explosion
  }

  /// Generate EMOM workouts
  Future<List<WorkoutPool>> _generateEMOMWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    // Single movement EMOMs
    final emomMovements = [
      ...groups.olympicLifts,
      ...groups.bodyweight.take(3),
      ...groups.kettlebell.take(2),
    ];

    for (final movement in emomMovements) {
      final reps = _getEMOMReps(movement);
      final minutes = _getEMOMMinutes(movement);

      pools.add(WorkoutPool(
        id: 'pool_emom_${movement.id}_${now.millisecondsSinceEpoch}',
        name: 'EMOM $minutes min - $reps ${movement.name}',
        description: 'Every minute on the minute ${movement.name.toLowerCase()}',
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        movements: [
          WorkoutMovement(movementId: movement.id, reps: reps),
        ],
        duration: minutes,
        formatSpecificSettings: {'minutes': minutes, 'intervalSeconds': 60},
        cadenceDays: 3,
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Alternating EMOMs
    if (emomMovements.length >= 2) {
      for (int i = 0; i < math.min(emomMovements.length - 1, 5); i++) {
        for (int j = i + 1; j < math.min(emomMovements.length, 6); j++) {
          pools.add(WorkoutPool(
            id: 'pool_emom_alt_${now.millisecondsSinceEpoch}_${i}_${j}',
            name: 'EMOM Alt: ${emomMovements[i].name}/${emomMovements[j].name}',
            description: 'Alternating EMOM between two movements',
            format: WorkoutFormat.emom,
            intensity: IntensityLevel.medium,
            movements: [
              WorkoutMovement(movementId: emomMovements[i].id, reps: _getEMOMReps(emomMovements[i])),
              WorkoutMovement(movementId: emomMovements[j].id, reps: _getEMOMReps(emomMovements[j])),
            ],
            duration: 12,
            formatSpecificSettings: {'minutes': 12, 'intervalSeconds': 60, 'alternating': true},
            cadenceDays: 4,
            createdAt: now,
            updatedAt: now,
          ));
        }
      }
    }

    return pools.take(20).toList();
  }

  /// Generate AMRAP workouts
  Future<List<WorkoutPool>> _generateAMRAPWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    // Bodyweight AMRAP (as mentioned in current service)
    if (groups.bodyweight.length >= 3) {
      final selectedMovements = groups.bodyweight.take(3).toList();
      pools.add(WorkoutPool(
        id: 'pool_amrap_bodyweight_${now.millisecondsSinceEpoch}',
        name: 'AMRAP Bodyweight Circuit',
        description: 'High volume bodyweight movements',
        format: WorkoutFormat.amrap,
        intensity: IntensityLevel.medium,
        movements: selectedMovements.map((m) => 
            WorkoutMovement(movementId: m.id, reps: 10)).toList(),
        duration: 15,
        timeCapInMinutes: 15,
        cadenceDays: 3,
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Mixed AMRAP combinations
    final amrapMovements = [
      ...groups.bodyweight.take(4),
      ...groups.kettlebell.take(2),
      ...groups.accessory.take(3),
    ];

    if (amrapMovements.length >= 2) {
      for (int duration in [10, 15, 20]) {
        for (int i = 0; i < math.min(amrapMovements.length - 1, 4); i++) {
          for (int j = i + 1; j < math.min(amrapMovements.length, 5); j++) {
            if (_areMovementsDiverse([amrapMovements[i], amrapMovements[j]])) {
              pools.add(WorkoutPool(
                id: 'pool_amrap_${duration}_${now.millisecondsSinceEpoch}_${i}_${j}',
                name: 'AMRAP $duration min: ${amrapMovements[i].name}/${amrapMovements[j].name}',
                description: '$duration minute AMRAP',
                format: WorkoutFormat.amrap,
                intensity: duration <= 10 ? IntensityLevel.high : IntensityLevel.medium,
                movements: [
                  WorkoutMovement(movementId: amrapMovements[i].id, reps: _getAMRAPReps(amrapMovements[i])),
                  WorkoutMovement(movementId: amrapMovements[j].id, reps: _getAMRAPReps(amrapMovements[j])),
                ],
                duration: duration,
                timeCapInMinutes: duration,
                cadenceDays: 3,
                createdAt: now,
                updatedAt: now,
              ));
            }
          }
        }
      }
    }

    return pools.take(15).toList();
  }

  /// Generate bodyweight workouts
  Future<List<WorkoutPool>> _generateBodyweightWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    if (groups.bodyweight.isEmpty) return pools;

    // Daily bodyweight options
    for (final movement in groups.bodyweight.take(8)) {
      pools.add(WorkoutPool(
        id: 'pool_bodyweight_${movement.id}_${now.millisecondsSinceEpoch}',
        name: '${movement.name} Focus',
        description: 'Bodyweight ${movement.name.toLowerCase()} workout',
        format: WorkoutFormat.forReps,
        intensity: IntensityLevel.low,
        movements: [
          WorkoutMovement(movementId: movement.id, reps: _getBodyweightReps(movement)),
        ],
        duration: 20,
        cadenceDays: 1, // Can be done daily
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Bodyweight circuits
    if (groups.bodyweight.length >= 4) {
      for (int i = 0; i < math.min(groups.bodyweight.length - 3, 3); i++) {
        pools.add(WorkoutPool(
          id: 'pool_bodyweight_circuit_${now.millisecondsSinceEpoch}_${i}',
          name: 'Bodyweight Circuit ${i + 1}',
          description: 'Full body bodyweight circuit',
          format: WorkoutFormat.roundsForTime,
          intensity: IntensityLevel.medium,
          movements: groups.bodyweight.skip(i).take(4).map((m) => 
              WorkoutMovement(movementId: m.id, reps: _getBodyweightReps(m))).toList(),
          rounds: 3,
          duration: 25,
          cadenceDays: 2,
          createdAt: now,
          updatedAt: now,
        ));
      }
    }

    return pools;
  }

  /// Generate cardio workouts
  Future<List<WorkoutPool>> _generateCardioWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    if (groups.cardio.isEmpty) return pools;

    // Intervals cycling/rowing (as specified in requirements)
    for (final cardio in groups.cardio.take(3)) {
      pools.add(WorkoutPool(
        id: 'pool_intervals_${cardio.id}_${now.millisecondsSinceEpoch}',
        name: 'Intervals - ${cardio.name}',
        description: 'High intensity ${cardio.name.toLowerCase()} intervals',
        format: WorkoutFormat.roundsForTime,
        intensity: IntensityLevel.high,
        movements: [
          WorkoutMovement(movementId: cardio.id, reps: 1, timeInSeconds: 300), // 5 minutes
        ],
        duration: 20,
        rounds: 4,
        cadenceDays: 2,
        createdAt: now,
        updatedAt: now,
      ));

      // Steady state cardio
      pools.add(WorkoutPool(
        id: 'pool_steady_${cardio.id}_${now.millisecondsSinceEpoch}',
        name: 'Steady State ${cardio.name}',
        description: 'Moderate effort endurance work',
        format: WorkoutFormat.forTime,
        intensity: IntensityLevel.low,
        movements: [
          WorkoutMovement(movementId: cardio.id, reps: 1, timeInSeconds: 1500), // 25 minutes
        ],
        duration: 25,
        cadenceDays: 30, // Monthly slog as mentioned in requirements
        createdAt: now,
        updatedAt: now,
      ));
    }

    return pools;
  }

  /// Generate hybrid workouts (strength + cardio)
  Future<List<WorkoutPool>> _generateHybridWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    // Strength + burst cardio (most common pattern per requirements)
    if (groups.deadlifts.isNotEmpty && groups.bodyweight.isNotEmpty) {
      for (final deadlift in groups.deadlifts.take(2)) {
        for (final cardio in groups.bodyweight.take(3)) {
          pools.add(WorkoutPool(
            id: 'pool_strength_cardio_${now.millisecondsSinceEpoch}_${deadlift.id}_${cardio.id}',
            name: '${deadlift.name} + ${cardio.name} Burst',
            description: 'Strength + burst cardio pattern',
            format: WorkoutFormat.roundsForTime,
            intensity: IntensityLevel.high,
            movements: [
              WorkoutMovement(movementId: deadlift.id, reps: 5),
              WorkoutMovement(movementId: cardio.id, reps: 10),
            ],
            rounds: 5,
            duration: 20,
            cadenceDays: 5,
            createdAt: now,
            updatedAt: now,
          ));
        }
      }
    }

    return pools.take(10).toList();
  }

  /// Generate specialty workouts (monthly/bi-weekly)
  Future<List<WorkoutPool>> _generateSpecialtyWorkouts(MovementGroups groups, DateTime now) async {
    final pools = <WorkoutPool>[];

    // Technical/diversity day (per requirements)
    if (groups.gymnastic.isNotEmpty && groups.accessory.isNotEmpty) {
      pools.add(WorkoutPool(
        id: 'pool_technical_diversity_${now.millisecondsSinceEpoch}',
        name: 'Technical Diversity Day',
        description: 'Focus on stability muscles and movement quality',
        format: WorkoutFormat.forReps,
        intensity: IntensityLevel.low,
        movements: [
          ...groups.gymnastic.take(2).map((m) => WorkoutMovement(movementId: m.id, reps: 8)),
          ...groups.accessory.take(2).map((m) => WorkoutMovement(movementId: m.id, reps: 12)),
        ],
        duration: 40,
        cadenceDays: 7,
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Long slog workouts (monthly per requirements)
    if (groups.cardio.isNotEmpty || groups.bodyweight.isNotEmpty) {
      final movements = [...groups.cardio, ...groups.bodyweight];
      for (final movement in movements.take(3)) {
        pools.add(WorkoutPool(
          id: 'pool_slog_${movement.id}_${now.millisecondsSinceEpoch}',
          name: 'Monthly Slog - ${movement.name}',
          description: '25 minute moderate effort endurance work',
          format: WorkoutFormat.forTime,
          intensity: IntensityLevel.low,
          movements: [
            WorkoutMovement(movementId: movement.id, reps: 1, timeInSeconds: 1500),
          ],
          duration: 25,
          cadenceDays: 30, // Monthly
          createdAt: now,
          updatedAt: now,
        ));
      }
    }

    return pools;
  }

  // Helper methods for rep calculations
  int _getOptimalReps(Movement movement) {
    if (movement.categories.contains(MovementCategory.cardio)) return 1;
    if (movement.difficultyLevel == DifficultyLevel.advanced) return 3;
    if (movement.difficultyLevel == DifficultyLevel.intermediate) return 5;
    return 10;
  }

  int _getEMOMReps(Movement movement) {
    if (movement.categories.contains(MovementCategory.compoundLift)) return 3;
    if (movement.difficultyLevel == DifficultyLevel.advanced) return 2;
    return 5;
  }

  int _getEMOMMinutes(Movement movement) {
    if (movement.categories.contains(MovementCategory.compoundLift)) return 8;
    if (movement.difficultyLevel == DifficultyLevel.advanced) return 6;
    return 10;
  }

  int _getAMRAPReps(Movement movement) {
    if (movement.categories.contains(MovementCategory.cardio)) return 1;
    if (movement.difficultyLevel == DifficultyLevel.advanced) return 3;
    return 8;
  }

  int _getBodyweightReps(Movement movement) {
    if (movement.name.toLowerCase().contains('burpee')) return 5;
    if (movement.name.toLowerCase().contains('push-up')) return 10;
    return 15;
  }

  bool _areMovementsDiverse(List<Movement> movements) {
    final categories = movements.map((m) => m.categories.first).toSet();
    return categories.length > 1; // Different movement categories
  }
}

/// Data structure to organize movements by functional groups
class MovementGroups {
  final List<Movement> deadlifts = [];
  final List<Movement> squats = [];
  final List<Movement> presses = [];
  final List<Movement> pulls = [];
  final List<Movement> olympicLifts = [];
  final List<Movement> bodyweight = [];
  final List<Movement> cardio = [];
  final List<Movement> kettlebell = [];
  final List<Movement> gymnastic = [];
  final List<Movement> accessory = [];
  final List<Movement> core = [];

  String summary() {
    return 'Deadlifts: ${deadlifts.length}, Squats: ${squats.length}, '
           'Presses: ${presses.length}, Pulls: ${pulls.length}, '
           'Olympic: ${olympicLifts.length}, Bodyweight: ${bodyweight.length}, '
           'Cardio: ${cardio.length}, Kettlebell: ${kettlebell.length}, '
           'Gymnastic: ${gymnastic.length}, Accessory: ${accessory.length}, '
           'Core: ${core.length}';
  }
}