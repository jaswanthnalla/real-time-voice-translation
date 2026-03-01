import { query } from '../../config/database';

export interface Recording {
  id: string;
  sessionId: string;
  filePath: string;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  format: string | null;
  createdAt: Date;
}

export async function create(data: {
  sessionId: string;
  filePath: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  format?: string;
}): Promise<Recording> {
  const result = await query(
    `INSERT INTO recordings (session_id, file_path, file_size_bytes, duration_seconds, format)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.sessionId, data.filePath, data.fileSizeBytes ?? null, data.durationSeconds ?? null, data.format ?? null],
  );
  return mapRow(result.rows[0]);
}

export async function getBySessionId(sessionId: string): Promise<Recording[]> {
  const result = await query(
    'SELECT * FROM recordings WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId],
  );
  return result.rows.map(mapRow);
}

function mapRow(row: Record<string, unknown>): Recording {
  return {
    id: row['id'] as string,
    sessionId: row['session_id'] as string,
    filePath: row['file_path'] as string,
    fileSizeBytes: row['file_size_bytes'] as number | null,
    durationSeconds: row['duration_seconds'] as number | null,
    format: row['format'] as string | null,
    createdAt: row['created_at'] as Date,
  };
}
