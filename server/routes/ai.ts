import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, requireRole, verifyPatientAccess, type AuthedRequest } from '../middleware/auth.ts';
import { generateDoctorClinicalSummary, generatePatientCompanionSummary } from '../services/geminiAgentService.ts';

const router = Router();

router.post(
  '/doctor-summary',
  requireAuth,
  requireRole('doctor', 'hospital_admin'),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      patient_id: z.string(),
      document_ids: z.array(z.string()).optional(),
      purpose: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'patient_id is required.' });

    try {
      const result = await generateDoctorClinicalSummary({
        actor: req.user!,
        patientId: parsed.data.patient_id,
        documentIds: parsed.data.document_ids,
        purpose: parsed.data.purpose,
      });
      res.json(result);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status || 500;
      const message = err instanceof Error ? err.message : 'Failed to generate clinical summary.';
      res.status(status).json({ error: message });
    }
  }
);

router.post('/patient-companion', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    patient_id: z.string(),
    language: z.string().default('en'),
    document_ids: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'patient_id is required.' });

  try {
    const result = await generatePatientCompanionSummary({
      actor: req.user!,
      patientId: parsed.data.patient_id,
      language: parsed.data.language,
      documentIds: parsed.data.document_ids,
    });
    res.json(result);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    const message = err instanceof Error ? err.message : 'Failed to generate plain-language explanation.';
    res.status(status).json({ error: message });
  }
});

router.post('/feedback', requireAuth, requireRole('doctor', 'hospital_admin'), (req: AuthedRequest, res) => {
  const schema = z.object({
    ai_summary_id: z.string(),
    accuracy_rating: z.enum(['accurate', 'needs_correction', 'flagged_conflict']),
    correction_notes: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide rating and correction notes.' });

  const feedback = {
    reviewer_id: req.user!.id,
    reviewer_name: req.user!.full_name,
    accuracy_rating: parsed.data.accuracy_rating,
    correction_notes: parsed.data.correction_notes,
    reviewed_at: new Date().toISOString(),
  };

  db.prepare('UPDATE ai_summaries SET reviewer_feedback_json = ? WHERE id = ?').run(
    JSON.stringify(feedback),
    parsed.data.ai_summary_id
  );

  res.json({ saved: true, feedback });
});

router.get('/history', requireAuth, (req: AuthedRequest, res) => {
  const patientId = String(req.query.patient_id || '');
  if (!patientId) return res.status(400).json({ error: 'patient_id is required.' });

  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const rows = db
    .prepare(
      `SELECT id, summary_type, language, model_name, prompt_version, validation_status, latency_ms, token_usage_json, estimated_cost_usd, reviewer_feedback_json, created_at
       FROM ai_summaries WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(patientId);

  res.json({ summaries: rows });
});

export default router;
