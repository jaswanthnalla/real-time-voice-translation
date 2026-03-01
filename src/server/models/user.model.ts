import { query } from '../../config/database';
import { User } from '../../types/user';

export async function findById(id: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] ?? null;
}

export async function create(data: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<User> {
  const result = await query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [data.email, data.name, data.passwordHash],
  );
  return result.rows[0];
}

export async function update(id: string, data: Partial<{ name: string; email: string }>): Promise<User> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(data.email);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0];
}
