# Automated Testing Guide

This document describes the comprehensive automated testing setup for the Workout App, which provides robust testing capabilities that are better suited for Flutter applications than Playwright.

## Testing Architecture

Our testing strategy includes multiple layers of automated testing:

### 1. **Unit Tests** (`test/unit/`)
- Test individual functions, methods, and classes
- Fast execution and isolated testing
- Mock external dependencies
- High code coverage target (80%+)

### 2. **Widget Tests** (`test/widgets/`)
- Test individual Flutter widgets
- Verify UI behavior and interactions
- Test state management and user interactions
- Isolated widget testing with mocked dependencies

### 3. **Integration Tests** (`integration_test/`)
- End-to-end testing of complete user flows
- Test real app behavior on devices/emulators
- Verify navigation, data persistence, and complex interactions
- **This replaces Playwright for Flutter apps**

### 4. **Golden Tests** (`test/golden/`)
- UI regression testing through screenshot comparison
- Detect visual changes in widgets
- Ensure consistent UI across different platforms
- Automated visual testing

### 5. **BDD Tests** (`test/features/`)
- Behavior-driven development with Gherkin syntax
- Human-readable test scenarios
- Acceptance criteria validation
- Stakeholder-friendly test documentation

## Why Not Playwright?

Playwright is designed for web applications and doesn't work well with Flutter apps because:

1. **Flutter renders to a canvas** - Playwright can't inspect Flutter widgets
2. **No DOM access** - Flutter doesn't use traditional HTML elements
3. **Platform-specific** - Flutter apps run natively, not in browsers
4. **Limited interaction** - Can't access Flutter's widget tree or state

Our Flutter-specific testing approach provides:
- ✅ **Widget tree inspection** with Flutter Test
- ✅ **Native platform testing** with Integration Tests
- ✅ **State management testing** with BLoC Test
- ✅ **Visual regression testing** with Golden Tests
- ✅ **Performance testing** with Flutter Driver

## Quick Start

### Prerequisites
```bash
# Install Flutter (if not already installed)
# Install lcov for coverage reports (Linux/macOS)
sudo apt-get install lcov  # Ubuntu/Debian
brew install lcov          # macOS

# Make test script executable
chmod +x scripts/run_tests.sh
```

### Running Tests

#### Run All Tests
```bash
./scripts/run_tests.sh all
```

#### Run Specific Test Types
```bash
# Unit tests only
./scripts/run_tests.sh unit

# Widget tests only
./scripts/run_tests.sh widget

# Integration tests only
./scripts/run_tests.sh integration

# Golden tests only
./scripts/run_tests.sh golden

# Static analysis only
./scripts/run_tests.sh analysis

# Code formatting check
./scripts/run_tests.sh format

# Coverage report generation
./scripts/run_tests.sh coverage
```

#### Manual Flutter Commands
```bash
# Run all tests with coverage
flutter test --coverage

# Run specific test files
flutter test test/unit/movement_test.dart

# Run integration tests
flutter test integration_test/

# Update golden files
flutter test test/golden/ --update-goldens

# Run tests with specific device
flutter test integration_test/ -d chrome
```

## Test Structure

```
test/
├── features/                 # BDD feature files
│   ├── movement_library.feature
│   ├── workout_generation.feature
│   └── step_definitions/     # Gherkin step implementations
├── golden/                   # Golden/screenshot tests
│   └── golden_test.dart
├── helpers/                  # Test utilities and helpers
│   └── test_helpers.dart
├── mocks/                    # Mock objects and data
├── unit/                     # Unit tests
│   ├── data/
│   ├── services/
│   └── widgets/
└── widgets/                  # Widget tests

integration_test/             # Integration tests
└── app_test.dart
```

## Writing Tests

### Unit Test Example
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:workout_app/data/models/movement.dart';

void main() {
  group('Movement Model', () {
    test('should create movement with required fields', () {
      final movement = Movement(
        id: '1',
        name: 'Push-up',
        // ... other fields
      );
      
      expect(movement.id, equals('1'));
      expect(movement.name, equals('Push-up'));
    });
  });
}
```

### Widget Test Example
```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:workout_app/presentation/widgets/movement_card.dart';

void main() {
  testWidgets('MovementCard displays movement name', (WidgetTester tester) async {
    final movement = MockDataFactory.createMovement(name: 'Test Movement');
    
    await tester.pumpWidget(
      MaterialApp(
        home: MovementCard(movement: movement, onTap: () {}),
      ),
    );
    
    expect(find.text('Test Movement'), findsOneWidget);
  });
}
```

### Integration Test Example
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:workout_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  
  testWidgets('Complete workout generation flow', (WidgetTester tester) async {
    app.main();
    await tester.pumpAndSettle();
    
    // Navigate to workout generation
    await tester.tap(find.text('Start Workout'));
    await tester.pumpAndSettle();
    
    // Verify navigation worked
    expect(find.byIcon(Icons.arrow_back), findsOneWidget);
  });
}
```

### Golden Test Example
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:golden_toolkit/golden_toolkit.dart';

void main() {
  testGoldens('MovementCard golden test', (WidgetTester tester) async {
    await tester.pumpWidgetBuilder(
      MovementCard(movement: testMovement, onTap: () {}),
      surfaceSize: const Size(400, 200),
    );
    
    await expectLater(
      find.byType(MovementCard),
      matchesGoldenFile('movement_card.png'),
    );
  });
}
```

## Test Data and Mocking

### Using Test Helpers
```dart
import '../helpers/test_helpers.dart';

// Create mock data
final movements = MockDataFactory.createMovements(5);
final workout = MockDataFactory.createWorkout();

// Setup test database
await TestHelpers.initTestDatabase();

// Create test widget
final widget = TestHelpers.createTestWidget(MyWidget());
```

### Mocking Dependencies
```dart
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

@GenerateMocks([MovementRepository])
import 'movement_test.mocks.dart';

void main() {
  late MockMovementRepository mockRepository;
  
  setUp(() {
    mockRepository = MockMovementRepository();
  });
  
  test('should return movements from repository', () async {
    // Arrange
    when(mockRepository.getAllMovements())
        .thenAnswer((_) async => [testMovement]);
    
    // Act & Assert
    final movements = await mockRepository.getAllMovements();
    expect(movements, hasLength(1));
  });
}
```

## Continuous Integration

### GitHub Actions
Our CI pipeline automatically:
1. **Runs all test suites** on every push/PR
2. **Generates coverage reports** and uploads to Codecov
3. **Performs static analysis** and formatting checks
4. **Runs integration tests** on Android emulator
5. **Builds APK** for testing
6. **Archives test results** and coverage reports

### Local CI Simulation
```bash
# Run the same checks as CI
./scripts/run_tests.sh all

# Check formatting (same as CI)
dart format --set-exit-if-changed .

# Run analysis (same as CI)
flutter analyze
```

## Coverage Reports

### Generating Coverage
```bash
# Generate coverage with all tests
flutter test --coverage

# Generate HTML report
genhtml coverage/lcov.info -o coverage/html

# Open coverage report
open coverage/html/index.html  # macOS
xdg-open coverage/html/index.html  # Linux
```

### Coverage Targets
- **Minimum coverage**: 80%
- **Exclude from coverage**:
  - Generated files (`*.g.dart`, `*.freezed.dart`)
  - Test files
  - Main entry point

## Performance Testing

### Integration Test Performance
```dart
testWidgets('Performance test - smooth scrolling', (WidgetTester tester) async {
  // Test scrolling performance
  await tester.drag(find.byType(ListView), const Offset(0, -300));
  await tester.pumpAndSettle();
  
  // Verify no frame drops or performance issues
  expect(find.byType(ListView), findsOneWidget);
});
```

### Memory Leak Detection
```dart
testWidgets('Memory leak test', (WidgetTester tester) async {
  // Navigate through multiple screens
  // Verify memory usage doesn't continuously increase
});
```

## Best Practices

### Test Organization
1. **Group related tests** using `group()`
2. **Use descriptive test names** that explain what is being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests independent** - no shared state between tests
5. **Use setUp/tearDown** for common test setup

### Test Data
1. **Use factories** for creating test data
2. **Make test data realistic** but minimal
3. **Use constants** for commonly used test values
4. **Mock external dependencies** consistently

### Performance
1. **Keep unit tests fast** (< 100ms each)
2. **Limit integration test scope** to critical paths
3. **Use golden tests sparingly** for key UI components
4. **Parallelize test execution** when possible

## Troubleshooting

### Common Issues

#### Golden Test Failures
```bash
# Update golden files when UI changes are intentional
flutter test test/golden/ --update-goldens
```

#### Integration Test Timeouts
```dart
// Increase timeout for slow operations
await tester.pumpAndSettle(const Duration(seconds: 10));
```

#### Coverage Issues
```bash
# Exclude files from coverage
lcov --remove coverage/lcov.info 'lib/generated/*' -o coverage/lcov_cleaned.info
```

#### Mock Generation
```bash
# Generate mocks after adding @GenerateMocks annotation
flutter packages pub run build_runner build
```

## Advanced Features

### Custom Matchers
```dart
Matcher hasMovementWithName(String name) {
  return predicate<List<Movement>>(
    (movements) => movements.any((m) => m.name == name),
    'contains movement with name $name',
  );
}
```

### Test Fixtures
```dart
// Load test data from JSON files
final testData = await loadTestFixture('movements.json');
```

### Parameterized Tests
```dart
void main() {
  for (final format in WorkoutFormat.values) {
    test('should generate $format workout', () {
      // Test each workout format
    });
  }
}
```

## Conclusion

This automated testing setup provides comprehensive coverage for your Flutter workout app, offering capabilities that are superior to Playwright for Flutter development:

- **Native Flutter testing** with proper widget inspection
- **Multi-layer testing strategy** covering all aspects of the app
- **Automated CI/CD pipeline** with coverage reporting
- **Visual regression testing** with golden files
- **Performance and integration testing** on real devices

The testing framework is designed to grow with your app and provide confidence in your code quality and functionality. 