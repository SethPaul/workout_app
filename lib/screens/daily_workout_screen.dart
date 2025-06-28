import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/services/workout_pool_service.dart';
import 'package:workout_app/services/movement_data_service.dart';
import 'package:logger/logger.dart';

class DailyWorkoutScreen extends StatefulWidget {
  final WorkoutPoolService workoutPoolService;
  final MovementDataService movementDataService;

  const DailyWorkoutScreen({
    super.key,
    required this.workoutPoolService,
    required this.movementDataService,
  });

  @override
  State<DailyWorkoutScreen> createState() => _DailyWorkoutScreenState();
}

class _DailyWorkoutScreenState extends State<DailyWorkoutScreen> {
  final Logger _logger = Logger();
  
  Workout? _todaysWorkout;
  bool _isLoading = false;
  String? _errorMessage;
  List<Movement> _allMovements = [];

  @override
  void initState() {
    super.initState();
    _loadMovements();
    _checkForExistingWorkout();
  }

  Future<void> _loadMovements() async {
    try {
      _allMovements = await widget.movementDataService.getAllMovements();
    } catch (e) {
      _logger.w('Error loading movements: $e');
    }
  }

  Future<void> _checkForExistingWorkout() async {
    // This could check if user already has a workout for today
    // For now, we'll start fresh each time
  }

  Future<void> _getTodaysWorkout() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final workout = await widget.workoutPoolService.getTodaysWorkout();
      
      setState(() {
        _todaysWorkout = workout;
        _isLoading = false;
      });

      if (workout == null) {
        setState(() {
          _errorMessage = 'No workouts available today. Try adjusting your equipment or cadence settings.';
        });
      }
    } catch (e) {
      _logger.e('Error getting today\'s workout: $e');
      setState(() {
        _errorMessage = 'Failed to get workout. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _bumpWorkout() async {
    setState(() {
      _todaysWorkout = null;
      _errorMessage = null;
    });
    
    await _getTodaysWorkout();
  }

  void _startWorkout() {
    if (_todaysWorkout != null) {
      // For now, show a simple message since we need to implement workout saving
      // This will be properly implemented in the next iteration
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Workout execution will be implemented in the next phase!'),
          duration: Duration(seconds: 2),
        ),
      );
      
      // TODO: Save workout to database and navigate to execution screen
      // final workoutId = await saveWorkout(_todaysWorkout!);
      // Navigator.push(
      //   context,
      //   MaterialPageRoute(
      //     builder: (context) => WorkoutExecutionScreen(
      //       workoutService: widget.workoutService,
      //       workoutId: workoutId,
      //     ),
      //   ),
      // ).then((_) {
      //   _checkForExistingWorkout();
      // });
    }
  }

  void _viewHistory() {
    // For now, show a simple message since we need to implement proper service integration
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Workout history will be implemented in Phase 2!'),
        duration: Duration(seconds: 2),
      ),
    );
    
    // TODO: Navigate to workout history screen
    // Navigator.push(
    //   context,
    //   MaterialPageRoute(
    //     builder: (context) => WorkoutHistoryScreen(
    //       workoutService: widget.workoutService,
    //     ),
    //   ),
    // );
  }

  void _openSettings() {
    // TODO: Implement settings screen with movement library and equipment management
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Settings screen coming soon in Phase 2!'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Daily Workout'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            onPressed: _viewHistory,
            icon: const Icon(Icons.history),
            tooltip: 'Workout History',
          ),
          IconButton(
            onPressed: _openSettings,
            icon: const Icon(Icons.settings),
            tooltip: 'Settings',
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(),
            const SizedBox(height: 24),
            if (_isLoading) _buildLoadingState(),
            if (_errorMessage != null) _buildErrorState(),
            if (_todaysWorkout != null) _buildWorkoutCard(),
            if (_todaysWorkout == null && !_isLoading && _errorMessage == null)
              _buildGetWorkoutButton(),
            const Spacer(),
            _buildInfoCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final now = DateTime.now();
    final dayName = _getDayName(now.weekday);
    final monthName = _getMonthName(now.month);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$dayName, ${monthName} ${now.day}',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Ready for today\'s workout?',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingState() {
    return const Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Finding your perfect workout...'),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _getTodaysWorkout,
              child: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkoutCard() {
    final workout = _todaysWorkout!;
    
    return Expanded(
      child: Card(
        elevation: 4,
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    _getWorkoutIcon(workout.format),
                    size: 32,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      workout.name,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (workout.description != null) ...[
                Text(
                  workout.description!,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              _buildWorkoutDetails(workout),
              const SizedBox(height: 24),
              _buildMovementsList(workout),
              const Spacer(),
              _buildWorkoutActions(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWorkoutDetails(Workout workout) {
    return Row(
      children: [
        _buildDetailChip(
          icon: Icons.schedule,
          label: '${workout.duration} min',
        ),
        const SizedBox(width: 8),
        _buildDetailChip(
          icon: Icons.trending_up,
          label: workout.intensity.toString().split('.').last.toUpperCase(),
        ),
        const SizedBox(width: 8),
        _buildDetailChip(
          icon: Icons.fitness_center,
          label: workout.format.toString().split('.').last.toUpperCase(),
        ),
      ],
    );
  }

  Widget _buildDetailChip({
    required IconData icon,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMovementsList(Workout workout) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Movements:',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        ...workout.movements.map((movement) {
          final movementData = _allMovements
              .where((m) => m.id == movement.movementId)
              .firstOrNull;
          
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2.0),
            child: Row(
              children: [
                const Icon(Icons.fiber_manual_record, size: 8),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${movement.reps} ${movementData?.name ?? movement.movementId}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildWorkoutActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton.icon(
          onPressed: _startWorkout,
          icon: const Icon(Icons.play_arrow),
          label: const Text('Start Workout'),
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 16),
            textStyle: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _bumpWorkout,
          icon: const Icon(Icons.refresh),
          label: const Text('Bump Workout'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildGetWorkoutButton() {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.fitness_center,
              size: 80,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 24),
            Text(
              'Ready to get started?',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(
              'Get a personalized workout from your pool\nbased on your cadence and equipment.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _getTodaysWorkout,
              icon: const Icon(Icons.today),
              label: const Text('Get Today\'s Workout'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 16,
                ),
                textStyle: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard() {
    return Card(
      color: Theme.of(context).colorScheme.surfaceVariant,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.info_outline,
                  size: 20,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 8),
                Text(
                  'How it works',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Workouts are selected from your pool based on movement cadences (e.g., deadlifts every 7 days) and available equipment. Tap settings to manage your movement library and equipment.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getWorkoutIcon(WorkoutFormat format) {
    switch (format) {
      case WorkoutFormat.emom:
        return Icons.timer;
      case WorkoutFormat.amrap:
        return Icons.all_inclusive;
      case WorkoutFormat.forTime:
        return Icons.speed;
      case WorkoutFormat.forReps:
        return Icons.fitness_center;
      case WorkoutFormat.tabata:
        return Icons.flash_on;
      default:
        return Icons.fitness_center;
    }
  }

  String _getDayName(int weekday) {
    const days = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
      'Friday', 'Saturday', 'Sunday'
    ];
    return days[weekday - 1];
  }

  String _getMonthName(int month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }
}