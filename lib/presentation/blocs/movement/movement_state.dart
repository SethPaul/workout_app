import 'package:equatable/equatable.dart';
import '../../../data/models/movement.dart';

abstract class MovementState extends Equatable {
  const MovementState();

  @override
  List<Object?> get props => [];
}

class MovementInitial extends MovementState {
  const MovementInitial();
}

class MovementLoading extends MovementState {
  const MovementLoading();
}

class MovementLoaded extends MovementState {
  final List<Movement> movements;
  final Movement? selectedMovement;
  final String? filterQuery;
  final List<MovementCategory>? selectedCategories;
  final List<EquipmentType>? selectedEquipmentTypes;
  final bool? isMainMovementFilter;

  const MovementLoaded({
    required this.movements,
    this.selectedMovement,
    this.filterQuery,
    this.selectedCategories,
    this.selectedEquipmentTypes,
    this.isMainMovementFilter,
  });

  MovementLoaded copyWith({
    List<Movement>? movements,
    Movement? selectedMovement,
    String? filterQuery,
    List<MovementCategory>? selectedCategories,
    List<EquipmentType>? selectedEquipmentTypes,
    bool? isMainMovementFilter,
  }) {
    return MovementLoaded(
      movements: movements ?? this.movements,
      selectedMovement: selectedMovement ?? this.selectedMovement,
      filterQuery: filterQuery ?? this.filterQuery,
      selectedCategories: selectedCategories ?? this.selectedCategories,
      selectedEquipmentTypes:
          selectedEquipmentTypes ?? this.selectedEquipmentTypes,
      isMainMovementFilter: isMainMovementFilter ?? this.isMainMovementFilter,
    );
  }

  @override
  List<Object?> get props => [
        movements,
        selectedMovement,
        filterQuery,
        selectedCategories,
        selectedEquipmentTypes,
        isMainMovementFilter,
      ];
}

class MovementError extends MovementState {
  final String message;

  const MovementError(this.message);

  @override
  List<Object?> get props => [message];
}
