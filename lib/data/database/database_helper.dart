import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:logger/logger.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;
  final _logger = Logger();
  static const int _databaseVersion =
      4; // Increment version for movement library separation

  factory DatabaseHelper() => _instance;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    try {
      _database = await _initDatabase();
      return _database!;
    } catch (e) {
      _logger.e('Error getting database: $e');
      rethrow;
    }
  }

  Future<Database> _initDatabase() async {
    try {
      final dbPath = await getDatabasesPath();
      _logger.i('Database path: $dbPath');

      // Ensure the directory exists
      final dbDir = Directory(dbPath);
      if (!await dbDir.exists()) {
        await dbDir.create(recursive: true);
        _logger.i('Created database directory');
      }

      final path = join(dbPath, 'workout_app.db');
      _logger.i('Initializing database at path: $path');

      // Check if the database file exists
      final dbFile = File(path);
      if (await dbFile.exists()) {
        _logger.i('Database file already exists');
      } else {
        _logger.i('Creating new database file');
      }

      final db = await openDatabase(
        path,
        version: _databaseVersion,
        onCreate: _createDb,
        onUpgrade: _upgradeDb,
        onOpen: (db) {
          _logger.i('Database opened successfully');
        },
      );
      _logger.i('Database initialized successfully');
      return db;
    } catch (e) {
      _logger.e('Error initializing database: $e');
      rethrow;
    }
  }

  Future<void> _createDb(Database db, int version) async {
    try {
      _logger.i('Creating database tables...');

      // Create workouts table
      await db.execute('''
        CREATE TABLE workouts(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          format TEXT NOT NULL,
          intensity TEXT NOT NULL,
          rounds INTEGER,
          duration INTEGER,
          time_cap_in_minutes INTEGER,
          format_specific_settings TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          notes TEXT
        )
      ''');
      _logger.i('Created workouts table');

      // Create movement library table (base movements from JSON)
      await db.execute('''
        CREATE TABLE movement_library(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          categories TEXT NOT NULL,
          requiredEquipment TEXT NOT NULL,
          muscleGroups TEXT NOT NULL,
          difficultyLevel TEXT NOT NULL,
          isMainMovement INTEGER DEFAULT 0,
          scalingOptions TEXT,
          guidelines TEXT,
          videoUrl TEXT,
          imageUrl TEXT
        )
      ''');
      _logger.i('Created movement_library table');

      // Create workout movements table (specific movements in workouts)
      await db.execute('''
        CREATE TABLE workout_movements(
          id TEXT PRIMARY KEY,
          workout_id TEXT NOT NULL,
          movement_id TEXT NOT NULL,
          reps INTEGER,
          time_in_seconds INTEGER,
          weight REAL,
          scaling_option TEXT,
          FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
          FOREIGN KEY (movement_id) REFERENCES movement_library (id)
        )
      ''');
      _logger.i('Created workout_movements table');

      // Create workout templates table
      await db.execute('''
        CREATE TABLE workout_templates(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          format TEXT NOT NULL,
          intensity TEXT NOT NULL,
          targetDuration INTEGER NOT NULL,
          preferredCategories TEXT,
          availableEquipment TEXT,
          isMainMovementOnly INTEGER,
          created_at TEXT NOT NULL,
          lastUsed TEXT,
          timesUsed INTEGER DEFAULT 0,
          metadata TEXT
        )
      ''');
      _logger.i('Created workout_templates table');

      // Create user progress table with onboarding fields
      await db.execute('''
        CREATE TABLE user_progress(
          user_id TEXT PRIMARY KEY,
          last_workout_date TEXT NOT NULL,
          total_workouts_completed INTEGER NOT NULL DEFAULT 0,
          goals TEXT,
          achievements TEXT,
          is_first_run INTEGER DEFAULT 1,
          has_accepted_default_workouts INTEGER DEFAULT 0,
          onboarding_completed_at TEXT
        )
      ''');
      _logger.i('Created user_progress table');

      // Create workout results table
      await db.execute('''
        CREATE TABLE workout_results(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          workout_id TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          total_time_in_seconds INTEGER,
          total_rounds INTEGER,
          total_reps INTEGER,
          max_weight REAL,
          performance_metrics TEXT,
          notes TEXT,
          FOREIGN KEY (user_id) REFERENCES user_progress (user_id) ON DELETE CASCADE
        )
      ''');
      _logger.i('Created workout_results table');

      // Create movement progress table
      await db.execute('''
        CREATE TABLE movement_progress(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          movement_id TEXT NOT NULL,
          max_weight REAL,
          max_reps INTEGER,
          max_time_in_seconds INTEGER,
          last_updated TEXT NOT NULL,
          personal_records TEXT,
          UNIQUE(user_id, movement_id),
          FOREIGN KEY (user_id) REFERENCES user_progress (user_id) ON DELETE CASCADE
        )
      ''');
      _logger.i('Created movement_progress table');

      _logger.i('All database tables created successfully');
    } catch (e) {
      _logger.e('Error creating database tables: $e');
      rethrow;
    }
  }

  Future<void> _upgradeDb(Database db, int oldVersion, int newVersion) async {
    try {
      _logger.i('Upgrading database from version $oldVersion to $newVersion');

      if (oldVersion < 2) {
        // Add user progress tables for version 2
        _logger.i('Adding user progress tables...');

        // Create user progress table
        await db.execute('''
          CREATE TABLE user_progress(
            user_id TEXT PRIMARY KEY,
            last_workout_date TEXT NOT NULL,
            total_workouts_completed INTEGER NOT NULL DEFAULT 0,
            goals TEXT,
            achievements TEXT
          )
        ''');
        _logger.i('Created user_progress table');

        // Create workout results table
        await db.execute('''
          CREATE TABLE workout_results(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            workout_id TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            total_time_in_seconds INTEGER,
            total_rounds INTEGER,
            total_reps INTEGER,
            max_weight REAL,
            performance_metrics TEXT,
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES user_progress (user_id) ON DELETE CASCADE
          )
        ''');
        _logger.i('Created workout_results table');

        // Create movement progress table
        await db.execute('''
          CREATE TABLE movement_progress(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            movement_id TEXT NOT NULL,
            max_weight REAL,
            max_reps INTEGER,
            max_time_in_seconds INTEGER,
            last_updated TEXT NOT NULL,
            personal_records TEXT,
            UNIQUE(user_id, movement_id),
            FOREIGN KEY (user_id) REFERENCES user_progress (user_id) ON DELETE CASCADE
          )
        ''');
        _logger.i('Created movement_progress table');
      }

      if (oldVersion < 3) {
        // Add onboarding fields to user_progress table for version 3
        _logger.i('Adding onboarding fields to user_progress table...');

        await db.execute('''
          ALTER TABLE user_progress ADD COLUMN is_first_run INTEGER DEFAULT 1
        ''');

        await db.execute('''
          ALTER TABLE user_progress ADD COLUMN has_accepted_default_workouts INTEGER DEFAULT 0
        ''');

        await db.execute('''
          ALTER TABLE user_progress ADD COLUMN onboarding_completed_at TEXT
        ''');

        _logger.i('Added onboarding fields to user_progress table');
      }

      if (oldVersion < 4) {
        // Separate movement library from workout movements for version 4
        _logger.i('Separating movement library from workout movements...');

        // Create movement library table
        await db.execute('''
          CREATE TABLE movement_library(
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            categories TEXT NOT NULL,
            requiredEquipment TEXT NOT NULL,
            muscleGroups TEXT NOT NULL,
            difficultyLevel TEXT NOT NULL,
            isMainMovement INTEGER DEFAULT 0,
            scalingOptions TEXT,
            guidelines TEXT,
            videoUrl TEXT,
            imageUrl TEXT
          )
        ''');

        // Rename old movements table to workout_movements
        await db.execute('''
          ALTER TABLE movements RENAME TO workout_movements_backup
        ''');

        // Create new workout_movements table with proper structure
        await db.execute('''
          CREATE TABLE workout_movements(
            id TEXT PRIMARY KEY,
            workout_id TEXT NOT NULL,
            movement_id TEXT NOT NULL,
            reps INTEGER,
            time_in_seconds INTEGER,
            weight REAL,
            scaling_option TEXT,
            FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
            FOREIGN KEY (movement_id) REFERENCES movement_library (id)
          )
        ''');

        // Copy data from backup table (use name as movement_id for now)
        await db.execute('''
          INSERT INTO workout_movements (id, workout_id, movement_id, reps, time_in_seconds, weight, scaling_option)
          SELECT id, workout_id, name, reps, time_in_seconds, weight, scaling_option
          FROM workout_movements_backup
        ''');

        // Drop backup table
        await db.execute('''DROP TABLE workout_movements_backup''');

        _logger.i(
            'Successfully separated movement library from workout movements');
      }

      _logger.i('Database upgrade completed successfully');
    } catch (e) {
      _logger.e('Error upgrading database: $e');
      rethrow;
    }
  }

  Future<void> close() async {
    try {
      final db = await database;
      await db.close();
      _logger.i('Database closed successfully');
    } catch (e) {
      _logger.e('Error closing database: $e');
      rethrow;
    }
  }
}
