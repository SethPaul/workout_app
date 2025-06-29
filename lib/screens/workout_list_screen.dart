import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/screens/workout_detail_screen.dart';
import 'package:workout_app/screens/workout_templates_screen.dart';

class WorkoutListScreen extends StatefulWidget {
  final WorkoutService workoutService;
  final ValueNotifier<int>? refreshTrigger;

  const WorkoutListScreen({
    super.key,
    required this.workoutService,
    this.refreshTrigger,
  });

  @override
  State<WorkoutListScreen> createState() => _WorkoutListScreenState();
}

class _WorkoutListScreenState extends State<WorkoutListScreen> {
  List<Workout> _workouts = [];
  bool _isLoading = true;
  String? _error;
  WorkoutFormat? _selectedFormat;
  IntensityLevel? _selectedIntensity;

  @override
  void initState() {
    super.initState();
    _loadWorkouts();

    // Listen to refresh trigger
    widget.refreshTrigger?.addListener(_onRefreshTrigger);
  }

  @override
  void dispose() {
    widget.refreshTrigger?.removeListener(_onRefreshTrigger);
    super.dispose();
  }

  void _onRefreshTrigger() {
    _loadWorkouts();
  }

  Future<void> _loadWorkouts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      List<Workout> workouts;
      if (_selectedFormat != null) {
        workouts = await widget.workoutService.getWorkoutsByFormat(
          _selectedFormat!,
        );
      } else if (_selectedIntensity != null) {
        workouts = await widget.workoutService.getWorkoutsByIntensity(
          _selectedIntensity!,
        );
      } else {
        workouts = await widget.workoutService.getAllWorkouts();
      }
      setState(() {
        _workouts = workouts;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Filter Workouts'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<WorkoutFormat?>(
              value: _selectedFormat,
              decoration: const InputDecoration(labelText: 'Format'),
              items: [
                const DropdownMenuItem(value: null, child: Text('All Formats')),
                ...WorkoutFormat.values.map((format) {
                  return DropdownMenuItem(
                    value: format,
                    child: Text(format.toString().split('.').last),
                  );
                }),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedFormat = value;
                  _selectedIntensity = null;
                });
                Navigator.pop(context);
                _loadWorkouts();
              },
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<IntensityLevel?>(
              value: _selectedIntensity,
              decoration: const InputDecoration(labelText: 'Intensity'),
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('All Intensities'),
                ),
                ...IntensityLevel.values.map((intensity) {
                  return DropdownMenuItem(
                    value: intensity,
                    child: Text(intensity.toString().split('.').last),
                  );
                }),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedIntensity = value;
                  _selectedFormat = null;
                });
                Navigator.pop(context);
                _loadWorkouts();
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() {
                _selectedFormat = null;
                _selectedIntensity = null;
              });
              Navigator.pop(context);
              _loadWorkouts();
            },
            child: const Text('Clear Filters'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workouts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => WorkoutTemplatesScreen(
                templateService: widget.workoutService.templateService,
                workoutService: widget.workoutService,
              ),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
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
              'Error loading workouts',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(_error!, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadWorkouts,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_workouts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'No workouts yet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Generate a workout from a template',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => WorkoutTemplatesScreen(
                      templateService: widget.workoutService.templateService,
                      workoutService: widget.workoutService,
                    ),
                  ),
                );
              },
              child: const Text('Generate Workout'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadWorkouts,
      child: ListView.builder(
        itemCount: _workouts.length,
        itemBuilder: (context, index) {
          final workout = _workouts[index];
          return _WorkoutCard(
            workout: workout,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => WorkoutDetailScreen(
                    workoutService: widget.workoutService,
                    workoutId: workout.id,
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _WorkoutCard extends StatelessWidget {
  final Workout workout;
  final VoidCallback onTap;

  const _WorkoutCard({required this.workout, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(workout.name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                workout.description ?? 'No description available',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  _buildChip(
                    context,
                    workout.format.toString().split('.').last,
                    Icons.timer,
                  ),
                  _buildChip(
                    context,
                    workout.intensity.toString().split('.').last,
                    Icons.fitness_center,
                  ),
                  if (workout.movements.isNotEmpty)
                    _buildChip(
                      context,
                      '${workout.movements.length} movements',
                      Icons.format_list_numbered,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChip(BuildContext context, String label, IconData icon) {
    return Chip(
      label: Text(label),
      avatar: Icon(icon, size: 16),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}
