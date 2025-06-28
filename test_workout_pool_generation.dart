import 'dart:io';
import 'package:workout_app/services/workout_pool_generator.dart';
import 'package:workout_app/services/movement_data_service.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:workout_app/data/database_helper.dart';

/// Simple test script to verify workout pool generation
void main() async {
  print('🏃‍♂️ Testing Extensive Workout Pool Generation...\n');

  try {
    // Initialize database
    final databaseHelper = DatabaseHelper();
    await databaseHelper.initializeDatabase();
    print('✅ Database initialized');

    // Initialize movement repository and service
    final movementRepository = MovementRepository(databaseHelper: databaseHelper);
    final movementDataService = MovementDataService(movementRepository: movementRepository);
    
    // Load movements from JSON
    await movementDataService.initializeMovementLibrary();
    print('✅ Movement library initialized');

    // Get all movements
    final movements = await movementRepository.getAllMovements();
    print('✅ Found ${movements.length} movements');

    // Create workout pool generator
    final generator = WorkoutPoolGenerator();
    
    // Generate extensive workout pools
    print('\n🔄 Generating extensive workout pools...');
    final workoutPools = await generator.generateExtensiveWorkoutPools(movements);
    
    print('\n🎉 SUCCESS! Generated ${workoutPools.length} workout pools');
    
    // Display summary by category
    final strengthPools = workoutPools.where((p) => p.name.contains('Heavy') || p.name.contains('Squat') || p.name.contains('Bench')).length;
    final olympicPools = workoutPools.where((p) => p.name.contains('EMOM') && (p.name.contains('Clean') || p.name.contains('Snatch'))).length;
    final metconPools = workoutPools.where((p) => p.name.contains('MetCon')).length;
    final amrapPools = workoutPools.where((p) => p.name.contains('AMRAP')).length;
    final bodyweightPools = workoutPools.where((p) => p.name.contains('Bodyweight') || p.name.contains('Focus')).length;
    final cardioPools = workoutPools.where((p) => p.name.contains('Intervals') || p.name.contains('Steady')).length;
    final hybridPools = workoutPools.where((p) => p.name.contains('Burst')).length;
    final specialtyPools = workoutPools.where((p) => p.name.contains('Technical') || p.name.contains('Slog')).length;

    print('\n📊 Workout Pool Summary:');
    print('   💪 Strength Workouts: $strengthPools');
    print('   🏋️  Olympic Lift Workouts: $olympicPools');
    print('   🔥 MetCon Workouts: $metconPools');
    print('   ⏱️  AMRAP Workouts: $amrapPools');
    print('   🤸 Bodyweight Workouts: $bodyweightPools');
    print('   🚴 Cardio Workouts: $cardioPools');
    print('   ⚡ Hybrid Workouts: $hybridPools');
    print('   🎯 Specialty Workouts: $specialtyPools');

    // Show some example workouts
    print('\n🏆 Example Workouts Generated:');
    final examples = workoutPools.take(10);
    for (final pool in examples) {
      print('   • ${pool.name} (${pool.format.toString().split('.').last}, ${pool.intensity.toString().split('.').last} intensity, ${pool.cadenceDays} day cadence)');
    }

    // Verify requirements compliance
    print('\n✅ Requirements Compliance Check:');
    final hasDeadliftPushPress = workoutPools.any((p) => p.name.contains('Heavy Deadlift + Push Press') || (p.name.contains('Deadlift') && p.name.contains('Press')));
    final hasEMOMClean = workoutPools.any((p) => p.name.contains('EMOM') && p.name.contains('Clean'));
    final hasIntervalsCardio = workoutPools.any((p) => p.name.contains('Intervals'));
    final hasWeeklyCadence = workoutPools.any((p) => p.cadenceDays == 7);
    final hasMonthlySlog = workoutPools.any((p) => p.cadenceDays == 30);

    print('   ${hasDeadliftPushPress ? "✅" : "❌"} Deadlift + Push Press workout');
    print('   ${hasEMOMClean ? "✅" : "❌"} EMOM Clean workout');
    print('   ${hasIntervalsCardio ? "✅" : "❌"} Intervals cardio workout');
    print('   ${hasWeeklyCadence ? "✅" : "❌"} Weekly cadence workouts');
    print('   ${hasMonthlySlog ? "✅" : "❌"} Monthly slog workouts');

    print('\n🎯 Total Generated: ${workoutPools.length} extensive workout pools');
    print('🚀 Workout pool generation test completed successfully!');

  } catch (e, stackTrace) {
    print('❌ Error during workout pool generation test:');
    print('Error: $e');
    print('Stack trace: $stackTrace');
    exit(1);
  }
}