import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/repositories/movement_repository.dart';
import 'movement_event.dart';
import 'movement_state.dart';

class MovementBloc extends Bloc<MovementEvent, MovementState> {
  final MovementRepository _movementRepository;

  MovementBloc(this._movementRepository) : super(const MovementInitial()) {
    on<LoadMovements>(_onLoadMovements);
    on<LoadMovementsByCategory>(_onLoadMovementsByCategory);
    on<LoadMovementById>(_onLoadMovementById);
    on<AddMovement>(_onAddMovement);
    on<UpdateMovement>(_onUpdateMovement);
    on<DeleteMovement>(_onDeleteMovement);
    on<FilterMovements>(_onFilterMovements);
  }

  Future<void> _onLoadMovements(
    LoadMovements event,
    Emitter<MovementState> emit,
  ) async {
    try {
      emit(const MovementLoading());
      final movements = await _movementRepository.getAllMovements();
      emit(MovementLoaded(movements: movements));
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }

  Future<void> _onLoadMovementsByCategory(
    LoadMovementsByCategory event,
    Emitter<MovementState> emit,
  ) async {
    try {
      emit(const MovementLoading());
      final movements = await _movementRepository.getMovementsByCategory(
        event.category,
      );
      emit(
        MovementLoaded(
          movements: movements,
          selectedCategories: [event.category],
        ),
      );
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }

  Future<void> _onLoadMovementById(
    LoadMovementById event,
    Emitter<MovementState> emit,
  ) async {
    try {
      emit(const MovementLoading());
      final movement = await _movementRepository.getMovementById(event.id);
      if (movement != null) {
        final currentState = state;
        if (currentState is MovementLoaded) {
          emit(currentState.copyWith(selectedMovement: movement));
        } else {
          final movements = await _movementRepository.getAllMovements();
          emit(
            MovementLoaded(movements: movements, selectedMovement: movement),
          );
        }
      } else {
        emit(const MovementError('Movement not found'));
      }
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }

  Future<void> _onAddMovement(
    AddMovement event,
    Emitter<MovementState> emit,
  ) async {
    try {
      emit(const MovementLoading());
      await _movementRepository.createMovement(event.movement);
      final movements = await _movementRepository.getAllMovements();
      emit(MovementLoaded(movements: movements));
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }

  Future<void> _onUpdateMovement(
    UpdateMovement event,
    Emitter<MovementState> emit,
  ) async {
    try {
      emit(const MovementLoading());
      await _movementRepository.updateMovement(event.movement);
      final movements = await _movementRepository.getAllMovements();
      emit(MovementLoaded(movements: movements));
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }

  Future<void> _onDeleteMovement(
    DeleteMovement event,
    Emitter<MovementState> emit,
  ) async {
    try {
      emit(const MovementLoading());
      await _movementRepository.deleteMovement(event.id);
      final movements = await _movementRepository.getAllMovements();
      emit(MovementLoaded(movements: movements));
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }

  Future<void> _onFilterMovements(
    FilterMovements event,
    Emitter<MovementState> emit,
  ) async {
    try {
      final currentState = state;
      if (currentState is MovementLoaded) {
        final filteredMovements = currentState.movements.where((movement) {
          final matchesQuery =
              event.query.isEmpty ||
              movement.name.toLowerCase().contains(event.query.toLowerCase()) ||
              movement.description.toLowerCase().contains(
                event.query.toLowerCase(),
              );

          final matchesCategories =
              event.categories == null ||
              event.categories!.isEmpty ||
              movement.categories.any(
                (category) => event.categories!.contains(category),
              );

          final matchesEquipment =
              event.equipmentTypes == null ||
              event.equipmentTypes!.isEmpty ||
              movement.requiredEquipment.any(
                (equipment) => event.equipmentTypes!.contains(equipment),
              );

          final matchesMainMovement =
              event.isMainMovement == null ||
              movement.isMainMovement == event.isMainMovement;

          return matchesQuery &&
              matchesCategories &&
              matchesEquipment &&
              matchesMainMovement;
        }).toList();

        emit(
          currentState.copyWith(
            movements: filteredMovements,
            filterQuery: event.query,
            selectedCategories: event.categories,
            selectedEquipmentTypes: event.equipmentTypes,
            isMainMovementFilter: event.isMainMovement,
          ),
        );
      }
    } catch (e) {
      emit(MovementError(e.toString()));
    }
  }
}
