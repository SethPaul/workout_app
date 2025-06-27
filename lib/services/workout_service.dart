import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/repositories/workout_repository.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/data/database/database_helper.dart';

class WorkoutService {
  final WorkoutRepository _repository;
  final WorkoutTemplateService _templateService;
  final DatabaseHelper _databaseHelper;

  WorkoutService({
    required WorkoutRepository repository,
    required WorkoutTemplateService templateService,
    required DatabaseHelper databaseHelper,
  })  : _repository = repository,
        _templateService = templateService,
        _databaseHelper = databaseHelper;

  // Expose template service for UI access
  WorkoutTemplateService get templateService => _templateService;

  Future<List<Workout>> getAllWorkouts() async {
    return _repository.getAllWorkouts();
  }

  Future<Workout?> getWorkoutById(String id) async {
    return _repository.getWorkoutById(id);
  }

  Future<List<Workout>> getWorkoutsByFormat(WorkoutFormat format) async {
    return _repository.getWorkoutsByFormat(format);
  }

  Future<List<Workout>> getWorkoutsByIntensity(IntensityLevel intensity) async {
    return _repository.getWorkoutsByIntensity(intensity);
  }

  Future<String> createWorkoutFromTemplate(String templateId) async {
    final workout =
        await _templateService.generateWorkoutFromTemplate(templateId);
    return _repository.createWorkout(workout);
  }

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
    return _repository.createWorkout(workout);
  }

  Future<String> createWorkout(Workout workout) async {
    return _repository.createWorkout(workout);
  }

  Future<void> updateWorkout(Workout workout) async {
    await _repository.updateWorkout(workout);
  }

  Future<void> deleteWorkout(String id) async {
    await _repository.deleteWorkout(id);
  }

  Future<void> markWorkoutAsCompleted(String id) async {
    await _repository.markWorkoutAsCompleted(id);
  }

  Future<List<Workout>> getCompletedWorkouts() async {
    final db = await _databaseHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workouts',
      where: 'completed_at IS NOT NULL',
      orderBy: 'completed_at DESC',
    );

    return List.generate(maps.length, (i) {
      return Workout.fromMap(maps[i]);
    });
  }
}
