# Workout App Requirements

## Overview
A Flutter-based workout app focused on functional movements inspired by CrossFit workouts. The app will target modern Android devices, with specific optimization for Pixel 8.

## Equipment Support
The app supports workouts using the following equipment:
- Barbells and Bumper Plates
- Kettlebells
- Squat racks and Benches
- Rowers and Assault Bikes
- Boxes and Jump Ropes
- Medicine Balls and Wall Balls
- TRX straps and Gymnastics Rings
- Pull-up bars and Ropes
- Dumbbells and Sandbags
- Sleds and Tires
- Strongman Equipment (Yoke, Log, etc.)
- GHD Machines and Ab Wheels
- Cable Machines and Landmines

## Core Features

### Movement Library
1. **Movement Categories**
   - Compound Lifts (Olympic, Power, Strength)
   - Bodyweight & Functional Movements
   - Cardio & Endurance Exercises
   - Accessory/Finisher Movements
   - Core & Stability Work
   - Box & Plyometric Exercises
   - Strongman Movements

2. **Movement Details**
   - Equipment requirements
   - Primary/Secondary muscle groups
   - Movement patterns
   - Complexity levels
   - Scaling options
   - Target rep ranges
   - Rest periods
   - Technique cues
   - Common faults
   - Contraindications

### Workout Generation and Management
1. **Cadence-based Workouts**
   - Support for movement-specific cadences
   - Workouts remain in rotation until completed
   - System tracks when workouts were last performed

2. **Workout Manipulation**
   - Ability to "bump" workouts (replace with alternative or defer)
   - Workout selection based on criteria:
     - Functional muscle groups
     - Movement patterns
     - Intensity levels
     - Equipment availability

3. **Workout Structure**
   - Mandatory warm-up section
   - Multiple workout patterns:
     - Long slog (25 minutes moderate effort, monthly)
     - Technical/diversity (focus on stability muscles)
     - Strength + burst cardio (most common pattern)

4. **Weekly Structure**
   - 4 gym days per week
   - Deadlift + push press day (mandatory)
   - 2 additional strength days
   - 1 diversity day
   - Monthly slog workout

### Workout Formats
1. **Time-Based Formats**
   - EMOM (Every Minute On the Minute)
   - Tabata (20s/10s intervals)
   - 30 on 30 off
   - Death By (progressive rounds)

2. **Rep-Based Formats**
   - AMRAP (As Many Rounds As Possible)
   - N Rounds (For Time)
   - Clusters (multiple sets with short rest)

3. **Complex Formats**
   - Chipper (one round, many movements)
   - Ladder (increasing/decreasing reps)
   - Every X Minutes

4. **Team Formats**
   - Partner Workouts
   - Team WODs

### Intensity Management
1. **Intensity Levels**
   - High Intensity (H): 5-15 minutes, 80-100% max HR
   - Medium Intensity (M): 15-30 minutes, 60-80% max HR
   - Low Intensity (L): 30+ minutes, 50-70% max HR

2. **Recovery Tracking**
   - Recovery periods between workouts
   - Cumulative fatigue monitoring
   - RPE (Rate of Perceived Exertion) tracking

## Views/Screens

### Main Page
- Daily workout display
- Workout bumping functionality
- Workout type selection
- Specific workout selection
- Weight tracking per set

### Movements List Page
- Complete movement catalog
- Movement addition capability
- Rotation management (enable/disable movements)
- Equipment filtering
- Movement pattern filtering
- Muscle group filtering

### Movement Edit Page
- Rep pattern configuration
- Movement frequency settings
- Cadence configuration
- Scaling options
- Equipment requirements
- Technique notes

### Workout History Page
- Past workout records
- Performance metrics
- Progress tracking
- Recovery status

## Technical Requirements
- Flutter-based development
- Latest library versions
- Android optimization (Pixel 8 focus)
- Data persistence for workout history
- Workout generation engine based on constraints
- Real-time performance tracking
- Equipment availability management

## Data Management
- Movement database
- Workout templates
- User progress tracking
- Workout history
- Performance metrics
- Recovery tracking
- Equipment inventory 




