import 'package:equatable/equatable.dart';

enum EquipmentCategory {
  barbell,
  dumbbell,
  kettlebell,
  machine,
  cardio,
  bodyweight,
  other,
}

class Equipment extends Equatable {
  final String id;
  final String name;
  final EquipmentCategory category;
  final String? description;
  final double? weight;
  final String? unit;
  final bool isAvailable;
  final String? location;
  final DateTime lastMaintenance;
  final DateTime? nextMaintenance;
  final Map<String, dynamic>? specifications;

  const Equipment({
    required this.id,
    required this.name,
    required this.category,
    this.description,
    this.weight,
    this.unit,
    required this.isAvailable,
    this.location,
    required this.lastMaintenance,
    this.nextMaintenance,
    this.specifications,
  });

  factory Equipment.fromJson(Map<String, dynamic> json) {
    return Equipment(
      id: json['id'] as String,
      name: json['name'] as String,
      category: EquipmentCategory.values.firstWhere(
        (c) => c.toString() == 'EquipmentCategory.${json['category']}',
      ),
      description: json['description'] as String?,
      weight: json['weight'] as double?,
      unit: json['unit'] as String?,
      isAvailable: json['isAvailable'] as bool,
      location: json['location'] as String?,
      lastMaintenance: DateTime.parse(json['lastMaintenance'] as String),
      nextMaintenance: json['nextMaintenance'] != null
          ? DateTime.parse(json['nextMaintenance'] as String)
          : null,
      specifications: json['specifications'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category.toString().split('.').last,
      'description': description,
      'weight': weight,
      'unit': unit,
      'isAvailable': isAvailable,
      'location': location,
      'lastMaintenance': lastMaintenance.toIso8601String(),
      'nextMaintenance': nextMaintenance?.toIso8601String(),
      'specifications': specifications,
    };
  }

  Equipment copyWith({
    String? id,
    String? name,
    EquipmentCategory? category,
    String? description,
    double? weight,
    String? unit,
    bool? isAvailable,
    String? location,
    DateTime? lastMaintenance,
    DateTime? nextMaintenance,
    Map<String, dynamic>? specifications,
  }) {
    return Equipment(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      description: description ?? this.description,
      weight: weight ?? this.weight,
      unit: unit ?? this.unit,
      isAvailable: isAvailable ?? this.isAvailable,
      location: location ?? this.location,
      lastMaintenance: lastMaintenance ?? this.lastMaintenance,
      nextMaintenance: nextMaintenance ?? this.nextMaintenance,
      specifications: specifications ?? this.specifications,
    );
  }

  @override
  List<Object?> get props => [
    id,
    name,
    category,
    description,
    weight,
    unit,
    isAvailable,
    location,
    lastMaintenance,
    nextMaintenance,
    specifications,
  ];
}
