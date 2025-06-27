import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:logger/logger.dart';

class DefaultWorkoutService {
  final WorkoutTemplateService _templateService;
  final Logger _logger = Logger();

  DefaultWorkoutService({
    required WorkoutTemplateService templateService,
  }) : _templateService = templateService;

  /// Get all available default workout template configurations
  List<Map<String, dynamic>> getDefaultWorkoutConfigurations() {
    return [
      {
        'name': 'Beginner\'s Blast',
        'description': 'Perfect for newcomers to fitness - low intensity, full body workout',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.low,
        'targetDuration': 20,
        'preferredCategories': [
          MovementCategory.bodyweight,
          MovementCategory.cardio
        ],
        'category': 'Beginner',
        'icon': '🌱',
      },
      {
        'name': 'Quick HIIT Cardio',
        'description': 'High-intensity interval training for busy schedules',
        'format': WorkoutFormat.tabata,
        'intensity': IntensityLevel.high,
        'targetDuration': 15,
        'preferredCategories': [
          MovementCategory.cardio,
          MovementCategory.bodyweight
        ],
        'category': 'Cardio',
        'icon': '⚡',
      },
      {
        'name': 'Strength Builder',
        'description': 'Compound movements for building overall strength',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.medium,
        'targetDuration': 30,
        'preferredCategories': [MovementCategory.compoundLift],
        'isMainMovementOnly': true,
        'category': 'Strength',
        'icon': '💪',
      },
      {
        'name': 'Endurance Challenge',
        'description': 'Long form workout to build stamina and cardiovascular health',
        'format': WorkoutFormat.amrap,
        'intensity': IntensityLevel.medium,
        'targetDuration': 20,
        'preferredCategories': [
          MovementCategory.cardio,
          MovementCategory.bodyweight
        ],
        'category': 'Endurance',
        'icon': '🏃‍♂️',
      },
      {
        'name': 'Power Hour',
        'description': 'High-intensity strength and conditioning for experienced athletes',
        'format': WorkoutFormat.emom,
        'intensity': IntensityLevel.high,
        'targetDuration': 45,
        'preferredCategories': [
          MovementCategory.compoundLift,
          MovementCategory.cardio
        ],
        'category': 'Advanced',
        'icon': '🔥',
      },
      {
        'name': 'Recovery Session',
        'description': 'Low-intensity movement for active recovery and mobility',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.low,
        'targetDuration': 25,
        'preferredCategories': [
          MovementCategory.bodyweight,
          MovementCategory.accessory
        ],
        'category': 'Recovery',
        'icon': '🧘‍♀️',
      },
      {
        'name': 'Core Crusher',
        'description': 'Focused core strengthening workout for all fitness levels',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.medium,
        'targetDuration': 15,
        'preferredCategories': [
          MovementCategory.bodyweight,
          MovementCategory.accessory
        ],
        'category': 'Core',
        'icon': '🎯',
      },
      {
        'name': 'Morning Energizer',
        'description': 'Wake up your body with this energizing morning routine',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.low,
        'targetDuration': 10,
        'preferredCategories': [
          MovementCategory.bodyweight,
          MovementCategory.cardio
        ],
        'category': 'Quick',
        'icon': '🌅',
      },
    ];
  }

  /// Get default workouts organized by category
  Map<String, List<Map<String, dynamic>>> getDefaultWorkoutsByCategory() {
    final workouts = getDefaultWorkoutConfigurations();
    final Map<String, List<Map<String, dynamic>>> categorized = {};
    
    for (final workout in workouts) {
      final category = workout['category'] as String;
      if (!categorized.containsKey(category)) {
        categorized[category] = [];
      }
      categorized[category]!.add(workout);
    }
    
    return categorized;
  }

  /// Add selected default workouts to the user's templates
  Future<List<String>> addSelectedDefaultWorkouts(List<String> selectedWorkoutNames) async {
    final List<String> addedTemplateIds = [];
    final availableWorkouts = getDefaultWorkoutConfigurations();

    try {
      for (final workoutName in selectedWorkoutNames) {
        final workoutConfig = availableWorkouts.firstWhere(
          (w) => w['name'] == workoutName,
          orElse: () => {},
        );

        if (workoutConfig.isNotEmpty) {
          final templateId = await _templateService.createTemplate(
            name: workoutConfig['name'] as String,
            description: workoutConfig['description'] as String,
            format: workoutConfig['format'] as WorkoutFormat,
            intensity: workoutConfig['intensity'] as IntensityLevel,
            targetDuration: workoutConfig['targetDuration'] as int,
            preferredCategories: workoutConfig['preferredCategories'] as List<MovementCategory>?,
            isMainMovementOnly: workoutConfig['isMainMovementOnly'] as bool?,
          );
          
          addedTemplateIds.add(templateId);
          _logger.i('Added default workout template: ${workoutConfig['name']}');
        }
      }

      _logger.i('Successfully added ${addedTemplateIds.length} default workout templates');
    } catch (e) {
      _logger.e('Error adding default workout templates: $e');
    }

    return addedTemplateIds;
  }

  /// Add all default workouts
  Future<List<String>> addAllDefaultWorkouts() async {
    final allWorkoutNames = getDefaultWorkoutConfigurations()
        .map((w) => w['name'] as String)
        .toList();
    
    return await addSelectedDefaultWorkouts(allWorkoutNames);
  }

  /// Get recommended workouts based on user preference
  List<Map<String, dynamic>> getRecommendedWorkouts(String preference) {
    final allWorkouts = getDefaultWorkoutConfigurations();
    
    switch (preference.toLowerCase()) {
      case 'beginner':
        return allWorkouts.where((w) => 
          (w['category'] == 'Beginner' || w['category'] == 'Quick' || w['category'] == 'Recovery')
        ).toList();
      
      case 'cardio':
        return allWorkouts.where((w) => 
          (w['category'] == 'Cardio' || w['category'] == 'Endurance' || w['category'] == 'Quick')
        ).toList();
      
      case 'strength':
        return allWorkouts.where((w) => 
          (w['category'] == 'Strength' || w['category'] == 'Core' || w['category'] == 'Advanced')
        ).toList();
      
      case 'mixed':
        // Return a balanced mix from different categories
        return [
          ...allWorkouts.where((w) => w['category'] == 'Beginner').take(2),
          ...allWorkouts.where((w) => w['category'] == 'Cardio').take(2),
          ...allWorkouts.where((w) => w['category'] == 'Strength').take(2),
          ...allWorkouts.where((w) => w['category'] == 'Recovery').take(1),
          ...allWorkouts.where((w) => w['category'] == 'Quick').take(1),
        ];
      
      default:
        return allWorkouts.take(4).toList(); // Return first 4 as default
    }
  }
}