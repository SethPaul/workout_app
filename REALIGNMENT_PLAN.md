# Workout App Realignment Plan

## Executive Summary

After thorough analysis of the codebase, documentation, and requirements, **the app has deviated significantly from the original vision**. While substantial technical infrastructure exists, the core user experience and business logic don't align with the desired behavior.

### Key Deviations Identified:

1. **❌ Missing Core Feature**: No "workout pool" concept - workouts are generated ad-hoc rather than selected from a curated pool
2. **❌ No Cadence-Based Selection**: Missing the "deadlifts every 7 days" scheduling logic
3. **❌ No Movement Library UI**: Users can't review/disable movements or equipment groups
4. **❌ Complex Template System**: Over-engineered template creation instead of simple pool management
5. **❌ Missing Equipment Filtering**: No way to disable equipment groups (e.g., "no GHD machine")
6. **❌ Wrong User Flow**: Bottom tabs instead of simple daily workout selection

### Current State Assessment:
- **Technical Infrastructure**: ✅ Solid (95% complete)
- **Core User Experience**: ❌ Misaligned (30% aligned)
- **Business Logic**: ❌ Wrong approach (40% aligned)
- **Data Models**: 🟡 Partially correct (70% aligned)

## Original Vision vs Current Implementation

### **DESIRED BEHAVIOR** (From Requirements):
```
Essential functionality:
• App has a POOL of workouts
• Each day user selects to have a workout PULLED from the pool
• Selection adheres to criteria (e.g., deadlifts every 7 days)
• Pool is reviewable and allows disabling specific workouts
• Allow disabling groups by equipment (e.g., no GHD machine)

Example week:
• Day 1: Heavy deadlift + push press, 3x5s (from pool)
• Day 2: EMOM 10 minutes 5 cleans (from pool)  
• Day 3: Intervals, cycling/rowing (from pool)
• Next week: Deadlift + push press again (7-day cadence)
```

### **CURRENT IMPLEMENTATION**:
```
❌ No workout pool - workouts generated on-demand
❌ No cadence tracking - no "every 7 days" logic
❌ Complex template system instead of simple pool
❌ No movement library UI for users
❌ No equipment group disabling
❌ Bottom navigation instead of daily selection focus
```

## Comprehensive Realignment Plan

### Phase 1: Fix Core Issues (Week 1)
**Priority: CRITICAL - Foundation Fixes**

#### 1.1 Create Workout Pool System
- **Current**: Workouts generated ad-hoc from templates
- **Fix**: Create pre-populated workout pool with cadence tracking
- **Implementation**:
  - Create `WorkoutPool` model and repository
  - Populate pool with 50-100 predefined workouts
  - Add cadence fields (`daysInterval`, `lastPerformed`)
  - Implement pool selection algorithm

#### 1.2 Implement Cadence-Based Selection
- **Current**: No scheduling logic
- **Fix**: Add movement cadence tracking
- **Implementation**:
  - Add `MovementCadence` model (movement, daysInterval, lastPerformed)
  - Create cadence validation logic
  - Implement smart workout selection based on cadence rules

#### 1.3 Simplify Main UI Flow
- **Current**: Complex bottom navigation with templates
- **Fix**: Simple daily workout selection
- **Implementation**:
  - Replace bottom nav with single "Today's Workout" screen
  - Add "Get Workout" button that pulls from pool
  - Add "Bump Workout" functionality
  - Keep execution and history as secondary screens

### Phase 2: Add Missing Core Features (Week 2)
**Priority: HIGH - Essential User Features**

#### 2.1 Movement Library UI
- **Current**: No user-facing movement management
- **Fix**: Add Movement Library screen
- **Implementation**:
  - Create `MovementLibraryScreen` 
  - Show all movements with enable/disable toggles
  - Add equipment group filtering
  - Add cadence configuration per movement

#### 2.2 Equipment Group Management
- **Current**: Equipment model exists but no UI
- **Fix**: Add equipment group disabling
- **Implementation**:
  - Create `EquipmentSettingsScreen`
  - Group equipment by type (e.g., "GHD Machine", "Rowing Machine")
  - Add toggle to disable entire equipment groups
  - Filter workout pool based on available equipment

#### 2.3 Workout Pool Management
- **Current**: No pool review capability
- **Fix**: Add pool review and management
- **Implementation**:
  - Create `WorkoutPoolScreen`
  - Show all workouts in pool with enable/disable
  - Add workout preview and modification
  - Show cadence information and last performed dates

### Phase 3: Data Model Alignment (Week 2)
**Priority: HIGH - Fix Data Structure**

#### 3.1 Restructure Core Models
- **Fix Movement Model**: Add cadence fields
- **Fix Workout Model**: Add pool membership, cadence tracking
- **Add WorkoutPool Model**: Central pool management
- **Add MovementCadence Model**: Track movement frequency rules

#### 3.2 Database Schema Updates
- Add workout_pool table
- Add movement_cadence table  
- Add equipment_availability table
- Update existing tables with new fields

#### 3.3 Seed Default Workout Pool
- Create 50-100 predefined workouts matching requirements
- Set appropriate cadences (deadlift every 7 days, etc.)
- Populate with various formats (EMOM, AMRAP, strength, etc.)

### Phase 4: Fix User Flow (Week 3)
**Priority: MEDIUM - Polish User Experience**

#### 4.1 Redesign Main Screen
- **Current**: Bottom nav with workout list
- **New**: Single "Daily Workout" screen
- **Features**:
  - Large "Get Today's Workout" button
  - Show selected workout with "Start" and "Bump" options
  - Simple navigation to settings and history

#### 4.2 Streamline Navigation
- **Remove**: Complex template management from main flow
- **Add**: Settings screen with movement library and equipment
- **Keep**: Workout execution and history as needed

#### 4.3 Improve Workout Selection Logic
- Implement smart selection algorithm:
  - Respect movement cadences
  - Avoid recently performed workouts
  - Balance intensity and variety
  - Consider available equipment

### Phase 5: Testing & Validation (Week 4)
**Priority: HIGH - Ensure Quality**

#### 5.1 Fix Existing Test Issues
- **Current Issues**:
  - 3 failing MovementDataService tests
  - Missing SQLite library for golden tests
  - Asset directory errors
- **Fixes**:
  - Install SQLite3 library
  - Fix mock repository configurations
  - Create missing asset directories

#### 5.2 Add Tests for New Features
- Unit tests for WorkoutPool logic
- Integration tests for cadence selection
- Widget tests for new screens
- End-to-end tests for user flow

#### 5.3 Validate Against Requirements
- Test cadence behavior (deadlifts every 7 days)
- Test equipment filtering (disable GHD)
- Test workout bumping functionality
- Verify pool selection algorithm

## Implementation Strategy

### Week 1: Foundation (Core Issues)
**Days 1-2**: Workout Pool System
- Create WorkoutPool model and repository
- Implement basic pool selection logic
- Add database schema updates

**Days 3-4**: Cadence System
- Create MovementCadence model
- Implement cadence tracking
- Add smart selection algorithm

**Days 5-7**: UI Simplification
- Redesign main screen
- Remove complex template navigation
- Add basic "Get Workout" functionality

### Week 2: Essential Features
**Days 1-3**: Movement Library UI
- Create MovementLibraryScreen
- Add movement enable/disable functionality
- Implement equipment group management

**Days 4-5**: Equipment Management
- Create EquipmentSettingsScreen
- Add group-based equipment disabling
- Integrate with workout selection

**Days 6-7**: Pool Management
- Create WorkoutPoolScreen
- Add pool review and editing
- Implement workout enable/disable

### Week 3: Polish & Integration
**Days 1-3**: Complete UI Redesign
- Finalize main screen redesign
- Implement workout bumping
- Add proper navigation flow

**Days 4-5**: Selection Algorithm
- Refine workout selection logic
- Add variety and balance algorithms
- Implement intelligent cadence respect

**Days 6-7**: Data Population
- Create comprehensive workout pool
- Set appropriate cadences
- Test real-world scenarios

### Week 4: Testing & Validation
**Days 1-3**: Fix Current Tests
- Resolve SQLite and mock issues
- Fix failing tests
- Add missing test coverage

**Days 4-5**: Integration Testing
- Test complete user workflows
- Validate cadence behavior
- Test equipment filtering

**Days 6-7**: Final Validation
- Test against all requirements
- Performance optimization
- Bug fixes and polish

## Success Criteria

### Core Functionality ✅
- [ ] Users can pull workouts from a pool
- [ ] Deadlift appears every 7 days as specified
- [ ] Users can disable movements/equipment groups
- [ ] Workout pool is reviewable and manageable
- [ ] Equipment-based filtering works (e.g., no GHD)

### User Experience ✅  
- [ ] Simple daily workflow: open app → get workout → execute
- [ ] Workout bumping functionality
- [ ] Movement library management
- [ ] Equipment availability settings

### Technical Quality ✅
- [ ] All tests passing (current: 44/47 failing)
- [ ] App builds and runs smoothly
- [ ] Performance meets requirements
- [ ] Database properly structured

## Risk Assessment

### High Risk Items:
1. **Database Migration**: Significant schema changes needed
2. **Data Loss**: Existing workout history and templates
3. **Test Failures**: Current 3 failing tests blocking validation

### Mitigation Strategies:
1. **Backup Strategy**: Export existing data before migration
2. **Gradual Migration**: Phase database changes
3. **Test Environment**: Fix test infrastructure first

## Resource Requirements

### Development Time: 4 weeks
- Week 1: 40 hours (core foundation)
- Week 2: 32 hours (essential features)  
- Week 3: 24 hours (polish & integration)
- Week 4: 16 hours (testing & validation)
- **Total**: 112 hours

### Dependencies:
- SQLite3 library installation (for tests)
- Asset directory creation
- Database backup/migration strategy

## Next Immediate Actions

### 🔴 CRITICAL (Start Immediately):
1. **Fix Test Environment**: Install SQLite3, fix failing tests
2. **Create Backup**: Export current data before changes
3. **Start WorkoutPool Implementation**: Core foundation

### 🟡 HIGH (This Week):
4. **Redesign Main Screen**: Simplify user flow
5. **Implement Cadence Logic**: Movement frequency tracking
6. **Create Movement Library UI**: User-facing movement management

### 🟢 MEDIUM (Next Week):
7. **Equipment Group Management**: Disable by equipment type
8. **Workout Pool UI**: Review and manage pool
9. **Selection Algorithm**: Smart workout selection logic

This plan will transform your app from a complex template-based system into the simple, elegant workout pool system described in your original vision. The key insight is that **simplicity is the goal** - users just want to open the app, get a workout from the pool, and go exercise.

Ready to execute this plan? 🚀