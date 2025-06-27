import 'package:flutter/material.dart';
import 'package:workout_app/data/repositories/movement_repository.dart';
import 'package:workout_app/data/repositories/workout_repository.dart';
import 'package:workout_app/data/repositories/workout_template_repository.dart';
import 'package:workout_app/data/repositories/user_progress_repository.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/screens/workout_list_screen.dart';
import 'package:workout_app/screens/workout_history_screen.dart';
import 'package:workout_app/screens/workout_templates_screen.dart';
import 'package:workout_app/services/workout_generator.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/services/user_progress_service.dart';
import 'package:workout_app/data/database/database_helper.dart';
import 'package:logger/logger.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    final logger = Logger();
    logger.i('Starting Workout App...');

    // Initialize database
    logger.i('Initializing database...');
    final databaseHelper = DatabaseHelper();
    await databaseHelper.database;

    // Create repositories
    logger.i('Creating repositories...');
    final movementRepository = SQLiteMovementRepository();
    final workoutRepository = SQLiteWorkoutRepository();
    final workoutTemplateRepository = SQLiteWorkoutTemplateRepository();
    final userProgressRepository = SQLiteUserProgressRepository();

    // Load movements
    logger.i('Loading movements...');
    final availableMovements = await movementRepository.getAllMovements();

    // Create services
    logger.i('Creating services...');
    final workoutGenerator = WorkoutGenerator(
      availableMovements: availableMovements,
    );

    final workoutTemplateService = WorkoutTemplateService(
      repository: workoutTemplateRepository,
      workoutGenerator: workoutGenerator,
    );

    final workoutService = WorkoutService(
      repository: workoutRepository,
      templateService: workoutTemplateService,
      databaseHelper: databaseHelper,
    );

    final userProgressService = UserProgressService(
      repository: userProgressRepository,
    );

    // Seed database with sample templates if empty
    logger.i('Checking for sample data...');
    await _seedSampleTemplates(workoutTemplateService);

    // Initialize user progress
    logger.i('Initializing user progress...');
    await userProgressService.initializeUserProgress();

    logger.i('App initialization complete!');

    runApp(WorkoutApp(
      workoutService: workoutService,
      userProgressService: userProgressService,
    ));
  } catch (e, stackTrace) {
    final logger = Logger();
    logger.e('Failed to initialize app', error: e, stackTrace: stackTrace);
    runApp(const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('Failed to initialize app. Please restart.'),
        ),
      ),
    ));
  }
}

Future<void> _seedSampleTemplates(
    WorkoutTemplateService templateService) async {
  final logger = Logger();

  try {
    final existingTemplates = await templateService.getAllTemplates();
    if (existingTemplates.isNotEmpty) {
      logger.i('Sample templates already exist, skipping seeding');
      return;
    }

    logger.i('Seeding sample workout templates...');

    final sampleTemplates = [
      {
        'name': 'Quick HIIT Cardio',
        'description': 'High-intensity interval training for busy schedules',
        'format': WorkoutFormat.tabata,
        'intensity': IntensityLevel.high,
        'targetDuration': 15,
        'preferredCategories': [
          MovementCategory.cardio,
          MovementCategory.bodyweight
        ],
      },
      {
        'name': 'Strength Builder',
        'description': 'Compound movements for building overall strength',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.medium,
        'targetDuration': 30,
        'preferredCategories': [MovementCategory.compoundLift],
        'isMainMovementOnly': true,
      },
      {
        'name': 'Endurance Challenge',
        'description': 'Long form workout to build stamina',
        'format': WorkoutFormat.amrap,
        'intensity': IntensityLevel.medium,
        'targetDuration': 20,
        'preferredCategories': [
          MovementCategory.cardio,
          MovementCategory.bodyweight
        ],
      },
      {
        'name': 'Power Hour',
        'description': 'High-intensity strength and conditioning',
        'format': WorkoutFormat.emom,
        'intensity': IntensityLevel.high,
        'targetDuration': 45,
        'preferredCategories': [
          MovementCategory.compoundLift,
          MovementCategory.cardio
        ],
      },
      {
        'name': 'Recovery Session',
        'description': 'Low-intensity movement for active recovery',
        'format': WorkoutFormat.forTime,
        'intensity': IntensityLevel.low,
        'targetDuration': 25,
        'preferredCategories': [
          MovementCategory.bodyweight,
          MovementCategory.accessory
        ],
      },
    ];

    for (final templateData in sampleTemplates) {
      await templateService.createTemplate(
        name: templateData['name'] as String,
        description: templateData['description'] as String,
        format: templateData['format'] as WorkoutFormat,
        intensity: templateData['intensity'] as IntensityLevel,
        targetDuration: templateData['targetDuration'] as int,
        preferredCategories:
            templateData['preferredCategories'] as List<MovementCategory>?,
        isMainMovementOnly: templateData['isMainMovementOnly'] as bool?,
      );
    }

    logger.i('Sample templates seeded successfully');
  } catch (e) {
    logger.e('Error seeding sample templates: $e');
    // Don't throw - let the app continue even if seeding fails
  }
}

class WorkoutApp extends StatelessWidget {
  final WorkoutService workoutService;
  final UserProgressService userProgressService;

  const WorkoutApp({
    super.key,
    required this.workoutService,
    required this.userProgressService,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Workout App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: HomeScreen(
        workoutService: workoutService,
        userProgressService: userProgressService,
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  final WorkoutService workoutService;
  final UserProgressService userProgressService;

  const HomeScreen({
    super.key,
    required this.workoutService,
    required this.userProgressService,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      WorkoutListScreen(workoutService: widget.workoutService),
      WorkoutTemplatesScreen(
        templateService: widget.workoutService.templateService,
        workoutService: widget.workoutService,
      ),
      WorkoutHistoryScreen(workoutService: widget.workoutService),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.fitness_center),
            label: 'Workouts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.library_books),
            label: 'Templates',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history),
            label: 'History',
          ),
        ],
      ),
    );
  }
}
