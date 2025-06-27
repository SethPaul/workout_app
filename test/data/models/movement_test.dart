import 'package:flutter_test/flutter_test.dart';
import 'package:workout_app/data/models/movement.dart';

void main() {
  group('Movement', () {
    test('should create a Movement instance with required fields', () {
      final movement = Movement(
        id: '1',
        name: 'Push-up',
        description:
            'A bodyweight exercise that targets the chest, shoulders, and triceps',
        categories: [MovementCategory.bodyweight],
        requiredEquipment: [EquipmentType.bodyweight],
        muscleGroups: [
          MuscleGroup.chest,
          MuscleGroup.shoulders,
          MuscleGroup.triceps
        ],
        difficultyLevel: DifficultyLevel.beginner,
        scalingOptions: {
          'beginner': 'Knee push-ups',
          'advanced': 'Diamond push-ups'
        },
        guidelines: {'reps': '8-12', 'sets': '3-4'},
      );

      expect(movement.id, equals('1'));
      expect(movement.name, equals('Push-up'));
      expect(movement.description, contains('bodyweight exercise'));
      expect(movement.categories, contains(MovementCategory.bodyweight));
      expect(movement.requiredEquipment, contains(EquipmentType.bodyweight));
      expect(
          movement.muscleGroups,
          containsAll(
              [MuscleGroup.chest, MuscleGroup.shoulders, MuscleGroup.triceps]));
      expect(movement.difficultyLevel, equals(DifficultyLevel.beginner));
      expect(movement.isMainMovement, isFalse);
      expect(
          movement.scalingOptions, containsPair('beginner', 'Knee push-ups'));
      expect(movement.guidelines, containsPair('reps', '8-12'));
    });

    test('should convert Movement to and from JSON', () {
      final movement = Movement(
        id: '1',
        name: 'Push-up',
        description:
            'A bodyweight exercise that targets the chest, shoulders, and triceps',
        categories: [MovementCategory.bodyweight],
        requiredEquipment: [EquipmentType.bodyweight],
        muscleGroups: [
          MuscleGroup.chest,
          MuscleGroup.shoulders,
          MuscleGroup.triceps
        ],
        difficultyLevel: DifficultyLevel.beginner,
        scalingOptions: {
          'beginner': 'Knee push-ups',
          'advanced': 'Diamond push-ups'
        },
        guidelines: {'reps': '8-12', 'sets': '3-4'},
      );

      final json = movement.toJson();
      final fromJson = Movement.fromJson(json);

      expect(fromJson.id, equals(movement.id));
      expect(fromJson.name, equals(movement.name));
      expect(fromJson.description, equals(movement.description));
      expect(fromJson.categories, equals(movement.categories));
      expect(fromJson.requiredEquipment, equals(movement.requiredEquipment));
      expect(fromJson.muscleGroups, equals(movement.muscleGroups));
      expect(fromJson.difficultyLevel, equals(movement.difficultyLevel));
      expect(fromJson.isMainMovement, equals(movement.isMainMovement));
      expect(fromJson.scalingOptions, equals(movement.scalingOptions));
      expect(fromJson.guidelines, equals(movement.guidelines));
    });

    test('should create a copy of Movement with modified fields', () {
      final movement = Movement(
        id: '1',
        name: 'Push-up',
        description:
            'A bodyweight exercise that targets the chest, shoulders, and triceps',
        categories: [MovementCategory.bodyweight],
        requiredEquipment: [EquipmentType.bodyweight],
        muscleGroups: [
          MuscleGroup.chest,
          MuscleGroup.shoulders,
          MuscleGroup.triceps
        ],
        difficultyLevel: DifficultyLevel.beginner,
        scalingOptions: {
          'beginner': 'Knee push-ups',
          'advanced': 'Diamond push-ups'
        },
        guidelines: {'reps': '8-12', 'sets': '3-4'},
      );

      final modifiedMovement = movement.copyWith(
        name: 'Modified Push-up',
        difficultyLevel: DifficultyLevel.intermediate,
        isMainMovement: true,
      );

      expect(modifiedMovement.id, equals(movement.id));
      expect(modifiedMovement.name, equals('Modified Push-up'));
      expect(modifiedMovement.description, equals(movement.description));
      expect(modifiedMovement.categories, equals(movement.categories));
      expect(modifiedMovement.requiredEquipment,
          equals(movement.requiredEquipment));
      expect(modifiedMovement.muscleGroups, equals(movement.muscleGroups));
      expect(modifiedMovement.difficultyLevel,
          equals(DifficultyLevel.intermediate));
      expect(modifiedMovement.isMainMovement, isTrue);
      expect(modifiedMovement.scalingOptions, equals(movement.scalingOptions));
      expect(modifiedMovement.guidelines, equals(movement.guidelines));
    });
  });
}
