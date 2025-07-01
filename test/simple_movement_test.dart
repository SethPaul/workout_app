import 'package:flutter_test/flutter_test.dart';
import 'package:workout_app/data/models/movement.dart';

void main() {
  group('Movement Model Tests', () {
    // Sample movement data for testing
    final movementData = {
      'id': 'test_movement_1',
      'name': 'Push Up',
      'description': 'A basic bodyweight push-up exercise',
      'categories': ['bodyweight'],
      'requiredEquipment': ['bodyweight'],
      'muscleGroups': ['chest', 'triceps', 'core'],
      'difficultyLevel': 'beginner',
      'scalingOptions': {
        'easier': 'Knee push-ups',
        'harder': 'Diamond push-ups'
      },
      'guidelines': {
        'form': 'Keep body straight',
        'breathing': 'Exhale on push up'
      },
      'isMainMovement': false,
      'videoUrl': 'https://example.com/video',
      'imageUrl': 'https://example.com/image.jpg'
    };

    test('Movement should be created from JSON correctly', () {
      // Act
      final movement = Movement.fromJson(movementData);

      // Assert
      expect(movement.id, equals('test_movement_1'));
      expect(movement.name, equals('Push Up'));
      expect(movement.description, equals('A basic bodyweight push-up exercise'));
      expect(movement.categories, contains(MovementCategory.bodyweight));
      expect(movement.requiredEquipment, contains(EquipmentType.bodyweight));
      expect(movement.muscleGroups, contains(MuscleGroup.chest));
      expect(movement.difficultyLevel, equals(DifficultyLevel.beginner));
      expect(movement.isMainMovement, isFalse);
      expect(movement.scalingOptions, isA<Map<String, String>>());
      expect(movement.guidelines, isA<Map<String, dynamic>>());
    });

    test('Movement should convert to JSON correctly', () {
      // Arrange
      final movement = Movement.fromJson(movementData);

      // Act
      final json = movement.toJson();

      // Assert
      expect(json['id'], equals('test_movement_1'));
      expect(json['name'], equals('Push Up'));
      expect(json['categories'], contains('bodyweight'));
      expect(json['requiredEquipment'], contains('bodyweight'));
      expect(json['muscleGroups'], contains('chest'));
      expect(json['difficultyLevel'], equals('beginner'));
      expect(json['isMainMovement'], isFalse);
    });

    test('Movement copyWith should work correctly', () {
      // Arrange
      final originalMovement = Movement.fromJson(movementData);

      // Act
      final copiedMovement = originalMovement.copyWith(
        name: 'Diamond Push Up',
        difficultyLevel: DifficultyLevel.intermediate,
      );

      // Assert
      expect(copiedMovement.name, equals('Diamond Push Up'));
      expect(copiedMovement.difficultyLevel, equals(DifficultyLevel.intermediate));
      expect(copiedMovement.id, equals(originalMovement.id)); // Should remain unchanged
      expect(copiedMovement.categories, equals(originalMovement.categories)); // Should remain unchanged
    });

    test('Movement equality should work correctly', () {
      // Arrange
      final movement1 = Movement.fromJson(movementData);
      final movement2 = Movement.fromJson(movementData);
      final movement3 = movement1.copyWith(name: 'Different Name');

      // Assert
      expect(movement1, equals(movement2)); // Same data should be equal
      expect(movement1, isNot(equals(movement3))); // Different data should not be equal
    });

    test('Movement should handle missing optional fields', () {
      // Arrange
      final minimalData = {
        'id': 'minimal_movement',
        'name': 'Minimal Movement',
        'description': 'A minimal movement',
        'categories': ['bodyweight'],
        'requiredEquipment': ['bodyweight'],
        'muscleGroups': ['core'],
        'difficultyLevel': 'beginner',
        'scalingOptions': {},
        'guidelines': {},
      };

      // Act
      final movement = Movement.fromJson(minimalData);

      // Assert
      expect(movement.id, equals('minimal_movement'));
      expect(movement.name, equals('Minimal Movement'));
      expect(movement.isMainMovement, isFalse); // Should default to false
      expect(movement.videoUrl, isNull);
      expect(movement.imageUrl, isNull);
    });
  });
}