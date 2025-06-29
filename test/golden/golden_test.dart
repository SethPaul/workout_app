import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:golden_toolkit/golden_toolkit.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/presentation/widgets/movement_card.dart';

import '../helpers/test_helpers.dart';

void main() {
  group('Golden Tests', () {
    setUpAll(() async {
      await TestHelpers.initTestDatabase();
    });

    testGoldens('MovementCard golden test', (WidgetTester tester) async {
      // Create test movement
      final movement = MockDataFactory.createMovement(
        name: 'Push-up',
        categories: [MovementCategory.bodyweight],
        muscleGroups: [MuscleGroup.chest, MuscleGroup.triceps],
        equipment: [EquipmentType.bodyweight],
        difficulty: DifficultyLevel.beginner,
        isMainMovement: true,
      );

      // Build widget
      await tester.pumpWidgetBuilder(
        MovementCard(movement: movement, onTap: () {}),
        surfaceSize: const Size(400, 200),
      );

      // Capture golden
      await expectLater(
        find.byType(MovementCard),
        matchesGoldenFile('movement_card.png'),
      );
    });

    testGoldens('MovementCard variations', (WidgetTester tester) async {
      final movements = [
        MockDataFactory.createMovement(
          name: 'Beginner Push-up',
          categories: [MovementCategory.bodyweight],
          difficulty: DifficultyLevel.beginner,
          isMainMovement: false,
        ),
        MockDataFactory.createMovement(
          name: 'Advanced Squat',
          categories: [MovementCategory.compoundLift],
          difficulty: DifficultyLevel.advanced,
          isMainMovement: true,
        ),
        MockDataFactory.createMovement(
          name: 'Cardio Running',
          categories: [MovementCategory.cardio],
          difficulty: DifficultyLevel.intermediate,
          isMainMovement: false,
        ),
      ];

      for (int i = 0; i < movements.length; i++) {
        await tester.pumpWidgetBuilder(
          MovementCard(movement: movements[i], onTap: () {}),
          surfaceSize: const Size(400, 200),
        );

        await expectLater(
          find.byType(MovementCard),
          matchesGoldenFile('movement_card_variation_$i.png'),
        );
      }
    });

    testGoldens('MovementCard list view', (WidgetTester tester) async {
      final movements = MockDataFactory.createMovements(3);

      await tester.pumpWidgetBuilder(
        Container(
          key: const Key('movement_list'),
          child: ListView.builder(
            itemCount: movements.length,
            itemBuilder: (context, index) =>
                MovementCard(movement: movements[index], onTap: () {}),
          ),
        ),
        surfaceSize: const Size(400, 600),
      );

      await expectLater(
        find.byKey(const Key('movement_list')),
        matchesGoldenFile('movement_list.png'),
      );
    });

    testGoldens('Empty state golden test', (WidgetTester tester) async {
      await tester.pumpWidgetBuilder(
        const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.fitness_center, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'No movements found',
                style: TextStyle(fontSize: 18, color: Colors.grey),
              ),
              SizedBox(height: 8),
              Text(
                'Try adjusting your filters',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
            ],
          ),
        ),
        surfaceSize: const Size(400, 300),
      );

      await expectLater(
        find.text('No movements found'),
        matchesGoldenFile('empty_state.png'),
      );
    });

    testGoldens('Loading state golden test', (WidgetTester tester) async {
      await tester.pumpWidgetBuilder(
        const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading movements...'),
            ],
          ),
        ),
        surfaceSize: const Size(400, 200),
      );

      await expectLater(
        find.text('Loading movements...'),
        matchesGoldenFile('loading_state.png'),
      );
    });

    testGoldens('Error state golden test', (WidgetTester tester) async {
      await tester.pumpWidgetBuilder(
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              const Text(
                'Something went wrong',
                style: TextStyle(fontSize: 18, color: Colors.red),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please try again',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () {}, child: const Text('Retry')),
            ],
          ),
        ),
        surfaceSize: const Size(400, 300),
      );

      await expectLater(
        find.text('Something went wrong'),
        matchesGoldenFile('error_state.png'),
      );
    });
  });
}
