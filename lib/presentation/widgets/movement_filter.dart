import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/movement/movement_bloc.dart';
import '../blocs/movement/movement_event.dart';
import '../blocs/movement/movement_state.dart';
import '../../data/models/movement.dart';

class MovementFilter extends StatefulWidget {
  const MovementFilter({super.key});

  @override
  State<MovementFilter> createState() => _MovementFilterState();
}

class _MovementFilterState extends State<MovementFilter> {
  List<MovementCategory> _selectedCategories = [];
  List<EquipmentType> _selectedEquipmentTypes = [];
  bool? _isMainMovement;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Filter Movements',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          Text(
            'Categories',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Wrap(
            spacing: 8,
            children: MovementCategory.values.map((category) {
              final isSelected = _selectedCategories.contains(category);
              return FilterChip(
                label: Text(category.toString().split('.').last),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedCategories.add(category);
                    } else {
                      _selectedCategories.remove(category);
                    }
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Text(
            'Equipment',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Wrap(
            spacing: 8,
            children: EquipmentType.values.map((equipment) {
              final isSelected = _selectedEquipmentTypes.contains(equipment);
              return FilterChip(
                label: Text(equipment.toString().split('.').last),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedEquipmentTypes.add(equipment);
                    } else {
                      _selectedEquipmentTypes.remove(equipment);
                    }
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Text(
            'Movement Type',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Wrap(
            spacing: 8,
            children: [
              FilterChip(
                label: const Text('Main Movements'),
                selected: _isMainMovement == true,
                onSelected: (selected) {
                  setState(() {
                    _isMainMovement = selected ? true : null;
                  });
                },
              ),
              FilterChip(
                label: const Text('Accessory Movements'),
                selected: _isMainMovement == false,
                onSelected: (selected) {
                  setState(() {
                    _isMainMovement = selected ? false : null;
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () {
                  setState(() {
                    _selectedCategories = [];
                    _selectedEquipmentTypes = [];
                    _isMainMovement = null;
                  });
                },
                child: const Text('Clear All'),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {
                  final state = context.read<MovementBloc>().state;
                  if (state is MovementLoaded) {
                    context.read<MovementBloc>().add(
                          FilterMovements(
                            query: state.filterQuery ?? '',
                            categories: _selectedCategories,
                            equipmentTypes: _selectedEquipmentTypes,
                            isMainMovement: _isMainMovement,
                          ),
                        );
                  }
                  Navigator.pop(context);
                },
                child: const Text('Apply'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
