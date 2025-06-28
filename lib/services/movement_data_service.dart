import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:logger/logger.dart';

class MovementDataService {
  final MovementRepository _repository;
  final Logger _logger = Logger();

  MovementDataService({required MovementRepository repository})
    : _repository = repository;

  /// Initialize movement library from JSON file
  Future<void> initializeMovementLibrary({bool forceReload = false}) async {
    try {
      _logger.i('Checking movement library initialization...');

      // Check if movements already exist (unless force reload)
      if (!forceReload) {
        final existingMovements = await _repository.getAllMovements();
        if (existingMovements.isNotEmpty) {
          _logger.i(
            'Movement library already initialized with ${existingMovements.length} movements',
          );
          return;
        }
      }

      _logger.i('Loading movements from JSON file...');
      await _loadMovementsFromJson();
      _logger.i('Movement library initialization completed successfully');
    } catch (e) {
      _logger.e('Error initializing movement library: $e');
      rethrow;
    }
  }

  Future<void> _loadMovementsFromJson() async {
    try {
      // Load JSON file from assets
      final jsonString = await rootBundle.loadString('data/movements.json');
      final jsonData = jsonDecode(jsonString) as Map<String, dynamic>;
      final movementsData = jsonData['movements'] as List;

      _logger.i('Found ${movementsData.length} movements in JSON file');

      // Convert JSON data to Movement objects and save to database
      for (final movementJson in movementsData) {
        try {
          final movement = _convertJsonToMovement(
            movementJson as Map<String, dynamic>,
          );
          await _repository.createMovement(movement);
          _logger.d('Loaded movement: ${movement.name}');
        } catch (e) {
          _logger.w('Error loading movement: $e');
          // Continue with other movements even if one fails
        }
      }

      _logger.i(
        'Successfully loaded ${movementsData.length} movements into database',
      );
    } catch (e) {
      _logger.e('Error loading movements from JSON: $e');
      rethrow;
    }
  }

  Movement _convertJsonToMovement(Map<String, dynamic> json) {
    return Movement(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      categories: _parseCategories(json),
      requiredEquipment: _parseEquipment(json),
      muscleGroups: _parseMuscleGroups(json),
      difficultyLevel: _parseDifficultyLevel(json),
      isMainMovement: _parseIsMainMovement(json),
      scalingOptions: _parseScalingOptions(json),
      guidelines: _parseGuidelines(json),
      videoUrl: json['videoUrl'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }

  List<MovementCategory> _parseCategories(Map<String, dynamic> json) {
    // Handle different possible category field names and formats
    dynamic categories = json['categories'] ?? json['category'];

    if (categories == null) return [];

    List<String> categoryStrings = [];
    if (categories is String) {
      categoryStrings = [categories];
    } else if (categories is List) {
      categoryStrings = categories.cast<String>();
    }

    return categoryStrings.map((cat) {
      switch (cat.toUpperCase()) {
        case 'COMPOUND_LIFT':
        case 'COMPOUND':
          return MovementCategory.compoundLift;
        case 'BODYWEIGHT':
          return MovementCategory.bodyweight;
        case 'CARDIO':
          return MovementCategory.cardio;
        case 'ACCESSORY':
          return MovementCategory.accessory;
        case 'MOBILITY':
          return MovementCategory.mobility;
        case 'SKILL':
          return MovementCategory.skill;
        default:
          _logger.w('Unknown category: $cat, defaulting to accessory');
          return MovementCategory.accessory;
      }
    }).toList();
  }

  List<EquipmentType> _parseEquipment(Map<String, dynamic> json) {
    // Handle different possible equipment field names and formats
    dynamic equipment = json['requiredEquipment'] ?? json['equipment'];

    if (equipment == null) return [EquipmentType.bodyweight];

    List<String> equipmentStrings = [];
    if (equipment is String) {
      equipmentStrings = [equipment];
    } else if (equipment is List) {
      for (final item in equipment) {
        if (item is String) {
          equipmentStrings.add(item);
        } else if (item is Map<String, dynamic>) {
          // Handle object format: {"name": "Barbell", "type": "BARBELL"}
          final type = item['type'] as String?;
          if (type != null) {
            equipmentStrings.add(type);
          }
        }
      }
    }

    return equipmentStrings.map((eq) {
      switch (eq.toUpperCase()) {
        case 'BARBELL':
          return EquipmentType.barbell;
        case 'DUMBBELL':
          return EquipmentType.dumbbell;
        case 'KETTLEBELL':
          return EquipmentType.kettlebell;
        case 'BODYWEIGHT':
          return EquipmentType.bodyweight;
        case 'RESISTANCE_BAND':
        case 'RESISTANCEBAND':
          return EquipmentType.resistanceBand;
        case 'MACHINE':
          return EquipmentType.machine;
        case 'CARDIO':
          return EquipmentType.cardio;
        case 'MOBILITY':
          return EquipmentType.mobility;
        default:
          _logger.w('Unknown equipment: $eq, defaulting to bodyweight');
          return EquipmentType.bodyweight;
      }
    }).toList();
  }

  List<MuscleGroup> _parseMuscleGroups(Map<String, dynamic> json) {
    // Handle different possible muscle group field names
    dynamic muscleGroups =
        json['muscleGroups'] ??
        json['primaryMuscleGroups'] ??
        json['grossMuscleGroups'];

    if (muscleGroups == null) return [MuscleGroup.fullBody];

    List<String> muscleGroupStrings = [];
    if (muscleGroups is String) {
      muscleGroupStrings = [muscleGroups];
    } else if (muscleGroups is List) {
      muscleGroupStrings = muscleGroups.cast<String>();
    }

    return muscleGroupStrings.map((mg) {
      switch (mg.toUpperCase()) {
        case 'CHEST':
          return MuscleGroup.chest;
        case 'BACK':
          return MuscleGroup.back;
        case 'SHOULDERS':
          return MuscleGroup.shoulders;
        case 'BICEPS':
          return MuscleGroup.biceps;
        case 'TRICEPS':
          return MuscleGroup.triceps;
        case 'LEGS':
        case 'QUADS':
        case 'HAMSTRINGS':
        case 'GLUTES':
        case 'CALVES':
          return MuscleGroup.legs;
        case 'CORE':
        case 'ABS':
          return MuscleGroup.core;
        case 'FULL_BODY':
        case 'FULLBODY':
          return MuscleGroup.fullBody;
        default:
          _logger.w('Unknown muscle group: $mg, defaulting to fullBody');
          return MuscleGroup.fullBody;
      }
    }).toList();
  }

  DifficultyLevel _parseDifficultyLevel(Map<String, dynamic> json) {
    final difficulty =
        json['difficultyLevel'] ?? json['complexity'] ?? 'intermediate';

    switch (difficulty.toString().toUpperCase()) {
      case 'BEGINNER':
      case 'EASY':
        return DifficultyLevel.beginner;
      case 'INTERMEDIATE':
      case 'MEDIUM':
        return DifficultyLevel.intermediate;
      case 'ADVANCED':
      case 'HARD':
        return DifficultyLevel.advanced;
      default:
        return DifficultyLevel.intermediate;
    }
  }

  bool _parseIsMainMovement(Map<String, dynamic> json) {
    // Check various possible field names for main movement indicator
    return json['isMainMovement'] as bool? ??
        json['isMain'] as bool? ??
        (json['category'] == 'COMPOUND_LIFT') || false;
  }

  Map<String, String> _parseScalingOptions(Map<String, dynamic> json) {
    final scalingOptions = json['scalingOptions'] ?? <String, dynamic>{};

    if (scalingOptions is List) {
      // Handle array format
      final Map<String, String> result = {};
      for (final option in scalingOptions) {
        if (option is Map<String, dynamic>) {
          final name = option['name'] as String?;
          final description = option['description'] as String?;
          if (name != null && description != null) {
            result[name] = description;
          }
        }
      }
      return result;
    } else if (scalingOptions is Map) {
      // Handle map format
      return Map<String, String>.from(scalingOptions);
    }

    return <String, String>{};
  }

  Map<String, dynamic> _parseGuidelines(Map<String, dynamic> json) {
    final guidelines = json['guidelines'] ?? <String, dynamic>{};

    if (guidelines is Map) {
      return Map<String, dynamic>.from(guidelines);
    }

    // If guidelines is a list of strings (like commonFaults, techniqueCues), convert to map
    final result = <String, dynamic>{};

    if (json['commonFaults'] != null) {
      result['commonFaults'] = json['commonFaults'];
    }
    if (json['techniqueCues'] != null) {
      result['techniqueCues'] = json['techniqueCues'];
    }
    if (json['contraindications'] != null) {
      result['contraindications'] = json['contraindications'];
    }
    if (json['frequencyGuidelines'] != null) {
      result['frequencyGuidelines'] = json['frequencyGuidelines'];
    }

    return result;
  }

  /// Get movement count in the database
  Future<int> getMovementCount() async {
    final movements = await _repository.getAllMovements();
    return movements.length;
  }

  /// Force reload all movements from JSON
  Future<void> reloadMovements() async {
    _logger.i('Force reloading movements from JSON...');
    await initializeMovementLibrary(forceReload: true);
  }
}
