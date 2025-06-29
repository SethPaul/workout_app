import 'package:equatable/equatable.dart';

enum MovementCategory {
  compoundLift,
  bodyweight,
  cardio,
  accessory,
  mobility,
  skill,
}

enum EquipmentType {
  barbell,
  dumbbell,
  kettlebell,
  bodyweight,
  resistanceBand,
  machine,
  cardio,
  mobility,
}

enum MuscleGroup {
  chest,
  back,
  shoulders,
  biceps,
  triceps,
  legs,
  core,
  fullBody,
}

enum DifficultyLevel { beginner, intermediate, advanced }

class Movement extends Equatable {
  final String id;
  final String name;
  final String description;
  final List<MovementCategory> categories;
  final List<EquipmentType> requiredEquipment;
  final List<MuscleGroup> muscleGroups;
  final DifficultyLevel difficultyLevel;
  final bool isMainMovement;
  final Map<String, String> scalingOptions;
  final Map<String, dynamic> guidelines;
  final String? videoUrl;
  final String? imageUrl;

  const Movement({
    required this.id,
    required this.name,
    required this.description,
    required this.categories,
    required this.requiredEquipment,
    required this.muscleGroups,
    required this.difficultyLevel,
    this.isMainMovement = false,
    required this.scalingOptions,
    required this.guidelines,
    this.videoUrl,
    this.imageUrl,
  });

  @override
  List<Object?> get props => [
    id,
    name,
    description,
    categories,
    requiredEquipment,
    muscleGroups,
    difficultyLevel,
    isMainMovement,
    scalingOptions,
    guidelines,
    videoUrl,
    imageUrl,
  ];

  factory Movement.fromJson(Map<String, dynamic> json) {
    return Movement(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      categories: (json['categories'] as List)
          .map(
            (e) => MovementCategory.values.firstWhere(
              (type) => type.toString() == 'MovementCategory.$e',
            ),
          )
          .toList(),
      requiredEquipment: (json['requiredEquipment'] as List)
          .map(
            (e) => EquipmentType.values.firstWhere(
              (type) => type.toString() == 'EquipmentType.$e',
            ),
          )
          .toList(),
      muscleGroups: (json['muscleGroups'] as List)
          .map(
            (e) => MuscleGroup.values.firstWhere(
              (group) => group.toString() == 'MuscleGroup.$e',
            ),
          )
          .toList(),
      difficultyLevel: DifficultyLevel.values.firstWhere(
        (level) =>
            level.toString() == 'DifficultyLevel.${json['difficultyLevel']}',
      ),
      scalingOptions: Map<String, String>.from(json['scalingOptions'] as Map),
      guidelines: json['guidelines'] as Map<String, dynamic>,
      isMainMovement: json['isMainMovement'] as bool? ?? false,
      videoUrl: json['videoUrl'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'categories': categories
          .map((e) => e.toString().split('.').last)
          .toList(),
      'requiredEquipment': requiredEquipment
          .map((e) => e.toString().split('.').last)
          .toList(),
      'muscleGroups': muscleGroups
          .map((e) => e.toString().split('.').last)
          .toList(),
      'difficultyLevel': difficultyLevel.toString().split('.').last,
      'scalingOptions': scalingOptions,
      'guidelines': guidelines,
      'isMainMovement': isMainMovement,
      'videoUrl': videoUrl,
      'imageUrl': imageUrl,
    };
  }

  Movement copyWith({
    String? id,
    String? name,
    String? description,
    List<MovementCategory>? categories,
    List<EquipmentType>? requiredEquipment,
    List<MuscleGroup>? muscleGroups,
    DifficultyLevel? difficultyLevel,
    bool? isMainMovement,
    Map<String, String>? scalingOptions,
    Map<String, dynamic>? guidelines,
    String? videoUrl,
    String? imageUrl,
  }) {
    return Movement(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      categories: categories ?? this.categories,
      requiredEquipment: requiredEquipment ?? this.requiredEquipment,
      muscleGroups: muscleGroups ?? this.muscleGroups,
      difficultyLevel: difficultyLevel ?? this.difficultyLevel,
      isMainMovement: isMainMovement ?? this.isMainMovement,
      scalingOptions: scalingOptions ?? this.scalingOptions,
      guidelines: guidelines ?? this.guidelines,
      videoUrl: videoUrl ?? this.videoUrl,
      imageUrl: imageUrl ?? this.imageUrl,
    );
  }
}
