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
import 'package:workout_app/services/default_workout_service.dart';
import 'package:workout_app/services/movement_data_service.dart';
import 'package:workout_app/data/database/database_helper.dart';
import 'package:workout_app/screens/onboarding_screen.dart';
import 'package:logger/logger.dart';
import 'package:mcp_toolkit/mcp_toolkit.dart';
import 'dart:async';

void main() async {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // Initialize MCP Toolkit for AI-powered debugging and development
      MCPToolkitBinding.instance
        ..initialize() // Initializes the Toolkit
        ..initializeFlutterToolkit(); // Adds Flutter related methods to the MCP server

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

        // Initialize movement data service
        logger.i('Initializing movement data service...');
        final movementDataService = MovementDataService(
          repository: movementRepository,
        );

        // Initialize movement library from JSON
        logger.i('Loading movement library...');
        await movementDataService.initializeMovementLibrary();

        // Load movements
        logger.i('Loading movements...');
        final availableMovements = await movementRepository.getAllMovements();
        logger.i('Loaded ${availableMovements.length} movements');

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

        // Create default workout service
        logger.i('Creating default workout service...');
        final defaultWorkoutService = DefaultWorkoutService(
          templateService: workoutTemplateService,
        );

        // Initialize user progress
        logger.i('Initializing user progress...');
        await userProgressService.initializeUserProgress();

        logger.i('App initialization complete!');

        runApp(
          WorkoutApp(
            workoutService: workoutService,
            userProgressService: userProgressService,
            defaultWorkoutService: defaultWorkoutService,
          ),
        );
      } catch (e, stackTrace) {
        final logger = Logger();
        logger.e('Failed to initialize app', error: e, stackTrace: stackTrace);
        runApp(
          const MaterialApp(
            home: Scaffold(
              body: Center(
                child: Text('Failed to initialize app. Please restart.'),
              ),
            ),
          ),
        );
      }
    },
    (error, stack) {
      // Critical for MCP error capturing - ensures errors are captured and available to MCP server
      MCPToolkitBinding.instance.handleZoneError(error, stack);
    },
  );
}

class WorkoutApp extends StatelessWidget {
  final WorkoutService workoutService;
  final UserProgressService userProgressService;
  final DefaultWorkoutService defaultWorkoutService;

  const WorkoutApp({
    super.key,
    required this.workoutService,
    required this.userProgressService,
    required this.defaultWorkoutService,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Workout App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: AppInitializer(
        workoutService: workoutService,
        userProgressService: userProgressService,
        defaultWorkoutService: defaultWorkoutService,
      ),
    );
  }
}

class AppInitializer extends StatefulWidget {
  final WorkoutService workoutService;
  final UserProgressService userProgressService;
  final DefaultWorkoutService defaultWorkoutService;

  const AppInitializer({
    super.key,
    required this.workoutService,
    required this.userProgressService,
    required this.defaultWorkoutService,
  });

  @override
  State<AppInitializer> createState() => _AppInitializerState();
}

class _AppInitializerState extends State<AppInitializer> {
  bool _isLoading = true;
  bool _showOnboarding = false;

  @override
  void initState() {
    super.initState();
    _checkFirstRun();
  }

  Future<void> _checkFirstRun() async {
    try {
      final userProgress = await widget.userProgressService
          .getCurrentUserProgress();
      setState(() {
        _showOnboarding = userProgress?.isFirstRun ?? true;
        _isLoading = false;
      });
    } catch (e) {
      // If there's an error, assume it's first run
      setState(() {
        _showOnboarding = true;
        _isLoading = false;
      });
    }
  }

  void _completeOnboarding() {
    setState(() {
      _showOnboarding = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_showOnboarding) {
      return OnboardingScreen(
        defaultWorkoutService: widget.defaultWorkoutService,
        userProgressService: widget.userProgressService,
        onComplete: _completeOnboarding,
      );
    }

    return HomeScreen(
      workoutService: widget.workoutService,
      userProgressService: widget.userProgressService,
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
  final ValueNotifier<int> _refreshTrigger = ValueNotifier<int>(0);

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      WorkoutListScreen(
        workoutService: widget.workoutService,
        refreshTrigger: _refreshTrigger,
      ),
      WorkoutTemplatesScreen(
        templateService: widget.workoutService.templateService,
        workoutService: widget.workoutService,
        onWorkoutGenerated: _onWorkoutGenerated,
      ),
      WorkoutHistoryScreen(workoutService: widget.workoutService),
    ];
  }

  void _onTabSelected(int index) {
    setState(() {
      _currentIndex = index;
    });

    // Refresh workout list when returning to workouts tab
    if (index == 0) {
      _refreshTrigger.value++;
    }
  }

  void _onWorkoutGenerated() {
    // Switch to workouts tab (index 0) and refresh the list
    setState(() {
      _currentIndex = 0;
    });
    _refreshTrigger.value++;
  }

  @override
  void dispose() {
    _refreshTrigger.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabSelected,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.fitness_center),
            label: 'Workouts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.library_books),
            label: 'Templates',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
        ],
      ),
    );
  }
}
