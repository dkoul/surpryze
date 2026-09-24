import type Database from 'better-sqlite3';
import type {
  Assumption,
  Experiment,
  Observation,
  ParsedTest,
  Surprise,
} from './schemas.js';

export class KnowledgeStore {
  constructor(private readonly db: Database.Database) {}

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  getMeta(key: string): string | undefined {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  upsertTest(test: ParsedTest): void {
    this.db
      .prepare(
        `INSERT INTO tests (id, file_path, title, feature, data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           file_path = excluded.file_path,
           title = excluded.title,
           feature = excluded.feature,
           data_json = excluded.data_json`,
      )
      .run(
        test.id,
        test.filePath,
        test.title,
        test.feature ?? null,
        JSON.stringify(test),
        new Date().toISOString(),
      );
  }

  listTests(): ParsedTest[] {
    const rows = this.db.prepare(`SELECT data_json FROM tests`).all() as { data_json: string }[];
    return rows.map((r) => JSON.parse(r.data_json) as ParsedTest);
  }

  countTests(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM tests`).get() as { c: number };
    return row.c;
  }

  upsertAssumption(a: Assumption): void {
    this.db
      .prepare(
        `INSERT INTO assumptions (id, statement, feature, source, confidence, status, provenance_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           statement = excluded.statement,
           feature = excluded.feature,
           source = excluded.source,
           confidence = excluded.confidence,
           status = excluded.status,
           provenance_json = excluded.provenance_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        a.id,
        a.statement,
        a.feature ?? null,
        a.source,
        a.confidence,
        a.status,
        JSON.stringify(a.provenance),
        a.createdAt,
        a.updatedAt,
      );
  }

  listAssumptions(): Assumption[] {
    const rows = this.db.prepare(`SELECT * FROM assumptions`).all() as Record<string, unknown>[];
    return rows.map(rowToAssumption);
  }

  getAssumption(id: string): Assumption | undefined {
    const row = this.db.prepare(`SELECT * FROM assumptions WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToAssumption(row) : undefined;
  }

  upsertExperiment(e: Experiment): void {
    this.db
      .prepare(
        `INSERT INTO experiments (id, hypothesis, strategy, assumption_ids_json, steps_json, expected_json, script_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hypothesis = excluded.hypothesis,
           script_path = excluded.script_path`,
      )
      .run(
        e.id,
        e.hypothesis,
        e.strategy,
        JSON.stringify(e.assumptionIds),
        JSON.stringify(e.steps),
        e.expected ? JSON.stringify(e.expected) : null,
        e.scriptPath ?? null,
        e.createdAt,
      );
  }

  listExperiments(): Experiment[] {
    const rows = this.db.prepare(`SELECT * FROM experiments`).all() as Record<string, unknown>[];
    return rows.map(rowToExperiment);
  }

  getExperiment(id: string): Experiment | undefined {
    const row = this.db.prepare(`SELECT * FROM experiments WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToExperiment(row) : undefined;
  }

  insertObservation(o: Observation): void {
    this.db
      .prepare(
        `INSERT INTO observations (id, experiment_id, result, payload_json, trace_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(o.id, o.experimentId, o.result, JSON.stringify(o.payload), o.tracePath ?? null, o.createdAt);
  }

  listObservations(): Observation[] {
    const rows = this.db.prepare(`SELECT * FROM observations`).all() as Record<string, unknown>[];
    return rows.map(rowToObservation);
  }

  insertSurprise(s: Surprise): void {
    this.db
      .prepare(
        `INSERT INTO surprises (id, feature, expected, observed, assumption_id, experiment_id, observation_id, evidence_json, impact, confidence, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        s.id,
        s.feature ?? null,
        s.expected,
        s.observed,
        s.assumptionId ?? null,
        s.experimentId,
        s.observationId,
        JSON.stringify(s.evidence),
        s.impact ?? null,
        s.confidence,
        s.status,
        s.createdAt,
        s.createdAt,
      );
  }

  updateSurprise(
    id: string,
    patch: {
      status?: Surprise['status'];
      classification?: string;
      humanNote?: string;
    },
  ): void {
    const existing = this.getSurprise(id);
    if (!existing) return;
    this.db
      .prepare(
        `UPDATE surprises SET status = ?, classification = ?, human_note = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        patch.status ?? existing.status,
        patch.classification ?? null,
        patch.humanNote ?? null,
        new Date().toISOString(),
        id,
      );
  }

  getSurprise(id: string): (Surprise & { classification?: string; humanNote?: string }) | undefined {
    const row = this.db.prepare(`SELECT * FROM surprises WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;
    const base = rowToSurprise(row);
    return {
      ...base,
      classification: row.classification as string | undefined,
      humanNote: row.human_note as string | undefined,
    };
  }

  listSurprises(): Surprise[] {
    const rows = this.db.prepare(`SELECT * FROM surprises ORDER BY created_at DESC`).all() as Record<
      string,
      unknown
    >[];
    return rows.map(rowToSurprise);
  }

  recordMetric(name: string, value: number): void {
    this.db
      .prepare(`INSERT INTO metrics (name, value, recorded_at) VALUES (?, ?, ?)`)
      .run(name, value, new Date().toISOString());
  }
}

function rowToAssumption(row: Record<string, unknown>): Assumption {
  return {
    id: row.id as string,
    statement: row.statement as string,
    feature: (row.feature as string) ?? undefined,
    source: row.source as Assumption['source'],
    confidence: row.confidence as number,
    status: row.status as Assumption['status'],
    provenance: JSON.parse(row.provenance_json as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToExperiment(row: Record<string, unknown>): Experiment {
  return {
    id: row.id as string,
    hypothesis: row.hypothesis as string,
    strategy: row.strategy as Experiment['strategy'],
    assumptionIds: JSON.parse(row.assumption_ids_json as string),
    steps: JSON.parse(row.steps_json as string),
    expected: row.expected_json ? JSON.parse(row.expected_json as string) : undefined,
    scriptPath: (row.script_path as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function rowToObservation(row: Record<string, unknown>): Observation {
  return {
    id: row.id as string,
    experimentId: row.experiment_id as string,
    result: row.result as Observation['result'],
    payload: JSON.parse(row.payload_json as string),
    tracePath: (row.trace_path as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function rowToSurprise(row: Record<string, unknown>): Surprise {
  return {
    id: row.id as string,
    feature: (row.feature as string) ?? undefined,
    expected: row.expected as string,
    observed: row.observed as string,
    assumptionId: (row.assumption_id as string) ?? undefined,
    experimentId: row.experiment_id as string,
    observationId: row.observation_id as string,
    evidence: JSON.parse(row.evidence_json as string),
    impact: (row.impact as string) ?? undefined,
    confidence: row.confidence as number,
    status: row.status as Surprise['status'],
    createdAt: row.created_at as string,
  };
}
