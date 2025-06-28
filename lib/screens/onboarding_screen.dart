import 'package:flutter/material.dart';
import 'package:workout_app/services/default_workout_service.dart';
import 'package:workout_app/services/user_progress_service.dart';

class OnboardingScreen extends StatefulWidget {
  final DefaultWorkoutService defaultWorkoutService;
  final UserProgressService userProgressService;
  final VoidCallback onComplete;

  const OnboardingScreen({
    super.key,
    required this.defaultWorkoutService,
    required this.userProgressService,
    required this.onComplete,
  });

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _currentPage = 0;
  String _selectedPreference = '';
  List<String> _selectedWorkouts = [];
  bool _isLoading = false;

  final PageController _pageController = PageController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Progress indicator
            LinearProgressIndicator(
              value: (_currentPage + 1) / 3,
              backgroundColor: Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(
                Theme.of(context).primaryColor,
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                children: [
                  _buildWelcomePage(),
                  _buildPreferencePage(),
                  _buildWorkoutSelectionPage(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomePage() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.fitness_center, size: 100, color: Colors.deepPurple),
          const SizedBox(height: 32),
          Text(
            'Welcome to Workout App!',
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'Let\'s get you started with some awesome workouts tailored to your preferences.',
            style: Theme.of(context).textTheme.bodyLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 48),
          ElevatedButton(
            onPressed: () {
              _pageController.nextPage(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            },
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            ),
            child: const Text('Get Started'),
          ),
        ],
      ),
    );
  }

  Widget _buildPreferencePage() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          const SizedBox(height: 32),
          Text(
            'What\'s your fitness focus?',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'Choose your main fitness goal to get personalized workout recommendations.',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          Expanded(
            child: ListView(
              children: [
                _buildPreferenceCard(
                  'Beginner',
                  'New to fitness? Start with gentle, foundational workouts',
                  Icons.sentiment_very_satisfied,
                  Colors.green,
                ),
                const SizedBox(height: 16),
                _buildPreferenceCard(
                  'Cardio',
                  'Focus on heart health and endurance training',
                  Icons.favorite,
                  Colors.red,
                ),
                const SizedBox(height: 16),
                _buildPreferenceCard(
                  'Strength',
                  'Build muscle and increase overall strength',
                  Icons.fitness_center,
                  Colors.orange,
                ),
                const SizedBox(height: 16),
                _buildPreferenceCard(
                  'Mixed',
                  'A balanced approach to all aspects of fitness',
                  Icons.all_inclusive,
                  Colors.blue,
                ),
              ],
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () {
                  _pageController.previousPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
                child: const Text('Back'),
              ),
              ElevatedButton(
                onPressed: _selectedPreference.isNotEmpty
                    ? () {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                      }
                    : null,
                child: const Text('Next'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreferenceCard(
    String preference,
    String description,
    IconData icon,
    Color color,
  ) {
    final isSelected = _selectedPreference == preference;

    return Card(
      elevation: isSelected ? 4 : 1,
      color: isSelected ? color.withOpacity(0.1) : null,
      child: ListTile(
        leading: Icon(icon, color: color, size: 32),
        title: Text(
          preference,
          style: TextStyle(
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        subtitle: Text(description),
        trailing: isSelected
            ? Icon(Icons.check_circle, color: color)
            : const Icon(Icons.radio_button_unchecked),
        onTap: () {
          setState(() {
            _selectedPreference = preference;
          });
        },
      ),
    );
  }

  Widget _buildWorkoutSelectionPage() {
    final recommendedWorkouts = widget.defaultWorkoutService
        .getRecommendedWorkouts(_selectedPreference);

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          const SizedBox(height: 16),
          Text(
            'Choose Your Starter Workouts',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Select workouts that interest you. You can always add more later!',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              itemCount: recommendedWorkouts.length,
              itemBuilder: (context, index) {
                final workout = recommendedWorkouts[index];
                final workoutName = workout['name'] as String;
                final isSelected = _selectedWorkouts.contains(workoutName);

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: CheckboxListTile(
                    title: Row(
                      children: [
                        Text(
                          workout['icon'] as String,
                          style: const TextStyle(fontSize: 24),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            workoutName,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(workout['description'] as String),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Chip(
                              label: Text(
                                '${workout['targetDuration']} min',
                                style: const TextStyle(fontSize: 12),
                              ),
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                            ),
                            const SizedBox(width: 8),
                            Chip(
                              label: Text(
                                '${workout['intensity']}'
                                    .split('.')
                                    .last
                                    .toUpperCase(),
                                style: const TextStyle(fontSize: 12),
                              ),
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                            ),
                          ],
                        ),
                      ],
                    ),
                    value: isSelected,
                    onChanged: (value) {
                      setState(() {
                        if (value ?? false) {
                          _selectedWorkouts.add(workoutName);
                        } else {
                          _selectedWorkouts.remove(workoutName);
                        }
                      });
                    },
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              TextButton(
                onPressed: () {
                  _pageController.previousPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
                child: const Text('Back'),
              ),
              const Spacer(),
              TextButton(
                onPressed: _isLoading ? null : _completeOnboarding,
                child: const Text('Skip'),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _isLoading ? null : _completeOnboarding,
                child: _isLoading
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        _selectedWorkouts.isNotEmpty
                            ? 'Add Workouts'
                            : 'Continue',
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _completeOnboarding() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Add selected workouts if any were chosen
      if (_selectedWorkouts.isNotEmpty) {
        await widget.defaultWorkoutService.addSelectedDefaultWorkouts(
          _selectedWorkouts,
        );
      }

      // Update user progress to mark onboarding as complete
      final userProgress = await widget.userProgressService
          .getCurrentUserProgress();
      if (userProgress != null) {
        final updatedProgress = userProgress.copyWith(
          isFirstRun: false,
          hasAcceptedDefaultWorkouts: _selectedWorkouts.isNotEmpty,
          onboardingCompletedAt: DateTime.now(),
        );
        await widget.userProgressService.updateUserProgress(updatedProgress);
      }

      // Show success message
      if (mounted && _selectedWorkouts.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Added ${_selectedWorkouts.length} starter workouts!',
            ),
            backgroundColor: Colors.green,
          ),
        );
      }

      // Complete onboarding
      widget.onComplete();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error setting up workouts: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}
