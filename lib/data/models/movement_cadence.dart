import 'package:equatable/equatable.dart';

class MovementCadence extends Equatable {
  final String id;
  final String movementId;
  final int daysInterval; // How often this movement should appear (e.g., 7 for weekly)
  final DateTime? lastPerformed;
  final bool isEnabled;
  final DateTime createdAt;
  final DateTime updatedAt;

  const MovementCadence({
    required this.id,
    required this.movementId,
    required this.daysInterval,
    this.lastPerformed,
    this.isEnabled = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MovementCadence.fromMap(Map<String, dynamic> map) {
    return MovementCadence(
      id: map['id'] as String,
      movementId: map['movement_id'] as String,
      daysInterval: map['days_interval'] as int,
      lastPerformed: map['last_performed'] != null
          ? DateTime.parse(map['last_performed'] as String)
          : null,
      isEnabled: map['is_enabled'] as bool? ?? true,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'movement_id': movementId,
      'days_interval': daysInterval,
      'last_performed': lastPerformed?.toIso8601String(),
      'is_enabled': isEnabled,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  /// Check if this movement is available based on cadence and last performed
  bool isAvailableForSelection({DateTime? currentDate}) {
    if (!isEnabled) return false;
    
    currentDate ??= DateTime.now();
    
    if (lastPerformed == null) return true;
    
    final daysSinceLastPerformed = currentDate.difference(lastPerformed!).inDays;
    return daysSinceLastPerformed >= daysInterval;
  }

  /// Mark this movement as performed
  MovementCadence markAsPerformed({DateTime? performedAt}) {
    return copyWith(
      lastPerformed: performedAt ?? DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  /// Calculate days until this movement is available again
  int daysUntilAvailable({DateTime? currentDate}) {
    if (!isEnabled || lastPerformed == null) return 0;
    
    currentDate ??= DateTime.now();
    final daysSinceLastPerformed = currentDate.difference(lastPerformed!).inDays;
    final daysUntilAvailable = daysInterval - daysSinceLastPerformed;
    
    return daysUntilAvailable > 0 ? daysUntilAvailable : 0;
  }

  MovementCadence copyWith({
    String? id,
    String? movementId,
    int? daysInterval,
    DateTime? lastPerformed,
    bool? isEnabled,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return MovementCadence(
      id: id ?? this.id,
      movementId: movementId ?? this.movementId,
      daysInterval: daysInterval ?? this.daysInterval,
      lastPerformed: lastPerformed ?? this.lastPerformed,
      isEnabled: isEnabled ?? this.isEnabled,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        movementId,
        daysInterval,
        lastPerformed,
        isEnabled,
        createdAt,
        updatedAt,
      ];
}

/// Common cadence presets for different movement types
class CadencePresets {
  static const int daily = 1;
  static const int everyOtherDay = 2;
  static const int twiceWeekly = 3;
  static const int weekly = 7;
  static const int biweekly = 14;
  static const int monthly = 30;

  /// Get default cadence for a movement type
  static int getDefaultCadenceForMovement(String movementName) {
    final name = movementName.toLowerCase();
    
    // Heavy compound movements - weekly
    if (name.contains('deadlift') || 
        name.contains('squat') ||
        name.contains('bench press') ||
        name.contains('overhead press')) {
      return weekly;
    }
    
    // High intensity movements - every other day
    if (name.contains('max effort') ||
        name.contains('1rm') ||
        name.contains('heavy')) {
      return everyOtherDay;
    }
    
    // Accessory and bodyweight - twice weekly
    if (name.contains('pull-up') ||
        name.contains('push-up') ||
        name.contains('dip') ||
        name.contains('row')) {
      return twiceWeekly;
    }
    
    // Cardio and conditioning - daily
    if (name.contains('run') ||
        name.contains('bike') ||
        name.contains('row') ||
        name.contains('burpee')) {
      return daily;
    }
    
    // Default to twice weekly for most movements
    return twiceWeekly;
  }
}