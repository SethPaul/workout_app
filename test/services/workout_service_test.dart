import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/workout_repository.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/data/database/database_helper.dart';

@GenerateMocks([WorkoutRepository, WorkoutTemplateService, DatabaseHelper])
import 'workout_service_test.mocks.dart';

void main() {
  late WorkoutService service;
  late MockWorkoutRepository mockRepository;
  late MockWorkoutTemplateService mockTemplateService;
  late MockDatabaseHelper mockDatabaseHelper;

  setUp(() {
    mockRepository = MockWorkoutRepository();
    mockTemplateService = MockWorkoutTemplateService();
    mockDatabaseHelper = MockDatabaseHelper();
    service = WorkoutService(
      repository: mockRepository,
      templateService: mockTemplateService,
      databaseHelper: mockDatabaseHelper,
    );
  });

  group('WorkoutService', () {
    final testWorkout = Workout(
      id: '1',
      name: 'Test Workout',
      description: 'A test workout',
      format: WorkoutFormat.emom,
      intensity: IntensityLevel.medium,
      movements: [],
      duration: 20,
      createdAt: DateTime.now(),
    );

    test('getAllWorkouts returns all workouts', () async {
      when(
        mockRepository.getAllWorkouts(),
      ).thenAnswer((_) async => [testWorkout]);

      final workouts = await service.getAllWorkouts();
      expect(workouts, [testWorkout]);
      verify(mockRepository.getAllWorkouts()).called(1);
    });

    test('getWorkoutById returns workout when found', () async {
      when(
        mockRepository.getWorkoutById('1'),
      ).thenAnswer((_) async => testWorkout);

      final workout = await service.getWorkoutById('1');
      expect(workout, testWorkout);
      verify(mockRepository.getWorkoutById('1')).called(1);
    });

    test('getWorkoutById returns null when not found', () async {
      when(mockRepository.getWorkoutById('2')).thenAnswer((_) async => null);

      final workout = await service.getWorkoutById('2');
      expect(workout, null);
      verify(mockRepository.getWorkoutById('2')).called(1);
    });

    test('getWorkoutsByFormat returns filtered workouts', () async {
      when(
        mockRepository.getWorkoutsByFormat(WorkoutFormat.emom),
      ).thenAnswer((_) async => [testWorkout]);

      final workouts = await service.getWorkoutsByFormat(WorkoutFormat.emom);
      expect(workouts, [testWorkout]);
      verify(mockRepository.getWorkoutsByFormat(WorkoutFormat.emom)).called(1);
    });

    test('getWorkoutsByIntensity returns filtered workouts', () async {
      when(
        mockRepository.getWorkoutsByIntensity(IntensityLevel.medium),
      ).thenAnswer((_) async => [testWorkout]);

      final workouts = await service.getWorkoutsByIntensity(
        IntensityLevel.medium,
      );
      expect(workouts, [testWorkout]);
      verify(
        mockRepository.getWorkoutsByIntensity(IntensityLevel.medium),
      ).called(1);
    });

    test('createWorkoutFromTemplate creates and returns workout id', () async {
      when(
        mockTemplateService.generateWorkoutFromTemplate('1'),
      ).thenAnswer((_) async => testWorkout);
      when(
        mockRepository.createWorkout(testWorkout),
      ).thenAnswer((_) async => '1');

      final id = await service.createWorkoutFromTemplate('1');
      expect(id, '1');
      verify(mockTemplateService.generateWorkoutFromTemplate('1')).called(1);
      verify(mockRepository.createWorkout(testWorkout)).called(1);
    });

    test(
      'createWorkoutFromTemplateWithModifications creates workout with modifications',
      () async {
        when(
          mockTemplateService.generateWorkoutFromTemplateWithModifications(
            '1',
            format: WorkoutFormat.amrap,
            intensity: IntensityLevel.high,
            targetDuration: 30,
          ),
        ).thenAnswer((_) async => testWorkout);
        when(
          mockRepository.createWorkout(testWorkout),
        ).thenAnswer((_) async => '1');

        final id = await service.createWorkoutFromTemplateWithModifications(
          '1',
          format: WorkoutFormat.amrap,
          intensity: IntensityLevel.high,
          targetDuration: 30,
        );
        expect(id, '1');
        verify(
          mockTemplateService.generateWorkoutFromTemplateWithModifications(
            '1',
            format: WorkoutFormat.amrap,
            intensity: IntensityLevel.high,
            targetDuration: 30,
          ),
        ).called(1);
        verify(mockRepository.createWorkout(testWorkout)).called(1);
      },
    );

    test('updateWorkout updates workout', () async {
      await service.updateWorkout(testWorkout);
      verify(mockRepository.updateWorkout(testWorkout)).called(1);
    });

    test('deleteWorkout deletes workout', () async {
      await service.deleteWorkout('1');
      verify(mockRepository.deleteWorkout('1')).called(1);
    });

    test('markWorkoutAsCompleted marks workout as completed', () async {
      await service.markWorkoutAsCompleted('1');
      verify(mockRepository.markWorkoutAsCompleted('1')).called(1);
    });
  });
}
