import 'dart:async';
import 'package:flutter/material.dart';
import 'package:workout_app/data/models/workout.dart';
import 'package:workout_app/services/workout_service.dart';
import 'package:workout_app/services/audio_cue_service.dart';

class WorkoutExecutionScreen extends StatefulWidget {
  final WorkoutService workoutService;
  final String workoutId;

  const WorkoutExecutionScreen({
    super.key,
    required this.workoutService,
    required this.workoutId,
  });

  @override
  State<WorkoutExecutionScreen> createState() => _WorkoutExecutionScreenState();
}

class _WorkoutExecutionScreenState extends State<WorkoutExecutionScreen> {
  Workout? _workout;
  bool _isLoading = true;
  String? _error;
  Timer? _timer;
  int _elapsedSeconds = 0;
  int _currentRound = 1;
  int _currentMovementIndex = 0;
  bool _isResting = false;
  int _restSeconds = 0;
  bool _isPaused = false;
  Map<int, int> _completedReps = {}; // movement index -> completed reps
  late final AudioCueService _audioCueService;
  bool _isMuted = false;

  @override
  void initState() {
    super.initState();
    _audioCueService = AudioCueService();
    _initializeAudio();
    _loadWorkout();
  }

  Future<void> _initializeAudio() async {
    try {
      await _audioCueService.initialize();
    } catch (e) {
      // Audio initialization failed, but don't prevent the workout from continuing
      print('Failed to initialize audio: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Audio unavailable - workout will continue silently'),
            duration: Duration(seconds: 3),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _audioCueService.dispose();
    super.dispose();
  }

  Future<void> _loadWorkout() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final workout =
          await widget.workoutService.getWorkoutById(widget.workoutId);
      setState(() {
        _workout = workout;
        _isLoading = false;
      });
      _startTimer();
      await _audioCueService.playWorkoutStart();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return; // Prevent setState after dispose

      if (!_isPaused) {
        setState(() {
          _elapsedSeconds++;
          if (_isResting) {
            _restSeconds--;
            if (_restSeconds <= 0) {
              _isResting = false;
              _restSeconds = 0;
              _audioCueService.playRestEnd();
            } else if (_restSeconds == 10) {
              _audioCueService.playFormatSpecificCue(
                _workout!.format,
                _restSeconds,
              );
            }
          } else if (_workout != null) {
            // Check for format-specific timing cues
            final secondsInMinute = _elapsedSeconds % 60;
            if (secondsInMinute == 0) {
              _audioCueService.playFormatSpecificCue(
                _workout!.format,
                secondsInMinute,
              );
            } else if (secondsInMinute == 30) {
              _audioCueService.playFormatSpecificCue(
                _workout!.format,
                secondsInMinute,
              );
            }
          }
        });
      }
    });
  }

  void _togglePause() {
    setState(() {
      _isPaused = !_isPaused;
    });
  }

  void _toggleMute() {
    setState(() {
      _isMuted = !_isMuted;
      _audioCueService.toggleMute();
    });
  }

  void _completeMovement() {
    if (_workout == null ||
        _workout!.movements.isEmpty ||
        _currentMovementIndex >= _workout!.movements.length) {
      return;
    }

    final currentMovement = _workout!.movements[_currentMovementIndex];
    final completedReps = _completedReps[_currentMovementIndex] ?? 0;

    if (completedReps >= currentMovement.reps) {
      // Move to next movement or round
      if (_currentMovementIndex < _workout!.movements.length - 1) {
        setState(() {
          _currentMovementIndex++;
          _isResting = true;
          _restSeconds = 30; // Default rest period
        });
        _audioCueService.playRestStart();
      } else if (_workout!.rounds != null &&
          _currentRound < _workout!.rounds!) {
        setState(() {
          _currentRound++;
          _currentMovementIndex = 0;
          _isResting = true;
          _restSeconds = 60; // Longer rest between rounds
        });
        _audioCueService.playRoundStart();
      } else {
        _completeWorkout();
      }
    } else {
      setState(() {
        _completedReps[_currentMovementIndex] = completedReps + 1;
      });
    }
  }

  Future<void> _completeWorkout() async {
    _timer?.cancel();
    await _audioCueService.playWorkoutEnd();
    try {
      await widget.workoutService.markWorkoutAsCompleted(_workout!.id);
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error completing workout: $e'),
          ),
        );
      }
    }
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSeconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workout'),
        actions: [
          IconButton(
            icon: Icon(_isMuted ? Icons.volume_off : Icons.volume_up),
            onPressed: _toggleMute,
          ),
          IconButton(
            icon: Icon(_isPaused ? Icons.play_arrow : Icons.pause),
            onPressed: _togglePause,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Error loading workout',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadWorkout,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_workout == null) {
      return const Center(
        child: Text('Workout not found'),
      );
    }

    return Column(
      children: [
        _buildTimer(),
        if (_isResting) _buildRestTimer(),
        Expanded(
          child: _buildWorkoutContent(),
        ),
      ],
    );
  }

  Widget _buildTimer() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).primaryColor,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            _formatTime(_elapsedSeconds),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: Colors.white,
                ),
          ),
          if (_workout!.rounds != null)
            Text(
              'Round $_currentRound/${_workout!.rounds}',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                  ),
            ),
        ],
      ),
    );
  }

  Widget _buildRestTimer() {
    return Container(
      padding: const EdgeInsets.all(8),
      color: Colors.orange,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.timer, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            'Rest: ${_formatTime(_restSeconds)}',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkoutContent() {
    // Safety check: ensure we have movements and valid index
    if (_workout == null ||
        _workout!.movements.isEmpty ||
        _currentMovementIndex >= _workout!.movements.length) {
      return const Center(
        child: Text('No movements available for this workout'),
      );
    }

    final currentMovement = _workout!.movements[_currentMovementIndex];
    final completedReps = _completedReps[_currentMovementIndex] ?? 0;
    final remainingReps = currentMovement.reps - completedReps;

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            itemCount: _workout!.movements.length,
            itemBuilder: (context, index) {
              final movement = _workout!.movements[index];
              final isCurrentMovement = index == _currentMovementIndex;
              final movementCompletedReps = _completedReps[index] ?? 0;

              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: isCurrentMovement
                    ? Theme.of(context).primaryColor.withOpacity(0.1)
                    : null,
                child: ListTile(
                  title: Text(
                    'Movement ${index + 1}',
                    style: TextStyle(
                      fontWeight: isCurrentMovement ? FontWeight.bold : null,
                    ),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (movement.reps > 0)
                        Text(
                          'Reps: $movementCompletedReps/${movement.reps}',
                        ),
                      if (movement.timeInSeconds != null)
                        Text('Time: ${movement.timeInSeconds}s'),
                      if (movement.weight != null)
                        Text('Weight: ${movement.weight}kg'),
                      if (movement.scalingOption != null)
                        Text('Scaling: ${movement.scalingOption}'),
                    ],
                  ),
                  trailing: isCurrentMovement
                      ? IconButton(
                          icon: const Icon(Icons.check_circle),
                          onPressed: _completeMovement,
                        )
                      : null,
                ),
              );
            },
          ),
        ),
        if (!_isResting)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  'Current Movement',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  'Reps: $remainingReps remaining',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _completeMovement,
                  child: const Text('Complete Rep'),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
