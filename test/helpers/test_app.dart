import 'package:flutter/material.dart';
import 'package:sqflite/sqflite.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:workout_app/data/repositories/workout_repository.dart';
import 'package:workout_app/data/repositories/workout_template_repository.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/screens/workout_list_screen.dart';
import 'package:workout_app/screens/workout_history_screen.dart';
import 'package:workout_app/services/workout_generator.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/data/database/database_helper.dart';
import 'package:logger/logger.dart';
import 'test_helpers.dart';

/// Test-specific app that uses in-memory database
class TestWorkoutApp extends StatelessWidget {
  const TestWorkoutApp({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<WorkoutService>(
      future: _initializeTestApp(),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return MaterialApp(
            home: Scaffold(
              body: Center(
                child: Text('Test initialization failed: ${snapshot.error}'),
              ),
            ),
          );
        }

        if (!snapshot.hasData) {
          return const MaterialApp(
            home: Scaffold(body: Center(child: CircularProgressIndicator())),
          );
        }

        return WorkoutApp(workoutService: snapshot.data!);
      },
    );
  }

  Future<WorkoutService> _initializeTestApp() async {
    final logger = Logger();
    logger.i('Initializing test app...');

    // Use test database helper
    final testDatabaseHelper = TestHelpers.createTestDatabaseHelper();

    // Create test repositories that use the test database
    final movementRepository = TestMovementRepository(testDatabaseHelper);
    final workoutRepository = TestWorkoutRepository(testDatabaseHelper);
    final workoutTemplateRepository = TestWorkoutTemplateRepository(
      testDatabaseHelper,
    );

    // Create some test movements for the app to work with
    await _seedTestData(movementRepository);

    // Load movements
    final availableMovements = await movementRepository.getAllMovements();

    // Create services
    final workoutGenerator = WorkoutGenerator(
      availableMovements: availableMovements,
    );

    final workoutTemplateService = WorkoutTemplateService(
      repository: workoutTemplateRepository,
      workoutGenerator: workoutGenerator,
    );

    // Create a simplified test workout service
    final workoutService = TestWorkoutService(
      repository: workoutRepository,
      templateService: workoutTemplateService,
    );

    logger.i('Test app initialization complete!');
    return workoutService;
  }

  Future<void> _seedTestData(MovementRepository repository) async {
    // Create some basic test movements
    final testMovements = MockDataFactory.createMovements(10);
    for (final movement in testMovements) {
      await repository.createMovement(movement);
    }
  }
}

class WorkoutApp extends StatelessWidget {
  final WorkoutService workoutService;

  const WorkoutApp({super.key, required this.workoutService});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Workout App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: HomeScreen(workoutService: workoutService),
    );
  }
}

class HomeScreen extends StatelessWidget {
  final WorkoutService workoutService;

  const HomeScreen({super.key, required this.workoutService});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: const Text('Workout App'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Text(
              'Welcome to your Workout App!',
              style: TextStyle(fontSize: 24),
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) =>
                        WorkoutListScreen(workoutService: workoutService),
                  ),
                );
              },
              child: const Text('Start Workout'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) =>
                        WorkoutHistoryScreen(workoutService: workoutService),
                  ),
                );
              },
              child: const Text('Workout History'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Test-specific repository implementations that use the test database helper
class TestMovementRepository extends SQLiteMovementRepository {
  final TestDatabaseHelper _testDbHelper;

  TestMovementRepository(this._testDbHelper);

  @override
  Future<Database> get database async => await _testDbHelper.database;
}

class TestWorkoutRepository extends SQLiteWorkoutRepository {
  final TestDatabaseHelper _testDbHelper;

  TestWorkoutRepository(this._testDbHelper);

  @override
  Future<Database> get database async => await _testDbHelper.database;
}

class TestWorkoutTemplateRepository extends SQLiteWorkoutTemplateRepository {
  final TestDatabaseHelper _testDbHelper;

  TestWorkoutTemplateRepository(this._testDbHelper);

  @override
  Future<Database> get database async => await _testDbHelper.database;
}

/// Simplified test workout service that doesn't require DatabaseHelper
class TestWorkoutService extends WorkoutService {
  TestWorkoutService({
    required WorkoutRepository repository,
    required WorkoutTemplateService templateService,
  }) : super(
         repository: repository,
         templateService: templateService,
         databaseHelper: DatabaseHelper(), // Use default singleton
       );

  // Override methods that use database helper directly
  @override
  Future<List<Workout>> getCompletedWorkouts() async {
    // For tests, return empty list or mock data
    return [];
  }
}
