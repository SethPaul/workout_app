@GenerateNiceMocks([MockSpec<MovementBloc>()])
import 'movement_filter_test.mocks.dart';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/presentation/blocs/movement/movement_bloc.dart';
import 'package:workout_app/presentation/blocs/movement/movement_event.dart';
import 'package:workout_app/presentation/blocs/movement/movement_state.dart';
import 'package:workout_app/presentation/widgets/movement_filter.dart';

void main() {
  group('MovementFilter Widget Tests', () {
    late MockMovementBloc mockMovementBloc;

    setUp(() {
      mockMovementBloc = MockMovementBloc();
      when(mockMovementBloc.state).thenReturn(
        const MovementLoaded(
          movements: [],
          filterQuery: '',
        ),
      );
      when(mockMovementBloc.stream).thenAnswer((_) => const Stream.empty());
    });

    testWidgets('renders all filter sections', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: BlocProvider<MovementBloc>.value(
            value: mockMovementBloc,
            child: const Scaffold(
              body: MovementFilter(),
            ),
          ),
        ),
      );

      // Verify filter sections are displayed
      expect(find.text('Filter Movements'), findsOneWidget);
      expect(find.text('Categories'), findsOneWidget);
      expect(find.text('Equipment'), findsOneWidget);
      expect(find.text('Movement Type'), findsOneWidget);
    });

    testWidgets('selects and deselects category chips',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: BlocProvider<MovementBloc>.value(
            value: mockMovementBloc,
            child: const Scaffold(
              body: MovementFilter(),
            ),
          ),
        ),
      );

      // Find and tap a category chip
      final categoryText = find.text('compoundLift');
      final categoryChip = find.ancestor(
        of: categoryText,
        matching: find.byType(FilterChip),
      );
      await tester.tap(categoryChip);
      await tester.pump();

      // Verify chip is selected
      expect(
        tester.widget<FilterChip>(categoryChip).selected,
        true,
      );

      // Tap again to deselect
      await tester.tap(categoryChip);
      await tester.pump();

      // Verify chip is deselected
      expect(
        tester.widget<FilterChip>(categoryChip).selected,
        false,
      );
    });

    testWidgets('selects and deselects equipment chips',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: BlocProvider<MovementBloc>.value(
            value: mockMovementBloc,
            child: const Scaffold(
              body: MovementFilter(),
            ),
          ),
        ),
      );

      // Find and tap an equipment chip
      final equipmentText = find.text('barbell');
      final equipmentChip = find.ancestor(
        of: equipmentText,
        matching: find.byType(FilterChip),
      );
      await tester.tap(equipmentChip);
      await tester.pump();

      // Verify chip is selected
      expect(
        tester.widget<FilterChip>(equipmentChip).selected,
        true,
      );

      // Tap again to deselect
      await tester.tap(equipmentChip);
      await tester.pump();

      // Verify chip is deselected
      expect(
        tester.widget<FilterChip>(equipmentChip).selected,
        false,
      );
    });

    testWidgets('clears all filters when Clear All is pressed',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: BlocProvider<MovementBloc>.value(
            value: mockMovementBloc,
            child: const Scaffold(
              body: MovementFilter(),
            ),
          ),
        ),
      );

      // Select some filters
      final categoryText = find.text('compoundLift');
      final categoryChip = find.ancestor(
        of: categoryText,
        matching: find.byType(FilterChip),
      );
      final equipmentText = find.text('barbell');
      final equipmentChip = find.ancestor(
        of: equipmentText,
        matching: find.byType(FilterChip),
      );
      final mainMovementText = find.text('Main Movements');
      final mainMovementChip = find.ancestor(
        of: mainMovementText,
        matching: find.byType(FilterChip),
      );
      await tester.tap(categoryChip);
      await tester.tap(equipmentChip);
      await tester.tap(mainMovementChip);
      await tester.pump();

      // Press Clear All
      await tester.tap(find.text('Clear All'));
      await tester.pump();

      // Verify all chips are deselected
      expect(
        tester.widget<FilterChip>(categoryChip).selected,
        false,
      );
      expect(
        tester.widget<FilterChip>(equipmentChip).selected,
        false,
      );
      expect(
        tester.widget<FilterChip>(mainMovementChip).selected,
        false,
      );
    });

    testWidgets('applies filters when Apply is pressed',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: BlocProvider<MovementBloc>.value(
            value: mockMovementBloc,
            child: const Scaffold(
              body: MovementFilter(),
            ),
          ),
        ),
      );

      // Select some filters
      final categoryText = find.text('compoundLift');
      final categoryChip = find.ancestor(
        of: categoryText,
        matching: find.byType(FilterChip),
      );
      final equipmentText = find.text('barbell');
      final equipmentChip = find.ancestor(
        of: equipmentText,
        matching: find.byType(FilterChip),
      );
      final mainMovementText = find.text('Main Movements');
      final mainMovementChip = find.ancestor(
        of: mainMovementText,
        matching: find.byType(FilterChip),
      );
      await tester.tap(categoryChip);
      await tester.tap(equipmentChip);
      await tester.tap(mainMovementChip);
      await tester.pump();

      // Press Apply
      await tester.tap(find.text('Apply'));
      await tester.pump();

      // Verify FilterMovements event was added
      verify(
        mockMovementBloc.add(
          FilterMovements(
            query: '',
            categories: [MovementCategory.compoundLift],
            equipmentTypes: [EquipmentType.barbell],
            isMainMovement: true,
          ),
        ),
      ).called(1);
    });
  });
}
