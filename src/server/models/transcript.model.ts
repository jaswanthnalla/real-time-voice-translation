import { query } from '../../config/database';
import { TranscriptEntry } from '../../types/session';

export async function appendEntry(sessionId: string, entry: TranscriptEntry): Promise<void> {
  await query(
    `INSERT INTO transcripts (session_id, speaker_id, original_text, translated_text, source_language, target_language, is_final)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      sessionId,
      entry.speakerId,
      entry.originalText,
      entry.translatedText,
      entry.sourceLanguage,
      entry.targetLanguage,
      entry.isFinal,
    ],
  );
}

export async function getBySessionId(sessionId: string): Promise<TranscriptEntry[]> {
  const result = await query(
    'SELECT * FROM transcripts WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId],
  );
  return result.rows.map((row) => ({
    id: row['id'],
    speakerId: row['speaker_id'],
    originalText: row['original_text'],
    translatedText: row['translated_text'],
    sourceLanguage: row['source_language'],
    targetLanguage: row['target_language'],
    isFinal: row['is_final'],
    timestamp: row['created_at'],
  }));
}
