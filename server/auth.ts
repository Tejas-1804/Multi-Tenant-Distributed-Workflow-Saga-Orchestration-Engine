import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const API_KEY_PREFIX = 'wk_live_';
const BCRYPT_SALT_ROUNDS = 12;
const API_KEY_BYTES = 32;
const MIN_JWT_SECRET_BYTES = 32;
const DEFAULT_JWT_EXPIRATION = '7d';

const DEVELOPMENT_JWT_SECRET =
  'workflow_orchestration_jwt_secret_dev_2026';

/**
 * Authentication token payload.
 */
export interface AuthTokenPayload {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}

/**
 * Validates whether a value is a non-empty string.
 */
function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Returns the configured JWT secret.
 *
 * Production requires JWT_SECRET to be provided through
 * the environment. Local development uses a development-only
 * fallback so the application can run without additional setup.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    if (
      Buffer.byteLength(secret, 'utf8') <
      MIN_JWT_SECRET_BYTES
    ) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes long.`
      );
    }

    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production.'
    );
  }

  return DEVELOPMENT_JWT_SECRET;
}

/**
 * Validates the JWT payload before signing.
 */
function validateJwtPayload(
  payload: AuthTokenPayload
): void {
  if (!payload) {
    throw new Error('JWT payload is required.');
  }

  if (!isValidString(payload.userId)) {
    throw new Error('JWT payload userId is required.');
  }

  if (!isValidString(payload.email)) {
    throw new Error('JWT payload email is required.');
  }

  if (!isValidString(payload.tenantId)) {
    throw new Error('JWT payload tenantId is required.');
  }

  if (!isValidString(payload.role)) {
    throw new Error('JWT payload role is required.');
  }
}

/**
 * Hashes a user's password using bcrypt.
 */
export async function hashPassword(
  plain: string
): Promise<string> {
  if (!isValidString(plain)) {
    throw new Error(
      'Password must be a non-empty string.'
    );
  }

  return bcrypt.hash(
    plain,
    BCRYPT_SALT_ROUNDS
  );
}

/**
 * Compares a plain password against a stored bcrypt hash.
 *
 * Returns false instead of throwing for invalid credentials
 * or malformed hashes.
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
  expiresIn: string = DEFAULT_JWT_EXPIRATION
): string {
  validateJwtPayload(payload);

  if (!isValidString(expiresIn)) {
    throw new Error(
      'JWT expiration time must be a non-empty string.'
    );
  }

  const tokenPayload: AuthTokenPayload = {
    userId: payload.userId.trim(),
    email: payload.email.trim(),
    tenantId: payload.tenantId.trim(),
    role: payload.role.trim()
  };

  return jwt.sign(
    tokenPayload,
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn:
        expiresIn as jwt.SignOptions['expiresIn']
    }
  );
}

/**
 * Verifies a JWT and validates its expected payload.
 *
 * Returns null when the token is:
 * - missing
 * - malformed
 * - expired
 * - incorrectly signed
 * - using an unsupported algorithm
 * - missing required claims
 */
export function verifyJwt(
  token: string
): AuthTokenPayload | null {
  if (!isValidString(token)) {
    return null;
  }

  try {
    const decoded = jwt.verify(
      token.trim(),
      getJwtSecret(),
      {
        algorithms: ['HS256']
      }
    );

    if (
      typeof decoded !== 'object' ||
      decoded === null
    ) {
      return null;
    }

    const userId = decoded.userId;
    const email = decoded.email;
    const tenantId = decoded.tenantId;
    const role = decoded.role;

    if (
      !isValidString(userId) ||
      !isValidString(email) ||
      !isValidString(tenantId) ||
      !isValidString(role)
    ) {
      return null;
    }

    return {
      userId: userId.trim(),
      email: email.trim(),
      tenantId: tenantId.trim(),
      role: role.trim()
    };
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically secure API key.
 *
 * The raw API key should only be shown to the user once.
 * Store the SHA-256 hash in the database instead of storing
 * the raw API key.
 */
export function generateApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const randomBytes = crypto.randomBytes(
    API_KEY_BYTES
  );

  const rawKey =
    `${API_KEY_PREFIX}${randomBytes.toString('hex')}`;

  const keyPrefix =
    `${rawKey.slice(0, 15)}...`;

  const keyHash =
    hashApiKey(rawKey);

  return {
    rawKey,
    keyPrefix,
    keyHash
  };
}

/**
 * Creates a deterministic SHA-256 hash of an API key.
 *
 * SHA-256 is suitable here because API keys are generated
 * using cryptographically secure random bytes and therefore
 * have high entropy.
 */
export function hashApiKey(
  rawKey: string
): string {
  if (!isValidString(rawKey)) {
    throw new Error(
      'API key must be a non-empty string.'
    );
  }

  return crypto
    .createHash('sha256')
    .update(rawKey.trim(), 'utf8')
    .digest('hex');
}

/**
 * Constant-time comparison for API key hashes.
 *
 * Useful when manually comparing stored hashes.
 */
export function compareApiKeyHashes(
  firstHash: string,
  secondHash: string
): boolean {
  if (
    !isValidString(firstHash) ||
    !isValidString(secondHash)
  ) {
    return false;
  }

  const first = Buffer.from(
    firstHash.trim(),
    'utf8'
  );

  const second = Buffer.from(
    secondHash.trim(),
    'utf8'
  );

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    first,
    second
  );
}