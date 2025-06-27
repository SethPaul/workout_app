import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:logger/logger.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;
  final _logger = Logger();

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
        version: 2,
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

      // Create movements table
      await db.execute('''
        CREATE TABLE movements(
          id TEXT PRIMARY KEY,
          workout_id TEXT NOT NULL,
          name TEXT NOT NULL,
          reps INTEGER,
          time_in_seconds INTEGER,
          weight REAL,
          scaling_option TEXT,
          FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
        )
      ''');
      _logger.i('Created movements table');

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
