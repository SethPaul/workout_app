// import 'package:audioplayers/audioplayers.dart'; // Temporarily disabled due to dependency conflicts
import 'package:workout_app/data/models/workout.dart';

class AudioCueService {
  // final AudioPlayer _audioPlayer = AudioPlayer(); // Temporarily disabled
  bool _isMuted = false;
  bool _isInitialized = false;

  // Audio cue types
  static const String _beepSound = 'audio/beep.mp3';
  static const String _bellSound = 'audio/bell.mp3';
  static const String _whistleSound = 'audio/whistle.mp3';
  static const String _countdownSound = 'audio/countdown.mp3';

  Future<void> initialize() async {
    // TODO: Re-enable when audioplayers dependency issues are resolved
    try {
      // await _audioPlayer.setSource(AssetSource(_beepSound));
      _isInitialized = false; // Disabled until dependency is restored
      _isMuted = true; // Auto-mute since audio is disabled
    } catch (e) {
      // Audio initialization failed, disable audio features
      print('AudioCueService: Failed to initialize audio - $e');
      _isMuted = true; // Automatically mute if audio fails
      _isInitialized = false;
    }
  }

  void toggleMute() {
    _isMuted = !_isMuted;
  }

  bool get isMuted => _isMuted;
  bool get isInitialized => _isInitialized;

  Future<void> _playSound(String soundPath) async {
    if (_isMuted || !_isInitialized) return;

    try {
      // TODO: Re-enable when audioplayers dependency issues are resolved
      // await _audioPlayer.play(AssetSource(soundPath));
      print('AudioCueService: Would play $soundPath (audio disabled)');
    } catch (e) {
      // Silently handle audio playback errors
      print('AudioCueService: Failed to play $soundPath - $e');
    }
  }

  Future<void> playBeep() async {
    await _playSound(_beepSound);
  }

  Future<void> playBell() async {
    await _playSound(_bellSound);
  }

  Future<void> playWhistle() async {
    await _playSound(_whistleSound);
  }

  Future<void> playCountdown() async {
    await _playSound(_countdownSound);
  }

  Future<void> playWorkoutStart() async {
    await playBell();
  }

  Future<void> playWorkoutEnd() async {
    await playWhistle();
  }

  Future<void> playRoundStart() async {
    await playBeep();
  }

  Future<void> playRestStart() async {
    await playBeep();
  }

  Future<void> playRestEnd() async {
    await playBell();
  }

  Future<void> playMovementTransition() async {
    await playBeep();
  }

  Future<void> playFormatSpecificCue(
    WorkoutFormat format,
    int secondsRemaining,
  ) async {
    if (_isMuted || !_isInitialized) return;

    switch (format) {
      case WorkoutFormat.emom:
        if (secondsRemaining == 10) {
          await playCountdown();
        } else if (secondsRemaining == 0) {
          await playBell();
        }
        break;
      case WorkoutFormat.tabata:
        if (secondsRemaining == 20) {
          await playBell();
        } else if (secondsRemaining == 10) {
          await playWhistle();
        }
        break;
      case WorkoutFormat.amrap:
        if (secondsRemaining == 30) {
          await playCountdown();
        }
        break;
      case WorkoutFormat.forTime:
        if (secondsRemaining == 30) {
          await playCountdown();
        }
        break;
      case WorkoutFormat.forReps:
        // Simple time markers for rep-based workouts
        for (int minute = 5; minute < 30; minute += 5) {
          if (secondsRemaining == minute) {
            await playBeep();
          }
        }
        break;
      case WorkoutFormat.roundsForTime:
      case WorkoutFormat.deathBy:
      case WorkoutFormat.chipper:
      case WorkoutFormat.ladder:
      case WorkoutFormat.partner:
        // Default minute markers for other formats
        for (int minute = 1; minute < 30; minute++) {
          if (secondsRemaining == minute) {
            await playBeep();
          }
        }
        break;
      default:
        break;
    }
  }

  void dispose() {
    try {
      // TODO: Re-enable when audioplayers dependency issues are resolved
      // _audioPlayer.dispose();
      print('AudioCueService: Audio player disposal skipped (audio disabled)');
    } catch (e) {
      print('AudioCueService: Error disposing audio player - $e');
    }
  }
}
