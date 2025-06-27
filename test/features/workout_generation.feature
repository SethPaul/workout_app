Feature: Workout Generation
  As a fitness enthusiast
  I want to generate workouts automatically
  So that I can have varied and structured training sessions

  Background:
    Given the app is launched
    And I am on the workout generation page

  Scenario: Generate basic AMRAP workout
    Given there are movements available in the database
    When I select "AMRAP" format
    And I set duration to "20" minutes
    And I set intensity to "medium"
    And I generate a workout
    Then I should see a workout with "AMRAP" format
    And the workout should have a time cap of "20" minutes
    And the workout should contain 3-5 movements
    And each movement should have specified reps

  Scenario: Generate EMOM workout
    Given there are movements available in the database
    When I select "EMOM" format
    And I set duration to "15" minutes
    And I set intensity to "high"
    And I generate a workout
    Then I should see a workout with "EMOM" format
    And the workout should have "15" rounds
    And each round should be 1 minute
    And movements should be balanced across muscle groups

  Scenario: Generate workout with equipment restrictions
    Given there are movements requiring different equipment
    When I select available equipment as "bodyweight" only
    And I generate a workout
    Then all movements in the workout should be bodyweight movements
    And no equipment-requiring movements should be included

  Scenario: Generate workout with intensity preference
    Given there are movements with different difficulty levels
    When I select "beginner" intensity
    And I generate a workout
    Then all movements should be beginner-friendly
    And advanced movements should not be included

  Scenario: Generate For Time workout
    Given there are movements available in the database
    When I select "For Time" format
    And I set target time to "12" minutes
    And I generate a workout
    Then I should see a workout with "For Time" format
    And the workout should have a suggested time cap
    And movements should be arranged for decreasing reps

  Scenario: Regenerate workout
    Given I have generated a workout
    When I tap the "Regenerate" button
    Then I should see a new workout
    And the new workout should be different from the previous one
    But should maintain the same format and settings

  Scenario: Save generated workout
    Given I have generated a workout
    When I tap the "Save Workout" button
    And I enter a workout name "My Custom AMRAP"
    Then the workout should be saved to my library
    And I should be able to find it in saved workouts

  Scenario: Generate workout with insufficient movements
    Given there are only 2 movements in the database
    When I try to generate an AMRAP workout
    Then I should see a warning message
    And the system should suggest adding more movements 