import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:workout_app/main.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/services/user_progress_service.dart';
import 'package:workout_app/services/default_workout_service.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/user_progress.dart';
import 'package:workout_app/screens/workout_templates_screen.dart';
import 'package:workout_app/screens/workout_template_form_screen.dart';
import 'package:workout_app/screens/workout_list_screen.dart';
import 'package:workout_app/screens/workout_detail_screen.dart';
import 'package:workout_app/screens/workout_execution_screen.dart';
import 'package:workout_app/screens/workout_history_screen.dart';

// Enhanced test service implementations with more realistic behavior
class TestWorkoutTemplateService implements WorkoutTemplateService {
  final List<WorkoutTemplate> _templates = [];
  int _idCounter = 1;

  @override
  Future<List<WorkoutTemplate>> getAllTemplates() async =>
      List.from(_templates);

  @override
  Future<WorkoutTemplate?> getTemplateById(String id) async {
    try {
      return _templates.firstWhere((t) => t.id == id);
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<WorkoutTemplate>> getTemplatesByFormat(
          WorkoutFormat format) async =>
      _templates.where((t) => t.format == format).toList();

  @override
  Future<List<WorkoutTemplate>> getTemplatesByIntensity(
          IntensityLevel intensity) async =>
      _templates.where((t) => t.intensity == intensity).toList();

  @override
  Future<List<WorkoutTemplate>> getTemplatesByEquipment(
          List<EquipmentType> equipment) async =>
      [];

  @override
  Future<List<WorkoutTemplate>> getTemplatesByCategory(
          List<MovementCategory> categories) async =>
      [];

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
  }) async {
    final template = WorkoutTemplate(
      id: 'template_${_idCounter++}',
      name: name,
      description: description,
      format: format,
      intensity: intensity,
      targetDuration: targetDuration,
      preferredCategories: preferredCategories,
      availableEquipment: availableEquipment,
      isMainMovementOnly: isMainMovementOnly,
      createdAt: DateTime.now(),
      metadata: metadata,
    );
    _templates.add(template);
    return template.id;
  }

  @override
  Future<void> updateTemplate(WorkoutTemplate template) async {
    final index = _templates.indexWhere((t) => t.id == template.id);
    if (index >= 0) {
      _templates[index] = template;
    }
  }

  @override
  Future<void> deleteTemplate(String id) async {
    _templates.removeWhere((t) => t.id == id);
  }

  @override
  Future<Workout> generateWorkoutFromTemplate(String templateId) async {
    final template = await getTemplateById(templateId);
    if (template == null) throw Exception('Template not found');

    return Workout(
      id: 'workout_${DateTime.now().millisecondsSinceEpoch}',
      name: '${template.name} Workout',
      description: 'Generated from ${template.name}',
      format: template.format,
      intensity: template.intensity,
      movements: [
        WorkoutMovement(
          movementId: 'movement_1',
          reps: 10,
        ),
        WorkoutMovement(
          movementId: 'movement_2',
          reps: 15,
        ),
      ],
      duration: template.targetDuration,
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

  // Add sample templates for testing
  void addSampleTemplates() {
    _templates.addAll([
      WorkoutTemplate(
        id: 'sample_1',
        name: 'Quick HIIT',
        description: 'High intensity interval training',
        format: WorkoutFormat.tabata,
        intensity: IntensityLevel.high,
        targetDuration: 15,
        createdAt: DateTime.now(),
      ),
      WorkoutTemplate(
        id: 'sample_2',
        name: 'Strength Builder',
        description: 'Build strength with compound movements',
        format: WorkoutFormat.forTime,
        intensity: IntensityLevel.medium,
        targetDuration: 30,
        createdAt: DateTime.now(),
      ),
    ]);
  }
}

class TestWorkoutService implements WorkoutService {
  final WorkoutTemplateService _templateService;
  final List<Workout> _workouts = [];
  final List<Workout> _completedWorkouts = [];

  TestWorkoutService(this._templateService);

  @override
  WorkoutTemplateService get templateService => _templateService;

  @override
  Future<List<Workout>> getAllWorkouts() async => List.from(_workouts);

  @override
  Future<Workout?> getWorkoutById(String id) async {
    try {
      return _workouts.firstWhere((w) => w.id == id);
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<Workout>> getWorkoutsByFormat(WorkoutFormat format) async =>
      _workouts.where((w) => w.format == format).toList();

  @override
  Future<List<Workout>> getWorkoutsByIntensity(
          IntensityLevel intensity) async =>
      _workouts.where((w) => w.intensity == intensity).toList();

  @override
  Future<String> createWorkoutFromTemplate(String templateId) async {
    final workout =
        await _templateService.generateWorkoutFromTemplate(templateId);
    return createWorkout(workout);
  }

  @override
  Future<String> createWorkoutFromTemplateWithModifications(
    String templateId, {
    WorkoutFormat? format,
    IntensityLevel? intensity,
    int? targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
  }) async {
    final workout =
        await _templateService.generateWorkoutFromTemplateWithModifications(
      templateId,
      format: format,
      intensity: intensity,
      targetDuration: targetDuration,
      preferredCategories: preferredCategories,
      availableEquipment: availableEquipment,
      isMainMovementOnly: isMainMovementOnly,
    );
    return createWorkout(workout);
  }

  @override
  Future<String> createWorkout(Workout workout) async {
    _workouts.add(workout);
    return workout.id;
  }

  @override
  Future<void> updateWorkout(Workout workout) async {
    final index = _workouts.indexWhere((w) => w.id == workout.id);
    if (index >= 0) {
      _workouts[index] = workout;
    }
  }

  @override
  Future<void> deleteWorkout(String id) async {
    _workouts.removeWhere((w) => w.id == id);
  }

  @override
  Future<void> markWorkoutAsCompleted(String id) async {
    final workout = await getWorkoutById(id);
    if (workout != null) {
      final completedWorkout = workout.copyWith(
        completedAt: DateTime.now(),
      );
      _completedWorkouts.add(completedWorkout);
      _workouts.removeWhere((w) => w.id == id);
    }
  }

  @override
  Future<List<Workout>> getCompletedWorkouts() async =>
      List.from(_completedWorkouts);
}

class TestUserProgressService implements UserProgressService {
  UserProgress? _userProgress = UserProgress(
    userId: 'test_user',
    workoutHistory: [],
    movementProgress: {},
    lastWorkoutDate: DateTime.now(),
    totalWorkoutsCompleted: 0,
    isFirstRun: false, // Set to false to skip onboarding
  );
  final List<WorkoutResult> _workoutHistory = [];

  @override
  Future<UserProgress?> getCurrentUserProgress() async => _userProgress;

  @override
  Future<void> initializeUserProgress() async {
    _userProgress = UserProgress(
      userId: 'test_user',
      workoutHistory: _workoutHistory,
      movementProgress: {},
      lastWorkoutDate: DateTime.now(),
      totalWorkoutsCompleted: 0,
    );
  }

  @override
  Future<void> recordWorkoutCompletion({
    required String workoutId,
    required int totalTimeInSeconds,
    int? totalRounds,
    int? totalReps,
    double? maxWeight,
    Map<String, dynamic>? performanceMetrics,
    String? notes,
  }) async {
    final result = WorkoutResult(
      workoutId: workoutId,
      completedAt: DateTime.now(),
      totalTimeInSeconds: totalTimeInSeconds,
      totalRounds: totalRounds,
      totalReps: totalReps,
      maxWeight: maxWeight,
      performanceMetrics: performanceMetrics,
      notes: notes,
    );
    _workoutHistory.add(result);

    if (_userProgress != null) {
      _userProgress = _userProgress!.copyWith(
        workoutHistory: _workoutHistory,
        totalWorkoutsCompleted: _userProgress!.totalWorkoutsCompleted + 1,
        lastWorkoutDate: DateTime.now(),
      );
    }
  }

  @override
  Future<void> updateMovementProgress({
    required String movementId,
    double? maxWeight,
    int? maxReps,
    int? maxTimeInSeconds,
    Map<String, dynamic>? personalRecords,
  }) async {}

  @override
  Future<List<WorkoutResult>> getWorkoutHistory({int? limit}) async {
    final history = List<WorkoutResult>.from(_workoutHistory);
    if (limit != null && history.length > limit) {
      return history.sublist(0, limit);
    }
    return history;
  }

  @override
  Future<MovementProgress?> getMovementProgress(String movementId) async =>
      null;

  @override
  Future<Map<String, dynamic>> getWorkoutStatistics() async => {
        'totalWorkouts': _workoutHistory.length,
        'totalTimeInSeconds': 3600,
        'averageWorkoutTimeInSeconds': 1200,
      };

  @override
  Future<Map<String, MovementProgress>> getAllMovementProgress() async => {};

  @override
  bool isNewPersonalRecord({
    required String movementId,
    required MovementProgress? existingProgress,
    double? newWeight,
    int? newReps,
    int? newTimeInSeconds,
  }) =>
      false;

  @override
  Future<void> setUserGoals(Map<String, dynamic> goals) async {}

  @override
  Future<void> addAchievement(
      String achievementKey, Map<String, dynamic> achievementData) async {}

  @override
  Future<void> updateUserProgress(UserProgress updatedProgress) async {
    _userProgress = updatedProgress;
  }

  @override
  Future<void> clearUserProgress() async {
    _userProgress = null;
    _workoutHistory.clear();
  }
}

// Test implementation of DefaultWorkoutService
class TestDefaultWorkoutService extends DefaultWorkoutService {
  TestDefaultWorkoutService()
      : super(templateService: TestWorkoutTemplateService());

  @override
  List<Map<String, dynamic>> getDefaultWorkoutConfigurations() => [];

  @override
  Map<String, List<Map<String, dynamic>>> getDefaultWorkoutsByCategory() => {};

  @override
  Future<List<String>> addSelectedDefaultWorkouts(
          List<String> selectedWorkoutNames) async =>
      [];

  @override
  Future<List<String>> addAllDefaultWorkouts() async => [];

  @override
  List<Map<String, dynamic>> getRecommendedWorkouts(String preference) => [];
}

void main() {
  group('Workout App Integration Tests', () {
    late TestWorkoutTemplateService testTemplateService;
    late TestWorkoutService testWorkoutService;
    late TestUserProgressService testUserProgressService;
    late TestDefaultWorkoutService testDefaultWorkoutService;

    setUp(() {
      testTemplateService = TestWorkoutTemplateService();
      testWorkoutService = TestWorkoutService(testTemplateService);
      testUserProgressService = TestUserProgressService();
      testDefaultWorkoutService = TestDefaultWorkoutService();

      // Add sample data for testing
      testTemplateService.addSampleTemplates();
    });

    group('Navigation Flow Tests', () {
      testWidgets('Bottom navigation works correctly',
          (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Verify we start on workouts tab
        expect(find.text('Workouts'), findsAtLeast(1));
        expect(find.byType(WorkoutListScreen), findsOneWidget);

        // Navigate to templates tab
        await tester.tap(find.text('Templates'));
        await tester.pumpAndSettle();
        expect(find.byType(WorkoutTemplatesScreen), findsOneWidget);

        // Navigate to history tab
        await tester.tap(find.text('History'));
        await tester.pumpAndSettle();
        expect(find.byType(WorkoutHistoryScreen), findsOneWidget);

        // Navigate back to workouts
        await tester.tap(find.text('Workouts').first);
        await tester.pumpAndSettle();
        expect(find.byType(WorkoutListScreen), findsOneWidget);
      });
    });

    group('Template Management Flow', () {
      testWidgets('Create new workout template flow',
          (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Navigate to templates tab
        await tester.tap(find.text('Templates'));
        await tester.pumpAndSettle();

        // Verify templates are shown
        expect(find.text('Quick HIIT'), findsOneWidget);
        expect(find.text('Strength Builder'), findsOneWidget);

        // Tap add button to create new template
        await tester.tap(find.byIcon(Icons.add));
        await tester.pumpAndSettle();

        // Verify template form is shown
        expect(find.byType(WorkoutTemplateFormScreen), findsOneWidget);
        expect(find.text('Create Template'), findsOneWidget);

        // Fill in template details
        await tester.enterText(
            find.byType(TextFormField).first, 'Test Template');
        await tester.enterText(
            find.byType(TextFormField).at(1), 'Test description');

        // Select format and intensity (they should have default values)
        expect(find.byType(DropdownButtonFormField<WorkoutFormat>),
            findsOneWidget);
        expect(find.byType(DropdownButtonFormField<IntensityLevel>),
            findsOneWidget);

        // Save template (it's an IconButton with save icon, not text)
        await tester.tap(find.byIcon(Icons.save));
        await tester.pumpAndSettle();

        // Verify we're back to templates list and new template is shown
        expect(find.byType(WorkoutTemplatesScreen), findsOneWidget);
        expect(find.text('Test Template'), findsOneWidget);
      });

      testWidgets('Delete template flow', (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Navigate to templates tab
        await tester.tap(find.text('Templates'));
        await tester.pumpAndSettle();

        // Find and tap delete button for first template
        final deleteButtons = find.byIcon(Icons.delete);
        expect(deleteButtons, findsAtLeast(1));

        await tester.tap(deleteButtons.first);
        await tester.pumpAndSettle();

        // Verify confirmation dialog
        expect(find.text('Delete Template'), findsOneWidget);
        expect(find.textContaining('Are you sure you want to delete'),
            findsOneWidget);

        // Confirm deletion
        await tester.tap(find.text('Delete'));
        await tester.pumpAndSettle();

        // Verify template is removed
        expect(find.text('Quick HIIT'), findsNothing);
      });
    });

    group('Workout Generation Flow', () {
      testWidgets('Generate workout from template',
          (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Navigate to templates tab
        await tester.tap(find.text('Templates'));
        await tester.pumpAndSettle();

        // Tap on a template to view details
        await tester.tap(find.text('Quick HIIT'));
        await tester.pumpAndSettle();

        // Verify template detail screen is shown
        expect(find.text('Quick HIIT'), findsOneWidget);
        expect(find.text('Generate Workout'), findsOneWidget);

        // Generate workout
        await tester.tap(find.text('Generate Workout'));
        await tester.pumpAndSettle();

        // Verify success message is shown (the generate workflow navigates back to main screen)
        expect(find.byType(SnackBar), findsOneWidget);
        expect(
            find.textContaining('Workout generated and saved'), findsOneWidget);

        // Navigate to workouts tab to verify workout was created
        await tester.tap(find.text('Workouts').first);
        await tester.pumpAndSettle();

        // Verify new workout appears in list
        expect(find.text('Quick HIIT Workout'), findsOneWidget);
      });

      testWidgets('No workouts state shows generate button',
          (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Verify empty state
        expect(find.text('No workouts yet'), findsOneWidget);
        expect(find.text('Generate Workout'), findsOneWidget);

        // Tap generate workout button
        await tester.tap(find.text('Generate Workout'));
        await tester.pumpAndSettle();

        // Verify we navigate to templates screen
        expect(find.byType(WorkoutTemplatesScreen), findsOneWidget);
      });
    });

    group('Workout Details and Execution Flow', () {
      testWidgets('View workout details and start execution',
          (WidgetTester tester) async {
        // First generate a workout
        final workout =
            await testTemplateService.generateWorkoutFromTemplate('sample_1');
        await testWorkoutService.createWorkout(workout);

        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Find and tap on workout card
        await tester.tap(find.text('Quick HIIT Workout'));
        await tester.pumpAndSettle();

        // Verify workout detail screen
        expect(find.byType(WorkoutDetailScreen), findsOneWidget);
        expect(find.text('Start Workout'), findsOneWidget);

        // Start workout
        await tester.tap(find.text('Start Workout'));
        await tester.pumpAndSettle();

        // Verify workout execution screen
        expect(find.byType(WorkoutExecutionScreen), findsOneWidget);
        expect(find.text('00:00'), findsOneWidget); // Timer display
      });
    });

    group('Workout History Flow', () {
      testWidgets('View workout history', (WidgetTester tester) async {
        // Create and complete a workout to have history data
        final workout =
            await testTemplateService.generateWorkoutFromTemplate('sample_1');
        final workoutId = await testWorkoutService.createWorkout(workout);
        await testWorkoutService.markWorkoutAsCompleted(workoutId);

        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Navigate to history tab
        await tester.tap(find.text('History'));
        await tester.pumpAndSettle();

        // Verify history screen loads
        expect(find.byType(WorkoutHistoryScreen), findsOneWidget);

        // Verify completed workout appears in history
        expect(find.text('Quick HIIT Workout'), findsOneWidget);
      });
    });

    group('Error Handling Tests', () {
      testWidgets('Handles empty templates gracefully',
          (WidgetTester tester) async {
        // Create service with no templates
        final emptyTemplateService = TestWorkoutTemplateService();
        final emptyWorkoutService = TestWorkoutService(emptyTemplateService);

        await tester.pumpWidget(WorkoutApp(
          workoutService: emptyWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Navigate to templates tab
        await tester.tap(find.text('Templates'));
        await tester.pumpAndSettle();

        // Verify empty state
        expect(find.text('No templates yet'), findsOneWidget);
        expect(find.text('Create Template'), findsOneWidget);
      });

      testWidgets('Form validation works correctly',
          (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Navigate to templates and create new template
        await tester.tap(find.text('Templates'));
        await tester.pumpAndSettle();
        await tester.tap(find.byIcon(Icons.add));
        await tester.pumpAndSettle();

        // Try to save without filling required fields (it's an IconButton with save icon)
        await tester.tap(find.byIcon(Icons.save));
        await tester.pumpAndSettle();

        // Verify validation errors
        expect(find.text('Please enter a name'), findsOneWidget);
        expect(find.text('Please enter a description'), findsOneWidget);
      });
    });

    group('Filter and Search Tests', () {
      testWidgets('Workout filtering works', (WidgetTester tester) async {
        // Generate multiple workouts with different formats
        final tabataWorkout =
            await testTemplateService.generateWorkoutFromTemplate('sample_1');
        final forTimeWorkout =
            await testTemplateService.generateWorkoutFromTemplate('sample_2');

        await testWorkoutService.createWorkout(tabataWorkout);
        await testWorkoutService.createWorkout(forTimeWorkout);

        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));
        await tester.pumpAndSettle();

        // Verify both workouts are shown
        expect(find.text('Quick HIIT Workout'), findsOneWidget);
        expect(find.text('Strength Builder Workout'), findsOneWidget);

        // Open filter dialog
        await tester.tap(find.byIcon(Icons.filter_list));
        await tester.pumpAndSettle();

        // Verify filter dialog appears
        expect(find.text('Filter Workouts'), findsOneWidget);
      });
    });

    group('Loading States Tests', () {
      testWidgets('Shows loading states correctly',
          (WidgetTester tester) async {
        await tester.pumpWidget(WorkoutApp(
          workoutService: testWorkoutService,
          userProgressService: testUserProgressService,
          defaultWorkoutService: testDefaultWorkoutService,
        ));

        // Initially should show loading state briefly
        expect(find.byType(CircularProgressIndicator), findsOneWidget);

        await tester.pumpAndSettle();

        // After loading completes, should show content
        expect(find.byType(CircularProgressIndicator), findsNothing);
        expect(find.text('No workouts yet'), findsOneWidget);
      });
    });
  });
}
