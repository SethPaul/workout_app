import 'package:equatable/equatable.dart';
import 'workout.dart';

class WorkoutPool extends Equatable {
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
  final bool isEnabled;
  final DateTime? lastPerformed;
  final int cadenceDays; // How often this workout should appear (e.g., 7 for weekly)
  final List<String> requiredEquipmentIds;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic>? metadata;

  const WorkoutPool({
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
    this.isEnabled = true,
    this.lastPerformed,
    this.cadenceDays = 7, // Default to weekly
    this.requiredEquipmentIds = const [],
    required this.createdAt,
    required this.updatedAt,
    this.metadata,
  });

  factory WorkoutPool.fromMap(Map<String, dynamic> map,
      {List<WorkoutMovement>? movements, List<String>? requiredEquipmentIds}) {
    return WorkoutPool(
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
          ? Map<String, dynamic>.from(map['format_specific_settings'] as Map)
          : null,
      isEnabled: map['is_enabled'] as bool? ?? true,
      lastPerformed: map['last_performed'] != null
          ? DateTime.parse(map['last_performed'] as String)
          : null,
      cadenceDays: map['cadence_days'] as int? ?? 7,
      requiredEquipmentIds: requiredEquipmentIds ?? [],
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      metadata: map['metadata'] != null
          ? Map<String, dynamic>.from(map['metadata'] as Map)
          : null,
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
      'format_specific_settings': formatSpecificSettings,
      'is_enabled': isEnabled,
      'last_performed': lastPerformed?.toIso8601String(),
      'cadence_days': cadenceDays,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'metadata': metadata,
    };
  }

  /// Convert this WorkoutPool to a Workout instance for execution
  Workout toWorkout() {
    final now = DateTime.now();
    return Workout(
      id: 'workout_${now.millisecondsSinceEpoch}',
      name: name,
      description: description,
      format: format,
      intensity: intensity,
      movements: movements,
      rounds: rounds,
      duration: duration,
      timeCapInMinutes: timeCapInMinutes,
      formatSpecificSettings: formatSpecificSettings,
      createdAt: now,
    );
  }

  /// Check if this workout is available based on cadence and last performed
  bool isAvailableForSelection({DateTime? currentDate}) {
    if (!isEnabled) return false;
    
    currentDate ??= DateTime.now();
    
    if (lastPerformed == null) return true;
    
    final daysSinceLastPerformed = currentDate.difference(lastPerformed!).inDays;
    return daysSinceLastPerformed >= cadenceDays;
  }

  /// Mark this workout as performed
  WorkoutPool markAsPerformed({DateTime? performedAt}) {
    return copyWith(
      lastPerformed: performedAt ?? DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  WorkoutPool copyWith({
    String? id,
    String? name,
    String? description,
    WorkoutFormat? format,
    IntensityLevel? intensity,
    List<WorkoutMovement>? movements,
    int? rounds,
    int? duration,
    int? timeCapInMinutes,
    Map<String, dynamic>? formatSpecificSettings,
    bool? isEnabled,
    DateTime? lastPerformed,
    int? cadenceDays,
    List<String>? requiredEquipmentIds,
    DateTime? createdAt,
    DateTime? updatedAt,
    Map<String, dynamic>? metadata,
  }) {
    return WorkoutPool(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      format: format ?? this.format,
      intensity: intensity ?? this.intensity,
      movements: movements ?? this.movements,
      rounds: rounds ?? this.rounds,
      duration: duration ?? this.duration,
      timeCapInMinutes: timeCapInMinutes ?? this.timeCapInMinutes,
      formatSpecificSettings: formatSpecificSettings ?? this.formatSpecificSettings,
      isEnabled: isEnabled ?? this.isEnabled,
      lastPerformed: lastPerformed ?? this.lastPerformed,
      cadenceDays: cadenceDays ?? this.cadenceDays,
      requiredEquipmentIds: requiredEquipmentIds ?? this.requiredEquipmentIds,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      metadata: metadata ?? this.metadata,
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
        duration,
        timeCapInMinutes,
        formatSpecificSettings,
        isEnabled,
        lastPerformed,
        cadenceDays,
        requiredEquipmentIds,
        createdAt,
        updatedAt,
        metadata,
      ];
}