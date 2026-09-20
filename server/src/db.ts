import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

// Resolve the SQLite file relative to this package so the database is found
// regardless of the current working directory (tests can point DATABASE_PATH
// at a disposable copy).
const defaultPath = path.join(__dirname, '..', 'sqlite.db');
const filename =
  process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim().length > 0
    ? process.env.DATABASE_PATH
    : defaultPath;

const sqlite = new Database(filename);
// Wait instead of throwing SQLITE_BUSY when two tabs write at the same time.
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);
export const databaseFile = filename;
