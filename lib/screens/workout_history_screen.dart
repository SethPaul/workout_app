import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:intl/intl.dart';

class WorkoutHistoryScreen extends StatefulWidget {
  final WorkoutService workoutService;

  const WorkoutHistoryScreen({
    super.key,
    required this.workoutService,
  });

  @override
  State<WorkoutHistoryScreen> createState() => _WorkoutHistoryScreenState();
}

class _WorkoutHistoryScreenState extends State<WorkoutHistoryScreen> {
  List<Workout> _completedWorkouts = [];
  bool _isLoading = true;
  String? _error;
  String _selectedFilter = 'All';
  String _selectedSort = 'Newest';

  @override
  void initState() {
    super.initState();
    _loadWorkoutHistory();
  }

  Future<void> _loadWorkoutHistory() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final workouts = await widget.workoutService.getCompletedWorkouts();
      setState(() {
        _completedWorkouts = workouts;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Workout> _getFilteredAndSortedWorkouts() {
    var filteredWorkouts = _completedWorkouts;

    // Apply filter
    if (_selectedFilter != 'All') {
      filteredWorkouts = filteredWorkouts
          .where((workout) => workout.format.toString() == _selectedFilter)
          .toList();
    }

    // Apply sort
    switch (_selectedSort) {
      case 'Newest':
        filteredWorkouts
            .sort((a, b) => b.completedAt!.compareTo(a.completedAt!));
        break;
      case 'Oldest':
        filteredWorkouts
            .sort((a, b) => a.completedAt!.compareTo(b.completedAt!));
        break;
      case 'Duration':
        filteredWorkouts.sort((a, b) => b.duration.compareTo(a.duration));
        break;
    }

    return filteredWorkouts;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workout History'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: _buildBody(),
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
              'Error loading workout history',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadWorkoutHistory,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final filteredWorkouts = _getFilteredAndSortedWorkouts();

    if (filteredWorkouts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.fitness_center,
              size: 64,
              color: Colors.grey,
            ),
            const SizedBox(height: 16),
            Text(
              'No completed workouts yet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Complete a workout to see it here',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: filteredWorkouts.length,
      itemBuilder: (context, index) {
        final workout = filteredWorkouts[index];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: ListTile(
            title: Text(workout.name),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Completed: ${DateFormat('MMM d, y').format(workout.completedAt!)}',
                ),
                Text(
                  'Duration: ${workout.duration} minutes',
                ),
                Text(
                  'Format: ${workout.format.toString().split('.').last}',
                ),
              ],
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: Navigate to workout details
            },
          ),
        );
      },
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Filter & Sort'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Filter by Format'),
            DropdownButton<String>(
              value: _selectedFilter,
              items: [
                'All',
                ...WorkoutFormat.values
                    .map((f) => f.toString().split('.').last),
              ].map((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Text(value),
                );
              }).toList(),
              onChanged: (String? newValue) {
                if (newValue != null) {
                  setState(() {
                    _selectedFilter = newValue;
                  });
                  Navigator.pop(context);
                }
              },
            ),
            const SizedBox(height: 16),
            const Text('Sort by'),
            DropdownButton<String>(
              value: _selectedSort,
              items: ['Newest', 'Oldest', 'Duration'].map((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Text(value),
                );
              }).toList(),
              onChanged: (String? newValue) {
                if (newValue != null) {
                  setState(() {
                    _selectedSort = newValue;
                  });
                  Navigator.pop(context);
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
