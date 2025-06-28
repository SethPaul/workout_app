import 'package:equatable/equatable.dart';

class WorkoutResult {
  final String workoutId;
  final DateTime completedAt;
  final int? totalTimeInSeconds;
  final int? totalRounds;
  final int? totalReps;
  final double? maxWeight;
  final Map<String, dynamic>? performanceMetrics;
  final String? notes;

  const WorkoutResult({
    required this.workoutId,
    required this.completedAt,
    this.totalTimeInSeconds,
    this.totalRounds,
    this.totalReps,
    this.maxWeight,
    this.performanceMetrics,
    this.notes,
  });

  factory WorkoutResult.fromJson(Map<String, dynamic> json) {
    return WorkoutResult(
      workoutId: json['workoutId'] as String,
      completedAt: DateTime.parse(json['completedAt'] as String),
      totalTimeInSeconds: json['totalTimeInSeconds'] as int?,
      totalRounds: json['totalRounds'] as int?,
      totalReps: json['totalReps'] as int?,
      maxWeight: json['maxWeight'] as double?,
      performanceMetrics: json['performanceMetrics'] as Map<String, dynamic>?,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'workoutId': workoutId,
      'completedAt': completedAt.toIso8601String(),
      'totalTimeInSeconds': totalTimeInSeconds,
      'totalRounds': totalRounds,
      'totalReps': totalReps,
      'maxWeight': maxWeight,
      'performanceMetrics': performanceMetrics,
      'notes': notes,
    };
  }
}

class MovementProgress {
  final String movementId;
  final double? maxWeight;
  final int? maxReps;
  final int? maxTimeInSeconds;
  final DateTime lastUpdated;
  final Map<String, dynamic>? personalRecords;

  const MovementProgress({
    required this.movementId,
    this.maxWeight,
    this.maxReps,
    this.maxTimeInSeconds,
    required this.lastUpdated,
    this.personalRecords,
  });

  factory MovementProgress.fromJson(Map<String, dynamic> json) {
    return MovementProgress(
      movementId: json['movementId'] as String,
      maxWeight: json['maxWeight'] as double?,
      maxReps: json['maxReps'] as int?,
      maxTimeInSeconds: json['maxTimeInSeconds'] as int?,
      lastUpdated: DateTime.parse(json['lastUpdated'] as String),
      personalRecords: json['personalRecords'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'movementId': movementId,
      'maxWeight': maxWeight,
      'maxReps': maxReps,
      'maxTimeInSeconds': maxTimeInSeconds,
      'lastUpdated': lastUpdated.toIso8601String(),
      'personalRecords': personalRecords,
    };
  }
}

class UserProgress extends Equatable {
  final String userId;
  final List<WorkoutResult> workoutHistory;
  final Map<String, MovementProgress> movementProgress;
  final DateTime lastWorkoutDate;
  final int totalWorkoutsCompleted;
  final Map<String, dynamic>? goals;
  final Map<String, dynamic>? achievements;
  final bool isFirstRun;
  final bool hasAcceptedDefaultWorkouts;
  final DateTime? onboardingCompletedAt;

  const UserProgress({
    required this.userId,
    required this.workoutHistory,
    required this.movementProgress,
    required this.lastWorkoutDate,
    required this.totalWorkoutsCompleted,
    this.goals,
    this.achievements,
    this.isFirstRun = true,
    this.hasAcceptedDefaultWorkouts = false,
    this.onboardingCompletedAt,
  });

  factory UserProgress.fromJson(Map<String, dynamic> json) {
    return UserProgress(
      userId: json['userId'] as String,
      workoutHistory: (json['workoutHistory'] as List)
          .map((w) => WorkoutResult.fromJson(w as Map<String, dynamic>))
          .toList(),
      movementProgress: (json['movementProgress'] as Map<String, dynamic>).map(
        (key, value) => MapEntry(
          key,
          MovementProgress.fromJson(value as Map<String, dynamic>),
        ),
      ),
      lastWorkoutDate: DateTime.parse(json['lastWorkoutDate'] as String),
      totalWorkoutsCompleted: json['totalWorkoutsCompleted'] as int,
      goals: json['goals'] as Map<String, dynamic>?,
      achievements: json['achievements'] as Map<String, dynamic>?,
      isFirstRun: json['isFirstRun'] as bool? ?? true,
      hasAcceptedDefaultWorkouts: json['hasAcceptedDefaultWorkouts'] as bool? ?? false,
      onboardingCompletedAt: json['onboardingCompletedAt'] == null
          ? null
          : DateTime.parse(json['onboardingCompletedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'workoutHistory': workoutHistory.map((w) => w.toJson()).toList(),
      'movementProgress':
          movementProgress.map((key, value) => MapEntry(key, value.toJson())),
      'lastWorkoutDate': lastWorkoutDate.toIso8601String(),
      'totalWorkoutsCompleted': totalWorkoutsCompleted,
      'goals': goals,
      'achievements': achievements,
      'isFirstRun': isFirstRun,
      'hasAcceptedDefaultWorkouts': hasAcceptedDefaultWorkouts,
      'onboardingCompletedAt': onboardingCompletedAt?.toIso8601String(),
    };
  }

  UserProgress copyWith({
    String? userId,
    List<WorkoutResult>? workoutHistory,
    Map<String, MovementProgress>? movementProgress,
    DateTime? lastWorkoutDate,
    int? totalWorkoutsCompleted,
    Map<String, dynamic>? goals,
    Map<String, dynamic>? achievements,
    bool? isFirstRun,
    bool? hasAcceptedDefaultWorkouts,
    DateTime? onboardingCompletedAt,
  }) {
    return UserProgress(
      userId: userId ?? this.userId,
      workoutHistory: workoutHistory ?? this.workoutHistory,
      movementProgress: movementProgress ?? this.movementProgress,
      lastWorkoutDate: lastWorkoutDate ?? this.lastWorkoutDate,
      totalWorkoutsCompleted:
          totalWorkoutsCompleted ?? this.totalWorkoutsCompleted,
      goals: goals ?? this.goals,
      achievements: achievements ?? this.achievements,
      isFirstRun: isFirstRun ?? this.isFirstRun,
      hasAcceptedDefaultWorkouts:
          hasAcceptedDefaultWorkouts ?? this.hasAcceptedDefaultWorkouts,
      onboardingCompletedAt: onboardingCompletedAt ?? this.onboardingCompletedAt,
    );
  }

  @override
  List<Object?> get props => [
        userId,
        workoutHistory,
        movementProgress,
        lastWorkoutDate,
        totalWorkoutsCompleted,
        goals,
        achievements,
        isFirstRun,
        hasAcceptedDefaultWorkouts,
        onboardingCompletedAt,
      ];
}
