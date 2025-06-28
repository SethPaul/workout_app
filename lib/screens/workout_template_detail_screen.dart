import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_template_service.dart';
import 'package:workout_app/screens/workout_template_form_screen.dart';
import 'package:workout_app/screens/workout_detail_screen.dart';
import 'package:workout_app/services/workout_service.dart';

class WorkoutTemplateDetailScreen extends StatefulWidget {
  final String templateId;
  final WorkoutTemplateService templateService;
  final WorkoutService? workoutService;
  final VoidCallback? onWorkoutGenerated;

  const WorkoutTemplateDetailScreen({
    super.key,
    required this.templateId,
    required this.templateService,
    this.workoutService,
    this.onWorkoutGenerated,
  });

  @override
  State<WorkoutTemplateDetailScreen> createState() =>
      _WorkoutTemplateDetailScreenState();
}

class _WorkoutTemplateDetailScreenState
    extends State<WorkoutTemplateDetailScreen> {
  WorkoutTemplate? _template;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTemplate();
  }

  Future<void> _loadTemplate() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final template =
          await widget.templateService.getTemplateById(widget.templateId);
      setState(() {
        _template = template;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _generateWorkout() async {
    if (_template == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Generate the workout
      final workout = await widget.templateService.generateWorkoutFromTemplate(
        widget.templateId,
      );

      // Save the workout if we have the service
      String? workoutId;
      if (widget.workoutService != null) {
        workoutId = await widget.workoutService!.createWorkout(workout);
      }

      if (mounted) {
        // Navigate back to the home screen completely and show success
        Navigator.popUntil(context, (route) => route.isFirst);

        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
                'Workout generated and saved! Switching to your workout list...'),
            duration: const Duration(seconds: 2),
            action: SnackBarAction(
              label: 'View',
              onPressed: () {
                // This will be handled by the main app to switch to workouts tab
              },
            ),
          ),
        );

        // Notify the parent to switch to workouts tab
        // We'll do this by sending a custom notification
        _notifyWorkoutGenerated(context);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _editTemplate() async {
    if (_template == null) return;

    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => WorkoutTemplateFormScreen(
          templateService: widget.templateService,
          template: _template,
        ),
      ),
    );

    if (result == true) {
      _loadTemplate();
    }
  }

  void _notifyWorkoutGenerated(BuildContext context) {
    if (widget.onWorkoutGenerated != null) {
      Future.delayed(const Duration(milliseconds: 100), () {
        widget.onWorkoutGenerated!();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Template Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: _editTemplate,
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
              'Error loading template',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadTemplate,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_template == null) {
      return const Center(
        child: Text('Template not found'),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _template!.name,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            _template!.description,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          _buildInfoSection(
            'Format',
            _template!.format.toString().split('.').last,
            Icons.timer,
          ),
          _buildInfoSection(
            'Intensity',
            _template!.intensity.toString().split('.').last,
            Icons.fitness_center,
          ),
          _buildInfoSection(
            'Duration',
            '${_template!.targetDuration} minutes',
            Icons.access_time,
          ),
          if (_template!.preferredCategories != null &&
              _template!.preferredCategories!.isNotEmpty)
            _buildInfoSection(
              'Categories',
              _template!.preferredCategories!
                  .map((c) => c.toString().split('.').last)
                  .join(', '),
              Icons.category,
            ),
          if (_template!.availableEquipment != null &&
              _template!.availableEquipment!.isNotEmpty)
            _buildInfoSection(
              'Equipment',
              _template!.availableEquipment!
                  .map((e) => e.toString().split('.').last)
                  .join(', '),
              Icons.fitness_center,
            ),
          if (_template!.isMainMovementOnly != null)
            _buildInfoSection(
              'Movement Type',
              _template!.isMainMovementOnly!
                  ? 'Main Movements Only'
                  : 'All Movements',
              Icons.directions_run,
            ),
          if (_template!.timesUsed > 0)
            _buildInfoSection(
              'Usage',
              'Used ${_template!.timesUsed} times',
              Icons.history,
            ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _generateWorkout,
              child: const Text('Generate Workout'),
            ),
          ),
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
