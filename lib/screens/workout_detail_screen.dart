import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/screens/workout_execution_screen.dart';

class WorkoutDetailScreen extends StatefulWidget {
  final WorkoutService workoutService;
  final String workoutId;

  const WorkoutDetailScreen({
    super.key,
    required this.workoutService,
    required this.workoutId,
  });

  @override
  State<WorkoutDetailScreen> createState() => _WorkoutDetailScreenState();
}

class _WorkoutDetailScreenState extends State<WorkoutDetailScreen> {
  Workout? _workout;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadWorkout();
  }

  Future<void> _loadWorkout() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final workout =
          await widget.workoutService.getWorkoutById(widget.workoutId);
      setState(() {
        _workout = workout;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _startWorkout() async {
    if (_workout == null) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => WorkoutExecutionScreen(
          workoutService: widget.workoutService,
          workoutId: _workout!.id,
        ),
      ),
    );
  }

  Future<void> _deleteWorkout() async {
    if (_workout == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Workout'),
        content: const Text('Are you sure you want to delete this workout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await widget.workoutService.deleteWorkout(_workout!.id);
        if (mounted) {
          Navigator.pop(context);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error deleting workout: $e'),
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workout Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: _deleteWorkout,
          ),
        ],
      ),
      body: _buildBody(),
      floatingActionButton: _workout != null
          ? FloatingActionButton.extended(
              onPressed: _startWorkout,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Start Workout'),
            )
          : null,
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Error loading workout',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadWorkout,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_workout == null) {
      return const Center(
        child: Text('Workout not found'),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _workout!.name,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            _workout!.description ?? 'No description available',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          _buildInfoSection(
            'Format',
            _workout!.format.toString().split('.').last,
            Icons.timer,
          ),
          _buildInfoSection(
            'Intensity',
            _workout!.intensity.toString().split('.').last,
            Icons.fitness_center,
          ),
          if (_workout!.rounds != null)
            _buildInfoSection(
              'Rounds',
              '${_workout!.rounds}',
              Icons.repeat,
            ),
          if (_workout!.timeCapInMinutes != null)
            _buildInfoSection(
              'Time Cap',
              '${_workout!.timeCapInMinutes} minutes',
              Icons.access_time,
            ),
          const SizedBox(height: 24),
          Text(
            'Movements',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _workout!.movements.length,
            itemBuilder: (context, index) {
              final movement = _workout!.movements[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text('Movement ${index + 1}'),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (movement.reps > 0) Text('Reps: ${movement.reps}'),
                      if (movement.timeInSeconds != null)
                        Text('Time: ${movement.timeInSeconds}s'),
                      if (movement.weight != null)
                        Text('Weight: ${movement.weight}kg'),
                      if (movement.scalingOption != null)
                        Text('Scaling: ${movement.scalingOption}'),
                    ],
                  ),
                ),
              );
            },
          ),
          if (_workout!.notes != null) ...[
            const SizedBox(height: 24),
            Text(
              'Notes',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _workout!.notes!,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildInfoSection(String title, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
