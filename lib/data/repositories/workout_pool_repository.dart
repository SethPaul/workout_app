import 'package:workout_app/data/models/workout_pool.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/equipment.dart';
import 'package:workout_app/data/database/database_helper.dart';

abstract class WorkoutPoolRepository {
  Future<List<WorkoutPool>> getAllWorkoutPools();
  Future<List<WorkoutPool>> getEnabledWorkoutPools();
  Future<List<WorkoutPool>> getAvailableWorkoutPools({DateTime? forDate});
  Future<WorkoutPool?> getWorkoutPoolById(String id);
  Future<String> createWorkoutPool(WorkoutPool workoutPool);
  Future<void> updateWorkoutPool(WorkoutPool workoutPool);
  Future<void> deleteWorkoutPool(String id);
  Future<void> markWorkoutPoolAsPerformed(String id, {DateTime? performedAt});
  Future<List<WorkoutPool>> getWorkoutPoolsByEquipment(List<String> availableEquipmentIds);
  Future<List<WorkoutPool>> getWorkoutPoolsByFormat(WorkoutFormat format);
  Future<List<WorkoutPool>> getWorkoutPoolsByIntensity(IntensityLevel intensity);
}

class SQLiteWorkoutPoolRepository implements WorkoutPoolRepository {
  final DatabaseHelper _databaseHelper = DatabaseHelper();

  @override
  Future<List<WorkoutPool>> getAllWorkoutPools() async {
    final db = await _databaseHelper.database;
    final workoutPoolMaps = await db.query('workout_pools', orderBy: 'name ASC');
    
    List<WorkoutPool> workoutPools = [];
    for (var map in workoutPoolMaps) {
      final movements = await _getWorkoutPoolMovements(map['id'] as String);
      final requiredEquipmentIds = await _getWorkoutPoolEquipment(map['id'] as String);
      workoutPools.add(WorkoutPool.fromMap(map, 
          movements: movements, 
          requiredEquipmentIds: requiredEquipmentIds));
    }
    
    return workoutPools;
  }

  @override
  Future<List<WorkoutPool>> getEnabledWorkoutPools() async {
    final db = await _databaseHelper.database;
    final workoutPoolMaps = await db.query(
      'workout_pools',
      where: 'is_enabled = ?',
      whereArgs: [1],
      orderBy: 'name ASC',
    );
    
    List<WorkoutPool> workoutPools = [];
    for (var map in workoutPoolMaps) {
      final movements = await _getWorkoutPoolMovements(map['id'] as String);
      final requiredEquipmentIds = await _getWorkoutPoolEquipment(map['id'] as String);
      workoutPools.add(WorkoutPool.fromMap(map, 
          movements: movements, 
          requiredEquipmentIds: requiredEquipmentIds));
    }
    
    return workoutPools;
  }

  @override
  Future<List<WorkoutPool>> getAvailableWorkoutPools({DateTime? forDate}) async {
    final enabledPools = await getEnabledWorkoutPools();
    forDate ??= DateTime.now();
    
    return enabledPools.where((pool) => 
        pool.isAvailableForSelection(currentDate: forDate)).toList();
  }

  @override
  Future<WorkoutPool?> getWorkoutPoolById(String id) async {
    final db = await _databaseHelper.database;
    final maps = await db.query(
      'workout_pools',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    
    if (maps.isEmpty) return null;
    
    final movements = await _getWorkoutPoolMovements(id);
    final requiredEquipmentIds = await _getWorkoutPoolEquipment(id);
    return WorkoutPool.fromMap(maps.first, 
        movements: movements, 
        requiredEquipmentIds: requiredEquipmentIds);
  }

  @override
  Future<String> createWorkoutPool(WorkoutPool workoutPool) async {
    final db = await _databaseHelper.database;
    
    await db.transaction((txn) async {
      // Insert workout pool
      await txn.insert('workout_pools', workoutPool.toMap());
      
      // Insert movements
      for (int i = 0; i < workoutPool.movements.length; i++) {
        final movement = workoutPool.movements[i];
        await txn.insert('workout_pool_movements', {
          'workout_pool_id': workoutPool.id,
          'movement_id': movement.movementId,
          'reps': movement.reps,
          'weight': movement.weight,
          'scaling_option': movement.scalingOption,
          'time_in_seconds': movement.timeInSeconds,
          'order_index': i,
        });
      }
      
      // Insert required equipment
      for (final equipmentId in workoutPool.requiredEquipmentIds) {
        await txn.insert('workout_pool_equipment', {
          'workout_pool_id': workoutPool.id,
          'equipment_id': equipmentId,
        });
      }
    });
    
    return workoutPool.id;
  }

  @override
  Future<void> updateWorkoutPool(WorkoutPool workoutPool) async {
    final db = await _databaseHelper.database;
    
    await db.transaction((txn) async {
      // Update workout pool
      await txn.update(
        'workout_pools',
        workoutPool.toMap(),
        where: 'id = ?',
        whereArgs: [workoutPool.id],
      );
      
      // Delete existing movements and equipment
      await txn.delete(
        'workout_pool_movements',
        where: 'workout_pool_id = ?',
        whereArgs: [workoutPool.id],
      );
      await txn.delete(
        'workout_pool_equipment',
        where: 'workout_pool_id = ?',
        whereArgs: [workoutPool.id],
      );
      
      // Insert updated movements
      for (int i = 0; i < workoutPool.movements.length; i++) {
        final movement = workoutPool.movements[i];
        await txn.insert('workout_pool_movements', {
          'workout_pool_id': workoutPool.id,
          'movement_id': movement.movementId,
          'reps': movement.reps,
          'weight': movement.weight,
          'scaling_option': movement.scalingOption,
          'time_in_seconds': movement.timeInSeconds,
          'order_index': i,
        });
      }
      
      // Insert updated equipment
      for (final equipmentId in workoutPool.requiredEquipmentIds) {
        await txn.insert('workout_pool_equipment', {
          'workout_pool_id': workoutPool.id,
          'equipment_id': equipmentId,
        });
      }
    });
  }

  @override
  Future<void> deleteWorkoutPool(String id) async {
    final db = await _databaseHelper.database;
    
    await db.transaction((txn) async {
      await txn.delete('workout_pool_movements', where: 'workout_pool_id = ?', whereArgs: [id]);
      await txn.delete('workout_pool_equipment', where: 'workout_pool_id = ?', whereArgs: [id]);
      await txn.delete('workout_pools', where: 'id = ?', whereArgs: [id]);
    });
  }

  @override
  Future<void> markWorkoutPoolAsPerformed(String id, {DateTime? performedAt}) async {
    final db = await _databaseHelper.database;
    final now = DateTime.now();
    
    await db.update(
      'workout_pools',
      {
        'last_performed': (performedAt ?? now).toIso8601String(),
        'updated_at': now.toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  @override
  Future<List<WorkoutPool>> getWorkoutPoolsByEquipment(List<String> availableEquipmentIds) async {
    if (availableEquipmentIds.isEmpty) return [];
    
    final db = await _databaseHelper.database;
    final placeholders = List.generate(availableEquipmentIds.length, (index) => '?').join(',');
    
    // Get workout pools that only require available equipment
    final query = '''
      SELECT DISTINCT wp.* FROM workout_pools wp
      LEFT JOIN workout_pool_equipment wpe ON wp.id = wpe.workout_pool_id
      WHERE wp.is_enabled = 1
      AND (wpe.equipment_id IS NULL OR wpe.equipment_id IN ($placeholders))
      GROUP BY wp.id
      HAVING COUNT(CASE WHEN wpe.equipment_id NOT IN ($placeholders) THEN 1 END) = 0
      ORDER BY wp.name ASC
    ''';
    
    final args = [...availableEquipmentIds, ...availableEquipmentIds];
    final workoutPoolMaps = await db.rawQuery(query, args);
    
    List<WorkoutPool> workoutPools = [];
    for (var map in workoutPoolMaps) {
      final movements = await _getWorkoutPoolMovements(map['id'] as String);
      final requiredEquipmentIds = await _getWorkoutPoolEquipment(map['id'] as String);
      workoutPools.add(WorkoutPool.fromMap(map, 
          movements: movements, 
          requiredEquipmentIds: requiredEquipmentIds));
    }
    
    return workoutPools;
  }

  @override
  Future<List<WorkoutPool>> getWorkoutPoolsByFormat(WorkoutFormat format) async {
    final db = await _databaseHelper.database;
    final workoutPoolMaps = await db.query(
      'workout_pools',
      where: 'format = ? AND is_enabled = ?',
      whereArgs: [format.toString().split('.').last, 1],
      orderBy: 'name ASC',
    );
    
    List<WorkoutPool> workoutPools = [];
    for (var map in workoutPoolMaps) {
      final movements = await _getWorkoutPoolMovements(map['id'] as String);
      final requiredEquipmentIds = await _getWorkoutPoolEquipment(map['id'] as String);
      workoutPools.add(WorkoutPool.fromMap(map, 
          movements: movements, 
          requiredEquipmentIds: requiredEquipmentIds));
    }
    
    return workoutPools;
  }

  @override
  Future<List<WorkoutPool>> getWorkoutPoolsByIntensity(IntensityLevel intensity) async {
    final db = await _databaseHelper.database;
    final workoutPoolMaps = await db.query(
      'workout_pools',
      where: 'intensity = ? AND is_enabled = ?',
      whereArgs: [intensity.toString().split('.').last, 1],
      orderBy: 'name ASC',
    );
    
    List<WorkoutPool> workoutPools = [];
    for (var map in workoutPoolMaps) {
      final movements = await _getWorkoutPoolMovements(map['id'] as String);
      final requiredEquipmentIds = await _getWorkoutPoolEquipment(map['id'] as String);
      workoutPools.add(WorkoutPool.fromMap(map, 
          movements: movements, 
          requiredEquipmentIds: requiredEquipmentIds));
    }
    
    return workoutPools;
  }

  Future<List<WorkoutMovement>> _getWorkoutPoolMovements(String workoutPoolId) async {
    final db = await _databaseHelper.database;
    final movementMaps = await db.query(
      'workout_pool_movements',
      where: 'workout_pool_id = ?',
      whereArgs: [workoutPoolId],
      orderBy: 'order_index ASC',
    );
    
    return movementMaps.map((map) => WorkoutMovement(
      movementId: map['movement_id'] as String,
      reps: map['reps'] as int,
      weight: map['weight'] as double?,
      scalingOption: map['scaling_option'] as String?,
      timeInSeconds: map['time_in_seconds'] as int?,
    )).toList();
  }

  Future<List<String>> _getWorkoutPoolEquipment(String workoutPoolId) async {
    final db = await _databaseHelper.database;
    final equipmentMaps = await db.query(
      'workout_pool_equipment',
      where: 'workout_pool_id = ?',
      whereArgs: [workoutPoolId],
    );
    
    return equipmentMaps.map((map) => map['equipment_id'] as String).toList();
  }
}