import 'dart:math' as math show Random, max;
import 'package:workout_app/data/models/workout_pool.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/movement_cadence.dart';
import 'package:workout_app/data/repositories/workout_pool_repository.dart';
import 'package:workout_app/data/repositories/movement_cadence_repository.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:logger/logger.dart';

class WorkoutPoolService {
  final WorkoutPoolRepository _workoutPoolRepository;
  final MovementCadenceRepository _movementCadenceRepository;
  final MovementRepository _movementRepository;
  final Logger _logger = Logger();

  WorkoutPoolService({
    required WorkoutPoolRepository workoutPoolRepository,
    required MovementCadenceRepository movementCadenceRepository,
    required MovementRepository movementRepository,
  })  : _workoutPoolRepository = workoutPoolRepository,
        _movementCadenceRepository = movementCadenceRepository,
        _movementRepository = movementRepository;

  /// Get today's workout from the pool using intelligent selection
  Future<Workout?> getTodaysWorkout({
    List<String>? availableEquipmentIds,
    IntensityLevel? preferredIntensity,
    WorkoutFormat? preferredFormat,
    DateTime? forDate,
  }) async {
    try {
      forDate ??= DateTime.now();

      // Get available workout pools
      final availablePools = await _getAvailableWorkoutPools(
        availableEquipmentIds: availableEquipmentIds,
        forDate: forDate,
      );

      if (availablePools.isEmpty) {
        _logger.w('No available workouts in pool for date: $forDate');
        return null;
      }

      // Filter by preferences if provided
      List<WorkoutPool> filteredPools = availablePools;
      
      if (preferredIntensity != null) {
        filteredPools = filteredPools.where((pool) => pool.intensity == preferredIntensity).toList();
      }
      
      if (preferredFormat != null) {
        filteredPools = filteredPools.where((pool) => pool.format == preferredFormat).toList();
      }

      // If filtering resulted in no workouts, fall back to all available
      if (filteredPools.isEmpty) {
        filteredPools = availablePools;
      }

      // Select workout using smart algorithm
      final selectedPool = await _selectWorkoutFromPool(filteredPools, forDate);

      if (selectedPool == null) {
        _logger.w('Failed to select workout from pool');
        return null;
      }

      // Convert to workout and return
      return selectedPool.toWorkout();
    } catch (e, stackTrace) {
      _logger.e('Error getting today\'s workout', error: e, stackTrace: stackTrace);
      return null;
    }
  }

  /// Mark a workout as performed and update cadences
  Future<void> markWorkoutAsPerformed(String workoutPoolId, {DateTime? performedAt}) async {
    try {
      performedAt ??= DateTime.now();

      // Mark workout pool as performed
      await _workoutPoolRepository.markWorkoutPoolAsPerformed(workoutPoolId, performedAt: performedAt);

      // Update movement cadences for all movements in the workout
      final workoutPool = await _workoutPoolRepository.getWorkoutPoolById(workoutPoolId);
      if (workoutPool != null) {
        for (final movement in workoutPool.movements) {
          await _movementCadenceRepository.markMovementAsPerformed(
            movement.movementId,
            performedAt: performedAt,
          );
        }
      }

      _logger.i('Marked workout as performed: $workoutPoolId');
    } catch (e, stackTrace) {
      _logger.e('Error marking workout as performed', error: e, stackTrace: stackTrace);
      rethrow;
    }
  }

  /// Get all available workout pools with cadence and equipment filtering
  Future<List<WorkoutPool>> _getAvailableWorkoutPools({
    List<String>? availableEquipmentIds,
    DateTime? forDate,
  }) async {
    List<WorkoutPool> pools;

    if (availableEquipmentIds != null && availableEquipmentIds.isNotEmpty) {
      // Filter by available equipment
      pools = await _workoutPoolRepository.getWorkoutPoolsByEquipment(availableEquipmentIds);
    } else {
      // Get all enabled pools
      pools = await _workoutPoolRepository.getEnabledWorkoutPools();
    }

    // Filter by availability (cadence-based)
    forDate ??= DateTime.now();
    final availablePools = pools.where((pool) => 
        pool.isAvailableForSelection(currentDate: forDate)).toList();

    // Additional filtering based on movement cadences
    final cadenceFilteredPools = <WorkoutPool>[];
    
    for (final pool in availablePools) {
      if (await _isWorkoutPoolAvailableBasedOnMovementCadences(pool, forDate)) {
        cadenceFilteredPools.add(pool);
      }
    }

    return cadenceFilteredPools;
  }

  /// Check if a workout pool is available based on its movement cadences
  Future<bool> _isWorkoutPoolAvailableBasedOnMovementCadences(
    WorkoutPool pool,
    DateTime forDate,
  ) async {
    try {
      // Get cadences for all movements in the workout
      for (final movement in pool.movements) {
        final cadence = await _movementCadenceRepository.getMovementCadenceByMovementId(movement.movementId);
        
        // If movement has a cadence restriction and isn't available, skip this workout
        if (cadence != null && !cadence.isAvailableForSelection(currentDate: forDate)) {
          return false;
        }
      }
      
      return true;
    } catch (e) {
      _logger.w('Error checking movement cadences for pool ${pool.id}: $e');
      return true; // Allow workout if cadence check fails
    }
  }

  /// Smart workout selection algorithm
  Future<WorkoutPool?> _selectWorkoutFromPool(List<WorkoutPool> pools, DateTime forDate) async {
    if (pools.isEmpty) return null;
    if (pools.length == 1) return pools.first;

    try {
      // Score each workout based on various factors
      final scoredWorkouts = <_ScoredWorkout>[];
      
      for (final pool in pools) {
        final score = await _calculateWorkoutScore(pool, forDate);
        scoredWorkouts.add(_ScoredWorkout(pool, score));
      }

      // Sort by score (highest first)
      scoredWorkouts.sort((a, b) => b.score.compareTo(a.score));

      // Add some randomness to prevent always picking the same workout
      // Select from top 3 or top 25% (whichever is larger)
      final selectionPoolSize = math.max(3, (scoredWorkouts.length * 0.25).ceil());
      final topWorkouts = scoredWorkouts.take(selectionPoolSize).toList();

      // Randomly select from top workouts
      final random = math.Random();
      final selectedWorkout = topWorkouts[random.nextInt(topWorkouts.length)];

      _logger.i('Selected workout: ${selectedWorkout.pool.name} (score: ${selectedWorkout.score})');
      return selectedWorkout.pool;
    } catch (e) {
      _logger.w('Error in smart selection, falling back to random: $e');
      // Fallback to random selection
      final random = math.Random();
      return pools[random.nextInt(pools.length)];
    }
  }

  /// Calculate a score for a workout based on various factors
  Future<double> _calculateWorkoutScore(WorkoutPool pool, DateTime forDate) async {
    double score = 0.0;

    try {
      // Factor 1: Time since last performed (higher score for longer time)
      if (pool.lastPerformed != null) {
        final daysSincePerformed = forDate.difference(pool.lastPerformed!).inDays;
        score += daysSincePerformed * 2.0; // 2 points per day
      } else {
        score += 100.0; // High score for never performed
      }

      // Factor 2: Cadence compliance (higher score if over cadence threshold)
      if (pool.lastPerformed != null) {
        final daysSincePerformed = forDate.difference(pool.lastPerformed!).inDays;
        if (daysSincePerformed >= pool.cadenceDays) {
          final overCadenceDays = daysSincePerformed - pool.cadenceDays;
          score += overCadenceDays * 3.0; // 3 points per day over cadence
        }
      }

      // Factor 3: Movement variety (higher score for movements not recently performed)
      double movementScore = 0.0;
      for (final movement in pool.movements) {
        final cadence = await _movementCadenceRepository.getMovementCadenceByMovementId(movement.movementId);
        if (cadence?.lastPerformed != null) {
          final daysSinceMovement = forDate.difference(cadence!.lastPerformed!).inDays;
          movementScore += daysSinceMovement * 1.0; // 1 point per day since movement
        } else {
          movementScore += 50.0; // High score for never performed movement
        }
      }
      score += movementScore / pool.movements.length; // Average movement score

      // Factor 4: Intensity balance (slight preference for variety)
      // This could be enhanced with workout history analysis

      // Factor 5: Small random factor for variety
      final random = math.Random();
      score += random.nextDouble() * 5.0; // 0-5 random points

      return score;
    } catch (e) {
      _logger.w('Error calculating workout score for ${pool.id}: $e');
      return math.Random().nextDouble() * 10.0; // Fallback random score
    }
  }

  /// Initialize the workout pool with default workouts
  Future<void> initializeDefaultWorkoutPool() async {
    try {
      _logger.i('Initializing default workout pool...');

      // Check if pools already exist
      final existingPools = await _workoutPoolRepository.getAllWorkoutPools();
      if (existingPools.isNotEmpty) {
        _logger.i('Workout pool already initialized with ${existingPools.length} workouts');
        return;
      }

      // Get available movements
      final allMovements = await _movementRepository.getAllMovements();
      if (allMovements.isEmpty) {
        _logger.w('No movements available for workout pool initialization');
        return;
      }

      // Initialize movement cadences
      final movementIds = allMovements.map((m) => m.id).toList();
      await _movementCadenceRepository.initializeDefaultCadences(movementIds);

      // Create default workout pools
      await _createDefaultWorkoutPools(allMovements);

      _logger.i('Default workout pool initialized successfully');
    } catch (e, stackTrace) {
      _logger.e('Error initializing default workout pool', error: e, stackTrace: stackTrace);
      rethrow;
    }
  }

  /// Create default workout pools with predefined workouts
  Future<void> _createDefaultWorkoutPools(List<Movement> movements) async {
    final now = DateTime.now();
    
    // Group movements by category for easier workout creation
    final deadliftMovements = movements.where((m) => m.name.toLowerCase().contains('deadlift')).toList();
    final squatMovements = movements.where((m) => m.name.toLowerCase().contains('squat')).toList();
    final pushMovements = movements.where((m) => 
        m.name.toLowerCase().contains('press') || 
        m.name.toLowerCase().contains('push')).toList();
    final pullMovements = movements.where((m) => 
        m.name.toLowerCase().contains('pull') || 
        m.name.toLowerCase().contains('row')).toList();
    final cardioMovements = movements.where((m) => 
        m.categories.contains(MovementCategory.cardio)).toList();

    final workoutPools = <WorkoutPool>[];

    // Heavy Deadlift + Push Press (Weekly - matches requirements)
    if (deadliftMovements.isNotEmpty && pushMovements.isNotEmpty) {
      workoutPools.add(WorkoutPool(
        id: 'pool_deadlift_push_${now.millisecondsSinceEpoch}',
        name: 'Heavy Deadlift + Push Press',
        description: 'Classic strength combination - deadlifts every 7 days',
        format: WorkoutFormat.forReps,
        intensity: IntensityLevel.high,
        movements: [
          WorkoutMovement(movementId: deadliftMovements.first.id, reps: 5),
          WorkoutMovement(movementId: pushMovements.first.id, reps: 5),
        ],
        duration: 45,
        cadenceDays: 7, // Weekly as specified in requirements
        createdAt: now,
        updatedAt: now,
      ));
    }

    // EMOM 10 minutes 5 cleans (as specified in requirements)
    final cleanMovements = movements.where((m) => m.name.toLowerCase().contains('clean')).toList();
    if (cleanMovements.isNotEmpty) {
      workoutPools.add(WorkoutPool(
        id: 'pool_emom_clean_${now.millisecondsSinceEpoch}',
        name: 'EMOM 10 minutes 5 cleans',
        description: 'Every minute on the minute clean practice',
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        movements: [
          WorkoutMovement(movementId: cleanMovements.first.id, reps: 5),
        ],
        duration: 10,
        formatSpecificSettings: {'minutes': 10, 'intervalSeconds': 60},
        cadenceDays: 3, // Twice weekly
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Intervals cycling/rowing (as specified in requirements)
    if (cardioMovements.isNotEmpty) {
      workoutPools.add(WorkoutPool(
        id: 'pool_intervals_cardio_${now.millisecondsSinceEpoch}',
        name: 'Intervals - Cycling/Rowing',
        description: 'High intensity cardio intervals',
        format: WorkoutFormat.roundsForTime,
        intensity: IntensityLevel.high,
        movements: [
          WorkoutMovement(movementId: cardioMovements.first.id, reps: 1, timeInSeconds: 300), // 5 minutes
        ],
        duration: 20,
        rounds: 4,
        cadenceDays: 2, // Every other day
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Add more default workouts...
    // Squat + Pull workout
    if (squatMovements.isNotEmpty && pullMovements.isNotEmpty) {
      workoutPools.add(WorkoutPool(
        id: 'pool_squat_pull_${now.millisecondsSinceEpoch}',
        name: 'Squat & Pull Strength',
        description: 'Lower body and pulling strength focus',
        format: WorkoutFormat.forReps,
        intensity: IntensityLevel.high,
        movements: [
          WorkoutMovement(movementId: squatMovements.first.id, reps: 8),
          WorkoutMovement(movementId: pullMovements.first.id, reps: 8),
        ],
        duration: 40,
        cadenceDays: 7, // Weekly
        createdAt: now,
        updatedAt: now,
      ));
    }

    // AMRAP bodyweight workout
    final bodyweightMovements = movements.where((m) => 
        m.requiredEquipment.contains(EquipmentType.bodyweight)).toList();
    if (bodyweightMovements.length >= 3) {
      workoutPools.add(WorkoutPool(
        id: 'pool_amrap_bodyweight_${now.millisecondsSinceEpoch}',
        name: 'AMRAP Bodyweight Circuit',
        description: 'High volume bodyweight movements',
        format: WorkoutFormat.amrap,
        intensity: IntensityLevel.medium,
        movements: bodyweightMovements.take(3).map((m) => 
            WorkoutMovement(movementId: m.id, reps: 10)).toList(),
        duration: 15,
        timeCapInMinutes: 15,
        cadenceDays: 3, // Twice weekly
        createdAt: now,
        updatedAt: now,
      ));
    }

    // Save all workout pools
    for (final pool in workoutPools) {
      await _workoutPoolRepository.createWorkoutPool(pool);
    }

    _logger.i('Created ${workoutPools.length} default workout pools');
  }

  /// Get available equipment-based workout pools
  Future<List<WorkoutPool>> getWorkoutPoolsByEquipment(List<String> availableEquipmentIds) {
    return _workoutPoolRepository.getWorkoutPoolsByEquipment(availableEquipmentIds);
  }

  /// Get all workout pools for management
  Future<List<WorkoutPool>> getAllWorkoutPools() {
    return _workoutPoolRepository.getAllWorkoutPools();
  }

  /// Toggle workout pool enabled state
  Future<void> toggleWorkoutPoolEnabled(String workoutPoolId) async {
    final pool = await _workoutPoolRepository.getWorkoutPoolById(workoutPoolId);
    if (pool != null) {
      final updatedPool = pool.copyWith(
        isEnabled: !pool.isEnabled,
        updatedAt: DateTime.now(),
      );
      await _workoutPoolRepository.updateWorkoutPool(updatedPool);
    }
  }
}

class _ScoredWorkout {
  final WorkoutPool pool;
  final double score;

  _ScoredWorkout(this.pool, this.score);
}