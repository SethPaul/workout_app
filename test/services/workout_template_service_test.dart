import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/workout_template_repository.dart';
import 'package:workout_app/services/workout_generator.dart';
import 'package:workout_app/services/workout_template_service.dart';

@GenerateMocks([WorkoutTemplateRepository, WorkoutGenerator])
import 'workout_template_service_test.mocks.dart';

void main() {
  late WorkoutTemplateService service;
  late MockWorkoutTemplateRepository mockRepository;
  late MockWorkoutGenerator mockGenerator;

  setUp(() {
    mockRepository = MockWorkoutTemplateRepository();
    mockGenerator = MockWorkoutGenerator();
    service = WorkoutTemplateService(
      repository: mockRepository,
      workoutGenerator: mockGenerator,
    );
  });

  group('WorkoutTemplateService', () {
    final testTemplate = WorkoutTemplate(
      id: '1',
      name: 'Test Template',
      description: 'A test template',
      format: WorkoutFormat.emom,
      intensity: IntensityLevel.medium,
      targetDuration: 20,
      createdAt: DateTime.now(),
    );

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

    test('getAllTemplates returns all templates', () async {
      when(
        mockRepository.getAllTemplates(),
      ).thenAnswer((_) async => [testTemplate]);

      final templates = await service.getAllTemplates();
      expect(templates, [testTemplate]);
      verify(mockRepository.getAllTemplates()).called(1);
    });

    test('getTemplateById returns template when found', () async {
      when(
        mockRepository.getTemplateById('1'),
      ).thenAnswer((_) async => testTemplate);

      final template = await service.getTemplateById('1');
      expect(template, testTemplate);
      verify(mockRepository.getTemplateById('1')).called(1);
    });

    test('getTemplateById returns null when not found', () async {
      when(mockRepository.getTemplateById('2')).thenAnswer((_) async => null);

      final template = await service.getTemplateById('2');
      expect(template, null);
      verify(mockRepository.getTemplateById('2')).called(1);
    });

    test('createTemplate creates and returns template id', () async {
      when(mockRepository.createTemplate(any)).thenAnswer((_) async => '1');

      final id = await service.createTemplate(
        name: 'Test Template',
        description: 'A test template',
        format: WorkoutFormat.emom,
        intensity: IntensityLevel.medium,
        targetDuration: 20,
      );

      expect(id, '1');
      verify(mockRepository.createTemplate(any)).called(1);
    });

    test(
      'generateWorkoutFromTemplate generates workout and increments usage',
      () async {
        when(
          mockRepository.getTemplateById('1'),
        ).thenAnswer((_) async => testTemplate);
        when(
          mockGenerator.generateWorkout(
            format: anyNamed('format'),
            intensity: anyNamed('intensity'),
            targetDuration: anyNamed('targetDuration'),
            preferredCategories: anyNamed('preferredCategories'),
            availableEquipment: anyNamed('availableEquipment'),
            isMainMovementOnly: anyNamed('isMainMovementOnly'),
          ),
        ).thenAnswer((_) => testWorkout);

        final workout = await service.generateWorkoutFromTemplate('1');

        expect(workout, testWorkout);
        verify(mockRepository.getTemplateById('1')).called(1);
        verify(
          mockGenerator.generateWorkout(
            format: testTemplate.format,
            intensity: testTemplate.intensity,
            targetDuration: testTemplate.targetDuration,
            preferredCategories: testTemplate.preferredCategories,
            availableEquipment: testTemplate.availableEquipment,
            isMainMovementOnly: testTemplate.isMainMovementOnly,
          ),
        ).called(1);
        verify(mockRepository.incrementUsage('1')).called(1);
      },
    );

    test(
      'generateWorkoutFromTemplate throws when template not found',
      () async {
        when(mockRepository.getTemplateById('2')).thenAnswer((_) async => null);

        expect(() => service.generateWorkoutFromTemplate('2'), throwsException);
        verify(mockRepository.getTemplateById('2')).called(1);
        verifyNever(
          mockGenerator.generateWorkout(
            format: anyNamed('format'),
            intensity: anyNamed('intensity'),
            targetDuration: anyNamed('targetDuration'),
            preferredCategories: anyNamed('preferredCategories'),
            availableEquipment: anyNamed('availableEquipment'),
            isMainMovementOnly: anyNamed('isMainMovementOnly'),
          ),
        );
        verifyNever(mockRepository.incrementUsage('2'));
      },
    );

    test(
      'generateWorkoutFromTemplateWithModifications uses modified parameters',
      () async {
        when(
          mockRepository.getTemplateById('1'),
        ).thenAnswer((_) async => testTemplate);
        when(
          mockGenerator.generateWorkout(
            format: anyNamed('format'),
            intensity: anyNamed('intensity'),
            targetDuration: anyNamed('targetDuration'),
            preferredCategories: anyNamed('preferredCategories'),
            availableEquipment: anyNamed('availableEquipment'),
            isMainMovementOnly: anyNamed('isMainMovementOnly'),
          ),
        ).thenAnswer((_) => testWorkout);

        final workout = await service
            .generateWorkoutFromTemplateWithModifications(
              '1',
              format: WorkoutFormat.amrap,
              intensity: IntensityLevel.high,
              targetDuration: 30,
            );

        expect(workout, testWorkout);
        verify(mockRepository.getTemplateById('1')).called(1);
        verify(
          mockGenerator.generateWorkout(
            format: WorkoutFormat.amrap,
            intensity: IntensityLevel.high,
            targetDuration: 30,
            preferredCategories: testTemplate.preferredCategories,
            availableEquipment: testTemplate.availableEquipment,
            isMainMovementOnly: testTemplate.isMainMovementOnly,
          ),
        ).called(1);
        verify(mockRepository.incrementUsage('1')).called(1);
      },
    );
  });
}
