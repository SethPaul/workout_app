import 'package:workout_app/data/models/movement_cadence.dart';
import 'package:workout_app/data/database/database_helper.dart';

abstract class MovementCadenceRepository {
  Future<List<MovementCadence>> getAllMovementCadences();
  Future<List<MovementCadence>> getEnabledMovementCadences();
  Future<List<MovementCadence>> getAvailableMovementCadences({DateTime? forDate});
  Future<MovementCadence?> getMovementCadenceById(String id);
  Future<MovementCadence?> getMovementCadenceByMovementId(String movementId);
  Future<String> createMovementCadence(MovementCadence movementCadence);
  Future<void> updateMovementCadence(MovementCadence movementCadence);
  Future<void> deleteMovementCadence(String id);
  Future<void> markMovementAsPerformed(String movementId, {DateTime? performedAt});
  Future<void> initializeDefaultCadences(List<String> movementIds);
}

class SQLiteMovementCadenceRepository implements MovementCadenceRepository {
  final DatabaseHelper _databaseHelper = DatabaseHelper();

  @override
  Future<List<MovementCadence>> getAllMovementCadences() async {
    final db = await _databaseHelper.database;
    final movementCadenceMaps = await db.query('movement_cadences', orderBy: 'created_at ASC');
    
    return movementCadenceMaps.map((map) => MovementCadence.fromMap(map)).toList();
  }

  @override
  Future<List<MovementCadence>> getEnabledMovementCadences() async {
    final db = await _databaseHelper.database;
    final movementCadenceMaps = await db.query(
      'movement_cadences',
      where: 'is_enabled = ?',
      whereArgs: [1],
      orderBy: 'created_at ASC',
    );
    
    return movementCadenceMaps.map((map) => MovementCadence.fromMap(map)).toList();
  }

  @override
  Future<List<MovementCadence>> getAvailableMovementCadences({DateTime? forDate}) async {
    final enabledCadences = await getEnabledMovementCadences();
    forDate ??= DateTime.now();
    
    return enabledCadences.where((cadence) => 
        cadence.isAvailableForSelection(currentDate: forDate)).toList();
  }

  @override
  Future<MovementCadence?> getMovementCadenceById(String id) async {
    final db = await _databaseHelper.database;
    final maps = await db.query(
      'movement_cadences',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    
    if (maps.isEmpty) return null;
    return MovementCadence.fromMap(maps.first);
  }

  @override
  Future<MovementCadence?> getMovementCadenceByMovementId(String movementId) async {
    final db = await _databaseHelper.database;
    final maps = await db.query(
      'movement_cadences',
      where: 'movement_id = ?',
      whereArgs: [movementId],
      limit: 1,
    );
    
    if (maps.isEmpty) return null;
    return MovementCadence.fromMap(maps.first);
  }

  @override
  Future<String> createMovementCadence(MovementCadence movementCadence) async {
    final db = await _databaseHelper.database;
    await db.insert('movement_cadences', movementCadence.toMap());
    return movementCadence.id;
  }

  @override
  Future<void> updateMovementCadence(MovementCadence movementCadence) async {
    final db = await _databaseHelper.database;
    await db.update(
      'movement_cadences',
      movementCadence.toMap(),
      where: 'id = ?',
      whereArgs: [movementCadence.id],
    );
  }

  @override
  Future<void> deleteMovementCadence(String id) async {
    final db = await _databaseHelper.database;
    await db.delete(
      'movement_cadences',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  @override
  Future<void> markMovementAsPerformed(String movementId, {DateTime? performedAt}) async {
    final db = await _databaseHelper.database;
    final now = DateTime.now();
    
    await db.update(
      'movement_cadences',
      {
        'last_performed': (performedAt ?? now).toIso8601String(),
        'updated_at': now.toIso8601String(),
      },
      where: 'movement_id = ?',
      whereArgs: [movementId],
    );
  }

  @override
  Future<void> initializeDefaultCadences(List<String> movementIds) async {
    final db = await _databaseHelper.database;
    
    // First, get existing movement names to determine default cadences
    final existingCadences = await getAllMovementCadences();
    final existingMovementIds = existingCadences.map((c) => c.movementId).toSet();
    
    // Get movement names
    final movementMaps = await db.query(
      'movements',
      columns: ['id', 'name'],
      where: 'id IN (${List.generate(movementIds.length, (index) => '?').join(',')})',
      whereArgs: movementIds,
    );
    
    final movementNamesMap = Map<String, String>.fromEntries(
      movementMaps.map((map) => MapEntry(map['id'] as String, map['name'] as String))
    );
    
    await db.transaction((txn) async {
      for (final movementId in movementIds) {
        if (!existingMovementIds.contains(movementId)) {
          final movementName = movementNamesMap[movementId] ?? '';
          final defaultCadence = CadencePresets.getDefaultCadenceForMovement(movementName);
          final now = DateTime.now();
          
          final cadence = MovementCadence(
            id: 'cadence_${movementId}_${now.millisecondsSinceEpoch}',
            movementId: movementId,
            daysInterval: defaultCadence,
            createdAt: now,
            updatedAt: now,
          );
          
          await txn.insert('movement_cadences', cadence.toMap());
        }
      }
    });
  }
}