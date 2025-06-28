import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'package:workout_app/data/models/movement.dart';

enum WorkoutFormat {
  emom,
  amrap,
  tabata,
  forTime,
  roundsForTime,
  deathBy,
  chipper,
  ladder,
  partner,
  forReps,
}

enum IntensityLevel { high, medium, low }

class WorkoutMovement {
  final String movementId;
  final int reps;
  final double? weight;
  final String? scalingOption;
  final int? timeInSeconds;

  const WorkoutMovement({
    required this.movementId,
    required this.reps,
    this.weight,
    this.scalingOption,
    this.timeInSeconds,
  });

  factory WorkoutMovement.fromJson(Map<String, dynamic> json) {
    return WorkoutMovement(
      movementId: json['movementId'] as String,
      reps: json['reps'] as int,
      weight: json['weight'] as double?,
      scalingOption: json['scalingOption'] as String?,
      timeInSeconds: json['timeInSeconds'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'movementId': movementId,
      'reps': reps,
      'weight': weight,
      'scalingOption': scalingOption,
      'timeInSeconds': timeInSeconds,
    };
  }
}

class Workout extends Equatable {
  final String id;
  final String name;
  final String? description;
  final WorkoutFormat format;
  final IntensityLevel intensity;
  final List<WorkoutMovement> movements;
  final int? rounds;
  final int duration;
  final int? timeCapInMinutes;
  final Map<String, dynamic>? formatSpecificSettings;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? notes;

  const Workout({
    required this.id,
    required this.name,
    this.description,
    required this.format,
    required this.intensity,
    required this.movements,
    this.rounds,
    required this.duration,
    this.timeCapInMinutes,
    this.formatSpecificSettings,
    required this.createdAt,
    this.completedAt,
    this.notes,
  });

  factory Workout.fromMap(Map<String, dynamic> map,
      {List<WorkoutMovement>? movements}) {
    return Workout(
      id: map['id'] as String,
      name: map['name'] as String,
      description: map['description'] as String?,
      format: WorkoutFormat.values.firstWhere(
        (e) => e.toString() == 'WorkoutFormat.${map['format']}',
      ),
      intensity: IntensityLevel.values.firstWhere(
        (e) => e.toString() == 'IntensityLevel.${map['intensity']}',
      ),
      movements: movements ?? [],
      rounds: map['rounds'] as int?,
      duration: map['duration'] as int,
      timeCapInMinutes: map['time_cap_in_minutes'] as int?,
      formatSpecificSettings: map['format_specific_settings'] != null
          ? jsonDecode(map['format_specific_settings'] as String)
              as Map<String, dynamic>
          : null,
      completedAt: map['completed_at'] != null
          ? DateTime.parse(map['completed_at'] as String)
          : null,
      createdAt: DateTime.parse(map['created_at'] as String),
      notes: map['notes'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'format': format.toString().split('.').last,
      'intensity': intensity.toString().split('.').last,
      'rounds': rounds,
      'duration': duration,
      'time_cap_in_minutes': timeCapInMinutes,
      'format_specific_settings': formatSpecificSettings != null
          ? jsonEncode(formatSpecificSettings!)
          : null,
      'completed_at': completedAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'notes': notes,
    };
  }

  Workout copyWith({
    String? id,
    String? name,
    String? description,
    WorkoutFormat? format,
    IntensityLevel? intensity,
    List<WorkoutMovement>? movements,
    int? rounds,
    int? timeCapInMinutes,
    Map<String, dynamic>? formatSpecificSettings,
    DateTime? createdAt,
    DateTime? completedAt,
    String? notes,
    int? duration,
  }) {
    return Workout(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      format: format ?? this.format,
      intensity: intensity ?? this.intensity,
      movements: movements ?? this.movements,
      rounds: rounds ?? this.rounds,
      timeCapInMinutes: timeCapInMinutes ?? this.timeCapInMinutes,
      formatSpecificSettings:
          formatSpecificSettings ?? this.formatSpecificSettings,
      createdAt: createdAt ?? this.createdAt,
      completedAt: completedAt ?? this.completedAt,
      notes: notes ?? this.notes,
      duration: duration ?? this.duration,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        format,
        intensity,
        movements,
        rounds,
        timeCapInMinutes,
        formatSpecificSettings,
        createdAt,
        completedAt,
        notes,
        duration,
      ];
}
