import * as userModel from '../models/user.model';
import { hashPassword, comparePassword, signAccessToken, signRefreshToken, verifyJWT } from '../../utils/crypto';
import { AuthTokens, RegisterInput, UserCredentials, UserProfile } from '../../types/user';
import { AuthenticationError, ConflictError, NotFoundError } from '../../shared/errors';

export async function register(input: RegisterInput): Promise<AuthTokens> {
  const existing = await userModel.findByEmail(input.email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await userModel.create({
    email: input.email,
    name: input.name,
    passwordHash,
  });

  return generateTokens(user.id, user.email);
}

export async function login(credentials: UserCredentials): Promise<AuthTokens> {
  const user = await userModel.findByEmail(credentials.email);
  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  const isValid = await comparePassword(credentials.password, user.passwordHash);
  if (!isValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  return generateTokens(user.id, user.email);
}

export async function refreshToken(token: string): Promise<AuthTokens> {
  try {
    const payload = verifyJWT(token);
    const user = await userModel.findById(payload.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    return generateTokens(user.id, user.email);
  } catch {
    throw new AuthenticationError('Invalid refresh token');
  }
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

function generateTokens(userId: string, email: string): AuthTokens {
  return {
    accessToken: signAccessToken({ userId, email }),
    refreshToken: signRefreshToken({ userId, email }),
  };
}
