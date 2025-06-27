// This is a basic Flutter widget test for the Workout App.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:workout_app/main.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/services/user_progress_service.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/user_progress.dart';

// Test implementation of WorkoutTemplateService
class TestWorkoutTemplateService implements WorkoutTemplateService {
  @override
  Future<List<WorkoutTemplate>> getAllTemplates() async => [];

  @override
  Future<WorkoutTemplate?> getTemplateById(String id) async => null;

  @override
  Future<List<WorkoutTemplate>> getTemplatesByFormat(WorkoutFormat format) async => [];

  @override
  Future<List<WorkoutTemplate>> getTemplatesByIntensity(IntensityLevel intensity) async => [];

  @override
  Future<List<WorkoutTemplate>> getTemplatesByEquipment(List<EquipmentType> equipment) async => [];

  @override
  Future<List<WorkoutTemplate>> getTemplatesByCategory(List<MovementCategory> categories) async => [];

  @override
  Future<String> createTemplate({
    required String name,
    required String description,
    required WorkoutFormat format,
    required IntensityLevel intensity,
    required int targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
    Map<String, dynamic>? metadata,
  }) async => 'test_id';

  @override
  Future<void> updateTemplate(WorkoutTemplate template) async {}

  @override
  Future<void> deleteTemplate(String id) async {}

  @override
  Future<Workout> generateWorkoutFromTemplate(String templateId) async {
    return Workout(
      id: 'test_workout',
      name: 'Test Workout',
      description: 'Test Description',
      format: WorkoutFormat.amrap,
      intensity: IntensityLevel.medium,
      movements: [],
      duration: 20,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<Workout> generateWorkoutFromTemplateWithModifications(
    String templateId, {
    WorkoutFormat? format,
    IntensityLevel? intensity,
    int? targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
  }) async {
    return generateWorkoutFromTemplate(templateId);
  }
}

// Test implementation of WorkoutService
class TestWorkoutService implements WorkoutService {
  final WorkoutTemplateService _templateService = TestWorkoutTemplateService();

  @override
  WorkoutTemplateService get templateService => _templateService;

  @override
  Future<List<Workout>> getAllWorkouts() async => [];

  @override
  Future<Workout?> getWorkoutById(String id) async => null;

  @override
  Future<List<Workout>> getWorkoutsByFormat(WorkoutFormat format) async => [];

  @override
  Future<List<Workout>> getWorkoutsByIntensity(IntensityLevel intensity) async => [];

  @override
  Future<String> createWorkoutFromTemplate(String templateId) async => 'test_id';

  @override
  Future<String> createWorkoutFromTemplateWithModifications(
    String templateId, {
    WorkoutFormat? format,
    IntensityLevel? intensity,
    int? targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
  }) async => 'test_id';

  @override
  Future<String> createWorkout(Workout workout) async => 'test_id';

  @override
  Future<void> updateWorkout(Workout workout) async {}

  @override
  Future<void> deleteWorkout(String id) async {}

  @override
  Future<void> markWorkoutAsCompleted(String id) async {}

  @override
  Future<List<Workout>> getCompletedWorkouts() async => [];
}

// Test implementation of UserProgressService
class TestUserProgressService implements UserProgressService {
  @override
  Future<UserProgress?> getCurrentUserProgress() async => null;

  @override
  Future<void> initializeUserProgress() async {}

  @override
  Future<void> recordWorkoutCompletion({
    required String workoutId,
    required int totalTimeInSeconds,
    int? totalRounds,
    int? totalReps,
    double? maxWeight,
    Map<String, dynamic>? performanceMetrics,
    String? notes,
  }) async {}

  @override
  Future<void> updateMovementProgress({
    required String movementId,
    double? maxWeight,
    int? maxReps,
    int? maxTimeInSeconds,
    Map<String, dynamic>? personalRecords,
  }) async {}

  @override
  Future<List<WorkoutResult>> getWorkoutHistory({int? limit}) async => [];

  @override
  Future<MovementProgress?> getMovementProgress(String movementId) async => null;

  @override
  Future<Map<String, dynamic>> getWorkoutStatistics() async => {};

  @override
  Future<Map<String, MovementProgress>> getAllMovementProgress() async => {};

  @override
  bool isNewPersonalRecord({
    required String movementId,
    required MovementProgress? existingProgress,
    double? newWeight,
    int? newReps,
    int? newTimeInSeconds,
  }) => false;

  @override
  Future<void> setUserGoals(Map<String, dynamic> goals) async {}

  @override
  Future<void> addAchievement(String achievementKey, Map<String, dynamic> achievementData) async {}

  @override
  Future<void> clearUserProgress() async {}
}

void main() {
  testWidgets('Workout App home screen displays correct UI elements',
      (WidgetTester tester) async {
    // Create test services
    final testWorkoutService = TestWorkoutService();
    final testUserProgressService = TestUserProgressService();

    // Build our app and trigger a frame using the test service.
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
        ),
      ),
    );

    // Wait for the async loading to complete
    await tester.pumpAndSettle();

    // Verify that our home screen shows the correct UI elements.
    expect(find.text('Workouts'), findsNWidgets(2)); // App bar title and bottom nav
    expect(find.text('No workouts yet'), findsOneWidget);
    expect(find.text('Generate Workout'), findsOneWidget);

    // Verify that the generate workout button is present
    expect(find.byType(ElevatedButton), findsOneWidget);
    
    // Verify bottom navigation is present
    expect(find.byType(BottomNavigationBar), findsOneWidget);
  });

  testWidgets('App handles initialization gracefully',
      (WidgetTester tester) async {
    // Create test services
    final testWorkoutService = TestWorkoutService();
    final testUserProgressService = TestUserProgressService();

    // Build the full WorkoutApp widget
    await tester.pumpWidget(WorkoutApp(
      workoutService: testWorkoutService,
      userProgressService: testUserProgressService,
    ));

    // Wait for the async loading to complete
    await tester.pumpAndSettle();

    // Verify that the app renders without throwing
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(BottomNavigationBar), findsOneWidget);
  });
}
