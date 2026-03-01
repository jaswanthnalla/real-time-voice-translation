import { query } from '../../config/database';
import { TranslationSession, CreateSessionInput } from '../../types/session';
import { PaginationParams, PaginatedResponse } from '../../types/api';

export async function create(data: CreateSessionInput): Promise<TranslationSession> {
  const result = await query(
    'INSERT INTO sessions (user_id, call_type) VALUES ($1, $2) RETURNING *',
    [data.userId, data.callType],
  );
  return mapRow(result.rows[0]);
}

export async function findById(id: string): Promise<TranslationSession | null> {
  const result = await query('SELECT * FROM sessions WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function findByUserId(
  userId: string,
  pagination: PaginationParams,
): Promise<PaginatedResponse<TranslationSession>> {
  const offset = (pagination.page - 1) * pagination.limit;

  const countResult = await query('SELECT COUNT(*) FROM sessions WHERE user_id = $1', [userId]);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    'SELECT * FROM sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3',
    [userId, pagination.limit, offset],
  );

  return {
    data: result.rows.map(mapRow),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function updateState(id: string, state: string): Promise<void> {
  await query('UPDATE sessions SET state = $1 WHERE id = $2', [state, id]);
}

export async function updateLanguage(
  id: string,
  participant: 'a' | 'b',
  language: string,
): Promise<void> {
  const column = participant === 'a' ? 'participant_a_language' : 'participant_b_language';
  await query(`UPDATE sessions SET ${column} = $1 WHERE id = $2`, [language, id]);
}

export async function endSession(id: string): Promise<void> {
  await query('UPDATE sessions SET state = $1, ended_at = NOW() WHERE id = $2', ['ended', id]);
}

export async function setSummary(id: string, summary: string): Promise<void> {
  await query('UPDATE sessions SET summary = $1 WHERE id = $2', [summary, id]);
}

function mapRow(row: Record<string, unknown>): TranslationSession {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    callType: row['call_type'] as TranslationSession['callType'],
    participantALanguage: row['participant_a_language'] as string | null,
    participantBLanguage: row['participant_b_language'] as string | null,
    state: row['state'] as string,
    startedAt: row['started_at'] as Date,
    endedAt: row['ended_at'] as Date | null,
    summary: row['summary'] as string | null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
  };
}
