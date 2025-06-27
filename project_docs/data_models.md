# Data Models

## Movement Model
```typescript
interface Movement {
  // Basic Information
  id: string;                    // Unique identifier
  name: string;                  // Movement name
  description: string;           // Detailed description
  category: MovementCategory;    // Main category (e.g., Compound, Bodyweight)
  subCategory: string;           // Sub-category (e.g., Olympic Lift, Gymnastic)
  
  // Equipment Requirements
  equipment: Equipment[];        // Required equipment
  equipmentAlternatives?: Equipment[]; // Optional alternative equipment
  
  // Muscle Groups
  primaryMuscleGroups: MuscleGroup[];  // Main muscles worked
  secondaryMuscleGroups: MuscleGroup[]; // Supporting muscles
  stabilizerMuscles: MuscleGroup[];    // Stabilizing muscles
  grossMuscleGroups: GrossMuscleGroup[]; // Major muscle groups for fatigue management
  
  // Movement Characteristics
  movementPattern: MovementPattern;    // Push, Pull, Squat, Hinge, etc.
  complexity: ComplexityLevel;         // Beginner, Intermediate, Advanced
  impact: ImpactLevel;                 // High, Medium, Low impact
  unilateral: boolean;                 // Single-side movement
  
  // Scaling Options
  scalingOptions: ScalingOption[];     // Different ways to scale the movement
  progressionSteps: Movement[];        // Easier variations
  regressionSteps: Movement[];         // Harder variations
  
  // Performance Metrics
  targetRepRanges: RepRange[];         // Recommended rep ranges
  restPeriods: RestPeriod[];           // Recommended rest periods
  tempoGuidelines?: string;            // Recommended tempo
  
  // Safety & Technique
  commonFaults: string[];              // Common mistakes to avoid
  techniqueCues: string[];             // Key points for proper form
  contraindications: string[];         // When to avoid this movement
  
  // Programming
  frequencyGuidelines: string;         // How often to program
  recoveryTime: number;                // Hours needed between sessions
  volumeGuidelines: string;            // Recommended volume
}

// Enums and Types
enum MovementCategory {
  COMPOUND_LIFT = "Compound Lift",
  BODYWEIGHT = "Bodyweight",
  CARDIO = "Cardio",
  ACCESSORY = "Accessory"
}

enum MovementPattern {
  PUSH = "Push",
  PULL = "Pull",
  SQUAT = "Squat",
  HINGE = "Hinge",
  LUNGE = "Lunge",
  CARRY = "Carry",
  ROTATION = "Rotation",
  LOCOMOTION = "Locomotion"
}

enum MuscleGroup {
  // Lower Body
  QUADS = "Quadriceps",
  HAMSTRINGS = "Hamstrings",
  GLUTES = "Glutes",
  CALVES = "Calves",
  HIP_FLEXORS = "Hip Flexors",
  ADDUCTORS = "Adductors",
  ABDUCTORS = "Abductors",
  
  // Upper Body
  CHEST = "Chest",
  BACK = "Back",
  SHOULDERS = "Shoulders",
  BICEPS = "Biceps",
  TRICEPS = "Triceps",
  FOREARMS = "Forearms",
  
  // Core
  ABS = "Abdominals",
  OBLIQUES = "Obliques",
  LOWER_BACK = "Lower Back",
  ERECTORS = "Erector Spinae"
}

enum ComplexityLevel {
  BEGINNER = "Beginner",
  INTERMEDIATE = "Intermediate",
  ADVANCED = "Advanced"
}

enum ImpactLevel {
  HIGH = "High",
  MEDIUM = "Medium",
  LOW = "Low"
}

interface Equipment {
  name: string;
  type: EquipmentType;
  optional: boolean;
}

enum EquipmentType {
  BARBELL = "Barbell",
  DUMBBELL = "Dumbbell",
  KETTLEBELL = "Kettlebell",
  BODYWEIGHT = "Bodyweight",
  MACHINE = "Machine",
  CARDIO = "Cardio",
  ACCESSORY = "Accessory"
}

interface ScalingOption {
  name: string;
  description: string;
  difficulty: ComplexityLevel;
}

interface RepRange {
  min: number;
  max: number;
  type: RepType;
}

enum RepType {
  STRENGTH = "Strength",
  HYPERTROPHY = "Hypertrophy",
  ENDURANCE = "Endurance",
  POWER = "Power"
}

interface RestPeriod {
  duration: number;  // in seconds
  type: RestType;
}

enum RestType {
  SHORT = "Short",
  MEDIUM = "Medium",
  LONG = "Long"
}

enum GrossMuscleGroup {
  LEGS = "Legs",               // All leg movements (squats, lunges, etc.)
  HIPS = "Hips",              // Hip dominant movements (deadlifts, hinges)
  PUSH = "Push",              // All pushing movements (press, push-ups)
  PULL = "Pull",              // All pulling movements (rows, pull-ups)
  CORE = "Core",              // Core and trunk stability
  CARDIO = "Cardio",          // Cardio and conditioning
  FULL_BODY = "Full Body"     // Complex movements using multiple groups
}

// Mapping of detailed muscle groups to gross muscle groups
const MuscleGroupToGrossMapping: Record<MuscleGroup, GrossMuscleGroup[]> = {
  // Lower Body -> Legs
  [MuscleGroup.QUADS]: [GrossMuscleGroup.LEGS],
  [MuscleGroup.HAMSTRINGS]: [GrossMuscleGroup.LEGS, GrossMuscleGroup.HIPS],
  [MuscleGroup.GLUTES]: [GrossMuscleGroup.LEGS, GrossMuscleGroup.HIPS],
  [MuscleGroup.CALVES]: [GrossMuscleGroup.LEGS],
  [MuscleGroup.HIP_FLEXORS]: [GrossMuscleGroup.LEGS, GrossMuscleGroup.HIPS],
  [MuscleGroup.ADDUCTORS]: [GrossMuscleGroup.LEGS],
  [MuscleGroup.ABDUCTORS]: [GrossMuscleGroup.LEGS],
  
  // Upper Body -> Push/Pull
  [MuscleGroup.CHEST]: [GrossMuscleGroup.PUSH],
  [MuscleGroup.BACK]: [GrossMuscleGroup.PULL],
  [MuscleGroup.SHOULDERS]: [GrossMuscleGroup.PUSH, GrossMuscleGroup.PULL],
  [MuscleGroup.BICEPS]: [GrossMuscleGroup.PULL],
  [MuscleGroup.TRICEPS]: [GrossMuscleGroup.PUSH],
  [MuscleGroup.FOREARMS]: [GrossMuscleGroup.PULL],
  
  // Core
  [MuscleGroup.ABS]: [GrossMuscleGroup.CORE],
  [MuscleGroup.OBLIQUES]: [GrossMuscleGroup.CORE],
  [MuscleGroup.LOWER_BACK]: [GrossMuscleGroup.CORE, GrossMuscleGroup.HIPS],
  [MuscleGroup.ERECTORS]: [GrossMuscleGroup.CORE, GrossMuscleGroup.HIPS]
}

// Example movement to gross muscle group mapping
const MovementToGrossMapping: Record<string, GrossMuscleGroup[]> = {
  "back squat": [GrossMuscleGroup.LEGS],
  "front squat": [GrossMuscleGroup.LEGS],
  "overhead squat": [GrossMuscleGroup.LEGS, GrossMuscleGroup.PUSH],
  "deadlift": [GrossMuscleGroup.HIPS],
  "sumo deadlift": [GrossMuscleGroup.HIPS],
  "clean": [GrossMuscleGroup.FULL_BODY],
  "snatch": [GrossMuscleGroup.FULL_BODY],
  "push press": [GrossMuscleGroup.PUSH],
  "strict press": [GrossMuscleGroup.PUSH],
  "pull-up": [GrossMuscleGroup.PULL],
  "push-up": [GrossMuscleGroup.PUSH],
  "row": [GrossMuscleGroup.PULL],
  "burpees": [GrossMuscleGroup.FULL_BODY],
  "box jumps": [GrossMuscleGroup.LEGS],
  "wall balls": [GrossMuscleGroup.LEGS, GrossMuscleGroup.PUSH],
  "thrusters": [GrossMuscleGroup.LEGS, GrossMuscleGroup.PUSH],
  "turkish getup": [GrossMuscleGroup.FULL_BODY],
  "kettlebell swing": [GrossMuscleGroup.HIPS],
  "assault bike": [GrossMuscleGroup.CARDIO],
  "double unders": [GrossMuscleGroup.CARDIO],
  "running": [GrossMuscleGroup.CARDIO]
}

// Rest periods between movements targeting same gross muscle groups
const GrossMuscleGroupRestPeriods: Record<GrossMuscleGroup, number> = {
  [GrossMuscleGroup.LEGS]: 48,      // 48 hours between leg-focused workouts
  [GrossMuscleGroup.HIPS]: 48,      // 48 hours between hip-focused workouts
  [GrossMuscleGroup.PUSH]: 24,      // 24 hours between push-focused workouts
  [GrossMuscleGroup.PULL]: 24,      // 24 hours between pull-focused workouts
  [GrossMuscleGroup.CORE]: 24,      // 24 hours between core-focused workouts
  [GrossMuscleGroup.CARDIO]: 12,    // 12 hours between cardio sessions
  [GrossMuscleGroup.FULL_BODY]: 48  // 48 hours between full body workouts
}
```

## Workout Format Model
```typescript
interface WorkoutFormat {
  // Basic Information
  id: string;                    // Unique identifier
  name: string;                  // Format name
  description: string;           // Detailed description
  category: FormatCategory;      // Time-based, Rep-based, etc.
  
  // Structure
  timeDomain: TimeDomain;        // Short, Medium, Long
  workRestRatio: string;         // e.g., "1:1", "2:1"
  rounds: number | "AMRAP";      // Number of rounds or AMRAP
  duration: number;              // Total duration in minutes
  
  // Intensity
  targetIntensity: IntensityLevel;
  restPeriods: RestPeriod[];
  scalingOptions: ScalingOption[];
  
  // Movement Guidelines
  recommendedMovements: Movement[];
  movementPatterns: MovementPattern[];
  muscleGroupRestrictions: MuscleGroupRestriction[];
  grossMuscleGroupRestrictions: GrossMuscleGroupRestriction[];
  
  // Programming
  frequency: string;             // How often to program
  recoveryTime: number;          // Hours needed between sessions
  volumeGuidelines: string;      // Recommended volume
  
  // Variations
  variations: WorkoutFormat[];
  teamOptions: TeamOption[];
  
  // Performance Metrics
  scoringMethod: ScoringMethod;
  targetMetrics: Metric[];
}

enum FormatCategory {
  TIME_BASED = "Time Based",
  REP_BASED = "Rep Based",
  COMPLEX = "Complex",
  TEAM = "Team"
}

enum TimeDomain {
  SHORT = "Short",    // < 10 minutes
  MEDIUM = "Medium",  // 10-20 minutes
  LONG = "Long"       // > 20 minutes
}

enum IntensityLevel {
  HIGH = "High",
  MODERATE = "Moderate",
  LOW = "Low"
}

interface MuscleGroupRestriction {
  muscleGroup: MuscleGroup;
  maxFrequency: number;  // Times per week
  minRestHours: number;  // Hours between sessions
}

interface GrossMuscleGroupRestriction {
  grossMuscleGroup: GrossMuscleGroup;
  maxMovementsPerWorkout: number;  // Max number of movements targeting this group
  minRestHours: number;            // Min hours between workouts targeting this group
  maxFrequencyPerWeek: number;     // Max times per week to target this group
}

interface TeamOption {
  name: string;
  description: string;
  minAthletes: number;
  maxAthletes: number;
  workSplit: string;
}

enum ScoringMethod {
  FOR_TIME = "For Time",
  FOR_REPS = "For Reps",
  FOR_WEIGHT = "For Weight",
  FOR_ROUNDS = "For Rounds"
}

interface Metric {
  name: string;
  unit: string;
  target: number | string;
}
```

## Workout Model
```typescript
interface Workout {
  id: string;
  name: string;
  format: WorkoutFormat;
  movements: WorkoutMovement[];
  intensity: IntensityLevel;
  duration: number;
  equipment: Equipment[];
  muscleGroups: MuscleGroup[];
  grossMuscleGroups: GrossMuscleGroup[];
  muscleGroupFatigue: Record<GrossMuscleGroup, number>;
  notes: string;
}

interface WorkoutMovement {
  movement: Movement;
  reps: number | string;  // number or "AMRAP"
  sets: number;
  weight?: number;
  rest: number;
  order: number;
}
```

## Notes
- These models are designed to prevent overworking muscle groups by tracking:
  - Primary and secondary muscle groups for each movement
  - Movement patterns and their frequency
  - Required rest periods between similar movements
  - Recovery time needed for each movement
  - Gross muscle group fatigue and recovery
- The models support:
  - Movement scaling and progression
  - Equipment alternatives
  - Team workout variations
  - Different scoring methods
  - Performance tracking
  - Safety considerations
- Additional considerations:
  - Movement complexity and impact levels
  - Technique requirements
  - Common faults to avoid
  - Programming frequency guidelines
  - Volume recommendations
  - Gross muscle group fatigue management
  - Movement pattern distribution
  - Recovery time between similar movements 