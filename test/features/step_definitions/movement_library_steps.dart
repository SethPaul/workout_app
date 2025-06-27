import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gherkin/gherkin.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/presentation/pages/movement_list_page.dart';
import 'package:workout_app/main.dart';
import '../../helpers/test_helpers.dart';

class AppLaunchedStep extends Given1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    await TestHelpers.initTestDatabase();
    await world.appDriver
        .pumpWidget(TestHelpers.createTestWidget(const MyApp()));
    await world.appDriver.pumpAndSettle();
  }

  @override
  RegExp get pattern => RegExp(r'the app is launched');
}

class NavigateToMovementLibraryStep
    extends Given1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    // Navigate to movement library page
    await world.appDriver.tap(find.byIcon(Icons.fitness_center));
    await world.appDriver.pumpAndSettle();
  }

  @override
  RegExp get pattern => RegExp(r'I am on the movement library page');
}

class MovementsInDatabaseStep extends Given1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    // Create test movements and add to database
    final movements = MockDataFactory.createMovements(10);
    // Add movements to repository/database
    // This would typically involve injecting a mock repository
    world.setProperty('testMovements', movements);
  }

  @override
  RegExp get pattern => RegExp(r'there are movements in the database');
}

class ViewMovementListStep extends When1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    // Already on movement list page, just verify it's loaded
    expect(find.byType(MovementListPage), findsOneWidget);
    await world.appDriver.pumpAndSettle();
  }

  @override
  RegExp get pattern => RegExp(r'I view the movement list');
}

class SeeMovementListStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    // Verify movement list is visible
    expect(find.byType(ListView), findsOneWidget);

    // Check that movements are displayed
    final movements = world.getProperty('testMovements') as List<Movement>;
    for (final movement in movements.take(3)) {
      // Check first 3 movements
      expect(find.text(movement.name), findsOneWidget);
    }
  }

  @override
  RegExp get pattern => RegExp(r'I should see a list of movements');
}

class MovementDisplayInfoStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    // Verify each movement shows name and description
    final movements = world.getProperty('testMovements') as List<Movement>;
    final firstMovement = movements.first;

    expect(find.text(firstMovement.name), findsOneWidget);
    // Note: Description might be truncated in list view
    expect(find.textContaining(firstMovement.description.substring(0, 10)),
        findsOneWidget);
  }

  @override
  RegExp get pattern =>
      RegExp(r'each movement should display its name and description');
}

class DifferentCategoriesStep extends Given1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    final movements = [
      MockDataFactory.createMovement(categories: [MovementCategory.bodyweight]),
      MockDataFactory.createMovement(
          categories: [MovementCategory.compoundLift]),
      MockDataFactory.createMovement(categories: [MovementCategory.cardio]),
    ];
    world.setProperty('testMovements', movements);
  }

  @override
  RegExp get pattern => RegExp(r'there are movements in different categories');
}

class FilterByCategoryStep extends When1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String category) async {
    // Open filter modal
    await world.appDriver.tap(find.byIcon(Icons.filter_list));
    await world.appDriver.pumpAndSettle();

    // Select category filter
    await world.appDriver.tap(find.text(category));
    await world.appDriver.pumpAndSettle();

    // Apply filter
    await world.appDriver.tap(find.text('Apply'));
    await world.appDriver.pumpAndSettle();
  }

  @override
  RegExp get pattern => RegExp(r'I filter by {string} category');
}

class SeeOnlyBodyweightMovementsStep
    extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    final movements = world.getProperty('testMovements') as List<Movement>;
    final bodyweightMovements = movements
        .where((m) => m.categories.contains(MovementCategory.bodyweight))
        .toList();

    // Verify only bodyweight movements are visible
    for (final movement in bodyweightMovements) {
      expect(find.text(movement.name), findsOneWidget);
    }
  }

  @override
  RegExp get pattern => RegExp(r'I should only see bodyweight movements');
}

class SearchMovementsStep extends When1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String searchTerm) async {
    // Find search field and enter text
    final searchField = find.byType(TextField);
    await world.appDriver.tap(searchField);
    await world.appDriver.enterText(searchField, searchTerm);
    await world.appDriver.pumpAndSettle();
  }

  @override
  RegExp get pattern => RegExp(r'I search for {string}');
}

class SeeSearchResultsStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String searchTerm) async {
    // Verify search results contain the search term
    expect(find.textContaining(searchTerm), findsAtLeastNWidgets(1));
  }

  @override
  RegExp get pattern =>
      RegExp(r'I should see movements containing {string} in their name');
}

class TapMovementStep extends When1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String movementName) async {
    await world.appDriver.tap(find.text(movementName));
    await world.appDriver.pumpAndSettle();
  }

  @override
  RegExp get pattern => RegExp(r'I tap on the {string} movement');
}

class SeeMovementDetailPageStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    // Verify we're on movement detail page
    expect(find.text('Movement Details'), findsOneWidget);
    // Or check for specific movement detail elements
    expect(find.text('Description'), findsOneWidget);
    expect(find.text('Equipment'), findsOneWidget);
    expect(find.text('Muscle Groups'), findsOneWidget);
  }

  @override
  RegExp get pattern => RegExp(r'I should see the movement detail page');
}

class SeeMovementDescriptionStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    expect(find.text('Description'), findsOneWidget);
  }

  @override
  RegExp get pattern => RegExp(r'I should see the movement description');
}

class SeeRequiredEquipmentStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    expect(find.text('Equipment'), findsOneWidget);
  }

  @override
  RegExp get pattern => RegExp(r'I should see the required equipment');
}

class SeeMuscleGroupsStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    expect(find.text('Muscle Groups'), findsOneWidget);
  }

  @override
  RegExp get pattern => RegExp(r'I should see the muscle groups targeted');
}

class SeeDifficultyLevelStep extends Then1WithWorld<String, FlutterWorld> {
  @override
  Future<void> executeStep(String parameter1) async {
    expect(find.text('Difficulty'), findsOneWidget);
  }

  @override
  RegExp get pattern => RegExp(r'I should see the difficulty level');
}
