import type Database from 'better-sqlite3';

const EDGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS graph_edges (
  id TEXT PRIMARY KEY,
  from_kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  evidence_kind TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assumption_evidence (
  id TEXT PRIMARY KEY,
  assumption_id TEXT NOT NULL,
  ref_kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  ref_label TEXT,
  evidence_kind TEXT NOT NULL,
  polarity TEXT NOT NULL,
  weight REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (assumption_id) REFERENCES assumptions(id)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_kind, from_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges(to_kind, to_id);
CREATE INDEX IF NOT EXISTS idx_assumption_evidence_assumption ON assumption_evidence(assumption_id);
`;

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

export function migrateDatabase(db: Database.Database): void {
  db.exec(EDGE_SCHEMA);

  if (!columnExists(db, 'assumptions', 'evidence_class')) {
    db.exec(`ALTER TABLE assumptions ADD COLUMN evidence_class TEXT NOT NULL DEFAULT 'UNKNOWN'`);
  }
  if (!columnExists(db, 'assumptions', 'missing_scenarios_json')) {
    db.exec(`ALTER TABLE assumptions ADD COLUMN missing_scenarios_json TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!columnExists(db, 'assumptions', 'statement_hash')) {
    db.exec(`ALTER TABLE assumptions ADD COLUMN statement_hash TEXT`);
  }
  if (!columnExists(db, 'assumptions', 'claim_precision')) {
    db.exec(`ALTER TABLE assumptions ADD COLUMN claim_precision TEXT NOT NULL DEFAULT 'structural'`);
  }
  if (!columnExists(db, 'assumptions', 'expected_literals_json')) {
    db.exec(`ALTER TABLE assumptions ADD COLUMN expected_literals_json TEXT NOT NULL DEFAULT '[]'`);
  }
}
