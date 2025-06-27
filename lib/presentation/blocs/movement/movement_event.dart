import 'package:equatable/equatable.dart';
import '../../../data/models/movement.dart';

abstract class MovementEvent extends Equatable {
  const MovementEvent();

  @override
  List<Object?> get props => [];
}

class LoadMovements extends MovementEvent {
  const LoadMovements();
}

class LoadMovementsByCategory extends MovementEvent {
  final MovementCategory category;

  const LoadMovementsByCategory(this.category);

  @override
  List<Object?> get props => [category];
}

class LoadMovementById extends MovementEvent {
  final String id;

  const LoadMovementById(this.id);

  @override
  List<Object?> get props => [id];
}

class AddMovement extends MovementEvent {
  final Movement movement;

  const AddMovement(this.movement);

  @override
  List<Object?> get props => [movement];
}

class UpdateMovement extends MovementEvent {
  final Movement movement;

  const UpdateMovement(this.movement);

  @override
  List<Object?> get props => [movement];
}

class DeleteMovement extends MovementEvent {
  final String id;

  const DeleteMovement(this.id);

  @override
  List<Object?> get props => [id];
}

class FilterMovements extends MovementEvent {
  final String query;
  final List<MovementCategory>? categories;
  final List<EquipmentType>? equipmentTypes;
  final bool? isMainMovement;

  const FilterMovements({
    this.query = '',
    this.categories,
    this.equipmentTypes,
    this.isMainMovement,
  });

  @override
  List<Object?> get props =>
      [query, categories, equipmentTypes, isMainMovement];
}
