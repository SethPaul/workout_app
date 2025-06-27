Feature: Movement Library
  As a fitness enthusiast
  I want to browse and filter movements
  So that I can find the right exercises for my workout

  Background:
    Given the app is launched
    And I am on the movement library page

  Scenario: View all movements
    Given there are movements in the database
    When I view the movement list
    Then I should see a list of movements
    And each movement should display its name and description

  Scenario: Filter movements by category
    Given there are movements in different categories
    When I filter by "bodyweight" category
    Then I should only see bodyweight movements
    And other category movements should be hidden

  Scenario: Filter movements by equipment
    Given there are movements requiring different equipment
    When I filter by "barbell" equipment
    Then I should only see movements that require a barbell
    And movements not requiring barbell should be hidden

  Scenario: Search movements by name
    Given there are movements with different names
    When I search for "push"
    Then I should see movements containing "push" in their name
    And other movements should be hidden

  Scenario: View movement details
    Given there is a movement called "Push-up"
    When I tap on the "Push-up" movement
    Then I should see the movement detail page
    And I should see the movement description
    And I should see the required equipment
    And I should see the muscle groups targeted
    And I should see the difficulty level

  Scenario: Filter by main movements only
    Given there are both main and accessory movements
    When I filter to show only main movements
    Then I should only see movements marked as main movements
    And accessory movements should be hidden

  Scenario: Clear all filters
    Given I have applied multiple filters
    When I clear all filters
    Then I should see all movements again
    And no filters should be active

  Scenario: No movements found
    Given there are movements in the database
    When I search for "nonexistent"
    Then I should see a "no movements found" message
    And the movement list should be empty 