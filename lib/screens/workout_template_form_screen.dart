import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout_template.dart';
import 'package:workout_app/data/models/movement.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_template_service.dart';

class WorkoutTemplateFormScreen extends StatefulWidget {
  final WorkoutTemplateService templateService;
  final WorkoutTemplate? template;

  const WorkoutTemplateFormScreen({
    super.key,
    required this.templateService,
    this.template,
  });

  @override
  State<WorkoutTemplateFormScreen> createState() =>
      _WorkoutTemplateFormScreenState();
}

class _WorkoutTemplateFormScreenState extends State<WorkoutTemplateFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _descriptionController;
  late WorkoutFormat _format;
  late IntensityLevel _intensity;
  late int _targetDuration;
  List<MovementCategory>? _preferredCategories;
  List<EquipmentType>? _availableEquipment;
  bool? _isMainMovementOnly;
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.template?.name);
    _descriptionController = TextEditingController(
      text: widget.template?.description,
    );
    _format = widget.template?.format ?? WorkoutFormat.emom;
    _intensity = widget.template?.intensity ?? IntensityLevel.medium;
    _targetDuration = widget.template?.targetDuration ?? 20;
    _preferredCategories = widget.template?.preferredCategories;
    _availableEquipment = widget.template?.availableEquipment;
    _isMainMovementOnly = widget.template?.isMainMovementOnly;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _saveTemplate() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (widget.template == null) {
        await widget.templateService.createTemplate(
          name: _nameController.text,
          description: _descriptionController.text,
          format: _format,
          intensity: _intensity,
          targetDuration: _targetDuration,
          preferredCategories: _preferredCategories,
          availableEquipment: _availableEquipment,
          isMainMovementOnly: _isMainMovementOnly,
        );
      } else {
        final updatedTemplate = widget.template!.copyWith(
          name: _nameController.text,
          description: _descriptionController.text,
          format: _format,
          intensity: _intensity,
          targetDuration: _targetDuration,
          preferredCategories: _preferredCategories,
          availableEquipment: _availableEquipment,
          isMainMovementOnly: _isMainMovementOnly,
        );
        await widget.templateService.updateTemplate(updatedTemplate);
      }

      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.template == null ? 'Create Template' : 'Edit Template',
        ),
        actions: [
          if (_isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            IconButton(icon: const Icon(Icons.save), onPressed: _saveTemplate),
        ],
      ),
      body: _error != null
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Error saving template',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(_error!, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _error = null;
                        _isLoading = false;
                      });
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      hintText: 'Enter template name',
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter a name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _descriptionController,
                    decoration: const InputDecoration(
                      labelText: 'Description',
                      hintText: 'Enter template description',
                    ),
                    maxLines: 3,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter a description';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<WorkoutFormat>(
                    value: _format,
                    decoration: const InputDecoration(labelText: 'Format'),
                    items: WorkoutFormat.values.map((format) {
                      return DropdownMenuItem(
                        value: format,
                        child: Text(format.toString().split('.').last),
                      );
                    }).toList(),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          _format = value;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<IntensityLevel>(
                    value: _intensity,
                    decoration: const InputDecoration(labelText: 'Intensity'),
                    items: IntensityLevel.values.map((intensity) {
                      return DropdownMenuItem(
                        value: intensity,
                        child: Text(intensity.toString().split('.').last),
                      );
                    }).toList(),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          _intensity = value;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: _targetDuration.toString(),
                    decoration: const InputDecoration(
                      labelText: 'Duration (minutes)',
                      hintText: 'Enter target duration',
                    ),
                    keyboardType: TextInputType.number,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter a duration';
                      }
                      final duration = int.tryParse(value);
                      if (duration == null || duration <= 0) {
                        return 'Please enter a valid duration';
                      }
                      return null;
                    },
                    onChanged: (value) {
                      final duration = int.tryParse(value);
                      if (duration != null) {
                        setState(() {
                          _targetDuration = duration;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  // TODO: Add movement category selection
                  // TODO: Add equipment selection
                  // TODO: Add main movement toggle
                ],
              ),
            ),
    );
  }
}
