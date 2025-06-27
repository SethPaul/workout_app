import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/presentation/widgets/movement_card.dart';

void main() {
  group('MovementCard Widget Tests', () {
    late Movement testMovement;
    late bool onTapCalled;

    setUp(() {
      onTapCalled = false;
      testMovement = Movement(
        id: '1',
        name: 'Test Movement',
        description: 'Test Description',
        categories: [MovementCategory.compoundLift],
        requiredEquipment: [EquipmentType.barbell],
        muscleGroups: [MuscleGroup.chest],
        difficultyLevel: DifficultyLevel.intermediate,
        isMainMovement: true,
        scalingOptions: {'beginner': 'Use lighter weight'},
        guidelines: {'sets': 3, 'reps': 10},
      );
    });

    testWidgets('renders correctly with all required data',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: Scaffold(
            body: MovementCard(
              movement: testMovement,
              onTap: () {},
            ),
          ),
        ),
      );

      // Verify movement name is displayed
      expect(find.text('Test Movement'), findsOneWidget);

      // Verify description is displayed
      expect(find.text('Test Description'), findsOneWidget);

      // Verify main movement chip is displayed
      expect(find.text('Main'), findsOneWidget);

      // Verify category chip is displayed
      expect(find.text('compoundLift'), findsOneWidget);

      // Verify equipment chip is displayed
      expect(find.text('barbell'), findsOneWidget);
    });

    testWidgets('triggers onTap callback when tapped',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: Scaffold(
            body: MovementCard(
              movement: testMovement,
              onTap: () => onTapCalled = true,
            ),
          ),
        ),
      );

      // Tap the card
      await tester.tap(find.byType(MovementCard));
      await tester.pump();

      // Verify onTap was called
      expect(onTapCalled, true);
    });

    testWidgets('does not show main movement chip when isMainMovement is false',
        (WidgetTester tester) async {
      final nonMainMovement = testMovement.copyWith(isMainMovement: false);

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: Scaffold(
            body: MovementCard(
              movement: nonMainMovement,
              onTap: () {},
            ),
          ),
        ),
      );

      // Verify main movement chip is not displayed
      expect(find.text('Main'), findsNothing);
    });

    testWidgets('displays multiple categories and equipment correctly',
        (WidgetTester tester) async {
      final movementWithMultipleItems = testMovement.copyWith(
        categories: [
          MovementCategory.compoundLift,
          MovementCategory.bodyweight
        ],
        requiredEquipment: [EquipmentType.barbell, EquipmentType.dumbbell],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: Scaffold(
            body: MovementCard(
              movement: movementWithMultipleItems,
              onTap: () {},
            ),
          ),
        ),
      );

      // Verify all categories are displayed
      expect(find.text('compoundLift'), findsOneWidget);
      expect(find.text('bodyweight'), findsOneWidget);

      // Verify all equipment is displayed
      expect(find.text('barbell'), findsOneWidget);
      expect(find.text('dumbbell'), findsOneWidget);
    });
  });
}
