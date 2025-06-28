import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:workout_app/services/movement_data_service.dart';

import 'movement_data_service_test.mocks.dart';

@GenerateMocks([MovementRepository])
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group('MovementDataService', () {
    late MockMovementRepository mockRepository;
    late MovementDataService service;

    setUp(() {
      mockRepository = MockMovementRepository();
      service = MovementDataService(repository: mockRepository);
    });

    test('should initialize movement library when no movements exist',
        () async {
      // Arrange
      when(mockRepository.getAllMovements()).thenAnswer((_) async => []);
      when(mockRepository.createMovement(any)).thenAnswer((_) async => 'test-id');

      // Act
      await service.initializeMovementLibrary();

      // Assert
      verify(mockRepository.getAllMovements()).called(1);
      // The service should load movements from JSON when repository is empty
    });

    test('should not reload movements if they already exist', () async {
      // Arrange
      final existingMovements = [
        Movement(
          id: 'test1',
          name: 'Test Movement',
          description: 'Test description',
          categories: [MovementCategory.bodyweight],
          requiredEquipment: [EquipmentType.bodyweight],
          muscleGroups: [MuscleGroup.fullBody],
          difficultyLevel: DifficultyLevel.beginner,
          scalingOptions: {},
          guidelines: {},
        ),
      ];

      when(mockRepository.getAllMovements())
          .thenAnswer((_) async => existingMovements);

      // Act
      await service.initializeMovementLibrary();

      // Assert
      verify(mockRepository.getAllMovements()).called(1);
      verifyNever(mockRepository.createMovement(any));
    });

    test('should get movement count', () async {
      // Arrange
      final movements = [
        Movement(
          id: 'test1',
          name: 'Test Movement 1',
          description: 'Test description',
          categories: [MovementCategory.bodyweight],
          requiredEquipment: [EquipmentType.bodyweight],
          muscleGroups: [MuscleGroup.fullBody],
          difficultyLevel: DifficultyLevel.beginner,
          scalingOptions: {},
          guidelines: {},
        ),
        Movement(
          id: 'test2',
          name: 'Test Movement 2',
          description: 'Test description',
          categories: [MovementCategory.compoundLift],
          requiredEquipment: [EquipmentType.barbell],
          muscleGroups: [MuscleGroup.legs],
          difficultyLevel: DifficultyLevel.intermediate,
          scalingOptions: {},
          guidelines: {},
        ),
      ];

      when(mockRepository.getAllMovements()).thenAnswer((_) async => movements);

      // Act
      final count = await service.getMovementCount();

      // Assert
      expect(count, equals(2));
      verify(mockRepository.getAllMovements()).called(1);
    });
  });
}
