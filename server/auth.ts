
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const API_KEY_PREFIX = 'wk_live_';
const BCRYPT_SALT_ROUNDS = 12;
const API_KEY_BYTES = 32;

// Use an environment variable for production.
// The fallback is strictly for local development.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('JWT_SECRET must be at least 32 bytes long.');
    }

    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production.'
    );
  }

  return 'workflow_orchestration_jwt_secret_dev_2026';
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}

/**
 * Validates basic string input.
 */
function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Hashes a user's password using bcrypt.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!isValidString(plain)) {
    throw new Error('Password must be a non-empty string.');
  }

  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plain password against its stored bcrypt hash.
 */
export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (
    typeof plain !== 'string' ||
    typeof hash !== 'string' ||
    !hash.trim()
  ) {
    return false;
  }

  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Generates a signed JWT authentication token.
 */
export function signJwt(
  payload: AuthTokenPayload,
  expiresIn: string = '7d'
): string {
  if (
    !payload ||
    !isValidString(payload.userId) ||
    !isValidString(payload.email) ||
    !isValidString(payload.tenantId) ||
    !isValidString(payload.role)
  ) {
    throw new Error('Invalid JWT payload.');
  }

  if (!isValidString(expiresIn)) {
    throw new Error('Invalid JWT expiration time.');
  }

  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role
    },
    getJwtSecret(),
    {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256'
    }
  );
}

/**
 * Verifies a JWT and validates its payload.
 * Returns null if the token is invalid or expired.
 */
export function verifyJwt(token: string): AuthTokenPayload | null {
  if (!isValidString(token)) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256']
    });

    if (typeof decoded === 'string') {
      return null;
    }

    const { userId, email, tenantId, role } = decoded;

    if (
      !isValidString(userId) ||
      !isValidString(email) ||
      !isValidString(tenantId) ||
      !isValidString(role)
    ) {
      return null;
    }

    return {
      userId,
      email,
      tenantId,
      role
    };
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically secure API key.
 *
 * The raw key should only be displayed once.
 * Store keyHash in the database, not rawKey.
 */
export function generateApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const randomBytes = crypto
    .randomBytes(API_KEY_BYTES)
    .toString('hex');

  const rawKey = `${API_KEY_PREFIX}${randomBytes}`;

  const keyPrefix = `${rawKey.substring(0, 15)}...`;

  const keyHash = hashApiKey(rawKey);

  return {
    rawKey,
    keyPrefix,
    keyHash
  };
}

/**
 * Creates a SHA-256 hash of an API key.
 */
export function hashApiKey(rawKey: string): string {
  if (!isValidString(rawKey)) {
    throw new Error('API key must be a non-empty string.');
  }

  return crypto
    .createHash('sha256')
    .update(rawKey, 'utf8')
    .digest('hex');
}
