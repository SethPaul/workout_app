import 'package:flutter_test/flutter_test.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_generator.dart';

void main() {
  group('WorkoutGenerator', () {
    late List<Movement> testMovements;
    late WorkoutGenerator generator;

    setUp(() {
      testMovements = [
        Movement(
          id: '1',
          name: 'Back Squat',
          description: 'A compound lower body movement',
          categories: [MovementCategory.compoundLift],
          requiredEquipment: [EquipmentType.barbell],
          muscleGroups: [MuscleGroup.legs],
          difficultyLevel: DifficultyLevel.intermediate,
          isMainMovement: true,
          scalingOptions: {'beginner': 'Goblet Squat'},
          guidelines: {'form': 'Keep chest up'},
        ),
        Movement(
          id: '2',
          name: 'Push-up',
          description: 'A bodyweight upper body movement',
          categories: [MovementCategory.bodyweight],
          requiredEquipment: [EquipmentType.bodyweight],
          muscleGroups: [MuscleGroup.chest, MuscleGroup.shoulders],
          difficultyLevel: DifficultyLevel.beginner,
          isMainMovement: true,
          scalingOptions: {'beginner': 'Knee Push-up'},
          guidelines: {'form': 'Keep core tight'},
        ),
        Movement(
          id: '3',
          name: 'Bicep Curl',
          description: 'An isolation movement for biceps',
          categories: [MovementCategory.accessory],
          requiredEquipment: [EquipmentType.dumbbell],
          muscleGroups: [MuscleGroup.biceps],
          difficultyLevel: DifficultyLevel.beginner,
          isMainMovement: false,
          scalingOptions: {'beginner': 'Lighter Weight'},
          guidelines: {'form': 'Keep elbows fixed'},
        ),
      ];

      generator = WorkoutGenerator(availableMovements: testMovements);
    });

    test('generates workout with correct format and intensity', () {
      final workout = generator.generateWorkout(
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
      );

      expect(workout.format, equals(WorkoutFormat.emom));
      expect(workout.intensity, equals(IntensityLevel.medium));
      expect(workout.timeCapInMinutes, equals(20));
    });

    test('filters movements by category', () {
      final workout = generator.generateWorkout(
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
        preferredCategories: [MovementCategory.compoundLift],
      );

      final movementIds = workout.movements.map((m) => m.movementId).toList();
      expect(movementIds, contains('1')); // Back Squat
      expect(movementIds, isNot(contains('2'))); // Push-up
      expect(movementIds, isNot(contains('3'))); // Bicep Curl
    });

    test('filters movements by equipment', () {
      final workout = generator.generateWorkout(
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
        availableEquipment: [EquipmentType.bodyweight],
      );

      final movementIds = workout.movements.map((m) => m.movementId).toList();
      expect(movementIds, contains('2')); // Push-up
      expect(movementIds, isNot(contains('1'))); // Back Squat
      expect(movementIds, isNot(contains('3'))); // Bicep Curl
    });

    test('filters movements by main movement flag', () {
      final workout = generator.generateWorkout(
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
        isMainMovementOnly: true,
      );

      final movementIds = workout.movements.map((m) => m.movementId).toList();
      expect(movementIds, contains('1')); // Back Squat
      expect(movementIds, contains('2')); // Push-up
      expect(movementIds, isNot(contains('3'))); // Bicep Curl
    });

    test('generates workout with movements', () {
      final workout = generator.generateWorkout(
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
      );

      expect(workout.movements, isNotEmpty);
      expect(workout.movements.length, lessThanOrEqualTo(3));
      expect(workout.movements.every((m) => m.reps > 0), isTrue);
    });

    test('generates workout with name and description', () {
      final workout = generator.generateWorkout(
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
      );

      expect(workout.name, isNotEmpty);
      expect(workout.description, isNotEmpty);
      expect(workout.name, contains('emom'));
      expect(workout.name, contains('Balanced'));
      expect(workout.description, contains('Moderate-intensity'));
      expect(workout.description, contains('EMOM'));
    });
  });
}
