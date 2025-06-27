import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/movement/movement_bloc.dart';
import '../blocs/movement/movement_event.dart';
import '../blocs/movement/movement_state.dart';
import '../../data/models/movement.dart';

class MovementDetailPage extends StatelessWidget {
  final String movementId;

  const MovementDetailPage({
    super.key,
    required this.movementId,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MovementBloc, MovementState>(
      builder: (context, state) {
        if (state is MovementLoading) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        if (state is MovementError) {
          return Scaffold(
            body: Center(
              child: Text(state.message),
            ),
          );
        }

        if (state is MovementLoaded) {
          final movement = state.selectedMovement;
          if (movement == null) {
            return const Scaffold(
              body: Center(
                child: Text('Movement not found'),
              ),
            );
          }

          return Scaffold(
            appBar: AppBar(
              title: Text(movement.name),
              actions: [
                IconButton(
                  icon: const Icon(Icons.edit),
                  onPressed: () {
                    // TODO: Navigate to edit movement page
                  },
                ),
              ],
            ),
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (movement.isMainMovement)
                    const Chip(
                      label: Text('Main Movement'),
                      backgroundColor: Colors.blue,
                      labelStyle: TextStyle(color: Colors.white),
                    ),
                  const SizedBox(height: 16),
                  Text(
                    'Description',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    movement.description,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Categories',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: movement.categories.map((category) {
                      return Chip(
                        label: Text(category.toString().split('.').last),
                        backgroundColor: Colors.grey[200],
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Required Equipment',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: movement.requiredEquipment.map((equipment) {
                      return Chip(
                        label: Text(equipment.toString().split('.').last),
                        backgroundColor: Colors.grey[200],
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Muscle Groups',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: movement.muscleGroups.map((muscle) {
                      return Chip(
                        label: Text(muscle.toString().split('.').last),
                        backgroundColor: Colors.grey[200],
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Difficulty Level',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    movement.difficultyLevel.toString().split('.').last,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
          );
        }

        return const Scaffold(
          body: Center(
            child: Text('Something went wrong'),
          ),
        );
      },
    );
  }
}
