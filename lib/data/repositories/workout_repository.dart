import 'dart:convert';
import 'package:workout_app/data/database/database_helper.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:sqflite/sqflite.dart';

abstract class WorkoutRepository {
  Future<List<Workout>> getAllWorkouts();
  Future<Workout?> getWorkoutById(String id);
  Future<List<Workout>> getWorkoutsByFormat(WorkoutFormat format);
  Future<List<Workout>> getWorkoutsByIntensity(IntensityLevel intensity);
  Future<String> createWorkout(Workout workout);
  Future<void> updateWorkout(Workout workout);
  Future<void> deleteWorkout(String id);
  Future<void> markWorkoutAsCompleted(String id);
}

class SQLiteWorkoutRepository implements WorkoutRepository {
  final DatabaseHelper _dbHelper = DatabaseHelper();

  @override
  Future<List<Workout>> getAllWorkouts() async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('workouts');
    return List.generate(maps.length, (i) => _workoutFromMap(maps[i]));
  }

  @override
  Future<Workout?> getWorkoutById(String id) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workouts',
      where: 'id = ?',
      whereArgs: [id],
    );
    if (maps.isEmpty) return null;
    return _workoutFromMap(maps.first);
  }

  @override
  Future<List<Workout>> getWorkoutsByFormat(WorkoutFormat format) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workouts',
      where: 'format = ?',
      whereArgs: [format.toString()],
    );
    return List.generate(maps.length, (i) => _workoutFromMap(maps[i]));
  }

  @override
  Future<List<Workout>> getWorkoutsByIntensity(IntensityLevel intensity) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workouts',
      where: 'intensity = ?',
      whereArgs: [intensity.toString()],
    );
    return List.generate(maps.length, (i) => _workoutFromMap(maps[i]));
  }

  @override
  Future<String> createWorkout(Workout workout) async {
    final db = await _dbHelper.database;
    await db.insert(
      'workouts',
      _workoutToMap(workout),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return workout.id;
  }

  @override
  Future<void> updateWorkout(Workout workout) async {
    final db = await _dbHelper.database;
    await db.update(
      'workouts',
      _workoutToMap(workout),
      where: 'id = ?',
      whereArgs: [workout.id],
    );
  }

  @override
  Future<void> deleteWorkout(String id) async {
    final db = await _dbHelper.database;
    await db.delete(
      'workouts',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  @override
  Future<void> markWorkoutAsCompleted(String id) async {
    final db = await _dbHelper.database;
    await db.update(
      'workouts',
      {'completed_at': DateTime.now().toIso8601String()},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Map<String, dynamic> _workoutToMap(Workout workout) {
    return {
      'id': workout.id,
      'name': workout.name,
      'description': workout.description,
      'format': workout.format.toString(),
      'intensity': workout.intensity.toString(),
      'movements':
          jsonEncode(workout.movements.map((m) => m.toJson()).toList()),
      'rounds': workout.rounds,
      'duration': workout.duration,
      'time_cap_in_minutes': workout.timeCapInMinutes,
      'format_specific_settings': jsonEncode(workout.formatSpecificSettings),
      'created_at': workout.createdAt.toIso8601String(),
      'completed_at': workout.completedAt?.toIso8601String(),
      'notes': workout.notes,
    };
  }

  Workout _workoutFromMap(Map<String, dynamic> map) {
    return Workout(
      id: map['id'] as String,
      name: map['name'] as String,
      description: map['description'] as String?,
      format: WorkoutFormat.values.firstWhere(
        (e) => e.toString() == 'WorkoutFormat.${map['format']}',
      ),
      intensity: IntensityLevel.values.firstWhere(
        (e) => e.toString() == 'IntensityLevel.${map['intensity']}',
      ),
      movements: (jsonDecode(map['movements'] as String) as List)
          .map((m) => WorkoutMovement.fromJson(m as Map<String, dynamic>))
          .toList(),
      rounds: map['rounds'] as int?,
      duration: map['duration'] as int? ?? 30,
      timeCapInMinutes: map['time_cap_in_minutes'] as int?,
      formatSpecificSettings: map['format_specific_settings'] != null
          ? jsonDecode(map['format_specific_settings'] as String)
              as Map<String, dynamic>
          : null,
      completedAt: map['completed_at'] != null
          ? DateTime.parse(map['completed_at'] as String)
          : null,
      createdAt: DateTime.parse(map['created_at'] as String),
      notes: map['notes'] as String?,
    );
  }
}
