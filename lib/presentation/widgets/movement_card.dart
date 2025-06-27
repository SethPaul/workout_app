import 'package:flutter/material.dart';
import '../../data/models/movement.dart';

class MovementCard extends StatelessWidget {
  final Movement movement;
  final VoidCallback onTap;

  const MovementCard({
    super.key,
    required this.movement,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      movement.name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  if (movement.isMainMovement)
                    Chip(
                      label: const Text('Main', style: TextStyle(fontSize: 10)),
                      backgroundColor: Colors.blue,
                      labelStyle: const TextStyle(color: Colors.white),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                movement.description,
                style: Theme.of(context).textTheme.bodySmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 28,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: movement.categories.length,
                  itemBuilder: (context, index) {
                    final category = movement.categories[index];
                    return Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Chip(
                        label: Text(
                          category.toString().split('.').last,
                          style: const TextStyle(fontSize: 10),
                        ),
                        backgroundColor: Colors.grey[200],
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 28,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: movement.requiredEquipment.length,
                  itemBuilder: (context, index) {
                    final equipment = movement.requiredEquipment[index];
                    return Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Chip(
                        label: Text(
                          equipment.toString().split('.').last,
                          style: const TextStyle(fontSize: 10),
                        ),
                        backgroundColor: Colors.grey[300],
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
