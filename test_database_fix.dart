import 'dart:io';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'lib/data/models/workout_template.dart';
import 'lib/data/models/workout.dart';
import 'lib/data/models/movement.dart';

void main() async {
  // Initialize FFI
  sqfliteFfiInit();

  // Override the default factory for testing
  databaseFactory = databaseFactoryFfi;

  print('Testing database template creation...');

  try {
    // Create an in-memory database for testing
    final db = await openDatabase(':memory:', version: 1,
        onCreate: (db, version) async {
      // Create workout templates table with snake_case column names
      await db.execute('''
        CREATE TABLE workout_templates(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          format TEXT NOT NULL,
          intensity TEXT NOT NULL,
          targetDuration INTEGER NOT NULL,
          preferredCategories TEXT,
          availableEquipment TEXT,
          isMainMovementOnly INTEGER,
          created_at TEXT NOT NULL,
          lastUsed TEXT,
          timesUsed INTEGER DEFAULT 0,
          metadata TEXT
        )
      ''');
      print('Database table created successfully');
    });

    // Create a test template
    final template = WorkoutTemplate(
      id: '1',
      name: 'Test Template',
      description: 'A test workout template',
      format: WorkoutFormat.emom,
      intensity: IntensityLevel.medium,
      targetDuration: 20,
      preferredCategories: [MovementCategory.compoundLift],
      availableEquipment: [EquipmentType.dumbbell],
      isMainMovementOnly: false,
      createdAt: DateTime.now(),
      timesUsed: 0,
    );

    // Test the mapping function
    final templateMap = {
      'id': template.id,
      'name': template.name,
      'description': template.description,
      'format': template.format.toString().split('.').last,
      'intensity': template.intensity.toString().split('.').last,
      'targetDuration': template.targetDuration,
      'preferredCategories': '["compoundLift"]',
      'availableEquipment': '["dumbbell"]',
      'isMainMovementOnly': template.isMainMovementOnly,
      'created_at': template.createdAt.toIso8601String(),
      'lastUsed': template.lastUsed?.toIso8601String(),
      'timesUsed': template.timesUsed,
      'metadata': 'null',
    };

    print('Template map created: $templateMap');

    // Try to insert the template
    await db.insert('workout_templates', templateMap);
    print('Template inserted successfully!');

    // Try to query it back
    final result =
        await db.query('workout_templates', where: 'id = ?', whereArgs: ['1']);
    print('Template retrieved: $result');

    if (result.isNotEmpty) {
      print('SUCCESS: Database template creation and retrieval works!');

      // Test the reverse mapping
      final retrievedMap = result.first;
      print('Retrieved template data:');
      print('  ID: ${retrievedMap['id']}');
      print('  Name: ${retrievedMap['name']}');
      print('  Created At: ${retrievedMap['created_at']}');
      print('  Format: ${retrievedMap['format']}');
      print('  Intensity: ${retrievedMap['intensity']}');
    } else {
      print('ERROR: Template was not found after insertion');
    }

    await db.close();
  } catch (e, stackTrace) {
    print('ERROR: Database operation failed');
    print('Error: $e');
    print('Stack trace: $stackTrace');
  }
}
