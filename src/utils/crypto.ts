import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { JWTPayload } from '../types/user';

export function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiry,
  });
}

export function signRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.refreshTokenExpiry,
  });
}

export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, config.auth.jwtSecret) as JWTPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  return uuidv4().replace(/-/g, '');
}

export function generateSessionId(): string {
  return uuidv4();
}
