import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'medilink-vault-dev-jwt-secret-change-in-prod';

export type UserRole = 'patient' | 'doctor' | 'hospital_admin' | 'lab_admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: UserRole;
  preferred_language: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function signSessionToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      full_name: user.full_name,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function signShortLivedToken(payload: Record<string, unknown>, expiresInSeconds = 300): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifySignedToken<T = Record<string, unknown>>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const rawToken = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!rawToken) {
    return res.status(401).json({ error: 'Authentication required. Missing bearer token.' });
  }

  try {
    const decoded = jwt.verify(rawToken, JWT_SECRET) as { sub: string };
    const row = db
      .prepare('SELECT id, email, phone, full_name, role, preferred_language, status FROM users WHERE id = ?')
      .get(decoded.sub) as (AuthUser & { status: string }) | undefined;

    if (!row || row.status !== 'active') {
      return res.status(401).json({ error: 'Invalid or inactive user session.' });
    }

    req.user = {
      id: row.id,
      email: row.email,
      phone: row.phone,
      full_name: row.full_name,
      role: row.role,
      preferred_language: row.preferred_language,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Session token expired or invalid.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not permitted for this operation.`,
      });
    }
    next();
  };
}

// Simple in-memory sliding window rate limiter for sensitive endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(maxRequests = 40, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before retrying.' });
    }
    bucket.count += 1;
    next();
  };
}

export interface AccessVerificationResult {
  authorized: boolean;
  accessMode: 'self' | 'caregiver' | 'active_consent' | 'emergency_break_glass' | 'facility_upload' | 'denied';
  allowedCategories: string[];
  reason?: string;
  consentId?: string;
}

/**
 * Backend-enforced patient data access verification.
 * Health ID identifies a patient; it NEVER independently authorizes access.
 */
export function verifyPatientAccess(
  actor: AuthUser,
  patientId: string,
  requiredCategory?: string
): AccessVerificationResult {
  const patient = db.prepare('SELECT id, user_id FROM patients WHERE id = ?').get(patientId) as
    | { id: string; user_id: string }
    | undefined;
  if (!patient) {
    return { authorized: false, accessMode: 'denied', allowedCategories: [], reason: 'Patient not found.' };
  }

  // 1. Patient viewing their own vault
  if (actor.role === 'patient' && patient.user_id === actor.id) {
    return {
      authorized: true,
      accessMode: 'self',
      allowedCategories: ['lab_report', 'prescription', 'discharge_summary', 'radiology_dicom', 'consultation_note'],
    };
  }

  // 2. Authorized family/caregiver with active granular permission
  if (actor.role === 'patient') {
    const cg = db
      .prepare(
        `SELECT id, can_view_records FROM caregiver_permissions
         WHERE patient_id = ? AND caregiver_user_id = ? AND status = 'active'`
      )
      .get(patientId, actor.id) as { id: string; can_view_records: number } | undefined;
    if (cg && cg.can_view_records === 1) {
      return {
        authorized: true,
        accessMode: 'caregiver',
        allowedCategories: ['lab_report', 'prescription', 'discharge_summary', 'radiology_dicom', 'consultation_note'],
      };
    }
  }

  // 3. Doctor / Hospital Staff / Lab with active unexpired consent
  const nowIso = new Date().toISOString();
  const consent = db
    .prepare(
      `SELECT id, scope_categories_json, verification_method FROM consent_records
       WHERE patient_id = ? AND grantee_user_id = ? AND status = 'active' AND expires_at > ?
       ORDER BY granted_at DESC LIMIT 1`
    )
    .get(patientId, actor.id, nowIso) as
    | { id: string; scope_categories_json: string; verification_method: string }
    | undefined;

  if (consent) {
    const categories = JSON.parse(consent.scope_categories_json) as string[];
    if (requiredCategory && !categories.includes(requiredCategory)) {
      return {
        authorized: false,
        accessMode: 'denied',
        allowedCategories: categories,
        reason: `Active consent does not include category '${requiredCategory}'.`,
      };
    }
    const isBreakGlass = consent.verification_method === 'emergency_break_glass';
    return {
      authorized: true,
      accessMode: isBreakGlass ? 'emergency_break_glass' : 'active_consent',
      allowedCategories: categories,
      consentId: consent.id,
    };
  }

  return {
    authorized: false,
    accessMode: 'denied',
    allowedCategories: [],
    reason: 'No active consent found for this patient. Request QR/OTP verification or documented emergency break-glass access.',
  };
}

export function logPatientAccess(params: {
  patientId: string;
  actor: AuthUser;
  facilityName: string;
  action: string;
  purpose: string;
  recordsAccessed: string[];
  isEmergencyBreakGlass?: boolean;
  emergencyReason?: string;
  ipAddress?: string;
}) {
  db.prepare(`
    INSERT INTO access_logs (
      id, patient_id, actor_user_id, actor_name, actor_role, facility_name,
      action, purpose, records_accessed_json, is_emergency_break_glass, emergency_reason, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `log-${crypto.randomUUID()}`,
    params.patientId,
    params.actor.id,
    params.actor.full_name,
    params.actor.role,
    params.facilityName,
    params.action,
    params.purpose,
    JSON.stringify(params.recordsAccessed),
    params.isEmergencyBreakGlass ? 1 : 0,
    params.emergencyReason ?? null,
    params.ipAddress ?? '127.0.0.1',
    new Date().toISOString()
  );
}
