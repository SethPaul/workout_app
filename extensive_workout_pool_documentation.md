# Extensive Default Workout Pool Documentation

## Overview

This document describes the comprehensive workout pool system that has been implemented to prepopulate the workout app with an extensive variety of workouts. The system uses a template-based approach to efficiently handle the combinatorics of creating workouts from the 24 movements available in `movements.json`.

## Generation Strategy

### Template-Based Approach

Instead of manually creating individual workouts, the system uses a **template-based generator** that:

1. **Categorizes movements** into functional groups (deadlifts, squats, presses, pulls, olympic lifts, bodyweight, cardio, etc.)
2. **Applies workout patterns** from the documentation (EMOM, AMRAP, MetCon, strength combinations)
3. **Generates combinations** systematically while avoiding combinatorial explosion
4. **Respects cadence requirements** (e.g., deadlifts every 7 days)
5. **Follows documented guidelines** from requirements and patterns

### Movement Categorization

The generator automatically categorizes the 24 movements from `movements.json` into:

- **Deadlifts**: All deadlift variations (deadlift, romanian-deadlift, etc.)
- **Squats**: All squat variations (back-squat, front-squat, etc.)  
- **Presses**: All pressing movements (bench-press, overhead-press, etc.)
- **Pulls**: All pulling movements (pull-up, ring-rows, etc.)
- **Olympic Lifts**: Clean, snatch, and variations
- **Bodyweight**: Push-ups, burpees, bodyweight movements
- **Cardio**: Assault bike, rowing, running movements
- **Kettlebell**: All kettlebell-specific movements
- **Gymnastic**: Ring work, advanced bodyweight
- **Accessory**: Smaller isolation movements
- **Core**: Abdominal and core-focused movements

## Workout Templates Generated

### 1. Core Strength Templates (Weekly Cadence)

**Heavy Deadlift + Push Press**
- Format: For Reps
- Intensity: High
- Cadence: 7 days (as specified in requirements)
- Movements: 5 deadlifts + 5 presses
- Duration: 45 minutes

**Squat + Pull Combinations**
- Multiple combinations of squat and pull movements
- Format: For Reps  
- Intensity: High
- Cadence: 7 days
- Example: "Back Squat + Pull-up" (8 reps each)

**Bench + Accessory Combinations**
- Upper body strength with accessory work
- Format: For Reps
- Intensity: Medium
- Cadence: 7 days
- Example: "Bench Press + Wall Balls" (8 + 12 reps)

### 2. Olympic Lift Templates (Bi-weekly Cadence)

**EMOM Clean Variations**
- Format: EMOM (Every Minute On the Minute)
- Intensity: Medium
- Cadence: 3 days
- Example: "EMOM 10 minutes 5 Clean" (as specified in requirements)
- Settings: 10 minutes, 60-second intervals

**Clean + Front Squat Complex**
- Olympic lift complexes
- Format: For Reps
- Intensity: High
- Cadence: 10 days
- Movements: 3 cleans + 5 front squats

**Snatch Skill Work**
- Technical practice sessions
- Format: For Reps
- Intensity: Medium
- Cadence: 14 days
- Focus: Movement quality and technique

### 3. MetCon Templates (2-3x per week)

**3-Movement MetCons**
- High-intensity mixed modality workouts
- Format: Rounds For Time
- Intensity: High
- Cadence: 3 days
- Combinations: Bodyweight + Kettlebell + Cardio
- Example: "MetCon: Burpees/Kettlebell Swing/Assault Bike"
- Structure: 5 rounds, 15-minute time cap

### 4. EMOM Templates (2x per week)

**Single Movement EMOMs**
- Format: EMOM
- Intensity: Medium
- Cadence: 3 days
- Movements: Olympic lifts, bodyweight, kettlebell
- Durations: 6-10 minutes based on movement complexity

**Alternating EMOMs**
- Two movements alternating each minute
- Format: EMOM
- Intensity: Medium
- Cadence: 4 days
- Duration: 12 minutes
- Example: "EMOM Alt: Power Clean/Push-up"

### 5. AMRAP Templates (2x per week)

**Bodyweight AMRAP Circuit**
- Format: AMRAP (As Many Rounds As Possible)
- Intensity: Medium
- Cadence: 3 days
- Duration: 15 minutes
- Movements: 3 bodyweight exercises, 10 reps each

**Mixed AMRAP Combinations**
- 2-movement AMRAPs
- Durations: 10, 15, 20 minutes
- Intensity: High (10 min) to Medium (20 min)
- Combinations: Bodyweight + Kettlebell + Accessory

### 6. Bodyweight Templates (Daily potential)

**Individual Movement Focus**
- Format: For Reps
- Intensity: Low
- Cadence: 1 day (can be done daily)
- Duration: 20 minutes
- Examples: "Push-up Focus", "Burpee Focus"

**Bodyweight Circuits**
- Format: Rounds For Time
- Intensity: Medium
- Cadence: 2 days
- Structure: 3 rounds, 4 movements
- Duration: 25 minutes

### 7. Cardio Templates (2-3x per week)

**Intervals - Cycling/Rowing**
- Format: Rounds For Time
- Intensity: High
- Cadence: 2 days
- Structure: 4 rounds of 5 minutes
- Duration: 20 minutes (as specified in requirements)

**Steady State Cardio**
- Format: For Time
- Intensity: Low
- Cadence: 30 days (monthly slog as per requirements)
- Duration: 25 minutes moderate effort

### 8. Hybrid Templates (Weekly)

**Strength + Burst Cardio**
- Format: Rounds For Time
- Intensity: High
- Cadence: 5 days
- Pattern: Most common pattern per requirements
- Structure: 5 rounds of strength + cardio burst
- Example: "Deadlift + Burpee Burst"

### 9. Specialty Templates (Monthly/Bi-weekly)

**Technical Diversity Day**
- Format: For Reps
- Intensity: Low
- Cadence: 7 days
- Focus: Stability muscles and movement quality
- Movements: Gymnastic + Accessory combinations

**Monthly Slog Workouts**
- Format: For Time
- Intensity: Low
- Cadence: 30 days (as specified in requirements)
- Duration: 25 minutes moderate effort
- Purpose: Endurance base building

## Combinatorial Efficiency

### Limiting Explosion
The generator prevents combinatorial explosion by:

1. **Limiting combinations**: Takes only top N movements from each category
2. **Smart filtering**: Only creates diverse movement combinations
3. **Category limits**: Caps the number of workouts per template type
4. **Quality over quantity**: Focuses on proven workout patterns

### Example Calculations
- 24 total movements
- ~8 categories with 2-5 movements each
- 9 template types with 5-20 variations each
- **Result**: ~100-150 high-quality workout pools instead of thousands of random combinations

## Cadence Compliance

The system respects movement-specific cadences:

- **Deadlifts**: 7 days (heavy compound movements)
- **Olympic Lifts**: 3-10 days (technical movements)
- **Bodyweight**: 1-3 days (can be done frequently)
- **Cardio**: 2-30 days (intervals vs. steady state)
- **Specialty**: 7-30 days (technical/diversity work)

## Requirements Compliance

### Documented Requirements Met:
✅ **Deadlift + push press day (mandatory)** - Generated as primary strength template
✅ **EMOM 10 minutes 5 cleans** - Generated as Olympic lift template  
✅ **Intervals - Cycling/Rowing** - Generated as cardio template
✅ **4 gym days per week structure** - Cadences support this frequency
✅ **Strength + burst cardio (most common pattern)** - Generated as hybrid template
✅ **Technical/diversity day** - Generated as specialty template
✅ **Monthly slog workout** - Generated as steady-state cardio
✅ **Movement-specific cadences** - Implemented throughout

### Workout Format Support:
✅ EMOM (Every Minute On the Minute)
✅ AMRAP (As Many Rounds As Possible)  
✅ Rounds For Time
✅ For Reps
✅ For Time
✅ Tabata (ready for future expansion)
✅ Complex formats (ready for future expansion)

## Database Integration

The generated pools are automatically:
1. **Saved to database** via WorkoutPoolRepository
2. **Linked to movements** via WorkoutPoolMovements table
3. **Tracked for cadence** via MovementCadence system
4. **Available for selection** via smart workout selection algorithm

## Usage in App

Users will experience:
1. **Variety**: 100+ different workout options
2. **Progression**: Smart cadence-based selection
3. **Customization**: Equipment filtering works automatically
4. **Quality**: All workouts follow proven patterns
5. **Compliance**: Meets all documented requirements

## Future Expansion

The template system can easily be extended:
- **New movement categories**: Add to MovementGroups
- **New workout patterns**: Add template generation methods
- **Seasonal variations**: Modify rep schemes and intensities
- **User preferences**: Filter templates based on user goals
- **Equipment availability**: Already supported via equipment filtering

## Technical Implementation

### Key Files:
- `lib/services/workout_pool_generator.dart` - Main generator logic
- `lib/services/workout_pool_service.dart` - Integration with existing service
- `lib/data/models/workout_pool.dart` - Data model
- `lib/data/repositories/workout_pool_repository.dart` - Database operations

### Generation Process:
1. Load movements from JSON
2. Categorize into functional groups
3. Apply template patterns
4. Generate combinations with limits
5. Save to database
6. Initialize cadence tracking

This extensive workout pool provides the foundation for a rich, varied, and compliant workout experience that scales efficiently with the available movements while respecting all documented requirements and patterns.