import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:faker/faker.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:sqflite/sqflite.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/database/database_helper.dart';

/// Test-specific database helper that uses in-memory database
class TestDatabaseHelper {
  final Database? _testDatabase;

  TestDatabaseHelper(this._testDatabase);

  Future<Database> get database async {
    if (_testDatabase == null) {
      throw Exception(
        'Test database not initialized. Call TestHelpers.initTestDatabase() first.',
      );
    }
    return _testDatabase!;
  }

  Future<void> close() async {
    // Don't close the test database here, let TestHelpers manage it
  }
}

/// Test helpers for creating mock data and setting up test environment
class TestHelpers {
  static final faker = Faker();
  static Database? _testDatabase;

  /// Initialize test database with in-memory database
  static Future<void> initTestDatabase() async {
    // Initialize FFI for testing
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;

    // Create in-memory database for tests
    _testDatabase = await openDatabase(
      inMemoryDatabasePath,
      version: 1,
      onCreate: _createTestDb,
    );
  }

  /// Create test database schema
  static Future<void> _createTestDb(Database db, int version) async {
    // Create workouts table
    await db.execute('''
      CREATE TABLE workouts(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        format TEXT NOT NULL,
        intensity TEXT NOT NULL,
        rounds INTEGER,
        duration INTEGER,
        time_cap_in_minutes INTEGER,
        format_specific_settings TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        notes TEXT
      )
    ''');

    // Create movements table
    await db.execute('''
      CREATE TABLE movements(
        id TEXT PRIMARY KEY,
        workout_id TEXT NOT NULL,
        name TEXT NOT NULL,
        reps INTEGER,
        time_in_seconds INTEGER,
        weight REAL,
        scaling_option TEXT,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
      )
    ''');

    // Create workout templates table
    await db.execute('''
      CREATE TABLE workout_templates(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        format TEXT NOT NULL,
        intensity TEXT NOT NULL,
        rounds INTEGER,
        time_cap_in_minutes INTEGER,
        format_specific_settings TEXT,
        created_at TEXT NOT NULL
      )
    ''');
  }

  /// Get test database instance
  static Database? get testDatabase => _testDatabase;

  /// Clean up test database
  static Future<void> cleanupTestDatabase() async {
    if (_testDatabase != null) {
      await _testDatabase!.close();
      _testDatabase = null;
    }
  }

  /// Reset test database (clear all data)
  static Future<void> resetTestDatabase() async {
    if (_testDatabase != null) {
      await _testDatabase!.delete('workouts');
      await _testDatabase!.delete('movements');
      await _testDatabase!.delete('workout_templates');
    }
  }

  /// Create a test-specific database helper that uses in-memory database
  static TestDatabaseHelper createTestDatabaseHelper() {
    return TestDatabaseHelper(_testDatabase);
  }

  /// Create a test widget wrapped with MaterialApp and necessary providers
  static Widget createTestWidget(Widget child) {
    return MaterialApp(home: child, theme: ThemeData.light());
  }

  /// Wait for animations and pumps to complete
  static Future<void> pumpAndSettleWithTimeout(
    WidgetTester tester, {
    Duration timeout = const Duration(seconds: 10),
  }) async {
    await tester.pumpAndSettle(timeout);
  }

  /// Find widget by type with optional index
  static Finder findWidgetByType<T extends Widget>({int index = 0}) {
    final finder = find.byType(T);
    return finder.at(index);
  }

  /// Find widget by key
  static Finder findWidgetByKey(String key) {
    return find.byKey(Key(key));
  }

  /// Verify widget exists and is visible
  static void verifyWidgetExists(WidgetTester tester, Finder finder) {
    expect(finder, findsOneWidget);
    expect(tester.widget(finder), isNotNull);
  }

  /// Tap widget and pump
  static Future<void> tapAndPump(WidgetTester tester, Finder finder) async {
    await tester.tap(finder);
    await tester.pump();
  }

  /// Enter text and pump
  static Future<void> enterTextAndPump(
    WidgetTester tester,
    Finder finder,
    String text,
  ) async {
    await tester.enterText(finder, text);
    await tester.pump();
  }

  /// Scroll widget and pump
  static Future<void> scrollAndPump(
    WidgetTester tester,
    Finder finder,
    Offset offset,
  ) async {
    await tester.drag(finder, offset);
    await tester.pump();
  }
}

/// Mock data factory for creating test data
class MockDataFactory {
  static final faker = Faker();

  /// Create a mock Movement
  static Movement createMovement({
    String? id,
    String? name,
    List<MovementCategory>? categories,
    List<MuscleGroup>? muscleGroups,
    List<EquipmentType>? equipment,
    DifficultyLevel? difficulty,
    bool? isMainMovement,
  }) {
    return Movement(
      id: id ?? faker.guid.guid(),
      name: name ?? faker.sport.name(),
      description: faker.lorem.sentence(),
      categories:
          categories ??
          [
            MovementCategory.values[faker.randomGenerator.integer(
              MovementCategory.values.length,
            )],
          ],
      requiredEquipment:
          equipment ??
          [
            EquipmentType.values[faker.randomGenerator.integer(
              EquipmentType.values.length,
            )],
          ],
      muscleGroups:
          muscleGroups ??
          [
            MuscleGroup.values[faker.randomGenerator.integer(
              MuscleGroup.values.length,
            )],
          ],
      difficultyLevel:
          difficulty ??
          DifficultyLevel.values[faker.randomGenerator.integer(
            DifficultyLevel.values.length,
          )],
      isMainMovement: isMainMovement ?? faker.randomGenerator.boolean(),
      scalingOptions: {
        'beginner': faker.lorem.sentence(),
        'advanced': faker.lorem.sentence(),
      },
      guidelines: {
        'reps':
            '${faker.randomGenerator.integer(15, min: 5)}-${faker.randomGenerator.integer(20, min: 10)}',
        'sets':
            '${faker.randomGenerator.integer(5, min: 1)}-${faker.randomGenerator.integer(8, min: 3)}',
      },
    );
  }

  /// Create multiple movements
  static List<Movement> createMovements(int count) {
    return List.generate(count, (index) => createMovement());
  }

  /// Create a mock WorkoutTemplate
  static WorkoutTemplate createWorkoutTemplate({
    String? id,
    String? name,
    WorkoutFormat? format,
    IntensityLevel? intensity,
  }) {
    return WorkoutTemplate(
      id: id ?? faker.guid.guid(),
      name: name ?? faker.company.name(),
      description: faker.lorem.sentence(),
      format:
          format ??
          WorkoutFormat.values[faker.randomGenerator.integer(
            WorkoutFormat.values.length,
          )],
      intensity:
          intensity ??
          IntensityLevel.values[faker.randomGenerator.integer(
            IntensityLevel.values.length,
          )],
      targetDuration: faker.randomGenerator.integer(60, min: 5),
      createdAt: DateTime.now(),
    );
  }

  /// Create multiple workout templates
  static List<WorkoutTemplate> createWorkoutTemplates(int count) {
    return List.generate(count, (index) => createWorkoutTemplate());
  }

  /// Create a mock WorkoutMovement
  static WorkoutMovement createWorkoutMovement({
    String? movementId,
    int? reps,
  }) {
    return WorkoutMovement(
      movementId: movementId ?? faker.guid.guid(),
      reps: reps ?? faker.randomGenerator.integer(20, min: 5),
    );
  }
}

/// Test matchers for custom assertions
class TestMatchers {
  /// Finder for checking if a widget has specific text
  static Finder hasText(String text) {
    return find.text(text);
  }

  /// Matcher for checking widget visibility
  static Matcher isVisible() {
    return findsOneWidget;
  }

  /// Matcher for checking widget is not visible
  static Matcher isNotVisible() {
    return findsNothing;
  }
}

/// Test constants
class TestConstants {
  static const String testDatabaseName = 'test_workout_app.db';
  static const Duration defaultTimeout = Duration(seconds: 30);
  static const Duration animationTimeout = Duration(seconds: 5);
}
