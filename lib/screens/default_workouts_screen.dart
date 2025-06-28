import 'package:flutter/material.dart';
import 'package:workout_app/services/default_workout_service.dart';

class DefaultWorkoutsScreen extends StatefulWidget {
  final DefaultWorkoutService defaultWorkoutService;

  const DefaultWorkoutsScreen({super.key, required this.defaultWorkoutService});

  @override
  State<DefaultWorkoutsScreen> createState() => _DefaultWorkoutsScreenState();
}

class _DefaultWorkoutsScreenState extends State<DefaultWorkoutsScreen> {
  final Map<String, bool> _selectedWorkouts = {};
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final workoutsByCategory = widget.defaultWorkoutService
        .getDefaultWorkoutsByCategory();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Default Workouts'),
        actions: [
          if (_selectedWorkouts.values.any((selected) => selected))
            TextButton(
              onPressed: _isLoading ? null : _addSelectedWorkouts,
              child: _isLoading
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Add Selected'),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Choose from our collection of starter workouts',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'These professionally designed templates will help you get started on your fitness journey.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ...workoutsByCategory.entries.map((entry) {
              final category = entry.key;
              final workouts = entry.value;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      children: [
                        Text(
                          category,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () =>
                              _selectAllInCategory(category, workouts),
                          child: Text(
                            _areAllSelectedInCategory(category, workouts)
                                ? 'Unselect All'
                                : 'Select All',
                          ),
                        ),
                      ],
                    ),
                  ),
                  ...workouts.map((workout) => _buildWorkoutCard(workout)),
                  const SizedBox(height: 16),
                ],
              );
            }),
          ],
        ),
      ),
      floatingActionButton: _selectedWorkouts.values.any((selected) => selected)
          ? FloatingActionButton.extended(
              onPressed: _isLoading ? null : _addSelectedWorkouts,
              icon: _isLoading
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add),
              label: Text(
                'Add ${_selectedWorkouts.values.where((selected) => selected).length} Workouts',
              ),
            )
          : null,
    );
  }

  Widget _buildWorkoutCard(Map<String, dynamic> workout) {
    final workoutName = workout['name'] as String;
    final isSelected = _selectedWorkouts[workoutName] ?? false;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: CheckboxListTile(
        title: Row(
          children: [
            Text(
              workout['icon'] as String,
              style: const TextStyle(fontSize: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                workoutName,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(workout['description'] as String),
            const SizedBox(height: 8),
            Row(
              children: [
                Chip(
                  label: Text(
                    '${workout['targetDuration']} min',
                    style: const TextStyle(fontSize: 12),
                  ),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                const SizedBox(width: 8),
                Chip(
                  label: Text(
                    '${workout['intensity']}'.split('.').last.toUpperCase(),
                    style: const TextStyle(fontSize: 12),
                  ),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                const SizedBox(width: 8),
                Chip(
                  label: Text(
                    workout['category'] as String,
                    style: const TextStyle(fontSize: 12),
                  ),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ],
            ),
          ],
        ),
        value: isSelected,
        onChanged: (value) {
          setState(() {
            _selectedWorkouts[workoutName] = value ?? false;
          });
        },
      ),
    );
  }

  void _selectAllInCategory(
    String category,
    List<Map<String, dynamic>> workouts,
  ) {
    final areAllSelected = _areAllSelectedInCategory(category, workouts);
    setState(() {
      for (final workout in workouts) {
        final workoutName = workout['name'] as String;
        _selectedWorkouts[workoutName] = !areAllSelected;
      }
    });
  }

  bool _areAllSelectedInCategory(
    String category,
    List<Map<String, dynamic>> workouts,
  ) {
    return workouts.every((workout) {
      final workoutName = workout['name'] as String;
      return _selectedWorkouts[workoutName] ?? false;
    });
  }

  Future<void> _addSelectedWorkouts() async {
    final selectedNames = _selectedWorkouts.entries
        .where((entry) => entry.value)
        .map((entry) => entry.key)
        .toList();

    if (selectedNames.isEmpty) return;

    setState(() {
      _isLoading = true;
    });

    try {
      await widget.defaultWorkoutService.addSelectedDefaultWorkouts(
        selectedNames,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Added ${selectedNames.length} workout templates!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true); // Return true to indicate success
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error adding workouts: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }
}
