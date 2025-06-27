import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/workout_template_repository.dart';
import 'package:workout_app/services/workout_generator.dart';

class WorkoutTemplateService {
  final WorkoutTemplateRepository _repository;
  final WorkoutGenerator _workoutGenerator;

  WorkoutTemplateService({
    required WorkoutTemplateRepository repository,
    required WorkoutGenerator workoutGenerator,
  })  : _repository = repository,
        _workoutGenerator = workoutGenerator;

  Future<List<WorkoutTemplate>> getAllTemplates() async {
    return _repository.getAllTemplates();
  }

  Future<WorkoutTemplate?> getTemplateById(String id) async {
    return _repository.getTemplateById(id);
  }

  Future<List<WorkoutTemplate>> getTemplatesByFormat(
      WorkoutFormat format) async {
    return _repository.getTemplatesByFormat(format);
  }

  Future<List<WorkoutTemplate>> getTemplatesByIntensity(
      IntensityLevel intensity) async {
    return _repository.getTemplatesByIntensity(intensity);
  }

  Future<List<WorkoutTemplate>> getTemplatesByEquipment(
      List<EquipmentType> equipment) async {
    return _repository.getTemplatesByEquipment(equipment);
  }

  Future<List<WorkoutTemplate>> getTemplatesByCategory(
      List<MovementCategory> categories) async {
    return _repository.getTemplatesByCategories(categories);
  }

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
      id: DateTime.now().millisecondsSinceEpoch.toString(),
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

    return _repository.createTemplate(template);
  }

  Future<void> updateTemplate(WorkoutTemplate template) async {
    await _repository.updateTemplate(template);
  }

  Future<void> deleteTemplate(String id) async {
    await _repository.deleteTemplate(id);
  }

  Future<Workout> generateWorkoutFromTemplate(String templateId) async {
    final template = await _repository.getTemplateById(templateId);
    if (template == null) {
      throw Exception('Template not found');
    }

    final workout = _workoutGenerator.generateWorkout(
      format: template.format,
      intensity: template.intensity,
      targetDuration: template.targetDuration,
      preferredCategories: template.preferredCategories,
      availableEquipment: template.availableEquipment,
      isMainMovementOnly: template.isMainMovementOnly,
    );

    await _repository.incrementUsage(templateId);
    return workout;
  }

  Future<Workout> generateWorkoutFromTemplateWithModifications(
    String templateId, {
    WorkoutFormat? format,
    IntensityLevel? intensity,
    int? targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
  }) async {
    final template = await _repository.getTemplateById(templateId);
    if (template == null) {
      throw Exception('Template not found');
    }

    final workout = _workoutGenerator.generateWorkout(
      format: format ?? template.format,
      intensity: intensity ?? template.intensity,
      targetDuration: targetDuration ?? template.targetDuration,
      preferredCategories: preferredCategories ?? template.preferredCategories,
      availableEquipment: availableEquipment ?? template.availableEquipment,
      isMainMovementOnly: isMainMovementOnly ?? template.isMainMovementOnly,
    );

    await _repository.incrementUsage(templateId);
    return workout;
  }
}
