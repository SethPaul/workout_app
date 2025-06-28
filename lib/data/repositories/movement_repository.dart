import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/movement.dart';
import 'package:workout_app/data/database/database_helper.dart';

abstract class MovementRepository {
  Future<List<Movement>> getAllMovements();
  Future<Movement?> getMovementById(String id);
  Future<List<Movement>> getMovementsByCategory(MovementCategory category);
  Future<List<Movement>> getMovementsByEquipment(EquipmentType equipment);
  Future<List<Movement>> getMovementsByDifficulty(DifficultyLevel difficulty);
  Future<List<Movement>> getMainMovements();
  Future<String> createMovement(Movement movement);
  Future<void> updateMovement(Movement movement);
  Future<void> deleteMovement(String id);
}

class SQLiteMovementRepository implements MovementRepository {
  final DatabaseHelper _dbHelper = DatabaseHelper();

  @override
  Future<List<Movement>> getAllMovements() async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('movement_library');
    return List.generate(maps.length, (i) => _movementFromMap(maps[i]));
  }

  @override
  Future<Movement?> getMovementById(String id) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'movement_library',
      where: 'id = ?',
      whereArgs: [id],
    );
    if (maps.isEmpty) return null;
    return _movementFromMap(maps.first);
  }

  @override
  Future<List<Movement>> getMovementsByCategory(
      MovementCategory category) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('movement_library');
    return maps
        .map((map) => _movementFromMap(map))
        .where((movement) => movement.categories.contains(category))
        .toList();
  }

  @override
  Future<List<Movement>> getMovementsByEquipment(
      EquipmentType equipment) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('movement_library');
    return maps
        .map((map) => _movementFromMap(map))
        .where((movement) => movement.requiredEquipment.contains(equipment))
        .toList();
  }

  @override
  Future<List<Movement>> getMovementsByDifficulty(
      DifficultyLevel difficulty) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'movement_library',
      where: 'difficultyLevel = ?',
      whereArgs: [difficulty.toString().split('.').last],
    );
    return List.generate(maps.length, (i) => _movementFromMap(maps[i]));
  }

  @override
  Future<List<Movement>> getMainMovements() async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'movement_library',
      where: 'isMainMovement = ?',
      whereArgs: [1],
    );
    return List.generate(maps.length, (i) => _movementFromMap(maps[i]));
  }

  @override
  Future<String> createMovement(Movement movement) async {
    final db = await _dbHelper.database;
    await db.insert(
      'movement_library',
      _movementToMap(movement),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return movement.id;
  }

  @override
  Future<void> updateMovement(Movement movement) async {
    final db = await _dbHelper.database;
    await db.update(
      'movement_library',
      _movementToMap(movement),
      where: 'id = ?',
      whereArgs: [movement.id],
    );
  }

  @override
  Future<void> deleteMovement(String id) async {
    final db = await _dbHelper.database;
    await db.delete(
      'movement_library',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Map<String, dynamic> _movementToMap(Movement movement) {
    return {
      'id': movement.id,
      'name': movement.name,
      'description': movement.description,
      'categories': jsonEncode(movement.categories
          .map((c) => c.toString().split('.').last)
          .toList()),
      'requiredEquipment': jsonEncode(movement.requiredEquipment
          .map((e) => e.toString().split('.').last)
          .toList()),
      'muscleGroups': jsonEncode(movement.muscleGroups
          .map((m) => m.toString().split('.').last)
          .toList()),
      'difficultyLevel': movement.difficultyLevel.toString().split('.').last,
      'isMainMovement': movement.isMainMovement ? 1 : 0,
      'scalingOptions': jsonEncode(movement.scalingOptions),
      'guidelines': jsonEncode(movement.guidelines),
      'videoUrl': movement.videoUrl,
      'imageUrl': movement.imageUrl,
    };
  }

  Movement _movementFromMap(Map<String, dynamic> map) {
    return Movement(
      id: map['id'] as String,
      name: map['name'] as String,
      description: map['description'] as String,
      categories: (jsonDecode(map['categories'] as String) as List)
          .map((c) => MovementCategory.values
              .firstWhere((mc) => mc.toString() == 'MovementCategory.$c'))
          .toList(),
      requiredEquipment:
          (jsonDecode(map['requiredEquipment'] as String) as List)
              .map((e) => EquipmentType.values
                  .firstWhere((et) => et.toString() == 'EquipmentType.$e'))
              .toList(),
      muscleGroups: (jsonDecode(map['muscleGroups'] as String) as List)
          .map((m) => MuscleGroup.values
              .firstWhere((mg) => mg.toString() == 'MuscleGroup.$m'))
          .toList(),
      difficultyLevel: DifficultyLevel.values.firstWhere(
        (e) => e.toString() == 'DifficultyLevel.${map['difficultyLevel']}',
      ),
      isMainMovement: map['isMainMovement'] == 1,
      scalingOptions:
          Map<String, String>.from(jsonDecode(map['scalingOptions'] as String)),
      guidelines:
          jsonDecode(map['guidelines'] as String) as Map<String, dynamic>,
      videoUrl: map['videoUrl'] as String?,
      imageUrl: map['imageUrl'] as String?,
    );
  }
}
