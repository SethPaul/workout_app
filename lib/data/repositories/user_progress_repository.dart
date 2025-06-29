import 'dart:convert';
import 'package:workout_app/data/database/database_helper.dart';
import 'package:workout_app/data/models/user_progress.dart';
import 'package:sqflite/sqflite.dart';

abstract class UserProgressRepository {
  Future<UserProgress?> getUserProgress(String userId);
  Future<void> saveUserProgress(UserProgress userProgress);
  Future<void> addWorkoutResult(String userId, WorkoutResult workoutResult);
  Future<void> updateMovementProgress(
    String userId,
    String movementId,
    MovementProgress progress,
  );
  Future<List<WorkoutResult>> getWorkoutHistory(String userId, {int? limit});
  Future<MovementProgress?> getMovementProgress(
    String userId,
    String movementId,
  );
  Future<void> deleteUserProgress(String userId);
}

class SQLiteUserProgressRepository implements UserProgressRepository {
  final DatabaseHelper _dbHelper = DatabaseHelper();

  @override
  Future<UserProgress?> getUserProgress(String userId) async {
    final db = await _dbHelper.database;

    // Get user progress record
    final List<Map<String, dynamic>> userMaps = await db.query(
      'user_progress',
      where: 'user_id = ?',
      whereArgs: [userId],
    );

    if (userMaps.isEmpty) return null;

    final userMap = userMaps.first;

    // Get workout history
    final List<Map<String, dynamic>> workoutMaps = await db.query(
      'workout_results',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'completed_at DESC',
    );

    final workoutHistory = workoutMaps
        .map((map) => _workoutResultFromMap(map))
        .toList();

    // Get movement progress
    final List<Map<String, dynamic>> movementMaps = await db.query(
      'movement_progress',
      where: 'user_id = ?',
      whereArgs: [userId],
    );

    final movementProgress = <String, MovementProgress>{};
    for (final map in movementMaps) {
      final progress = _movementProgressFromMap(map);
      movementProgress[progress.movementId] = progress;
    }

    return UserProgress(
      userId: userMap['user_id'] as String,
      workoutHistory: workoutHistory,
      movementProgress: movementProgress,
      lastWorkoutDate: DateTime.parse(userMap['last_workout_date'] as String),
      totalWorkoutsCompleted: userMap['total_workouts_completed'] as int,
      goals: userMap['goals'] != null
          ? jsonDecode(userMap['goals'] as String) as Map<String, dynamic>
          : null,
      achievements: userMap['achievements'] != null
          ? jsonDecode(userMap['achievements'] as String)
                as Map<String, dynamic>
          : null,
      isFirstRun: (userMap['is_first_run'] as int? ?? 1) == 1,
      hasAcceptedDefaultWorkouts:
          (userMap['has_accepted_default_workouts'] as int? ?? 0) == 1,
      onboardingCompletedAt: userMap['onboarding_completed_at'] != null
          ? DateTime.parse(userMap['onboarding_completed_at'] as String)
          : null,
    );
  }

  @override
  Future<void> saveUserProgress(UserProgress userProgress) async {
    final db = await _dbHelper.database;

    await db.transaction((txn) async {
      // Save user progress record
      await txn.insert(
        'user_progress',
        _userProgressToMap(userProgress),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      // Clear existing workout results and movement progress
      await txn.delete(
        'workout_results',
        where: 'user_id = ?',
        whereArgs: [userProgress.userId],
      );

      await txn.delete(
        'movement_progress',
        where: 'user_id = ?',
        whereArgs: [userProgress.userId],
      );

      // Save workout results
      for (final result in userProgress.workoutHistory) {
        await txn.insert(
          'workout_results',
          _workoutResultToMap(userProgress.userId, result),
        );
      }

      // Save movement progress
      for (final entry in userProgress.movementProgress.entries) {
        await txn.insert(
          'movement_progress',
          _movementProgressToMap(userProgress.userId, entry.value),
        );
      }
    });
  }

  @override
  Future<void> addWorkoutResult(
    String userId,
    WorkoutResult workoutResult,
  ) async {
    final db = await _dbHelper.database;

    await db.transaction((txn) async {
      // Add workout result
      await txn.insert(
        'workout_results',
        _workoutResultToMap(userId, workoutResult),
      );

      // Update user progress totals
      final userProgress = await getUserProgress(userId);
      if (userProgress != null) {
        final updatedProgress = userProgress.copyWith(
          lastWorkoutDate: workoutResult.completedAt,
          totalWorkoutsCompleted: userProgress.totalWorkoutsCompleted + 1,
          workoutHistory: [...userProgress.workoutHistory, workoutResult],
        );

        await txn.update(
          'user_progress',
          _userProgressToMap(updatedProgress),
          where: 'user_id = ?',
          whereArgs: [userId],
        );
      } else {
        // Create new user progress if it doesn't exist
        final newProgress = UserProgress(
          userId: userId,
          workoutHistory: [workoutResult],
          movementProgress: {},
          lastWorkoutDate: workoutResult.completedAt,
          totalWorkoutsCompleted: 1,
        );

        await txn.insert('user_progress', _userProgressToMap(newProgress));
      }
    });
  }

  @override
  Future<void> updateMovementProgress(
    String userId,
    String movementId,
    MovementProgress progress,
  ) async {
    final db = await _dbHelper.database;

    await db.insert(
      'movement_progress',
      _movementProgressToMap(userId, progress),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<List<WorkoutResult>> getWorkoutHistory(
    String userId, {
    int? limit,
  }) async {
    final db = await _dbHelper.database;

    final List<Map<String, dynamic>> maps = await db.query(
      'workout_results',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'completed_at DESC',
      limit: limit,
    );

    return maps.map((map) => _workoutResultFromMap(map)).toList();
  }

  @override
  Future<MovementProgress?> getMovementProgress(
    String userId,
    String movementId,
  ) async {
    final db = await _dbHelper.database;

    final List<Map<String, dynamic>> maps = await db.query(
      'movement_progress',
      where: 'user_id = ? AND movement_id = ?',
      whereArgs: [userId, movementId],
    );

    if (maps.isEmpty) return null;
    return _movementProgressFromMap(maps.first);
  }

  @override
  Future<void> deleteUserProgress(String userId) async {
    final db = await _dbHelper.database;

    await db.transaction((txn) async {
      await txn.delete(
        'user_progress',
        where: 'user_id = ?',
        whereArgs: [userId],
      );

      await txn.delete(
        'workout_results',
        where: 'user_id = ?',
        whereArgs: [userId],
      );

      await txn.delete(
        'movement_progress',
        where: 'user_id = ?',
        whereArgs: [userId],
      );
    });
  }

  // Helper methods for mapping
  Map<String, dynamic> _userProgressToMap(UserProgress userProgress) {
    return {
      'user_id': userProgress.userId,
      'last_workout_date': userProgress.lastWorkoutDate.toIso8601String(),
      'total_workouts_completed': userProgress.totalWorkoutsCompleted,
      'goals': userProgress.goals != null
          ? jsonEncode(userProgress.goals)
          : null,
      'achievements': userProgress.achievements != null
          ? jsonEncode(userProgress.achievements)
          : null,
      'is_first_run': userProgress.isFirstRun ? 1 : 0,
      'has_accepted_default_workouts': userProgress.hasAcceptedDefaultWorkouts
          ? 1
          : 0,
      'onboarding_completed_at': userProgress.onboardingCompletedAt
          ?.toIso8601String(),
    };
  }

  Map<String, dynamic> _workoutResultToMap(
    String userId,
    WorkoutResult result,
  ) {
    return {
      'user_id': userId,
      'workout_id': result.workoutId,
      'completed_at': result.completedAt.toIso8601String(),
      'total_time_in_seconds': result.totalTimeInSeconds,
      'total_rounds': result.totalRounds,
      'total_reps': result.totalReps,
      'max_weight': result.maxWeight,
      'performance_metrics': result.performanceMetrics != null
          ? jsonEncode(result.performanceMetrics)
          : null,
      'notes': result.notes,
    };
  }

  WorkoutResult _workoutResultFromMap(Map<String, dynamic> map) {
    return WorkoutResult(
      workoutId: map['workout_id'] as String,
      completedAt: DateTime.parse(map['completed_at'] as String),
      totalTimeInSeconds: map['total_time_in_seconds'] as int?,
      totalRounds: map['total_rounds'] as int?,
      totalReps: map['total_reps'] as int?,
      maxWeight: map['max_weight'] as double?,
      performanceMetrics: map['performance_metrics'] != null
          ? jsonDecode(map['performance_metrics'] as String)
                as Map<String, dynamic>
          : null,
      notes: map['notes'] as String?,
    );
  }

  Map<String, dynamic> _movementProgressToMap(
    String userId,
    MovementProgress progress,
  ) {
    return {
      'user_id': userId,
      'movement_id': progress.movementId,
      'max_weight': progress.maxWeight,
      'max_reps': progress.maxReps,
      'max_time_in_seconds': progress.maxTimeInSeconds,
      'last_updated': progress.lastUpdated.toIso8601String(),
      'personal_records': progress.personalRecords != null
          ? jsonEncode(progress.personalRecords)
          : null,
    };
  }

  MovementProgress _movementProgressFromMap(Map<String, dynamic> map) {
    return MovementProgress(
      movementId: map['movement_id'] as String,
      maxWeight: map['max_weight'] as double?,
      maxReps: map['max_reps'] as int?,
      maxTimeInSeconds: map['max_time_in_seconds'] as int?,
      lastUpdated: DateTime.parse(map['last_updated'] as String),
      personalRecords: map['personal_records'] != null
          ? jsonDecode(map['personal_records'] as String)
                as Map<String, dynamic>
          : null,
    );
  }
}
