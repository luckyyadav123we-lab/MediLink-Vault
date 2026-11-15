import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.ts';
import {
  requireAuth,
  requireRole,
  verifyPatientAccess,
  logPatientAccess,
  type AuthedRequest,
} from '../middleware/auth.ts';

const router = Router();

// Get consent history & access logs for a patient
router.get('/history', requireAuth, (req: AuthedRequest, res) => {
  const patientId = String(req.query.patient_id || '');
  if (!patientId) return res.status(400).json({ error: 'patient_id is required.' });

  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized && req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: access.reason });
  }

  const consents = db
    .prepare('SELECT * FROM consent_records WHERE patient_id = ? ORDER BY granted_at DESC')
    .all(patientId);

  const logs = db
    .prepare('SELECT * FROM access_logs WHERE patient_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(patientId);

  res.json({ consents, access_logs: logs });
});

// Grant consent directly by patient or authorized caregiver
router.post('/grant', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    patient_id: z.string(),
    grantee_email_or_id: z.string().min(3),
    purpose: z.string().min(4),
    scope_categories: z.array(z.string()).min(1),
    duration_hours: z.number().min(1).max(720).default(72),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid consent payload.' });

  const access = verifyPatientAccess(req.user!, parsed.data.patient_id);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const grantee = db
    .prepare('SELECT id, full_name, role FROM users WHERE lower(email) = lower(?) OR id = ?')
    .get(parsed.data.grantee_email_or_id.trim(), parsed.data.grantee_email_or_id.trim()) as
    | { id: string; full_name: string; role: string }
    | undefined;

  if (!grantee) {
    return res.status(404).json({ error: 'Recipient clinician or facility account not found.' });
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + parsed.data.duration_hours * 60 * 60 * 1000).toISOString();
  const id = `cons-${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO consent_records (id, patient_id, grantee_user_id, grantee_name, grantee_role, purpose, scope_categories_json, status, verification_method, granted_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'in_app', ?, ?)
  `).run(
    id,
    parsed.data.patient_id,
    grantee.id,
    grantee.full_name,
    grantee.role,
    parsed.data.purpose,
    JSON.stringify(parsed.data.scope_categories),
    nowIso,
    expiresAt
  );

  logPatientAccess({
    patientId: parsed.data.patient_id,
    actor: req.user!,
    facilityName: 'Patient Consent Portal',
    action: 'CONSENT_GRANTED',
    purpose: parsed.data.purpose,
    recordsAccessed: parsed.data.scope_categories,
  });

  res.status(201).json({ id, grantee_name: grantee.full_name, expires_at: expiresAt });
});

// Revoke active consent immediately
router.post('/:consentId/revoke', requireAuth, (req: AuthedRequest, res) => {
  const consent = db.prepare('SELECT * FROM consent_records WHERE id = ?').get(req.params.consentId) as
    | { id: string; patient_id: string; grantee_name: string; status: string }
    | undefined;

  if (!consent) return res.status(404).json({ error: 'Consent record not found.' });

  const access = verifyPatientAccess(req.user!, consent.patient_id);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const nowIso = new Date().toISOString();
  db.prepare(`UPDATE consent_records SET status = 'revoked', revoked_at = ? WHERE id = ?`).run(nowIso, consent.id);

  logPatientAccess({
    patientId: consent.patient_id,
    actor: req.user!,
    facilityName: 'Patient Consent Portal',
    action: 'CONSENT_REVOKED',
    purpose: `Revoked authorization for ${consent.grantee_name}`,
    recordsAccessed: [],
  });

  res.json({ revoked: true, revoked_at: nowIso });
});

// Controlled Emergency Break-Glass Workflow (Section 9)
router.post(
  '/break-glass',
  requireAuth,
  requireRole('doctor', 'hospital_admin'),
  (req: AuthedRequest, res) => {
    const schema = z.object({
      patient_id: z.string(),
      emergency_reason: z.string().min(12, 'Provide a specific clinical emergency justification (minimum 12 characters).'),
      clinical_unit: z.string().min(2),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid break-glass payload.' });
    }

    const pat = db.prepare('SELECT id, user_id FROM patients WHERE id = ?').get(parsed.data.patient_id) as
      | { id: string; user_id: string }
      | undefined;
    if (!pat) return res.status(404).json({ error: 'Patient not found.' });

    const nowIso = new Date().toISOString();
    // Minimum necessary emergency scope (2-hour automatic expiry)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const consentId = `cons-bg-${crypto.randomUUID()}`;
    const minScope = ['lab_report', 'prescription', 'discharge_summary'];

    db.prepare(`
      INSERT INTO consent_records (id, patient_id, grantee_user_id, grantee_name, grantee_role, purpose, scope_categories_json, status, verification_method, granted_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'emergency_break_glass', ?, ?)
    `).run(
      consentId,
      pat.id,
      req.user!.id,
      req.user!.full_name,
      req.user!.role,
      `EMERGENCY BREAK-GLASS (${parsed.data.clinical_unit}): ${parsed.data.emergency_reason}`,
      JSON.stringify(minScope),
      nowIso,
      expiresAt
    );

    logPatientAccess({
      patientId: pat.id,
      actor: req.user!,
      facilityName: parsed.data.clinical_unit,
      action: 'EMERGENCY_BREAK_GLASS_ACCESS',
      purpose: parsed.data.emergency_reason,
      recordsAccessed: minScope,
      isEmergencyBreakGlass: true,
      emergencyReason: parsed.data.emergency_reason,
      ipAddress: req.ip,
    });

    // Immediate patient notification for post-event audit transparency
    db.prepare(`
      INSERT INTO notifications (id, user_id, channel, title, message, is_read, created_at)
      VALUES (?, ?, 'in_app', 'Emergency Break-Glass Access Logged', ?, 0, ?)
    `).run(
      `notif-${crypto.randomUUID()}`,
      pat.user_id,
      `${req.user!.full_name} (${parsed.data.clinical_unit}) initiated 2-hour minimum-necessary emergency access. Reason: "${parsed.data.emergency_reason}". Logged for post-event audit.`,
      nowIso
    );

    res.status(201).json({
      break_glass_active: true,
      consent_id: consentId,
      expires_at: expiresAt,
      minimum_necessary_scope: minScope,
      audit_notice: 'Break-glass event logged and patient notified for post-event compliance review.',
    });
  }
);

export default router;
