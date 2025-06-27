import 'package:workout_app/data/models/user_progress.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/repositories/user_progress_repository.dart';

class UserProgressService {
  final UserProgressRepository _repository;
  static const String _defaultUserId = 'default_user'; // For single-user app

  UserProgressService({
    required UserProgressRepository repository,
  }) : _repository = repository;

  /// Get the current user's progress
  Future<UserProgress?> getCurrentUserProgress() async {
    return _repository.getUserProgress(_defaultUserId);
  }

  /// Initialize progress for a new user
  Future<void> initializeUserProgress() async {
    final existingProgress = await getCurrentUserProgress();
    if (existingProgress == null) {
      final newProgress = UserProgress(
        userId: _defaultUserId,
        workoutHistory: [],
        movementProgress: {},
        lastWorkoutDate: DateTime.now(),
        totalWorkoutsCompleted: 0,
      );
      await _repository.saveUserProgress(newProgress);
    }
  }

  /// Record a completed workout
  Future<void> recordWorkoutCompletion({
    required String workoutId,
    required int totalTimeInSeconds,
    int? totalRounds,
    int? totalReps,
    double? maxWeight,
    Map<String, dynamic>? performanceMetrics,
    String? notes,
  }) async {
    final workoutResult = WorkoutResult(
      workoutId: workoutId,
      completedAt: DateTime.now(),
      totalTimeInSeconds: totalTimeInSeconds,
      totalRounds: totalRounds,
      totalReps: totalReps,
      maxWeight: maxWeight,
      performanceMetrics: performanceMetrics,
      notes: notes,
    );

    await _repository.addWorkoutResult(_defaultUserId, workoutResult);
  }

  /// Update progress for a specific movement
  Future<void> updateMovementProgress({
    required String movementId,
    double? maxWeight,
    int? maxReps,
    int? maxTimeInSeconds,
    Map<String, dynamic>? personalRecords,
  }) async {
    // Get existing progress or create new
    final existingProgress = await _repository.getMovementProgress(_defaultUserId, movementId);
    
    final updatedProgress = MovementProgress(
      movementId: movementId,
      maxWeight: maxWeight ?? existingProgress?.maxWeight,
      maxReps: maxReps ?? existingProgress?.maxReps,
      maxTimeInSeconds: maxTimeInSeconds ?? existingProgress?.maxTimeInSeconds,
      lastUpdated: DateTime.now(),
      personalRecords: personalRecords ?? existingProgress?.personalRecords,
    );

    await _repository.updateMovementProgress(_defaultUserId, movementId, updatedProgress);
  }

  /// Get workout history with optional limit
  Future<List<WorkoutResult>> getWorkoutHistory({int? limit}) async {
    return _repository.getWorkoutHistory(_defaultUserId, limit: limit);
  }

  /// Get progress for a specific movement
  Future<MovementProgress?> getMovementProgress(String movementId) async {
    return _repository.getMovementProgress(_defaultUserId, movementId);
  }

  /// Get workout statistics
  Future<Map<String, dynamic>> getWorkoutStatistics() async {
    final progress = await getCurrentUserProgress();
    if (progress == null) return {};

    final workoutHistory = progress.workoutHistory;
    if (workoutHistory.isEmpty) return {};

    // Calculate statistics
    final totalWorkouts = workoutHistory.length;
    final totalTimeInSeconds = workoutHistory
        .where((w) => w.totalTimeInSeconds != null)
        .map((w) => w.totalTimeInSeconds!)
        .fold(0, (a, b) => a + b);
    
    final averageWorkoutTime = totalTimeInSeconds / totalWorkouts;
    
    final totalReps = workoutHistory
        .where((w) => w.totalReps != null)
        .map((w) => w.totalReps!)
        .fold(0, (a, b) => a + b);

    final maxWeight = workoutHistory
        .where((w) => w.maxWeight != null)
        .map((w) => w.maxWeight!)
        .fold(0.0, (a, b) => a > b ? a : b);

    // Calculate workout frequency (workouts per week)
    final firstWorkout = workoutHistory.last.completedAt;
    final lastWorkout = workoutHistory.first.completedAt;
    final daysBetween = lastWorkout.difference(firstWorkout).inDays;
    final workoutsPerWeek = daysBetween > 0 ? (totalWorkouts * 7) / daysBetween : 0.0;

    return {
      'totalWorkouts': totalWorkouts,
      'totalTimeInSeconds': totalTimeInSeconds,
      'averageWorkoutTimeInSeconds': averageWorkoutTime.round(),
      'totalReps': totalReps,
      'maxWeight': maxWeight,
      'workoutsPerWeek': workoutsPerWeek,
      'lastWorkoutDate': progress.lastWorkoutDate,
      'movementProgressCount': progress.movementProgress.length,
    };
  }

  /// Get personal records for all movements
  Future<Map<String, MovementProgress>> getAllMovementProgress() async {
    final progress = await getCurrentUserProgress();
    return progress?.movementProgress ?? {};
  }

  /// Check if a new personal record was achieved
  bool isNewPersonalRecord({
    required String movementId,
    required MovementProgress? existingProgress,
    double? newWeight,
    int? newReps,
    int? newTimeInSeconds,
  }) {
    if (existingProgress == null) return true;

    if (newWeight != null && (existingProgress.maxWeight == null || newWeight > existingProgress.maxWeight!)) {
      return true;
    }

    if (newReps != null && (existingProgress.maxReps == null || newReps > existingProgress.maxReps!)) {
      return true;
    }

    if (newTimeInSeconds != null && (existingProgress.maxTimeInSeconds == null || newTimeInSeconds > existingProgress.maxTimeInSeconds!)) {
      return true;
    }

    return false;
  }

  /// Set user goals
  Future<void> setUserGoals(Map<String, dynamic> goals) async {
    final progress = await getCurrentUserProgress();
    if (progress != null) {
      final updatedProgress = progress.copyWith(goals: goals);
      await _repository.saveUserProgress(updatedProgress);
    }
  }

  /// Add achievement
  Future<void> addAchievement(String achievementKey, Map<String, dynamic> achievementData) async {
    final progress = await getCurrentUserProgress();
    if (progress != null) {
      final achievements = Map<String, dynamic>.from(progress.achievements ?? {});
      achievements[achievementKey] = achievementData;
      final updatedProgress = progress.copyWith(achievements: achievements);
      await _repository.saveUserProgress(updatedProgress);
    }
  }

  /// Clear all user progress (for testing or reset)
  Future<void> clearUserProgress() async {
    await _repository.deleteUserProgress(_defaultUserId);
  }
} 