import 'dart:convert';
import 'package:workout_app/data/database/database_helper.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:sqflite/sqflite.dart';

abstract class WorkoutTemplateRepository {
  Future<List<WorkoutTemplate>> getAllTemplates();
  Future<WorkoutTemplate?> getTemplateById(String id);
  Future<List<WorkoutTemplate>> getTemplatesByFormat(WorkoutFormat format);
  Future<List<WorkoutTemplate>> getTemplatesByIntensity(
      IntensityLevel intensity);
  Future<List<WorkoutTemplate>> getTemplatesByEquipment(
      List<EquipmentType> equipment);
  Future<List<WorkoutTemplate>> getTemplatesByCategories(
      List<MovementCategory> categories);
  Future<String> createTemplate(WorkoutTemplate template);
  Future<void> updateTemplate(WorkoutTemplate template);
  Future<void> deleteTemplate(String id);
  Future<void> incrementUsage(String id);
}

class SQLiteWorkoutTemplateRepository implements WorkoutTemplateRepository {
  final DatabaseHelper _dbHelper = DatabaseHelper();

  @override
  Future<List<WorkoutTemplate>> getAllTemplates() async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('workout_templates');
    return List.generate(maps.length, (i) => _templateFromMap(maps[i]));
  }

  @override
  Future<WorkoutTemplate?> getTemplateById(String id) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workout_templates',
      where: 'id = ?',
      whereArgs: [id],
    );
    if (maps.isEmpty) return null;
    return _templateFromMap(maps.first);
  }

  @override
  Future<List<WorkoutTemplate>> getTemplatesByFormat(
      WorkoutFormat format) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workout_templates',
      where: 'format = ?',
      whereArgs: [format.toString().split('.').last],
    );
    return List.generate(maps.length, (i) => _templateFromMap(maps[i]));
  }

  @override
  Future<List<WorkoutTemplate>> getTemplatesByIntensity(
      IntensityLevel intensity) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query(
      'workout_templates',
      where: 'intensity = ?',
      whereArgs: [intensity.toString().split('.').last],
    );
    return List.generate(maps.length, (i) => _templateFromMap(maps[i]));
  }

  @override
  Future<List<WorkoutTemplate>> getTemplatesByEquipment(
      List<EquipmentType> equipment) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('workout_templates');
    return maps
        .map((map) => _templateFromMap(map))
        .where((template) =>
            template.availableEquipment?.any((e) => equipment.contains(e)) ??
            false)
        .toList();
  }

  @override
  Future<List<WorkoutTemplate>> getTemplatesByCategories(
      List<MovementCategory> categories) async {
    final db = await _dbHelper.database;
    final List<Map<String, dynamic>> maps = await db.query('workout_templates');
    return maps
        .map((map) => _templateFromMap(map))
        .where((template) =>
            template.preferredCategories?.any((c) => categories.contains(c)) ??
            false)
        .toList();
  }

  @override
  Future<String> createTemplate(WorkoutTemplate template) async {
    final db = await _dbHelper.database;
    await db.insert(
      'workout_templates',
      _templateToMap(template),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return template.id;
  }

  @override
  Future<void> updateTemplate(WorkoutTemplate template) async {
    final db = await _dbHelper.database;
    await db.update(
      'workout_templates',
      _templateToMap(template),
      where: 'id = ?',
      whereArgs: [template.id],
    );
  }

  @override
  Future<void> deleteTemplate(String id) async {
    final db = await _dbHelper.database;
    await db.delete(
      'workout_templates',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  @override
  Future<void> incrementUsage(String id) async {
    final db = await _dbHelper.database;
    final template = await getTemplateById(id);
    if (template != null) {
      final metadata = template.metadata ?? {};
      metadata['usageCount'] = (metadata['usageCount'] as int? ?? 0) + 1;
      await db.update(
        'workout_templates',
        {
          'metadata': jsonEncode(metadata),
          'timesUsed': template.timesUsed + 1,
          'lastUsed': DateTime.now().toIso8601String(),
        },
        where: 'id = ?',
        whereArgs: [id],
      );
    }
  }

  Map<String, dynamic> _templateToMap(WorkoutTemplate template) {
    return {
      'id': template.id,
      'name': template.name,
      'description': template.description,
      'format': template.format.toString().split('.').last,
      'intensity': template.intensity.toString().split('.').last,
      'targetDuration': template.targetDuration,
      'preferredCategories': jsonEncode(template.preferredCategories
          ?.map((c) => c.toString().split('.').last)
          .toList()),
      'availableEquipment': jsonEncode(template.availableEquipment
          ?.map((e) => e.toString().split('.').last)
          .toList()),
      'isMainMovementOnly': template.isMainMovementOnly,
      'created_at': template.createdAt.toIso8601String(),
      'lastUsed': template.lastUsed?.toIso8601String(),
      'timesUsed': template.timesUsed,
      'metadata': jsonEncode(template.metadata),
    };
  }

  WorkoutTemplate _templateFromMap(Map<String, dynamic> map) {
    return WorkoutTemplate(
      id: map['id'] as String,
      name: map['name'] as String,
      description: map['description'] as String,
      format: WorkoutFormat.values.firstWhere(
        (e) => e.toString() == 'WorkoutFormat.${map['format']}',
      ),
      intensity: IntensityLevel.values.firstWhere(
        (e) => e.toString() == 'IntensityLevel.${map['intensity']}',
      ),
      targetDuration: map['targetDuration'] as int,
      preferredCategories:
          (jsonDecode(map['preferredCategories'] as String) as List?)
              ?.map((c) => MovementCategory.values
                  .firstWhere((mc) => mc.toString() == 'MovementCategory.$c'))
              .toList(),
      availableEquipment:
          (jsonDecode(map['availableEquipment'] as String) as List?)
              ?.map((e) => EquipmentType.values
                  .firstWhere((et) => et.toString() == 'EquipmentType.$e'))
              .toList(),
      isMainMovementOnly: map['isMainMovementOnly'] as bool?,
      createdAt: DateTime.parse(map['created_at'] as String),
      lastUsed: map['lastUsed'] != null
          ? DateTime.parse(map['lastUsed'] as String)
          : null,
      timesUsed: map['timesUsed'] as int? ?? 0,
      metadata: map['metadata'] != null
          ? jsonDecode(map['metadata'] as String) as Map<String, dynamic>
          : null,
    );
  }
}
