import 'package:audioplayers/audioplayers.dart';
import 'package:workout_app/data/models/workout.dart';

class AudioCueService {
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isMuted = false;

  // Audio cue types
  static const String _beepSound = 'assets/audio/beep.mp3';
  static const String _bellSound = 'assets/audio/bell.mp3';
  static const String _whistleSound = 'assets/audio/whistle.mp3';
  static const String _countdownSound = 'assets/audio/countdown.mp3';

  Future<void> initialize() async {
    await _audioPlayer.setSource(AssetSource(_beepSound));
  }

  void toggleMute() {
    _isMuted = !_isMuted;
  }

  bool get isMuted => _isMuted;

  Future<void> playBeep() async {
    if (_isMuted) return;
    await _audioPlayer.play(AssetSource(_beepSound));
  }

  Future<void> playBell() async {
    if (_isMuted) return;
    await _audioPlayer.play(AssetSource(_bellSound));
  }

  Future<void> playWhistle() async {
    if (_isMuted) return;
    await _audioPlayer.play(AssetSource(_whistleSound));
  }

  Future<void> playCountdown() async {
    if (_isMuted) return;
    await _audioPlayer.play(AssetSource(_countdownSound));
  }

  Future<void> playWorkoutStart() async {
    if (_isMuted) return;
    await playBell();
  }

  Future<void> playWorkoutEnd() async {
    if (_isMuted) return;
    await playWhistle();
  }

  Future<void> playRoundStart() async {
    if (_isMuted) return;
    await playBeep();
  }

  Future<void> playRestStart() async {
    if (_isMuted) return;
    await playBeep();
  }

  Future<void> playRestEnd() async {
    if (_isMuted) return;
    await playBell();
  }

  Future<void> playMovementTransition() async {
    if (_isMuted) return;
    await playBeep();
  }

  Future<void> playFormatSpecificCue(
      WorkoutFormat format, int secondsRemaining) async {
    if (_isMuted) return;

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
    _audioPlayer.dispose();
  }
}
