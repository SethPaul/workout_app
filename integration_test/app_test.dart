import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mockito/mockito.dart';

import 'package:workout_app/main.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/data/models/workout.dart';

// Mock class for WorkoutService
class MockWorkoutService extends Mock implements WorkoutService {
  @override
  Future<List<Workout>> getWorkouts() async {
    return [];
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Workout App Integration Tests', () {
    late MockWorkoutService mockWorkoutService;

    setUp(() {
      mockWorkoutService = MockWorkoutService();
    });

    testWidgets('App launches and shows home screen',
        (WidgetTester tester) async {
      // Launch the app with mock service
      await tester.pumpWidget(WorkoutApp(workoutService: mockWorkoutService));
      await tester.pumpAndSettle();

      // Test: App starts and shows home screen
      expect(find.text('Workout App'), findsAtLeastNWidgets(1));
      expect(find.text('Start Workout'), findsOneWidget);
      expect(find.text('Workout History'), findsOneWidget);
    });

    testWidgets('Navigate to workout list', (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(workoutService: mockWorkoutService));
      await tester.pumpAndSettle();

      // Test: Navigate to workout list
      final startWorkoutButton = find.text('Start Workout');
      await tester.tap(startWorkoutButton);
      await tester.pumpAndSettle();

      // Should navigate to workout list screen
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);

      // Test back navigation
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // Should be back on home screen
      expect(find.text('Start Workout'), findsOneWidget);
    });

    testWidgets('Navigate to workout history', (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(workoutService: mockWorkoutService));
      await tester.pumpAndSettle();

      // Test: Navigate to workout history
      final historyButton = find.text('Workout History');
      await tester.tap(historyButton);
      await tester.pumpAndSettle();

      // Should navigate to history screen
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);

      // Test back navigation
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // Should be back on home screen
      expect(find.text('Workout History'), findsOneWidget);
    });

    testWidgets('App handles initialization gracefully',
        (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(workoutService: mockWorkoutService));
      await tester.pumpAndSettle();

      // App should start without crashing
      expect(find.byType(Scaffold), findsAtLeastNWidgets(1));

      // Should show main navigation elements
      expect(find.text('Start Workout'), findsOneWidget);
      expect(find.text('Workout History'), findsOneWidget);
    });

    testWidgets('UI elements are responsive', (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(workoutService: mockWorkoutService));
      await tester.pumpAndSettle();

      // Test button interactions
      final startButton = find.text('Start Workout');
      final historyButton = find.text('Workout History');

      // Buttons should be tappable
      expect(startButton, findsOneWidget);
      expect(historyButton, findsOneWidget);

      // Test multiple taps don't break the app
      await tester.tap(startButton);
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      await tester.tap(historyButton);
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // Should still be on home screen
      expect(find.text('Start Workout'), findsOneWidget);
    });

    testWidgets('Home screen displays correct layout',
        (WidgetTester tester) async {
      await tester.pumpWidget(WorkoutApp(workoutService: mockWorkoutService));
      await tester.pumpAndSettle();

      // Check that the app bar is present
      expect(find.byType(AppBar), findsOneWidget);

      // Check that buttons are properly styled
      expect(find.byType(ElevatedButton), findsNWidgets(2));

      // Check that the layout is centered
      expect(find.byType(Center), findsAtLeastNWidgets(1));
      expect(find.byType(Column), findsAtLeastNWidgets(1));
    });
  });
}
