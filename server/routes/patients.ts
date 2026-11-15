import { Router } from 'express';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db } from '../db.ts';
import {
  requireAuth,
  requireRole,
  signShortLivedToken,
  verifySignedToken,
  verifyPatientAccess,
  logPatientAccess,
  rateLimit,
  type AuthedRequest,
} from '../middleware/auth.ts';

const router = Router();

// Get patient overview (own or caregiver-authorized)
router.get('/:patientId/overview', requireAuth, (req: AuthedRequest, res) => {
  const patientId = req.params.patientId;
  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized) {
    return res.status(403).json({ error: access.reason });
  }

  const patient = db
    .prepare(
      `SELECT p.*, u.full_name, u.email, u.phone, u.preferred_language, h.health_id
       FROM patients p
       JOIN users u ON u.id = p.user_id
       JOIN patient_health_ids h ON h.patient_id = p.id AND h.status = 'active'
       WHERE p.id = ?`
    )
    .get(patientId);

  const profile = db
    .prepare('SELECT chronic_conditions_json, allergies_json, baseline_notes FROM patient_profiles WHERE patient_id = ?')
    .get(patientId) as { chronic_conditions_json: string; allergies_json: string; baseline_notes: string } | undefined;

  const docCount = db.prepare('SELECT COUNT(*) as c FROM medical_documents WHERE patient_id = ?').get(patientId) as { c: number };
  const recentDocs = db
    .prepare(
      `SELECT id, title, category, facility_name, document_date, verification_status, page_count
       FROM medical_documents WHERE patient_id = ? ORDER BY document_date DESC LIMIT 5`
    )
    .all(patientId);

  const medications = db
    .prepare('SELECT * FROM medications WHERE patient_id = ? ORDER BY started_at DESC')
    .all(patientId);

  const diagnoses = db
    .prepare('SELECT * FROM diagnoses WHERE patient_id = ? ORDER BY diagnosed_at DESC')
    .all(patientId);

  const upcomingAppointments = db
    .prepare(
      `SELECT a.*, h.name as hospital_name, u.full_name as doctor_name, d.specialty
       FROM appointments a
       LEFT JOIN hospitals h ON h.id = a.hospital_id
       LEFT JOIN doctors d ON d.id = a.doctor_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE a.patient_id = ? ORDER BY a.scheduled_at ASC LIMIT 5`
    )
    .all(patientId);

  const activeConsents = db
    .prepare(
      `SELECT * FROM consent_records WHERE patient_id = ? AND status = 'active' AND expires_at > ? ORDER BY granted_at DESC`
    )
    .all(patientId, new Date().toISOString());

  res.json({
    patient,
    profile: profile
      ? {
          chronic_conditions: JSON.parse(profile.chronic_conditions_json),
          allergies: JSON.parse(profile.allergies_json),
          baseline_notes: profile.baseline_notes,
        }
      : { chronic_conditions: [], allergies: [], baseline_notes: '' },
    stats: {
      total_records: docCount.c,
      active_consents: activeConsents.length,
      upcoming_appointments: upcomingAppointments.length,
    },
    recent_documents: recentDocs,
    medications,
    diagnoses,
    upcoming_appointments: upcomingAppointments,
    active_consents: activeConsents,
  });
});

// Generate dynamic short-lived signed QR (never embeds raw medical data!)
router.get('/:patientId/qr', requireAuth, async (req: AuthedRequest, res) => {
  const patientId = req.params.patientId;
  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized) {
    return res.status(403).json({ error: access.reason });
  }

  const row = db
    .prepare(
      `SELECT p.id, h.health_id, u.full_name, p.blood_group, p.emergency_contact_phone
       FROM patients p
       JOIN users u ON u.id = p.user_id
       JOIN patient_health_ids h ON h.patient_id = p.id AND h.status = 'active'
       WHERE p.id = ?`
    )
    .get(patientId) as { id: string; health_id: string; full_name: string; blood_group: string; emergency_contact_phone: string };

  if (!row) return res.status(404).json({ error: 'Patient Health ID not found.' });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const signedToken = signShortLivedToken(
    {
      typ: 'medilink_qr_identity',
      health_id: row.health_id,
      nonce: crypto.randomBytes(8).toString('hex'),
    },
    300
  );

  const qrPayload = JSON.stringify({
    v: 1,
    health_id: row.health_id,
    token: signedToken,
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 2,
    color: { dark: '#0F2942', light: '#FFFFFF' },
  });

  res.json({
    health_id: row.health_id,
    patient_name: row.full_name,
    blood_group: row.blood_group,
    emergency_contact_phone: row.emergency_contact_phone,
    qr_payload: qrPayload,
    qr_data_url: qrDataUrl,
    expires_at: expiresAt,
    security_note: 'Dynamic 5-minute token for identity matching only. Does not contain medical records or grant permanent access.',
  });
});

// Clinical Lookup by QR payload or manual Health ID (MV-XXXX-XXXX)
router.post('/lookup', requireAuth, requireRole('doctor', 'hospital_admin', 'lab_admin', 'super_admin'), rateLimit(40, 60_000), (req: AuthedRequest, res) => {
  const { qr_payload, health_id } = req.body as { qr_payload?: string; health_id?: string };
  let resolvedHealthId = (health_id || '').trim().toUpperCase();
  let verificationMethod: 'qr_token' | 'manual_id' = 'manual_id';

  if (qr_payload) {
    try {
      const parsed = JSON.parse(qr_payload) as { token?: string; health_id?: string };
      if (parsed.token) {
        const verified = verifySignedToken<{ typ: string; health_id: string }>(parsed.token);
        if (verified.typ !== 'medilink_qr_identity') {
          return res.status(400).json({ error: 'Invalid QR token type.' });
        }
        resolvedHealthId = verified.health_id;
        verificationMethod = 'qr_token';
      } else if (parsed.health_id) {
        resolvedHealthId = parsed.health_id.trim().toUpperCase();
      }
    } catch {
      // Allow raw Health ID string inside QR text
      resolvedHealthId = qr_payload.trim().toUpperCase();
    }
  }

  if (!/^MV-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(resolvedHealthId)) {
    return res.status(400).json({ error: 'Invalid Health ID format. Expected format like MV-8K29-X7P4.' });
  }

  const patRow = db
    .prepare(
      `SELECT p.id as patient_id, u.full_name, u.phone, p.date_of_birth, p.gender, p.blood_group, p.has_smartphone, h.health_id
       FROM patient_health_ids h
       JOIN patients p ON p.id = h.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE h.health_id = ? AND h.status = 'active'`
    )
    .get(resolvedHealthId) as
    | {
        patient_id: string;
        full_name: string;
        phone: string | null;
        date_of_birth: string;
        gender: string;
        blood_group: string;
        has_smartphone: number;
        health_id: string;
      }
    | undefined;

  if (!patRow) {
    return res.status(404).json({ error: `No active patient found with Health ID ${resolvedHealthId}.` });
  }

  const access = verifyPatientAccess(req.user!, patRow.patient_id);

  logPatientAccess({
    patientId: patRow.patient_id,
    actor: req.user!,
    facilityName: 'Clinician Lookup Console',
    action: 'IDENTITY_LOOKUP',
    purpose: `Health ID lookup via ${verificationMethod}`,
    recordsAccessed: [],
  });

  const maskedPhone = patRow.phone
    ? `${patRow.phone.slice(0, 4)}••••${patRow.phone.slice(-3)}`
    : 'No phone registered (Assisted consent required)';

  res.json({
    patient: {
      patient_id: patRow.patient_id,
      health_id: patRow.health_id,
      full_name: patRow.full_name,
      date_of_birth: patRow.date_of_birth,
      gender: patRow.gender,
      blood_group: patRow.blood_group,
      has_smartphone: patRow.has_smartphone === 1,
      phone_masked: maskedPhone,
    },
    verification_method: verificationMethod,
    authorized: access.authorized,
    access_mode: access.accessMode,
    allowed_categories: access.allowedCategories,
    message: access.authorized
      ? 'Patient matched and active consent verified.'
      : 'Patient identified. Health ID alone does not grant access — verify OTP or document assisted/emergency consent.',
  });
});

// Send SMS / Assisted Consent OTP (Demo mode clearly labeled when SMS provider not configured)
router.post('/otp/send', requireAuth, rateLimit(15, 60_000), (req: AuthedRequest, res) => {
  const { patient_id, channel = 'sms', purpose = 'Hospital record sharing consent' } = req.body as {
    patient_id: string;
    channel?: 'sms' | 'assisted_staff' | 'in_app';
    purpose?: string;
  };

  const pat = db
    .prepare(
      `SELECT p.id, u.phone, u.full_name, h.health_id
       FROM patients p
       JOIN users u ON u.id = p.user_id
       JOIN patient_health_ids h ON h.patient_id = p.id AND h.status = 'active'
       WHERE p.id = ?`
    )
    .get(patient_id) as { id: string; phone: string | null; full_name: string; health_id: string } | undefined;

  if (!pat) return res.status(404).json({ error: 'Patient not found.' });

  const otpCode = String(crypto.randomInt(100000, 999999));
  const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO otp_verifications (id, target_phone_or_id, patient_id, otp_code_hash, purpose, channel, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`otp-${crypto.randomUUID()}`, pat.phone || pat.health_id, pat.id, otpHash, purpose, channel, expiresAt, new Date().toISOString());

  const liveSmsConfigured = Boolean(process.env.MSG91_AUTH_KEY || process.env.TWILIO_ACCOUNT_SID);

  res.json({
    sent: true,
    channel,
    provider_mode: liveSmsConfigured ? 'live_sms_gateway' : 'demo_mode',
    masked_destination: pat.phone ? `${pat.phone.slice(0, 4)}••••${pat.phone.slice(-3)}` : 'Printed Card / Staff Desk',
    expires_at: expiresAt,
    // Only returned in Demo Mode when external SMS gateway is not configured
    demo_otp_preview: liveSmsConfigured ? undefined : otpCode,
    note: liveSmsConfigured
      ? 'OTP dispatched via configured SMS gateway.'
      : 'Demo Mode: Configure MSG91_AUTH_KEY or TWILIO_ACCOUNT_SID for live carrier SMS delivery. Use the demo verification code shown to complete consent.',
  });
});

// Verify OTP and issue time-limited consent
router.post('/otp/verify', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    patient_id: z.string(),
    otp_code: z.string().length(6),
    purpose: z.string().min(3),
    scope_categories: z.array(z.string()).default(['lab_report', 'prescription', 'discharge_summary', 'consultation_note']),
    duration_hours: z.number().min(1).max(720).default(24),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid OTP verification payload.' });
  }

  const { patient_id, otp_code, purpose, scope_categories, duration_hours } = parsed.data;
  const otpHash = crypto.createHash('sha256').update(otp_code).digest('hex');
  const nowIso = new Date().toISOString();

  const otpRow = db
    .prepare(
      `SELECT id FROM otp_verifications
       WHERE patient_id = ? AND otp_code_hash = ? AND verified_at IS NULL AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(patient_id, otpHash, nowIso) as { id: string } | undefined;

  if (!otpRow) {
    return res.status(400).json({ error: 'Invalid or expired OTP code.' });
  }

  db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(nowIso, otpRow.id);

  const consentId = `cons-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO consent_records (id, patient_id, grantee_user_id, grantee_name, grantee_role, purpose, scope_categories_json, status, verification_method, granted_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'sms_otp', ?, ?)
  `).run(
    consentId,
    patient_id,
    req.user!.id,
    req.user!.full_name,
    req.user!.role,
    purpose,
    JSON.stringify(scope_categories),
    nowIso,
    expiresAt
  );

  logPatientAccess({
    patientId: patient_id,
    actor: req.user!,
    facilityName: 'OTP Consent Verification',
    action: 'CONSENT_GRANTED_VIA_OTP',
    purpose,
    recordsAccessed: scope_categories,
  });

  res.json({ verified: true, consent_id: consentId, expires_at: expiresAt });
});

// Assisted-consent workflow for patients with NO phone (in-person hospital verification)
router.post('/:patientId/assisted-consent', requireAuth, requireRole('doctor', 'hospital_admin', 'lab_admin'), (req: AuthedRequest, res) => {
  const schema = z.object({
    witness_name: z.string().min(2),
    id_document_type: z.string().min(2),
    id_last_four: z.string().min(2).max(8),
    purpose: z.string().min(4),
    duration_hours: z.number().min(1).max(72).default(12),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Complete all assisted-consent verification fields.' });
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + parsed.data.duration_hours * 60 * 60 * 1000).toISOString();
  const consentId = `cons-${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO consent_records (id, patient_id, grantee_user_id, grantee_name, grantee_role, purpose, scope_categories_json, status, verification_method, granted_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, '["lab_report","prescription","discharge_summary","consultation_note"]', 'active', 'assisted_in_person', ?, ?)
  `).run(
    consentId,
    req.params.patientId,
    req.user!.id,
    req.user!.full_name,
    req.user!.role,
    `${parsed.data.purpose} (Assisted ID: ${parsed.data.id_document_type} *${parsed.data.id_last_four}; Witness: ${parsed.data.witness_name})`,
    nowIso,
    expiresAt
  );

  logPatientAccess({
    patientId: req.params.patientId,
    actor: req.user!,
    facilityName: 'Assisted Helpdesk',
    action: 'ASSISTED_IN_PERSON_CONSENT',
    purpose: parsed.data.purpose,
    recordsAccessed: ['lab_report', 'prescription', 'discharge_summary', 'consultation_note'],
  });

  res.json({ consent_id: consentId, expires_at: expiresAt, verification_method: 'assisted_in_person' });
});

// Family Health Vault & Caregiver permissions
router.get('/family/vault', requireAuth, (req: AuthedRequest, res) => {
  const myPatient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: string } | undefined;

  // Profiles where current user is a caregiver
  const managedProfiles = db
    .prepare(
      `SELECT cp.*, p.date_of_birth, p.gender, p.blood_group, p.has_smartphone, u.full_name as patient_name, h.health_id
       FROM caregiver_permissions cp
       JOIN patients p ON p.id = cp.patient_id
       JOIN users u ON u.id = p.user_id
       JOIN patient_health_ids h ON h.patient_id = p.id AND h.status = 'active'
       WHERE cp.caregiver_user_id = ?`
    )
    .all(req.user!.id);

  // Caregivers authorized on current user's own patient profile
  const myCaregivers = myPatient
    ? db
        .prepare('SELECT * FROM caregiver_permissions WHERE patient_id = ? ORDER BY created_at DESC')
        .all(myPatient.id)
    : [];

  res.json({ managed_profiles: managedProfiles, my_caregivers: myCaregivers });
});

router.post('/family/caregivers', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    caregiver_email_or_phone: z.string().min(3),
    relationship: z.string().min(2),
    can_view_records: z.boolean().default(true),
    can_upload_records: z.boolean().default(false),
    can_manage_consent: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid caregiver request.' });

  const myPatient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: string } | undefined;
  if (!myPatient) return res.status(404).json({ error: 'Patient profile not found.' });

  const target = db
    .prepare('SELECT id, full_name FROM users WHERE lower(email) = lower(?) OR phone = ?')
    .get(parsed.data.caregiver_email_or_phone.trim(), parsed.data.caregiver_email_or_phone.trim()) as
    | { id: string; full_name: string }
    | undefined;

  if (!target) {
    return res.status(404).json({ error: 'Caregiver user not found. Ask them to register a MediLink account first.' });
  }

  const id = `care-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO caregiver_permissions (id, patient_id, caregiver_user_id, caregiver_name, relationship, can_view_records, can_upload_records, can_manage_consent, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    id,
    myPatient.id,
    target.id,
    target.full_name,
    parsed.data.relationship,
    parsed.data.can_view_records ? 1 : 0,
    parsed.data.can_upload_records ? 1 : 0,
    parsed.data.can_manage_consent ? 1 : 0,
    new Date().toISOString()
  );

  res.status(201).json({ id, caregiver_name: target.full_name, status: 'active' });
});

router.patch('/family/caregivers/:caregiverPermId', requireAuth, (req: AuthedRequest, res) => {
  const myPatient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(req.user!.id) as { id: string } | undefined;
  if (!myPatient) return res.status(403).json({ error: 'Only the patient profile owner can modify caregiver permissions.' });

  const { status, can_view_records, can_upload_records, can_manage_consent } = req.body as {
    status?: string;
    can_view_records?: boolean;
    can_upload_records?: boolean;
    can_manage_consent?: boolean;
  };

  if (status === 'revoked') {
    db.prepare(`UPDATE caregiver_permissions SET status = 'revoked', can_view_records = 0, can_upload_records = 0, can_manage_consent = 0 WHERE id = ? AND patient_id = ?`)
      .run(req.params.caregiverPermId, myPatient.id);
    return res.json({ updated: true, status: 'revoked' });
  }

  db.prepare(`
    UPDATE caregiver_permissions
    SET can_view_records = COALESCE(?, can_view_records),
        can_upload_records = COALESCE(?, can_upload_records),
        can_manage_consent = COALESCE(?, can_manage_consent)
    WHERE id = ? AND patient_id = ?
  `).run(
    can_view_records === undefined ? null : can_view_records ? 1 : 0,
    can_upload_records === undefined ? null : can_upload_records ? 1 : 0,
    can_manage_consent === undefined ? null : can_manage_consent ? 1 : 0,
    req.params.caregiverPermId,
    myPatient.id
  );
  res.json({ updated: true });
});

export default router;
