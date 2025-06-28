import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/user_progress.dart';

class WorkoutGenerator {
  final List<Movement> availableMovements;
  final UserProgress? userProgress;

  WorkoutGenerator({required this.availableMovements, this.userProgress});

  /// Generates a workout based on the specified parameters
  Workout generateWorkout({
    required WorkoutFormat format,
    required IntensityLevel intensity,
    required int targetDuration,
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
  }) {
    // Filter movements based on preferences and equipment
    final filteredMovements = _filterMovements(
      preferredCategories: preferredCategories,
      availableEquipment: availableEquipment,
      isMainMovementOnly: isMainMovementOnly,
    );

    // Select movements based on format and intensity
    final selectedMovements = _selectMovements(
      filteredMovements,
      format: format,
      intensity: intensity,
      targetDuration: targetDuration,
    );

    // Create workout movements with appropriate reps/sets
    final workoutMovements = _createWorkoutMovements(
      selectedMovements,
      format: format,
      intensity: intensity,
    );

    // Generate workout name and description
    final name = _generateWorkoutName(format, intensity);
    final description = _generateWorkoutDescription(
      format,
      intensity,
      workoutMovements,
    );

    // Create and return the workout
    return Workout(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: name,
      description: description,
      format: format,
      intensity: intensity,
      movements: workoutMovements,
      rounds: _calculateRounds(format, intensity, targetDuration),
      duration: targetDuration,
      timeCapInMinutes: _calculateTimeCap(format, targetDuration),
      formatSpecificSettings: _getFormatSpecificSettings(format),
      createdAt: DateTime.now(),
    );
  }

  List<Movement> _filterMovements({
    List<MovementCategory>? preferredCategories,
    List<EquipmentType>? availableEquipment,
    bool? isMainMovementOnly,
  }) {
    return availableMovements.where((movement) {
      // Filter by category if specified
      if (preferredCategories != null &&
          !movement.categories.any((c) => preferredCategories.contains(c))) {
        return false;
      }

      // Filter by equipment if specified
      if (availableEquipment != null &&
          !movement.requiredEquipment.any(
            (e) => availableEquipment.contains(e),
          )) {
        return false;
      }

      // Filter by main movement if specified
      if (isMainMovementOnly == true && !movement.isMainMovement) {
        return false;
      }

      return true;
    }).toList();
  }

  List<Movement> _selectMovements(
    List<Movement> filteredMovements, {
    required WorkoutFormat format,
    required IntensityLevel intensity,
    required int targetDuration,
  }) {
    // Determine number of movements based on format and duration
    final numMovements = _getNumMovementsForFormat(format, targetDuration);

    // Group movements by muscle groups
    final movementsByMuscleGroup = _groupMovementsByMuscleGroup(
      filteredMovements,
    );

    // Select movements based on format and intensity
    final selectedMovements = <Movement>[];

    // For EMOM and AMRAP formats, prioritize compound movements
    if (format == WorkoutFormat.emom || format == WorkoutFormat.amrap) {
      selectedMovements.addAll(
        filteredMovements
            .where((m) => m.categories.contains(MovementCategory.compoundLift))
            .take(numMovements ~/ 2),
      );
    }

    // For Tabata format, prioritize cardio and bodyweight movements
    if (format == WorkoutFormat.tabata) {
      selectedMovements.addAll(
        filteredMovements
            .where(
              (m) =>
                  m.categories.contains(MovementCategory.cardio) ||
                  m.categories.contains(MovementCategory.bodyweight),
            )
            .take(numMovements),
      );
    }

    // For ForTime format, mix compound and accessory movements
    if (format == WorkoutFormat.forTime) {
      selectedMovements.addAll(
        filteredMovements
            .where((m) => m.categories.contains(MovementCategory.compoundLift))
            .take(numMovements ~/ 2),
      );
      selectedMovements.addAll(
        filteredMovements
            .where((m) => m.categories.contains(MovementCategory.accessory))
            .take(numMovements ~/ 2),
      );
    }

    // If we don't have enough movements yet, add more based on intensity
    if (selectedMovements.length < numMovements) {
      final remainingSlots = numMovements - selectedMovements.length;
      final remainingMovements = filteredMovements
          .where((m) => !selectedMovements.contains(m))
          .toList();

      // For high intensity, prioritize compound and cardio movements
      if (intensity == IntensityLevel.high) {
        selectedMovements.addAll(
          remainingMovements
              .where(
                (m) =>
                    m.categories.contains(MovementCategory.compoundLift) ||
                    m.categories.contains(MovementCategory.cardio),
              )
              .take(remainingSlots),
        );
      }
      // For medium intensity, mix movement types
      else if (intensity == IntensityLevel.medium) {
        selectedMovements.addAll(remainingMovements.take(remainingSlots));
      }
      // For low intensity, include more accessory and skill work
      else {
        selectedMovements.addAll(
          remainingMovements
              .where(
                (m) =>
                    m.categories.contains(MovementCategory.accessory) ||
                    m.categories.contains(MovementCategory.skill),
              )
              .take(remainingSlots),
        );
      }
    }

    // Ensure we have a balanced distribution of muscle groups
    final balancedMovements = _balanceMuscleGroups(
      selectedMovements,
      movementsByMuscleGroup,
      numMovements,
    );

    return balancedMovements;
  }

  int _getNumMovementsForFormat(WorkoutFormat format, int targetDuration) {
    switch (format) {
      case WorkoutFormat.emom:
        return (targetDuration / 5).ceil(); // One movement every 5 minutes
      case WorkoutFormat.amrap:
        return 3; // Typically 3 movements for AMRAP
      case WorkoutFormat.tabata:
        return 4; // 4 movements for Tabata
      case WorkoutFormat.forTime:
        return (targetDuration / 10).ceil(); // One movement every 10 minutes
      case WorkoutFormat.forReps:
        return 3; // Typically 3 movements for reps
      case WorkoutFormat.roundsForTime:
        return 3; // Typically 3 movements per round
      case WorkoutFormat.deathBy:
        return 1; // Single movement
      case WorkoutFormat.chipper:
        return 5; // Multiple movements in sequence
      case WorkoutFormat.ladder:
        return 2; // Two movements in ladder format
      case WorkoutFormat.partner:
        return 3; // Three movements for partner workout
    }
  }

  Map<MuscleGroup, List<Movement>> _groupMovementsByMuscleGroup(
    List<Movement> movements,
  ) {
    final grouped = <MuscleGroup, List<Movement>>{};
    for (final movement in movements) {
      for (final muscleGroup in movement.muscleGroups) {
        grouped.putIfAbsent(muscleGroup, () => []).add(movement);
      }
    }
    return grouped;
  }

  List<Movement> _balanceMuscleGroups(
    List<Movement> selectedMovements,
    Map<MuscleGroup, List<Movement>> movementsByMuscleGroup,
    int targetNumMovements,
  ) {
    // Count muscle group frequency in selected movements
    final muscleGroupCount = <MuscleGroup, int>{};
    for (final movement in selectedMovements) {
      for (final muscleGroup in movement.muscleGroups) {
        muscleGroupCount[muscleGroup] =
            (muscleGroupCount[muscleGroup] ?? 0) + 1;
      }
    }

    // Find muscle groups that are overrepresented
    final overrepresentedGroups = muscleGroupCount.entries
        .where((entry) => entry.value > (targetNumMovements / 3))
        .map((entry) => entry.key)
        .toList();

    // Find muscle groups that are underrepresented
    final underrepresentedGroups = movementsByMuscleGroup.keys
        .where((group) => !muscleGroupCount.containsKey(group))
        .toList();

    // Replace movements to balance muscle groups
    final balancedMovements = List<Movement>.from(selectedMovements);
    for (final overGroup in overrepresentedGroups) {
      if (underrepresentedGroups.isEmpty) break;

      // Find a movement to replace
      final movementToReplace = balancedMovements.firstWhere(
        (m) => m.muscleGroups.contains(overGroup),
        orElse: () => balancedMovements.first,
      );

      // Find a replacement movement
      final replacementGroup = underrepresentedGroups.removeAt(0);
      final replacementMovement =
          movementsByMuscleGroup[replacementGroup]?.first;

      if (replacementMovement != null) {
        final index = balancedMovements.indexOf(movementToReplace);
        balancedMovements[index] = replacementMovement;
      }
    }

    return balancedMovements;
  }

  List<WorkoutMovement> _createWorkoutMovements(
    List<Movement> selectedMovements, {
    required WorkoutFormat format,
    required IntensityLevel intensity,
  }) {
    return selectedMovements.map((movement) {
      // Calculate base reps based on movement type and intensity
      final baseReps = _calculateBaseReps(movement, intensity);

      // Calculate time in seconds for timed movements
      final timeInSeconds = _calculateTimeInSeconds(
        movement,
        format,
        intensity,
      );

      // Calculate weight if applicable
      final weight = _calculateWeight(movement, intensity);

      // Get appropriate scaling option
      final scalingOption = _getScalingOption(movement, intensity);

      return WorkoutMovement(
        movementId: movement.id,
        reps: baseReps,
        weight: weight,
        scalingOption: scalingOption,
        timeInSeconds: timeInSeconds,
      );
    }).toList();
  }

  int _calculateBaseReps(Movement movement, IntensityLevel intensity) {
    // Base reps vary by movement category and intensity
    if (movement.categories.contains(MovementCategory.compoundLift)) {
      switch (intensity) {
        case IntensityLevel.high:
          return 5; // Lower reps for high intensity compound movements
        case IntensityLevel.medium:
          return 8; // Moderate reps for medium intensity
        case IntensityLevel.low:
          return 12; // Higher reps for low intensity
      }
    } else if (movement.categories.contains(MovementCategory.cardio)) {
      switch (intensity) {
        case IntensityLevel.high:
          return 20; // More reps for high intensity cardio
        case IntensityLevel.medium:
          return 15; // Moderate reps for medium intensity
        case IntensityLevel.low:
          return 10; // Fewer reps for low intensity
      }
    } else {
      // For bodyweight, accessory, and other movements
      switch (intensity) {
        case IntensityLevel.high:
          return 15; // More reps for high intensity
        case IntensityLevel.medium:
          return 12; // Moderate reps for medium intensity
        case IntensityLevel.low:
          return 10; // Fewer reps for low intensity
      }
    }
  }

  int? _calculateTimeInSeconds(
    Movement movement,
    WorkoutFormat format,
    IntensityLevel intensity,
  ) {
    // Only calculate time for specific formats
    if (format == WorkoutFormat.tabata) {
      return 20; // 20 seconds work in Tabata
    } else if (format == WorkoutFormat.emom) {
      // EMOM typically has 30-60 seconds per movement
      switch (intensity) {
        case IntensityLevel.high:
          return 45;
        case IntensityLevel.medium:
          return 40;
        case IntensityLevel.low:
          return 30;
      }
    } else if (format == WorkoutFormat.forTime) {
      // ForTime typically has 30-90 seconds per movement
      switch (intensity) {
        case IntensityLevel.high:
          return 60;
        case IntensityLevel.medium:
          return 45;
        case IntensityLevel.low:
          return 30;
      }
    }
    return null; // No time component for other formats
  }

  double? _calculateWeight(Movement movement, IntensityLevel intensity) {
    // Only calculate weight for movements that use equipment
    if (movement.requiredEquipment.contains(EquipmentType.barbell) ||
        movement.requiredEquipment.contains(EquipmentType.dumbbell) ||
        movement.requiredEquipment.contains(EquipmentType.kettlebell)) {
      // TODO: Implement weight calculation based on user's max weights
      // For now, return null to indicate weight should be determined by user
      return null;
    }
    return null;
  }

  String? _getScalingOption(Movement movement, IntensityLevel intensity) {
    // Only provide scaling options for high intensity workouts
    if (intensity == IntensityLevel.high &&
        movement.scalingOptions.isNotEmpty) {
      // Return the first scaling option as default
      return movement.scalingOptions.values.first;
    }
    return null;
  }

  String _generateWorkoutName(WorkoutFormat format, IntensityLevel intensity) {
    final formatName = format.toString().split('.').last;
    final intensityName = intensity.toString().split('.').last;

    // Add descriptive prefixes based on intensity
    final intensityPrefix = switch (intensity) {
      IntensityLevel.high => 'Intense',
      IntensityLevel.medium => 'Balanced',
      IntensityLevel.low => 'Recovery',
    };

    // Add format-specific suffixes
    final formatSuffix = switch (format) {
      WorkoutFormat.emom => 'Challenge',
      WorkoutFormat.amrap => 'Grinder',
      WorkoutFormat.tabata => 'Blast',
      WorkoutFormat.forTime => 'Workout',
      WorkoutFormat.forReps => 'Strength',
      WorkoutFormat.roundsForTime => 'Circuit',
      WorkoutFormat.deathBy => 'Progression',
      WorkoutFormat.chipper => 'Combo',
      WorkoutFormat.ladder => 'Pyramid',
      WorkoutFormat.partner => 'Team',
    };

    return '$intensityPrefix $formatName $formatSuffix';
  }

  String _generateWorkoutDescription(
    WorkoutFormat format,
    IntensityLevel intensity,
    List<WorkoutMovement> movements,
  ) {
    final formatDescription = _getFormatDescription(format);
    final intensityDescription = _getIntensityDescription(intensity);
    final movementDescription = _getMovementDescription(movements);

    return '''
$intensityDescription workout in $formatDescription format.

$movementDescription

Focus on maintaining proper form throughout the workout. Scale movements as needed to maintain intensity and safety.
''';
  }

  String _getFormatDescription(WorkoutFormat format) {
    return switch (format) {
      WorkoutFormat.emom => 'Every Minute On the Minute (EMOM)',
      WorkoutFormat.amrap => 'As Many Rounds As Possible (AMRAP)',
      WorkoutFormat.tabata => 'Tabata (20s work / 10s rest)',
      WorkoutFormat.forTime => 'For Time',
      WorkoutFormat.forReps => 'For Reps',
      WorkoutFormat.roundsForTime => 'Rounds For Time',
      WorkoutFormat.deathBy => 'Death By (increasing reps)',
      WorkoutFormat.chipper => 'Chipper (complete all movements)',
      WorkoutFormat.ladder => 'Ladder (increasing/decreasing reps)',
      WorkoutFormat.partner => 'Partner Workout',
    };
  }

  String _getIntensityDescription(IntensityLevel intensity) {
    return switch (intensity) {
      IntensityLevel.high => 'High-intensity',
      IntensityLevel.medium => 'Moderate-intensity',
      IntensityLevel.low => 'Low-intensity',
    };
  }

  String _getMovementDescription(List<WorkoutMovement> movements) {
    if (movements.isEmpty) return 'No movements specified.';

    final movementDescriptions = movements
        .map((movement) {
          final reps = movement.reps;
          final time = movement.timeInSeconds;
          final weight = movement.weight;
          final scaling = movement.scalingOption;

          final repsStr = reps > 0 ? '$reps reps' : '';
          final timeStr = time != null ? '$time seconds' : '';
          final weightStr = weight != null ? '${weight}kg' : '';
          final scalingStr = scaling != null ? '($scaling)' : '';

          final parts = [
            repsStr,
            timeStr,
            weightStr,
            scalingStr,
          ].where((s) => s.isNotEmpty).join(' ');

          return '• $parts';
        })
        .join('\n');

    return 'Movements:\n$movementDescriptions';
  }

  int? _calculateRounds(
    WorkoutFormat format,
    IntensityLevel intensity,
    int targetDuration,
  ) {
    switch (format) {
      case WorkoutFormat.emom:
        return null; // EMOM doesn't use rounds
      case WorkoutFormat.amrap:
        return 1; // AMRAP is always 1 round
      case WorkoutFormat.tabata:
        return 8; // Tabata is always 8 rounds
      case WorkoutFormat.forTime:
        return null; // ForTime doesn't use rounds
      case WorkoutFormat.forReps:
        return null; // ForReps doesn't use rounds
      case WorkoutFormat.roundsForTime:
        // Calculate rounds based on duration and intensity
        return switch (intensity) {
          IntensityLevel.high =>
            (targetDuration / 5).ceil(), // 5 minutes per round
          IntensityLevel.medium =>
            (targetDuration / 7).ceil(), // 7 minutes per round
          IntensityLevel.low =>
            (targetDuration / 10).ceil(), // 10 minutes per round
        };
      case WorkoutFormat.deathBy:
        return null; // Death By doesn't use rounds
      case WorkoutFormat.chipper:
        return 1; // Chipper is always 1 round
      case WorkoutFormat.ladder:
        // Calculate ladder rounds based on intensity
        return switch (intensity) {
          IntensityLevel.high => 10, // 10 rounds for high intensity
          IntensityLevel.medium => 8, // 8 rounds for medium intensity
          IntensityLevel.low => 6, // 6 rounds for low intensity
        };
      case WorkoutFormat.partner:
        // Calculate partner workout rounds based on duration
        return (targetDuration / 15).ceil(); // 15 minutes per round
    }
  }

  int? _calculateTimeCap(WorkoutFormat format, int targetDuration) {
    switch (format) {
      case WorkoutFormat.emom:
        return targetDuration; // EMOM uses total duration
      case WorkoutFormat.amrap:
        return targetDuration; // AMRAP uses total duration
      case WorkoutFormat.tabata:
        return 4; // Tabata is always 4 minutes
      case WorkoutFormat.forTime:
        return targetDuration; // ForTime uses total duration
      case WorkoutFormat.forReps:
        return targetDuration; // ForReps uses total duration
      case WorkoutFormat.roundsForTime:
        return targetDuration; // Rounds For Time uses total duration
      case WorkoutFormat.deathBy:
        return null; // Death By doesn't use time cap
      case WorkoutFormat.chipper:
        return targetDuration; // Chipper uses total duration
      case WorkoutFormat.ladder:
        return targetDuration; // Ladder uses total duration
      case WorkoutFormat.partner:
        return targetDuration; // Partner workout uses total duration
    }
  }

  Map<String, dynamic>? _getFormatSpecificSettings(WorkoutFormat format) {
    switch (format) {
      case WorkoutFormat.emom:
        return {'intervalMinutes': 1, 'restBetweenMovements': 0};
      case WorkoutFormat.amrap:
        return {'restBetweenRounds': 0, 'allowMovementSubstitution': true};
      case WorkoutFormat.tabata:
        return {'workSeconds': 20, 'restSeconds': 10, 'rounds': 8};
      case WorkoutFormat.forTime:
        return {'allowMovementSubstitution': true, 'allowRest': true};
      case WorkoutFormat.forReps:
        return {'allowMovementSubstitution': true, 'focusOnForm': true};
      case WorkoutFormat.roundsForTime:
        return {
          'restBetweenRounds': 60, // 1 minute rest between rounds
          'allowMovementSubstitution': true,
        };
      case WorkoutFormat.deathBy:
        return {'startingReps': 1, 'repIncrement': 1, 'maxRounds': 10};
      case WorkoutFormat.chipper:
        return {'allowMovementSubstitution': true, 'allowRest': true};
      case WorkoutFormat.ladder:
        return {
          'startingReps': 1,
          'repIncrement': 1,
          'restBetweenRounds': 30, // 30 seconds rest between rounds
        };
      case WorkoutFormat.partner:
        return {'partnerRest': true, 'allowMovementSubstitution': true};
    }
  }
}
