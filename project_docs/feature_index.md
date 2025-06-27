# Feature Index

## Core Features

### Movement Library
- **Location**: `lib/features/movements/`
- **Key Files**:
  - `movement_list_page.dart`
  - `movement_detail_page.dart`
  - `movement_filter_widget.dart`
  - `movement_repository.dart`
- **Related Tests**: `test/features/movements/`
- **Documentation**: `project_docs/movements.md`

### Workout Generation
- **Location**: `lib/features/workouts/`
- **Key Files**:
  - `workout_generator.dart`
  - `workout_list_page.dart`
  - `workout_detail_page.dart`
  - `workout_repository.dart`
- **Related Tests**: `test/features/workouts/`
- **Documentation**: `project_docs/workout_formats.md`

### Workout Execution
- **Location**: `lib/features/execution/`
- **Key Files**:
  - `workout_timer.dart`
  - `workout_flow.dart`
  - `movement_instructions.dart`
  - `progress_tracker.dart`
- **Related Tests**: `test/features/execution/`
- **Documentation**: `project_docs/workout_formats.md`

### User Settings
- **Location**: `lib/features/settings/`
- **Key Files**:
  - `settings_page.dart`
  - `equipment_manager.dart`
  - `intensity_preferences.dart`
  - `recovery_tracker.dart`
- **Related Tests**: `test/features/settings/`
- **Documentation**: `project_docs/intensity_levels.md`

## Data Models

### Movement
- **Location**: `lib/data/models/movement.dart`
- **Related Files**:
  - `movement_repository.dart`
  - `movement_bloc.dart`
- **Documentation**: `project_docs/data_models.md`

### Workout
- **Location**: `lib/data/models/workout.dart`
- **Related Files**:
  - `workout_repository.dart`
  - `workout_bloc.dart`
- **Documentation**: `project_docs/data_models.md`

### Equipment
- **Location**: `lib/data/models/equipment.dart`
- **Related Files**:
  - `equipment_repository.dart`
  - `equipment_bloc.dart`
- **Documentation**: `project_docs/data_models.md`

### User Progress
- **Location**: `lib/data/models/user_progress.dart`
- **Related Files**:
  - `progress_repository.dart`
  - `progress_bloc.dart`
- **Documentation**: `project_docs/data_models.md`

## UI Components

### Common Widgets
- **Location**: `lib/presentation/widgets/`
- **Key Files**:
  - `movement_card.dart`
  - `workout_card.dart`
  - `timer_display.dart`
  - `progress_indicator.dart`

### Theme
- **Location**: `lib/presentation/theme/`
- **Key Files**:
  - `app_theme.dart`
  - `color_scheme.dart`
  - `text_theme.dart`
  - `spacing.dart`

## State Management

### BLoCs
- **Location**: `lib/presentation/blocs/`
- **Key Files**:
  - `movement_bloc.dart`
  - `workout_bloc.dart`
  - `execution_bloc.dart`
  - `settings_bloc.dart`

### Events
- **Location**: `lib/presentation/blocs/events/`
- **Key Files**:
  - `movement_events.dart`
  - `workout_events.dart`
  - `execution_events.dart`
  - `settings_events.dart`

### States
- **Location**: `lib/presentation/blocs/states/`
- **Key Files**:
  - `movement_states.dart`
  - `workout_states.dart`
  - `execution_states.dart`
  - `settings_states.dart`

## Testing

### Feature Tests
- **Location**: `test/features/`
- **Key Files**:
  - `movement_test.dart`
  - `workout_test.dart`
  - `execution_test.dart`
  - `settings_test.dart`

### Widget Tests
- **Location**: `test/widgets/`
- **Key Files**:
  - `movement_card_test.dart`
  - `workout_card_test.dart`
  - `timer_display_test.dart`
  - `progress_indicator_test.dart`

### Unit Tests
- **Location**: `test/unit/`
- **Key Files**:
  - `movement_repository_test.dart`
  - `workout_repository_test.dart`
  - `equipment_repository_test.dart`
  - `progress_repository_test.dart`

## Documentation

### Technical Docs
- **Location**: `project_docs/`
- **Key Files**:
  - `architecture.md`
  - `api_documentation.md`
  - `database_schema.md`
  - `testing_strategy.md`

### User Docs
- **Location**: `project_docs/user/`
- **Key Files**:
  - `getting_started.md`
  - `features.md`
  - `troubleshooting.md`
  - `faq.md`

## Configuration

### Environment
- **Location**: `lib/core/config/`
- **Key Files**:
  - `environment.dart`
  - `api_config.dart`
  - `database_config.dart`
  - `logging_config.dart`

### Constants
- **Location**: `lib/core/constants/`
- **Key Files**:
  - `app_constants.dart`
  - `api_constants.dart`
  - `database_constants.dart`
  - `ui_constants.dart` 