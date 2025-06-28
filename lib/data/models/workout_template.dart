import 'package:equatable/equatable.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';

class WorkoutTemplate extends Equatable {
  final String id;
  final String name;
  final String description;
  final WorkoutFormat format;
  final IntensityLevel intensity;
  final int targetDuration;
  final List<MovementCategory>? preferredCategories;
  final List<EquipmentType>? availableEquipment;
  final bool? isMainMovementOnly;
  final DateTime createdAt;
  final DateTime? lastUsed;
  final int timesUsed;
  final Map<String, dynamic>? metadata;

  const WorkoutTemplate({
    required this.id,
    required this.name,
    required this.description,
    required this.format,
    required this.intensity,
    required this.targetDuration,
    this.preferredCategories,
    this.availableEquipment,
    this.isMainMovementOnly,
    required this.createdAt,
    this.lastUsed,
    this.timesUsed = 0,
    this.metadata,
  });

  factory WorkoutTemplate.fromJson(Map<String, dynamic> json) {
    return WorkoutTemplate(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      format: WorkoutFormat.values.firstWhere(
        (f) => f.toString() == 'WorkoutFormat.${json['format']}',
      ),
      intensity: IntensityLevel.values.firstWhere(
        (i) => i.toString() == 'IntensityLevel.${json['intensity']}',
      ),
      targetDuration: json['targetDuration'] as int,
      preferredCategories: (json['preferredCategories'] as List?)
          ?.map(
            (c) => MovementCategory.values.firstWhere(
              (mc) => mc.toString() == 'MovementCategory.$c',
            ),
          )
          .toList(),
      availableEquipment: (json['availableEquipment'] as List?)
          ?.map(
            (e) => EquipmentType.values.firstWhere(
              (et) => et.toString() == 'EquipmentType.$e',
            ),
          )
          .toList(),
      isMainMovementOnly: json['isMainMovementOnly'] as bool?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lastUsed: json['lastUsed'] != null
          ? DateTime.parse(json['lastUsed'] as String)
          : null,
      timesUsed: json['timesUsed'] as int? ?? 0,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'format': format.toString().split('.').last,
      'intensity': intensity.toString().split('.').last,
      'targetDuration': targetDuration,
      'preferredCategories': preferredCategories
          ?.map((c) => c.toString().split('.').last)
          .toList(),
      'availableEquipment': availableEquipment
          ?.map((e) => e.toString().split('.').last)
          .toList(),
      'isMainMovementOnly': isMainMovementOnly,
      'createdAt': createdAt.toIso8601String(),
      'lastUsed': lastUsed?.toIso8601String(),
      'timesUsed': timesUsed,
      'metadata': metadata,
    };
  }

  WorkoutTemplate copyWith({
    String? id,
    String? name,
    String? description,
    WorkoutFormat? format,
    IntensityLevel? intensity,
    int? targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
    DateTime? createdAt,
    DateTime? lastUsed,
    int? timesUsed,
    Map<String, dynamic>? metadata,
  }) {
    return WorkoutTemplate(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      format: format ?? this.format,
      intensity: intensity ?? this.intensity,
      targetDuration: targetDuration ?? this.targetDuration,
      preferredCategories: preferredCategories ?? this.preferredCategories,
      availableEquipment: availableEquipment ?? this.availableEquipment,
      isMainMovementOnly: isMainMovementOnly ?? this.isMainMovementOnly,
      createdAt: createdAt ?? this.createdAt,
      lastUsed: lastUsed ?? this.lastUsed,
      timesUsed: timesUsed ?? this.timesUsed,
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
    targetDuration,
    preferredCategories,
    availableEquipment,
    isMainMovementOnly,
    createdAt,
    lastUsed,
    timesUsed,
    metadata,
  ];
}
