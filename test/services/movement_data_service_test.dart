import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:workout_app/services/movement_data_service.dart';

// Simple test repository implementation that works without mockito
class TestMovementRepository implements MovementRepository {
  List<Movement> _movements = [];

  void setMovements(List<Movement> movements) {
    _movements = movements;
  }

  @override
  Future<List<Movement>> getAllMovements() async => _movements;

  @override
  Future<Movement?> getMovementById(String id) async {
    try {
      return _movements.firstWhere((m) => m.id == id);
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<Movement>> getMovementsByCategory(MovementCategory category) async {
    return _movements.where((m) => m.categories.contains(category)).toList();
  }

  @override
  Future<List<Movement>> getMovementsByEquipment(EquipmentType equipment) async {
    return _movements.where((m) => m.requiredEquipment.contains(equipment)).toList();
  }

  @override
  Future<List<Movement>> getMovementsByDifficulty(DifficultyLevel difficulty) async {
    return _movements.where((m) => m.difficultyLevel == difficulty).toList();
  }

  @override
  Future<List<Movement>> getMainMovements() async {
    return _movements.where((m) => m.isMainMovement).toList();
  }

  @override
  Future<String> createMovement(Movement movement) async {
    _movements.add(movement);
    return movement.id;
  }

  @override
  Future<void> updateMovement(Movement movement) async {
    final index = _movements.indexWhere((m) => m.id == movement.id);
    if (index != -1) {
      _movements[index] = movement;
    }
  }

  @override
  Future<void> deleteMovement(String id) async {
    _movements.removeWhere((m) => m.id == id);
  }
}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  group('MovementDataService', () {
    late TestMovementRepository testRepository;
    late MovementDataService service;

    setUp(() {
      testRepository = TestMovementRepository();
      service = MovementDataService(repository: testRepository);
    });

    test('should initialize movement library when no movements exist', () async {
      // Arrange
      testRepository.setMovements([]);

      // Act
      await service.initializeMovementLibrary();
      final count = await service.getMovementCount();

      // Assert - When empty, service loads movements from JSON file
      expect(count, greaterThan(0)); // Should load movements from JSON
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

      testRepository.setMovements(existingMovements);

      // Act
      await service.initializeMovementLibrary();
      final count = await service.getMovementCount();

      // Assert
      expect(count, equals(1));
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

      testRepository.setMovements(movements);

      // Act
      final count = await service.getMovementCount();

      // Assert
      expect(count, equals(2));
    });
  });
}
