import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, signSessionToken, rateLimit, type AuthedRequest, type UserRole } from '../middleware/auth.ts';

const router = Router();

const RegisterSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(8).max(20),
  password: z.string().min(6),
  date_of_birth: z.string().default('1990-01-01'),
  gender: z.string().default('Prefer not to say'),
  blood_group: z.string().default('O+'),
  has_smartphone: z.boolean().default(true),
  preferred_language: z.string().default('en'),
  jurisdiction: z.string().default('IN'),
});

function generateUniqueHealthId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `MV-${part(4)}-${part(4)}`;
}

router.post('/register', rateLimit(20, 60_000), (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid registration details', details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const emailVal = data.email && data.email.trim() !== '' ? data.email.trim().toLowerCase() : null;

  const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(data.phone);
  if (existingPhone) {
    return res.status(409).json({ error: 'An account with this mobile number already exists.' });
  }
  if (emailVal) {
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(emailVal);
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
  }

  const now = new Date().toISOString();
  const userId = `usr-${crypto.randomUUID()}`;
  const patientId = `pat-${crypto.randomUUID()}`;
  const healthId = generateUniqueHealthId();
  const passwordHash = bcrypt.hashSync(data.password, 10);

  db.prepare(`
    INSERT INTO users (id, email, phone, password_hash, full_name, role, preferred_language, mfa_enabled, is_verified, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'patient', ?, 0, 1, 'active', ?)
  `).run(userId, emailVal, data.phone, passwordHash, data.full_name, data.preferred_language, now);

  db.prepare(`
    INSERT INTO patients (id, user_id, date_of_birth, gender, blood_group, has_smartphone, abha_linked, jurisdiction, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(patientId, userId, data.date_of_birth, data.gender, data.blood_group, data.has_smartphone ? 1 : 0, data.jurisdiction, now);

  db.prepare(`
    INSERT INTO patient_health_ids (id, patient_id, health_id, qr_token_secret, status, issued_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).run(`hid-${crypto.randomUUID()}`, patientId, healthId, crypto.randomBytes(16).toString('hex'), now);

  db.prepare(`
    INSERT INTO patient_profiles (id, patient_id, chronic_conditions_json, allergies_json, baseline_notes, updated_at)
    VALUES (?, ?, '[]', '[]', ?, ?)
  `).run(`prof-${crypto.randomUUID()}`, patientId, data.has_smartphone ? '' : 'Registered via keypad/assisted onboarding.', now);

  const authUser = {
    id: userId,
    email: emailVal,
    phone: data.phone,
    full_name: data.full_name,
    role: 'patient' as UserRole,
    preferred_language: data.preferred_language,
  };

  res.status(201).json({
    token: signSessionToken(authUser),
    user: authUser,
    health_id: healthId,
    patient_id: patientId,
  });
});

const LoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(4),
});

router.post('/login', rateLimit(30, 60_000), (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Provide email or mobile number and password.' });
  }
  const { identifier, password } = parsed.data;
  const userRow = db
    .prepare(
      `SELECT id, email, phone, password_hash, full_name, role, preferred_language, status
       FROM users WHERE lower(email) = lower(?) OR phone = ?`
    )
    .get(identifier.trim(), identifier.trim()) as
    | {
        id: string;
        email: string | null;
        phone: string | null;
        password_hash: string;
        full_name: string;
        role: UserRole;
        preferred_language: string;
        status: string;
      }
    | undefined;

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (userRow.status !== 'active') {
    return res.status(403).json({ error: 'Account is suspended or inactive.' });
  }

  const authUser = {
    id: userRow.id,
    email: userRow.email,
    phone: userRow.phone,
    full_name: userRow.full_name,
    role: userRow.role,
    preferred_language: userRow.preferred_language,
  };

  res.json({
    token: signSessionToken(authUser),
    user: authUser,
  });
});

router.post('/demo-login', (req, res) => {
  const role = String(req.body?.role || 'patient') as UserRole;
  const userRow = db
    .prepare(
      `SELECT id, email, phone, full_name, role, preferred_language
       FROM users WHERE role = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1`
    )
    .get(role) as
    | {
        id: string;
        email: string | null;
        phone: string | null;
        full_name: string;
        role: UserRole;
        preferred_language: string;
      }
    | undefined;

  if (!userRow) {
    return res.status(404).json({ error: `Demo user for role '${role}' not found.` });
  }

  res.json({
    token: signSessionToken(userRow),
    user: userRow,
    demo_mode: true,
  });
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const patient = db
    .prepare(
      `SELECT p.*, h.health_id FROM patients p
       JOIN patient_health_ids h ON h.patient_id = p.id AND h.status = 'active'
       WHERE p.user_id = ?`
    )
    .get(user.id);

  const doctor = db
    .prepare(
      `SELECT d.*, h.name as hospital_name FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       WHERE d.user_id = ?`
    )
    .get(user.id);

  const staff = db
    .prepare(
      `SELECT s.*, h.name as hospital_name FROM hospital_staff s
       JOIN hospitals h ON h.id = s.hospital_id
       WHERE s.user_id = ?`
    )
    .get(user.id);

  res.json({ user, patient: patient || null, doctor: doctor || null, staff: staff || null });
});

router.patch('/language', requireAuth, (req: AuthedRequest, res) => {
  const lang = z.string().min(2).max(10).safeParse(req.body?.language);
  if (!lang.success) {
    return res.status(400).json({ error: 'Invalid language code.' });
  }
  db.prepare('UPDATE users SET preferred_language = ? WHERE id = ?').run(lang.data, req.user!.id);
  res.json({ preferred_language: lang.data });
});

router.post('/abha-link', requireAuth, (req: AuthedRequest, res) => {
  const abhaInput = String(req.body?.abha_number || '').replace(/\s+/g, '');
  if (!/^\d{14}$|^\d{2}-\d{4}-\d{4}-\d{4}$/.test(abhaInput)) {
    return res.status(400).json({ error: 'Enter a valid 14-digit ABHA number (e.g. 91-1234-5678-9012).' });
  }
  const clean = abhaInput.replace(/-/g, '');
  const masked = `${clean.slice(0, 2)}-${clean.slice(2, 6)}-XXXX-${clean.slice(10, 14)}`;
  db.prepare('UPDATE patients SET abha_linked = 1, abha_number_masked = ? WHERE user_id = ?').run(
    masked,
    req.user!.id
  );
  res.json({ abha_linked: true, abha_number_masked: masked });
});

export default router;
