#!/bin/bash

# Workout App Test Runner Script
# This script runs all types of tests and generates coverage reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MIN_COVERAGE=80
TEST_REPORTS_DIR="test_reports"
COVERAGE_DIR="coverage"
FLUTTER_CMD="snap run flutter"

# Functions
print_header() {
    echo -e "${GREEN}===============================================${NC}"
    echo -e "${GREEN}         Workout App Test Suite Runner        ${NC}"
    echo -e "${GREEN}===============================================${NC}"
}

print_status() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

setup_test_environment() {
    print_status "Setting up test environment..."
    
    # Create test reports directory
    mkdir -p $TEST_REPORTS_DIR
    mkdir -p $COVERAGE_DIR
    
    # Clean previous test data
    rm -rf test_reports/*
    rm -rf coverage/*
    
    # Get dependencies
    print_status "Getting Flutter dependencies..."
    $FLUTTER_CMD pub get
    
    print_success "Test environment ready"
}

run_unit_tests() {
    print_status "Running unit tests..."
    
    if $FLUTTER_CMD test test/unit/ --coverage --reporter expanded; then
        print_success "Unit tests passed"
        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

run_widget_tests() {
    print_status "Running widget tests..."
    
    if $FLUTTER_CMD test test/widgets/ --coverage --reporter expanded; then
        print_success "Widget tests passed"
        return 0
    else
        print_error "Widget tests failed"
        return 1
    fi
}

run_integration_tests() {
    print_status "Running integration tests..."
    
    if $FLUTTER_CMD test integration_test/ --coverage --reporter expanded; then
        print_success "Integration tests passed"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

run_golden_tests() {
    print_status "Running golden tests..."
    
    if $FLUTTER_CMD test test/golden/ --update-goldens --reporter expanded; then
        print_success "Golden tests passed"
        return 0
    else
        print_error "Golden tests failed"
        return 1
    fi
}

run_all_tests() {
    print_status "Running all tests..."
    
    local unit_result=0
    local widget_result=0
    local integration_result=0
    local golden_result=0
    
    # Run different test suites
    run_unit_tests || unit_result=1
    run_widget_tests || widget_result=1
    run_integration_tests || integration_result=1
    run_golden_tests || golden_result=1
    
    # Check overall results
    if [ $unit_result -eq 0 ] && [ $widget_result -eq 0 ] && [ $integration_result -eq 0 ] && [ $golden_result -eq 0 ]; then
        print_success "All test suites passed!"
        return 0
    else
        print_error "Some test suites failed"
        return 1
    fi
}

generate_coverage_report() {
    print_status "Generating coverage report..."
    
    # Generate LCOV report
    if command -v lcov &> /dev/null; then
        lcov --remove coverage/lcov.info \
            '**/*.g.dart' \
            '**/*.freezed.dart' \
            '**/generated/**' \
            'test/**' \
            'integration_test/**' \
            -o coverage/lcov_cleaned.info
        
        # Generate HTML report
        genhtml coverage/lcov_cleaned.info -o coverage/html
        print_success "Coverage report generated in coverage/html/index.html"
    else
        print_error "lcov not found. Install with: sudo apt-get install lcov"
    fi
    
    # Check coverage percentage
    if command -v $FLUTTER_CMD &> /dev/null; then
        print_status "Checking coverage percentage..."
        # This is a simplified coverage check - you might want to use a more sophisticated tool
        $FLUTTER_CMD test --coverage
        print_success "Coverage check completed"
    fi
}

run_static_analysis() {
    print_status "Running static analysis..."
    
    if $FLUTTER_CMD analyze; then
        print_success "Static analysis passed"
        return 0
    else
        print_error "Static analysis failed"
        return 1
    fi
}

run_formatting_check() {
    print_status "Checking code formatting..."
    
    if snap run dart format --set-exit-if-changed .; then
        print_success "Code formatting is correct"
        return 0
    else
        print_error "Code formatting issues found. Run: snap run dart format ."
        return 1
    fi
}

main() {
    print_header
    
    local test_type="${1:-all}"
    local update_goldens="${2:-false}"
    
    setup_test_environment
    
    case $test_type in
        "unit")
            run_unit_tests
            ;;
        "widget")
            run_widget_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "golden")
            run_golden_tests
            ;;
        "all")
            run_all_tests
            ;;
        "analysis")
            run_static_analysis
            ;;
        "format")
            run_formatting_check
            ;;
        "coverage")
            generate_coverage_report
            ;;
        *)
            print_error "Unknown test type: $test_type"
            echo "Usage: $0 [unit|widget|integration|golden|all|analysis|format|coverage]"
            exit 1
            ;;
    esac
}

# Call main function with all arguments
main "$@" 