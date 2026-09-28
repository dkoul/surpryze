import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { migrateDatabase } from './migrate.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  title TEXT NOT NULL,
  feature TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assumptions (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  feature TEXT,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  hypothesis TEXT NOT NULL,
  strategy TEXT NOT NULL,
  assumption_ids_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  expected_json TEXT,
  script_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  result TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  trace_path TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS surprises (
  id TEXT PRIMARY KEY,
  feature TEXT,
  expected TEXT NOT NULL,
  observed TEXT NOT NULL,
  assumption_id TEXT,
  experiment_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  impact TEXT,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  classification TEXT,
  human_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  recorded_at TEXT NOT NULL
);
`;

export function openDatabase(surpryzeDir: string): Database.Database {
  fs.mkdirSync(surpryzeDir, { recursive: true });
  const dbPath = path.join(surpryzeDir, 'knowledge.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  migrateDatabase(db);
  return db;
}
