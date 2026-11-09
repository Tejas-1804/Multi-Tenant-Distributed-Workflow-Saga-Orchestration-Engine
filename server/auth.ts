
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const API_KEY_PREFIX = 'wk_live_';

const BCRYPT_SALT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

const API_KEY_BYTES = 32;
const API_KEY_HASH_LENGTH = 64;

const MIN_JWT_SECRET_BYTES = 32;
const DEFAULT_JWT_EXPIRATION = '7d';

/**
 * Development-only fallback.
 *
 * Never use this secret in production.
 * Production environments must configure JWT_SECRET.
 */
const DEVELOPMENT_JWT_SECRET =
  'workflow_orchestration_jwt_secret_dev_2026';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

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
 * Generated API key details.
 */
export interface GeneratedApiKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Checks whether a value is a non-empty string.
 */
function isValidString(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

/**
 * Validates the JWT payload before signing.
 */
function validateJwtPayload(
  payload: unknown
): asserts payload is AuthTokenPayload {
  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    throw new Error('JWT payload is required.');
  }

  const data = payload as Record<string, unknown>;

  if (!isValidString(data.userId)) {
    throw new Error(
      'JWT payload userId is required.'
    );
  }

  if (!isValidString(data.email)) {
    throw new Error(
      'JWT payload email is required.'
    );
  }

  if (!isValidString(data.tenantId)) {
    throw new Error(
      'JWT payload tenantId is required.'
    );
  }

  if (!isValidString(data.role)) {
    throw new Error(
      'JWT payload role is required.'
    );
  }
}

/**
 * Validates a SHA-256 hexadecimal hash.
 */
function isValidApiKeyHash(
  hash: unknown
): hash is string {
  return (
    typeof hash === 'string' &&
    /^[a-fA-F0-9]{64}$/.test(hash)
  );
}

/* -------------------------------------------------------------------------- */
/* JWT Secret Management                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns the configured JWT secret.
 *
 * Production requires JWT_SECRET to be configured.
 * Development uses a fallback only when the environment
 * variable is not provided.
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

/* -------------------------------------------------------------------------- */
/* Password Management                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Hashes a user's password using bcrypt.
 *
 * Passwords are never trimmed because whitespace can
 * legitimately be part of a password.
 */
export async function hashPassword(
  plain: string
): Promise<string> {
  if (
    typeof plain !== 'string' ||
    plain.length === 0
  ) {
    throw new Error(
      'Password must be a non-empty string.'
    );
  }

  const passwordBytes = Buffer.byteLength(
    plain,
    'utf8'
  );

  if (passwordBytes > BCRYPT_MAX_PASSWORD_BYTES) {
    throw new Error(
      `Password cannot exceed ${BCRYPT_MAX_PASSWORD_BYTES} bytes when using bcrypt.`
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
 * Returns false for invalid credentials or malformed hashes.
 */
export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (
    typeof plain !== 'string' ||
    typeof hash !== 'string' ||
    !hash.trim() ||
    Buffer.byteLength(plain, 'utf8') >
      BCRYPT_MAX_PASSWORD_BYTES
  ) {
    return false;
  }

  try {
    return await bcrypt.compare(
      plain,
      hash
    );
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* JWT Generation                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Generates a signed JWT authentication token.
 *
 * Uses HS256 explicitly and validates all required claims.
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

/* -------------------------------------------------------------------------- */
/* JWT Verification                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Verifies a JWT and validates its expected payload.
 *
 * Returns null when the token is:
 * - Missing or malformed.
 * - Expired.
 * - Incorrectly signed.
 * - Using an unsupported algorithm.
 * - Missing required authentication claims.
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
      decoded === null ||
      Array.isArray(decoded)
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

/* -------------------------------------------------------------------------- */
/* API Key Generation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Generates a cryptographically secure API key.
 *
 * The raw API key should only be displayed to the user once.
 * Store its SHA-256 hash instead of storing the raw key.
 */
export function generateApiKey(): GeneratedApiKey {
  const randomBytes = crypto.randomBytes(
    API_KEY_BYTES
  );

  const rawKey =
    `${API_KEY_PREFIX}${randomBytes.toString('hex')}`;

  const keyPrefix =
    `${rawKey.slice(0, 15)}...`;

  const keyHash = hashApiKey(rawKey);

  return {
    rawKey,
    keyPrefix,
    keyHash
  };
}

/* -------------------------------------------------------------------------- */
/* API Key Hashing                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Creates a deterministic SHA-256 hash of an API key.
 *
 * SHA-256 is suitable because API keys are generated
 * using cryptographically secure random bytes.
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
    .update(rawKey, 'utf8')
    .digest('hex');
}

/* -------------------------------------------------------------------------- */
/* API Key Hash Comparison                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Performs a constant-time comparison of two API key hashes.
 *
 * Validates SHA-256 hexadecimal format before comparison.
 * Helps prevent timing-based comparison attacks.
 */
export function compareApiKeyHashes(
  firstHash: string,
  secondHash: string
): boolean {
  if (
    !isValidApiKeyHash(firstHash) ||
    !isValidApiKeyHash(secondHash)
  ) {
    return false;
  }

  const first = Buffer.from(
    firstHash,
    'hex'
  );

  const second = Buffer.from(
    secondHash,
    'hex'
  );

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    first,
    second
  );
}

/* -------------------------------------------------------------------------- */
/* Token Revocation / Blacklist (Task 3)                                      */
/* -------------------------------------------------------------------------- */

const tokenBlacklist = new Set<string>();

export function revokeToken(token: string): void {
  if (token && typeof token === 'string') {
    tokenBlacklist.add(token.trim());
  }
}

export function isTokenRevoked(token: string): boolean {
  return tokenBlacklist.has(token.trim());
}