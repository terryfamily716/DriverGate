import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SESSION_SECRET_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

export interface AdminTokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

export interface AdminRequest extends Request {
  admin?: AdminTokenPayload;
}

export function getEnvAdminPasscode(): string | null {
  const value = process.env.ADMIN_PASSCODE?.trim();
  return value && value.length > 0 ? value : null;
}

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasscodeHash(passcode: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }
  const actualBuf = crypto.scryptSync(passcode, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function verifyPlainPasscode(input: string, expected: string): boolean {
  const inputDigest = crypto.createHash('sha256').update(input).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(inputDigest, expectedDigest);
}

export function issueAdminToken(): { token: string; expiresAt: string } {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    role: 'admin',
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET_KEY)
    .update(encodedPayload)
    .digest('base64url');

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const segments = token.split('.');
  if (segments.length !== 2) {
    return null;
  }
  const [encodedPayload, signature] = segments;
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET_KEY)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as AdminTokenPayload;

    if (parsed.role !== 'admin' || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Administrator sign-in is required.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verified = verifyAdminToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Administrator session is invalid or expired.' });
    return;
  }

  req.admin = verified;
  next();
}
