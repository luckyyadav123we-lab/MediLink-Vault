import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, UPLOAD_ROOT } from '../db.ts';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireRole, logPatientAccess, type AuthedRequest } from '../middleware/auth.ts';

const router = Router();

// Hospital Admin Overview
router.get('/hospital/overview', requireAuth, requireRole('hospital_admin', 'super_admin'), (_req: AuthedRequest, res) => {
  const hospital = db.prepare('SELECT * FROM hospitals LIMIT 1').get();
  const staff = db
    .prepare(
      `SELECT hs.*, u.full_name, u.email, u.role
       FROM hospital_staff hs JOIN users u ON u.id = hs.user_id`
    )
    .all();
  const doctors = db
    .prepare(
      `SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON u.id = d.user_id`
    )
    .all();
  const recentUploads = db
    .prepare(
      `SELECT md.id, md.title, md.category, md.facility_name, md.document_date, md.verification_status, h.health_id
       FROM medical_documents md
       JOIN patient_health_ids h ON h.patient_id = md.patient_id AND h.status = 'active'
       ORDER BY md.created_at DESC LIMIT 10`
    )
    .all();
  const auditLogs = db.prepare('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 20').all();
  const integrations = db.prepare('SELECT * FROM integration_configurations').all();

  res.json({ hospital, staff, doctors, recent_uploads: recentUploads, audit_logs: auditLogs, integrations });
});

router.post('/hospital/staff', requireAuth, requireRole('hospital_admin', 'super_admin'), (req: AuthedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2),
    email: z.string().email(),
    staff_role: z.string().min(2),
    department: z.string().min(2),
    role: z.enum(['doctor', 'hospital_admin']).default('doctor'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid staff onboarding payload.' });

  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(parsed.data.email);
  if (existing) return res.status(409).json({ error: 'Email already registered.' });

  const nowIso = new Date().toISOString();
  const userId = `usr-${crypto.randomUUID()}`;
  const passHash = bcrypt.hashSync('MediLink@2026', 10);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, preferred_language, mfa_enabled, is_verified, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'en', 1, 1, 'active', ?)
  `).run(userId, parsed.data.email.toLowerCase(), passHash, parsed.data.full_name, parsed.data.role, nowIso);

  if (parsed.data.role === 'doctor') {
    db.prepare(`
      INSERT INTO doctors (id, user_id, hospital_id, specialty, registration_number, verification_status, created_at)
      VALUES (?, ?, 'hosp-1', ?, ?, 'verified', ?)
    `).run(`doc-${crypto.randomUUID()}`, userId, parsed.data.department, `REG-${crypto.randomInt(10000, 99999)}`, nowIso);
  }

  db.prepare(`
    INSERT INTO hospital_staff (id, user_id, hospital_id, staff_role, department, permissions_json, status, created_at)
    VALUES (?, ?, 'hosp-1', ?, ?, '["view_records","upload_records"]', 'active', ?)
  `).run(`staff-${crypto.randomUUID()}`, userId, parsed.data.staff_role, parsed.data.department, nowIso);

  res.status(201).json({ onboarded: true, full_name: parsed.data.full_name, role: parsed.data.role });
});

// Diagnostic Lab Overview & Structured Report Submission
router.get('/lab/overview', requireAuth, requireRole('lab_admin', 'super_admin'), (_req: AuthedRequest, res) => {
  const lab = db.prepare('SELECT * FROM laboratories LIMIT 1').get();
  const submissions = db
    .prepare(
      `SELECT md.id, md.title, md.document_date, md.facility_name, md.verification_status, md.created_at, h.health_id, u.full_name as patient_name
       FROM medical_documents md
       JOIN patients p ON p.id = md.patient_id
       JOIN users u ON u.id = p.user_id
       JOIN patient_health_ids h ON h.patient_id = p.id AND h.status = 'active'
       WHERE md.category = 'lab_report'
       ORDER BY md.created_at DESC LIMIT 20`
    )
    .all();

  const observationsCount = (db.prepare('SELECT COUNT(*) as c FROM clinical_observations').get() as { c: number }).c;
  res.json({ lab, submissions, total_structured_observations: observationsCount });
});

router.post('/lab/submit-report', requireAuth, requireRole('lab_admin', 'hospital_admin'), (req: AuthedRequest, res) => {
  const schema = z.object({
    health_id: z.string().regex(/^MV-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
    title: z.string().min(4),
    observed_at: z.string().min(8),
    lab_name: z.string().min(2).default('MetroPath Diagnostics & Reference Lab (Demo)'),
    observations: z
      .array(
        z.object({
          test_name: z.string(),
          canonical_code: z.string(),
          value_numeric: z.number(),
          unit: z.string(),
          ref_low: z.number(),
          ref_high: z.number(),
          methodology: z.string(),
        })
      )
      .min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid structured lab report payload.' });

  const pat = db
    .prepare(
      `SELECT p.id as patient_id, p.user_id FROM patient_health_ids h
       JOIN patients p ON p.id = h.patient_id WHERE h.health_id = ? AND h.status = 'active'`
    )
    .get(parsed.data.health_id) as { patient_id: string; user_id: string } | undefined;

  if (!pat) return res.status(404).json({ error: `Patient Health ID ${parsed.data.health_id} not found.` });

  const docId = `doc-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  const reportText = [
    `FACILITY: ${parsed.data.lab_name} | DATE: ${parsed.data.observed_at} | HEALTH ID: ${parsed.data.health_id}`,
    ...parsed.data.observations.map((o) => {
      const flag = o.value_numeric > o.ref_high ? 'HIGH' : o.value_numeric < o.ref_low ? 'LOW' : 'NORMAL';
      return `- ${o.test_name}: ${o.value_numeric} ${o.unit} [Reference: ${o.ref_low} - ${o.ref_high} ${o.unit}] METHOD: ${o.methodology} FLAG: ${flag}`;
    }),
  ].join('\n');

  const storedPath = path.join(UPLOAD_ROOT, `${docId}.txt`);
  fs.writeFileSync(storedPath, reportText, 'utf8');
  const hash = crypto.createHash('sha256').update(reportText).digest('hex');

  db.prepare(`
    INSERT INTO medical_documents (
      id, patient_id, uploaded_by_user_id, source_lab_id, facility_name, title, category, document_date,
      mime_type, file_size_bytes, sha256_hash, storage_path, raw_extracted_text, page_count, verification_status, created_at
    ) VALUES (?, ?, ?, 'lab-1', ?, ?, 'lab_report', ?, 'text/plain', ?, ?, ?, ?, 1, 'verified', ?)
  `).run(docId, pat.patient_id, req.user!.id, parsed.data.lab_name, parsed.data.title, parsed.data.observed_at, Buffer.byteLength(reportText), hash, storedPath, reportText, nowIso);

  const insertObs = db.prepare(`
    INSERT INTO clinical_observations (id, document_id, patient_id, test_name, canonical_code, value_numeric, value_text, unit, ref_low, ref_high, methodology, lab_name, observed_at, is_abnormal, flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const o of parsed.data.observations) {
    const isAbn = o.value_numeric > o.ref_high || o.value_numeric < o.ref_low;
    const flag = o.value_numeric > o.ref_high ? 'high' : o.value_numeric < o.ref_low ? 'low' : 'normal';
    insertObs.run(
      `obs-${crypto.randomUUID()}`,
      docId,
      pat.patient_id,
      o.test_name,
      o.canonical_code,
      o.value_numeric,
      String(o.value_numeric),
      o.unit,
      o.ref_low,
      o.ref_high,
      o.methodology,
      parsed.data.lab_name,
      parsed.data.observed_at,
      isAbn ? 1 : 0,
      flag
    );
  }

  db.prepare(`
    INSERT INTO notifications (id, user_id, channel, title, message, is_read, created_at)
    VALUES (?, ?, 'in_app', 'New Structured Lab Report Delivered', ?, 0, ?)
  `).run(`notif-${crypto.randomUUID()}`, pat.user_id, `${parsed.data.lab_name} delivered "${parsed.data.title}" to your vault.`, nowIso);

  logPatientAccess({
    patientId: pat.patient_id,
    actor: req.user!,
    facilityName: parsed.data.lab_name,
    action: 'STRUCTURED_LAB_SUBMISSION',
    purpose: `Delivered ${parsed.data.title}`,
    recordsAccessed: [docId],
  });

  res.status(201).json({ document_id: docId, observations_recorded: parsed.data.observations.length });
});

// Platform Super Admin Overview
router.get('/super/overview', requireAuth, requireRole('super_admin'), (_req: AuthedRequest, res) => {
  const counts = {
    users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
    patients: (db.prepare('SELECT COUNT(*) as c FROM patients').get() as { c: number }).c,
    doctors: (db.prepare('SELECT COUNT(*) as c FROM doctors').get() as { c: number }).c,
    hospitals: (db.prepare('SELECT COUNT(*) as c FROM hospitals').get() as { c: number }).c,
    laboratories: (db.prepare('SELECT COUNT(*) as c FROM laboratories').get() as { c: number }).c,
    documents: (db.prepare('SELECT COUNT(*) as c FROM medical_documents').get() as { c: number }).c,
    ai_summaries: (db.prepare('SELECT COUNT(*) as c FROM ai_summaries').get() as { c: number }).c,
    break_glass_events: (db.prepare('SELECT COUNT(*) as c FROM access_logs WHERE is_emergency_break_glass = 1').get() as { c: number }).c,
  };

  const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY created_at DESC').all();
  const labs = db.prepare('SELECT * FROM laboratories ORDER BY created_at DESC').all();
  const subscriptions = db
    .prepare(
      `SELECT s.*, u.full_name as subscriber_name, u.email
       FROM subscriptions s JOIN users u ON u.id = s.subscriber_user_id ORDER BY s.created_at DESC`
    )
    .all();
  const securityAlerts = db
    .prepare('SELECT * FROM access_logs WHERE is_emergency_break_glass = 1 OR action LIKE "%REVOKED%" ORDER BY created_at DESC LIMIT 20')
    .all();
  const tickets = db
    .prepare(
      `SELECT t.*, u.full_name as user_name, u.role as user_role
       FROM support_tickets t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`
    )
    .all();
  const aiMetrics = db
    .prepare('SELECT id, summary_type, model_name, prompt_version, validation_status, latency_ms, estimated_cost_usd, created_at FROM ai_summaries ORDER BY created_at DESC LIMIT 15')
    .all();

  res.json({ counts, hospitals, labs, subscriptions, security_alerts: securityAlerts, tickets, ai_metrics: aiMetrics });
});

router.patch('/super/tickets/:id', requireAuth, requireRole('super_admin'), (req: AuthedRequest, res) => {
  const { status, admin_notes } = req.body as { status: string; admin_notes?: string };
  db.prepare('UPDATE support_tickets SET status = ?, admin_notes = COALESCE(?, admin_notes) WHERE id = ?').run(
    status,
    admin_notes ?? null,
    req.params.id
  );
  res.json({ updated: true });
});

router.patch('/super/hospitals/:id/verify', requireAuth, requireRole('super_admin'), (req: AuthedRequest, res) => {
  const status = String(req.body?.verification_status || 'verified');
  db.prepare('UPDATE hospitals SET verification_status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ updated: true, verification_status: status });
});

export default router;
