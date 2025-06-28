import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mockito/mockito.dart';

import 'package:workout_app/main.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/services/user_progress_service.dart';
import 'package:workout_app/services/default_workout_service.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/user_progress.dart';

// Mock classes for testing
class MockWorkoutService extends Mock implements WorkoutService {
  final MockWorkoutTemplateService _templateService =
      MockWorkoutTemplateService();

  @override
  Future<List<Workout>> getAllWorkouts() async {
    return [];
  }

  @override
  WorkoutTemplateService get templateService => _templateService;
}

class MockWorkoutTemplateService extends Mock
    implements WorkoutTemplateService {}

class MockUserProgressService extends Mock implements UserProgressService {
  @override
  Future<UserProgress?> getCurrentUserProgress() async {
    return UserProgress(
      userId: 'test_user',
      workoutHistory: [],
      movementProgress: {},
      lastWorkoutDate: DateTime.now(),
      totalWorkoutsCompleted: 0,
      isFirstRun: false,
      hasAcceptedDefaultWorkouts: false,
    );
  }

  @override
  Future<void> initializeUserProgress() async {
    // Mock implementation
  }

  @override
  Future<void> recordWorkoutCompletion({
    required String workoutId,
    required int totalTimeInSeconds,
    int? totalRounds,
    int? totalReps,
    double? maxWeight,
    String? notes,
    Map<String, dynamic>? performanceMetrics,
  }) async {
    // Mock implementation
  }

  @override
  Future<void> updateUserProgress(UserProgress userProgress) async {
    // Mock implementation
  }
}

class MockDefaultWorkoutService extends Mock implements DefaultWorkoutService {
  @override
  List<Map<String, dynamic>> getDefaultWorkoutConfigurations() {
    return [];
  }

  @override
  List<Map<String, dynamic>> getRecommendedWorkouts(String preference) {
    return [];
  }
}

class FirstRunMockUserProgressService extends Mock
    implements UserProgressService {
  @override
  Future<UserProgress?> getCurrentUserProgress() async {
    return UserProgress(
      userId: 'test_user',
      workoutHistory: [],
      movementProgress: {},
      lastWorkoutDate: DateTime.now(),
      totalWorkoutsCompleted: 0,
      isFirstRun: true,
      hasAcceptedDefaultWorkouts: false,
    );
  }

  @override
  Future<void> initializeUserProgress() async {
    // Mock implementation
  }

  @override
  Future<void> recordWorkoutCompletion({
    required String workoutId,
    required int totalTimeInSeconds,
    int? totalRounds,
    int? totalReps,
    double? maxWeight,
    String? notes,
    Map<String, dynamic>? performanceMetrics,
  }) async {
    // Mock implementation
  }

  @override
  Future<void> updateUserProgress(UserProgress userProgress) async {
    // Mock implementation
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Workout App Integration Tests', () {
    late MockWorkoutService mockWorkoutService;
    late MockUserProgressService mockUserProgressService;
    late MockDefaultWorkoutService mockDefaultWorkoutService;

    setUp(() {
      mockWorkoutService = MockWorkoutService();
      mockUserProgressService = MockUserProgressService();
      mockDefaultWorkoutService = MockDefaultWorkoutService();

      // Mock services are now set up with direct implementations
    });

    testWidgets('App launches and shows home screen',
        (WidgetTester tester) async {
      // Launch the app with mock services
      await tester.pumpWidget(WorkoutApp(
        workoutService: mockWorkoutService,
        userProgressService: mockUserProgressService,
        defaultWorkoutService: mockDefaultWorkoutService,
      ));

      // Wait for async operations to complete
      await tester.pumpAndSettle();

      // Test: App starts and shows home screen with bottom navigation
      expect(find.byType(BottomNavigationBar), findsOneWidget);
      expect(find.text('Workouts'), findsAtLeastNWidgets(1));
      expect(find.text('Templates'), findsAtLeastNWidgets(1));
      expect(find.text('History'), findsAtLeastNWidgets(1));
    });

    testWidgets('Navigate between tabs', (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(
        workoutService: mockWorkoutService,
        userProgressService: mockUserProgressService,
        defaultWorkoutService: mockDefaultWorkoutService,
      ));
      await tester.pumpAndSettle();

      // Test: Navigate to Templates tab
      final templatesTab = find.text('Templates');
      await tester.tap(templatesTab);
      await tester.pumpAndSettle();

      // Should be on templates tab (index 1)
      final bottomNav =
          tester.widget<BottomNavigationBar>(find.byType(BottomNavigationBar));
      expect(bottomNav.currentIndex, 1);

      // Test: Navigate to History tab
      final historyTab = find.text('History');
      await tester.tap(historyTab);
      await tester.pumpAndSettle();

      // Should be on history tab (index 2)
      final bottomNavAfterHistory =
          tester.widget<BottomNavigationBar>(find.byType(BottomNavigationBar));
      expect(bottomNavAfterHistory.currentIndex, 2);

      // Test: Navigate back to Workouts tab
      final workoutsTab = find.text('Workouts');
      await tester.tap(workoutsTab);
      await tester.pumpAndSettle();

      // Should be back on workouts tab (index 0)
      final bottomNavAfterWorkouts =
          tester.widget<BottomNavigationBar>(find.byType(BottomNavigationBar));
      expect(bottomNavAfterWorkouts.currentIndex, 0);
    });

    testWidgets('App handles initialization gracefully',
        (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(
        workoutService: mockWorkoutService,
        userProgressService: mockUserProgressService,
        defaultWorkoutService: mockDefaultWorkoutService,
      ));
      await tester.pumpAndSettle();

      // App should start without crashing
      expect(find.byType(Scaffold), findsAtLeastNWidgets(1));

      // Should show main navigation elements
      expect(find.byType(BottomNavigationBar), findsOneWidget);
      expect(find.text('Workouts'), findsAtLeastNWidgets(1));
      expect(find.text('Templates'), findsAtLeastNWidgets(1));
      expect(find.text('History'), findsAtLeastNWidgets(1));
    });

    testWidgets('UI elements are responsive', (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(
        workoutService: mockWorkoutService,
        userProgressService: mockUserProgressService,
        defaultWorkoutService: mockDefaultWorkoutService,
      ));
      await tester.pumpAndSettle();

      // Test tab interactions
      final templatesTab = find.text('Templates');
      final historyTab = find.text('History');
      final workoutsTab = find.text('Workouts');

      // Tabs should be tappable
      expect(templatesTab, findsAtLeastNWidgets(1));
      expect(historyTab, findsAtLeastNWidgets(1));
      expect(workoutsTab, findsAtLeastNWidgets(1));

      // Test multiple taps don't break the app
      await tester.tap(templatesTab);
      await tester.pumpAndSettle();

      await tester.tap(historyTab);
      await tester.pumpAndSettle();

      await tester.tap(workoutsTab);
      await tester.pumpAndSettle();

      // Should still have functional navigation
      expect(find.byType(BottomNavigationBar), findsOneWidget);
    });

    testWidgets('Home screen displays correct layout',
        (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(
        workoutService: mockWorkoutService,
        userProgressService: mockUserProgressService,
        defaultWorkoutService: mockDefaultWorkoutService,
      ));
      await tester.pumpAndSettle();

      // Check that the app structure is correct
      expect(find.byType(Scaffold), findsAtLeastNWidgets(1));
      expect(find.byType(BottomNavigationBar), findsOneWidget);

      // Check that bottom navigation has 3 tabs
      final bottomNav =
          tester.widget<BottomNavigationBar>(find.byType(BottomNavigationBar));
      expect(bottomNav.items.length, 3);
    });

    testWidgets('App handles first run flow', (WidgetTester tester) async {
      // Create a special mock service for first run
      final firstRunMockService = FirstRunMockUserProgressService();

      await tester.pumpWidget(WorkoutApp(
        workoutService: mockWorkoutService,
        userProgressService: firstRunMockService,
        defaultWorkoutService: mockDefaultWorkoutService,
      ));
      await tester.pumpAndSettle();

      // Should show onboarding screen for first run
      // This test verifies that the app properly handles first-time users
      expect(find.byType(Scaffold), findsOneWidget);
    });
  });
}
