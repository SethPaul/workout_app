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
    final List<Workout> workouts = [];
    for (final map in maps) {
      workouts.add(await _workoutFromMap(map));
    }
    return workouts;
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
    return await _workoutFromMap(maps.first);
  }

  @override
  Future<List<Workout>> getWorkoutsByFormat(WorkoutFormat format) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workouts',
      where: 'format = ?',
      whereArgs: [format.toString().split('.').last],
    );
    final List<Workout> workouts = [];
    for (final map in maps) {
      workouts.add(await _workoutFromMap(map));
    }
    return workouts;
  }

  @override
  Future<List<Workout>> getWorkoutsByIntensity(IntensityLevel intensity) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workouts',
      where: 'intensity = ?',
      whereArgs: [intensity.toString().split('.').last],
    );
    final List<Workout> workouts = [];
    for (final map in maps) {
      workouts.add(await _workoutFromMap(map));
    }
    return workouts;
  }

  @override
  Future<String> createWorkout(Workout workout) async {
    final db = await _dbHelper.database;

    await db.transaction((txn) async {
      // Save workout metadata
      await txn.insert(
        'workouts',
        _workoutToMap(workout),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      // Save individual movements
      for (final movement in workout.movements) {
        await txn.insert(
          'workout_movements',
          {
            'id': '${workout.id}_${workout.movements.indexOf(movement)}',
            'workout_id': workout.id,
            'movement_id': movement.movementId,
            'reps': movement.reps,
            'time_in_seconds': movement.timeInSeconds,
            'weight': movement.weight,
            'scaling_option': movement.scalingOption,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });

    return workout.id;
  }

  @override
  Future<void> updateWorkout(Workout workout) async {
    final db = await _dbHelper.database;

    await db.transaction((txn) async {
      // Update workout metadata
      await txn.update(
        'workouts',
        _workoutToMap(workout),
        where: 'id = ?',
        whereArgs: [workout.id],
      );

      // Delete existing movements
      await txn.delete(
        'workout_movements',
        where: 'workout_id = ?',
        whereArgs: [workout.id],
      );

      // Insert updated movements
      for (final movement in workout.movements) {
        await txn.insert(
          'workout_movements',
          {
            'id': '${workout.id}_${workout.movements.indexOf(movement)}',
            'workout_id': workout.id,
            'movement_id': movement.movementId,
            'reps': movement.reps,
            'time_in_seconds': movement.timeInSeconds,
            'weight': movement.weight,
            'scaling_option': movement.scalingOption,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  @override
  Future<void> deleteWorkout(String id) async {
    final db = await _dbHelper.database;

    await db.transaction((txn) async {
      // Delete movements first
      await txn.delete(
        'workout_movements',
        where: 'workout_id = ?',
        whereArgs: [id],
      );

      // Then delete workout
      await txn.delete(
        'workouts',
        where: 'id = ?',
        whereArgs: [id],
      );
    });
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
      'format': workout.format.toString().split('.').last,
      'intensity': workout.intensity.toString().split('.').last,
      'rounds': workout.rounds,
      'duration': workout.duration,
      'time_cap_in_minutes': workout.timeCapInMinutes,
      'format_specific_settings': workout.formatSpecificSettings != null
          ? jsonEncode(workout.formatSpecificSettings!)
          : null,
      'created_at': workout.createdAt.toIso8601String(),
      'completed_at': workout.completedAt?.toIso8601String(),
      'notes': workout.notes,
    };
  }

  Future<Workout> _workoutFromMap(Map<String, dynamic> map) async {
    // Load movements from separate table
    final db = await _dbHelper.database;
    final movementMaps = await db.query(
      'workout_movements',
      where: 'workout_id = ?',
      whereArgs: [map['id']],
    );

    final movements = movementMaps
        .map((movementMap) => WorkoutMovement(
              movementId: movementMap['movement_id'] as String,
              reps: movementMap['reps'] as int,
              weight: movementMap['weight'] as double?,
              scalingOption: movementMap['scaling_option'] as String?,
              timeInSeconds: movementMap['time_in_seconds'] as int?,
            ))
        .toList();

    return Workout.fromMap(map, movements: movements);
  }
}
