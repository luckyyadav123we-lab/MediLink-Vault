import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, verifyPatientAccess, type AuthedRequest } from '../middleware/auth.ts';

const router = Router();

// Healthcare directory (clearly labeled demo records)
router.get('/directory', requireAuth, (req: AuthedRequest, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';
  const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY name ASC').all() as Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    accreditation: string;
    verification_status: string;
    emergency_phone: string;
    is_demo: number;
  }>;

  const doctors = db
    .prepare(
      `SELECT d.*, u.full_name, h.name as hospital_name, h.city
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN hospitals h ON h.id = d.hospital_id`
    )
    .all() as Array<{ id: string; full_name: string; specialty: string; city: string; hospital_name: string }>;

  const labs = db.prepare('SELECT * FROM laboratories ORDER BY name ASC').all() as Array<{
    id: string;
    name: string;
    city: string;
    accreditation: string;
    verification_status: string;
    is_demo: number;
  }>;

  res.json({
    data_notice: 'Directory entries marked (Demo) are synthetic verification records.',
    hospitals: city ? hospitals.filter((h) => h.city.toLowerCase().includes(city)) : hospitals,
    doctors: city ? doctors.filter((d) => (d.city || '').toLowerCase().includes(city)) : doctors,
    laboratories: city ? labs.filter((l) => l.city.toLowerCase().includes(city)) : labs,
  });
});

// Emergency contacts shown ONLY after jurisdiction verification
router.get('/emergency-info', requireAuth, (req: AuthedRequest, res) => {
  const jurisdiction = String(req.query.jurisdiction || '').toUpperCase();
  const map: Record<string, { country: string; emergency: string; ambulance: string; poison_or_helpline: string }> = {
    IN: { country: 'India', emergency: '112', ambulance: '108 / 102', poison_or_helpline: '104 Health Helpline' },
    US: { country: 'United States', emergency: '911', ambulance: '911', poison_or_helpline: '1-800-222-1222' },
    GB: { country: 'United Kingdom', emergency: '999 / 112', ambulance: '999', poison_or_helpline: '111 NHS Non-Emergency' },
    AE: { country: 'UAE', emergency: '999', ambulance: '998', poison_or_helpline: '800 342 DHA' },
  };
  if (!map[jurisdiction]) {
    return res.status(400).json({
      verified: false,
      error: 'Select and verify your country/jurisdiction (IN, US, GB, AE) before viewing emergency numbers.',
    });
  }
  res.json({ verified: true, jurisdiction, ...map[jurisdiction] });
});

// Book Appointment / Second Opinion / Health Checkup
router.post('/appointments', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    patient_id: z.string(),
    doctor_id: z.string().optional(),
    hospital_id: z.string().optional(),
    service_type: z.enum(['consultation', 'second_opinion', 'health_checkup', 'teleconsultation']),
    scheduled_at: z.string().min(8),
    reason: z.string().min(4),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Complete all appointment fields.' });

  const access = verifyPatientAccess(req.user!, parsed.data.patient_id);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const id = `appt-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO appointments (id, patient_id, doctor_id, hospital_id, service_type, scheduled_at, status, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
  `).run(
    id,
    parsed.data.patient_id,
    parsed.data.doctor_id || null,
    parsed.data.hospital_id || null,
    parsed.data.service_type,
    parsed.data.scheduled_at,
    parsed.data.reason,
    nowIso
  );

  res.status(201).json({ id, status: 'confirmed', scheduled_at: parsed.data.scheduled_at });
});

router.get('/appointments', requireAuth, (req: AuthedRequest, res) => {
  const patientId = typeof req.query.patient_id === 'string' ? req.query.patient_id : '';
  if (patientId) {
    const access = verifyPatientAccess(req.user!, patientId);
    if (!access.authorized) return res.status(403).json({ error: access.reason });
    const rows = db
      .prepare(
        `SELECT a.*, h.name as hospital_name, u.full_name as doctor_name, d.specialty
         FROM appointments a
         LEFT JOIN hospitals h ON h.id = a.hospital_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         LEFT JOIN users u ON u.id = d.user_id
         WHERE a.patient_id = ? ORDER BY a.scheduled_at DESC`
      )
      .all(patientId);
    return res.json({ appointments: rows });
  }

  const rows = db
    .prepare(
      `SELECT a.*, h.name as hospital_name, pu.full_name as patient_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN users pu ON pu.id = p.user_id
       LEFT JOIN hospitals h ON h.id = a.hospital_id
       ORDER BY a.scheduled_at DESC LIMIT 30`
    )
    .all();
  res.json({ appointments: rows });
});

// Support Tickets & Help Center
router.get('/tickets', requireAuth, (req: AuthedRequest, res) => {
  const rows =
    req.user!.role === 'super_admin'
      ? db
          .prepare(
            `SELECT t.*, u.full_name as user_name, u.role as user_role
             FROM support_tickets t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`
          )
          .all()
      : db.prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.id);

  res.json({ tickets: rows });
});

router.post('/tickets', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    category: z.enum(['technical', 'login', 'payment', 'data_privacy']),
    subject: z.string().min(4),
    description: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide subject and detailed description.' });

  const id = `tkt-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO support_tickets (id, user_id, category, subject, description, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?)
  `).run(id, req.user!.id, parsed.data.category, parsed.data.subject, parsed.data.description, new Date().toISOString());

  res.status(201).json({ id, status: 'open' });
});

// Notifications
router.get('/notifications', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(req.user!.id);
  res.json({ notifications: rows });
});

router.post('/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ read: true });
});

export default router;
