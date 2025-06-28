import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/movement/movement_bloc.dart';
import '../blocs/movement/movement_event.dart';
import '../blocs/movement/movement_state.dart';
import '../../data/models/movement.dart';
import '../widgets/movement_card.dart';
import '../widgets/movement_filter.dart';

class MovementListPage extends StatelessWidget {
  const MovementListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Movement Library'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              showModalBottomSheet(
                context: context,
                builder: (context) => const MovementFilter(),
              );
            },
          ),
        ],
      ),
      body: BlocBuilder<MovementBloc, MovementState>(
        builder: (context, state) {
          if (state is MovementInitial) {
            context.read<MovementBloc>().add(const LoadMovements());
            return const Center(child: CircularProgressIndicator());
          }

          if (state is MovementLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is MovementError) {
            return Center(child: Text(state.message));
          }

          if (state is MovementLoaded) {
            if (state.movements.isEmpty) {
              return const Center(child: Text('No movements found'));
            }

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Search movements...',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (query) {
                      context.read<MovementBloc>().add(
                        FilterMovements(
                          query: query,
                          categories: state.selectedCategories,
                          equipmentTypes: state.selectedEquipmentTypes,
                          isMainMovement: state.isMainMovementFilter,
                        ),
                      );
                    },
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: state.movements.length,
                    itemBuilder: (context, index) {
                      final movement = state.movements[index];
                      return MovementCard(
                        movement: movement,
                        onTap: () {
                          // TODO: Navigate to movement detail page
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Navigate to add movement page
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
