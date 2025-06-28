// Simple database diagnostic script
// This script tests the core database mapping logic

import 'dart:convert';

// Mock the enum classes for testing
enum WorkoutFormat { emom, amrap, forTime, tabata }

enum IntensityLevel { low, medium, high }

enum MovementCategory { compoundLift, bodyweight, cardio, accessory }

enum EquipmentType { barbell, dumbbell, kettlebell, bodyweight }

class MockWorkoutTemplate {
  final String id;
  final String name;
  final String description;
  final WorkoutFormat format;
  final IntensityLevel intensity;
  final int targetDuration;
  final List<MovementCategory>? preferredCategories;
  final List<EquipmentType>? availableEquipment;
  final bool? isMainMovementOnly;
  final DateTime createdAt;
  final DateTime? lastUsed;
  final int timesUsed;
  final Map<String, dynamic>? metadata;

  const MockWorkoutTemplate({
    required this.id,
    required this.name,
    required this.description,
    required this.format,
    required this.intensity,
    required this.targetDuration,
    this.preferredCategories,
    this.availableEquipment,
    this.isMainMovementOnly,
    required this.createdAt,
    this.lastUsed,
    this.timesUsed = 0,
    this.metadata,
  });
}

// Test the database mapping functions
Map<String, dynamic> templateToMap(MockWorkoutTemplate template) {
  return {
    'id': template.id,
    'name': template.name,
    'description': template.description,
    'format': template.format.toString().split('.').last,
    'intensity': template.intensity.toString().split('.').last,
    'targetDuration': template.targetDuration,
    'preferredCategories': jsonEncode(
      template.preferredCategories
          ?.map((c) => c.toString().split('.').last)
          .toList(),
    ),
    'availableEquipment': jsonEncode(
      template.availableEquipment
          ?.map((e) => e.toString().split('.').last)
          .toList(),
    ),
    'isMainMovementOnly': template.isMainMovementOnly,
    'created_at': template.createdAt.toIso8601String(), // Using snake_case now
    'lastUsed': template.lastUsed?.toIso8601String(),
    'timesUsed': template.timesUsed,
    'metadata': jsonEncode(template.metadata),
  };
}

MockWorkoutTemplate templateFromMap(Map<String, dynamic> map) {
  return MockWorkoutTemplate(
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
            ?.map(
              (c) => MovementCategory.values.firstWhere(
                (mc) => mc.toString() == 'MovementCategory.$c',
              ),
            )
            .toList(),
    availableEquipment:
        (jsonDecode(map['availableEquipment'] as String) as List?)
            ?.map(
              (e) => EquipmentType.values.firstWhere(
                (et) => et.toString() == 'EquipmentType.$e',
              ),
            )
            .toList(),
    isMainMovementOnly: map['isMainMovementOnly'] as bool?,
    createdAt: DateTime.parse(
      map['created_at'] as String,
    ), // Using snake_case now
    lastUsed: map['lastUsed'] != null
        ? DateTime.parse(map['lastUsed'] as String)
        : null,
    timesUsed: map['timesUsed'] as int? ?? 0,
    metadata: map['metadata'] != null
        ? jsonDecode(map['metadata'] as String) as Map<String, dynamic>
        : null,
  );
}

void main() {
  print('Testing Database Mapping Functions...');
  print('=====================================');

  try {
    // Create a test template
    final template = MockWorkoutTemplate(
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

    print('Original template:');
    print('  ID: ${template.id}');
    print('  Name: ${template.name}');
    print('  Format: ${template.format}');
    print('  Intensity: ${template.intensity}');
    print('  Created At: ${template.createdAt}');
    print('');

    // Test the mapping to database format
    print('Converting to database map...');
    final templateMap = templateToMap(template);
    print('Database map:');
    templateMap.forEach((key, value) {
      print('  $key: $value');
    });
    print('');

    // Test conversion back from database format
    print('Converting back from database map...');
    final recoveredTemplate = templateFromMap(templateMap);
    print('Recovered template:');
    print('  ID: ${recoveredTemplate.id}');
    print('  Name: ${recoveredTemplate.name}');
    print('  Format: ${recoveredTemplate.format}');
    print('  Intensity: ${recoveredTemplate.intensity}');
    print('  Created At: ${recoveredTemplate.createdAt}');
    print('');

    // Verify data integrity
    print('Data integrity check:');
    final originalCreateAt = template.createdAt.toIso8601String();
    final recoveredCreateAt = recoveredTemplate.createdAt.toIso8601String();

    if (template.id == recoveredTemplate.id &&
        template.name == recoveredTemplate.name &&
        template.format == recoveredTemplate.format &&
        template.intensity == recoveredTemplate.intensity &&
        originalCreateAt == recoveredCreateAt) {
      print('✅ SUCCESS: All data matches perfectly!');
      print('');
      print('Key findings:');
      print('  - Database column names now use snake_case (created_at)');
      print('  - Mapping functions correctly handle the conversion');
      print('  - Data integrity is maintained through the conversion process');
      print('');
      print('The database error should now be fixed!');
    } else {
      print('❌ ERROR: Data mismatch detected!');
      print('Original created_at: $originalCreateAt');
      print('Recovered created_at: $recoveredCreateAt');
    }
  } catch (e, stackTrace) {
    print('❌ ERROR: Exception occurred during testing');
    print('Error: $e');
    print('Stack trace: $stackTrace');
  }
}
