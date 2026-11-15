import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { db, UPLOAD_ROOT } from '../db.ts';
import {
  requireAuth,
  verifyPatientAccess,
  logPatientAccess,
  signShortLivedToken,
  verifySignedToken,
  type AuthedRequest,
} from '../middleware/auth.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'application/dicom'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.dcm') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Upload PDF, PNG, JPG, TXT, or DICOM.'));
    }
  },
});

// List documents with search & filter
router.get('/', requireAuth, (req: AuthedRequest, res) => {
  const patientId = String(req.query.patient_id || '');
  if (!patientId) return res.status(400).json({ error: 'patient_id query parameter is required.' });

  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized) {
    return res.status(403).json({ error: access.reason });
  }

  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const facility = typeof req.query.facility === 'string' ? req.query.facility.trim().toLowerCase() : '';

  const docs = db
    .prepare(
      `SELECT id, patient_id, facility_name, title, category, document_date, mime_type, file_size_bytes, sha256_hash, page_count, verification_status, raw_extracted_text, created_at
       FROM medical_documents WHERE patient_id = ? ORDER BY document_date DESC`
    )
    .all(patientId) as Array<{
    id: string;
    patient_id: string;
    facility_name: string;
    title: string;
    category: string;
    document_date: string;
    mime_type: string;
    file_size_bytes: number;
    sha256_hash: string;
    page_count: number;
    verification_status: string;
    raw_extracted_text: string;
    created_at: string;
  }>;

  const filtered = docs.filter((d) => {
    if (!access.allowedCategories.includes(d.category)) return false;
    if (category && category !== 'all' && d.category !== category) return false;
    if (facility && !d.facility_name.toLowerCase().includes(facility)) return false;
    if (search && !`${d.title} ${d.facility_name} ${d.raw_extracted_text}`.toLowerCase().includes(search)) return false;
    return true;
  });

  // Issue time-limited signed URL tokens for downloads/previews
  const enriched = filtered.map((d) => ({
    ...d,
    signed_preview_url: `/api/records/${d.id}/content?sig=${encodeURIComponent(
      signShortLivedToken({ doc_id: d.id, user_id: req.user!.id }, 600)
    )}`,
  }));

  res.json({ documents: enriched, access_mode: access.accessMode });
});

// Upload document with SHA-256 duplicate detection
router.post('/upload', requireAuth, upload.single('file'), (req: AuthedRequest, res) => {
  const { patient_id, title, category, facility_name, document_date, notes } = req.body as {
    patient_id: string;
    title: string;
    category: string;
    facility_name?: string;
    document_date?: string;
    notes?: string;
  };

  if (!patient_id || !title || !category) {
    return res.status(400).json({ error: 'patient_id, title, and category are required.' });
  }

  const access = verifyPatientAccess(req.user!, patient_id);
  const isFacilityUploader = req.user!.role === 'hospital_admin' || req.user!.role === 'lab_admin';
  if (!access.authorized && !isFacilityUploader) {
    return res.status(403).json({ error: access.reason || 'Not authorized to upload records for this patient.' });
  }

  const fileBuf = req.file ? req.file.buffer : Buffer.from(notes || title, 'utf8');
  const mimeType = req.file ? req.file.mimetype : 'text/plain';
  const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');

  const duplicate = db
    .prepare('SELECT id, title, document_date FROM medical_documents WHERE patient_id = ? AND sha256_hash = ?')
    .get(patient_id, hash) as { id: string; title: string; document_date: string } | undefined;

  if (duplicate) {
    return res.status(409).json({
      error: `Duplicate document detected. Identical file hash already exists ("${duplicate.title}", dated ${duplicate.document_date}).`,
      duplicate_id: duplicate.id,
    });
  }

  const docId = `doc-${crypto.randomUUID()}`;
  const ext = req.file ? path.extname(req.file.originalname) || '.bin' : '.txt';
  const storedPath = path.join(UPLOAD_ROOT, `${docId}${ext}`);
  fs.writeFileSync(storedPath, fileBuf);

  const extractedText =
    mimeType.startsWith('text/') || !req.file
      ? fileBuf.toString('utf8')
      : `[Uploaded ${mimeType} file: ${req.file.originalname}, ${fileBuf.length} bytes]. Clinician notes: ${notes || 'None provided.'}`;

  const docDate = document_date || new Date().toISOString().slice(0, 10);
  const facName = facility_name || 'Patient Direct Upload';
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO medical_documents (
      id, patient_id, uploaded_by_user_id, facility_name, title, category, document_date,
      mime_type, file_size_bytes, sha256_hash, storage_path, raw_extracted_text, page_count, verification_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    docId,
    patient_id,
    req.user!.id,
    facName,
    title,
    category,
    docDate,
    mimeType,
    fileBuf.length,
    hash,
    storedPath,
    extractedText,
    req.user!.role === 'patient' ? 'patient_uploaded' : 'verified',
    nowIso
  );

  db.prepare(`
    INSERT INTO medical_records (id, document_id, patient_id, record_type, summary_headline, recorded_at, clinician_name, facility_name, provenance_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `rec-${crypto.randomUUID()}`,
    docId,
    patient_id,
    category,
    title,
    docDate,
    req.user!.full_name,
    facName,
    req.user!.role === 'patient' ? 'patient_uploaded' : 'verified'
  );

  logPatientAccess({
    patientId: patient_id,
    actor: req.user!,
    facilityName: facName,
    action: 'UPLOAD_RECORD',
    purpose: `Uploaded ${category}: ${title}`,
    recordsAccessed: [docId],
  });

  res.status(201).json({
    id: docId,
    title,
    sha256_hash: hash,
    verification_status: req.user!.role === 'patient' ? 'patient_uploaded' : 'verified',
  });
});

// Serve document content using time-limited signed URL
router.get('/:docId/content', (req, res) => {
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  if (!sig) return res.status(401).json({ error: 'Signed access token required.' });

  let payload: { doc_id: string; user_id: string };
  try {
    payload = verifySignedToken<{ doc_id: string; user_id: string }>(sig);
  } catch {
    return res.status(401).json({ error: 'Signed document URL has expired.' });
  }

  if (payload.doc_id !== req.params.docId) {
    return res.status(403).json({ error: 'Token does not match requested document.' });
  }

  const doc = db.prepare('SELECT * FROM medical_documents WHERE id = ?').get(req.params.docId) as
    | { storage_path: string; mime_type: string; title: string; raw_extracted_text: string }
    | undefined;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  if (fs.existsSync(doc.storage_path)) {
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.title.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
    return fs.createReadStream(doc.storage_path).pipe(res);
  }
  res.type('text/plain').send(doc.raw_extracted_text);
});

// Chronological Medical Timeline
router.get('/timeline', requireAuth, (req: AuthedRequest, res) => {
  const patientId = String(req.query.patient_id || '');
  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const docs = db
    .prepare(
      `SELECT id, title, category, facility_name, document_date, verification_status, page_count
       FROM medical_documents WHERE patient_id = ? ORDER BY document_date DESC`
    )
    .all(patientId);

  const diagnoses = db
    .prepare('SELECT id, icd_code, condition_name, diagnosed_at, clinician_name, status FROM diagnoses WHERE patient_id = ?')
    .all(patientId);

  const medications = db
    .prepare('SELECT id, drug_name, dose, frequency, started_at, prescribed_by, status FROM medications WHERE patient_id = ?')
    .all(patientId);

  res.json({ documents: docs, diagnoses, medications });
});

// Old vs New Medical Report Comparison (with unit & methodology safeguards!)
router.get('/compare', requireAuth, (req: AuthedRequest, res) => {
  const patientId = String(req.query.patient_id || '');
  const canonicalCode = typeof req.query.canonical_code === 'string' ? req.query.canonical_code : '';

  const access = verifyPatientAccess(req.user!, patientId);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const allObs = db
    .prepare(
      `SELECT o.*, d.title as document_title, d.document_date
       FROM clinical_observations o
       JOIN medical_documents d ON d.id = o.document_id
       WHERE o.patient_id = ?
       ORDER BY o.observed_at ASC`
    )
    .all(patientId) as Array<{
    id: string;
    document_id: string;
    document_title: string;
    test_name: string;
    canonical_code: string;
    value_numeric: number | null;
    value_text: string;
    unit: string;
    ref_low: number | null;
    ref_high: number | null;
    methodology: string;
    lab_name: string;
    observed_at: string;
    is_abnormal: number;
    flag: string;
  }>;

  // Group available canonical codes
  const analytesMap = new Map<string, { code: string; name: string; count: number }>();
  for (const o of allObs) {
    const cur = analytesMap.get(o.canonical_code);
    analytesMap.set(o.canonical_code, {
      code: o.canonical_code,
      name: o.test_name,
      count: (cur?.count || 0) + 1,
    });
  }

  const selectedCode = canonicalCode || Array.from(analytesMap.keys())[0] || 'HBA1C';
  const series = allObs.filter((o) => o.canonical_code === selectedCode);
  const units = Array.from(new Set(series.map((s) => s.unit)));
  const methods = Array.from(new Set(series.map((s) => s.methodology)));

  const unitsCompatible = units.length <= 1;
  const methodologyChanged = methods.length > 1;

  let deltaSummary: Record<string, unknown> | null = null;
  if (series.length >= 2 && unitsCompatible) {
    const oldest = series[0];
    const latest = series[series.length - 1];
    if (oldest.value_numeric !== null && latest.value_numeric !== null) {
      const diff = Number((latest.value_numeric - oldest.value_numeric).toFixed(2));
      const pct = oldest.value_numeric !== 0 ? Number(((diff / oldest.value_numeric) * 100).toFixed(1)) : 0;
      deltaSummary = {
        from_date: oldest.observed_at,
        to_date: latest.observed_at,
        from_value: oldest.value_numeric,
        to_value: latest.value_numeric,
        unit: latest.unit,
        absolute_change: diff,
        percent_change: pct,
        direction: diff < 0 ? 'decreased' : diff > 0 ? 'increased' : 'unchanged',
      };
    }
  }

  res.json({
    available_analytes: Array.from(analytesMap.values()),
    selected_code: selectedCode,
    units_compatible: unitsCompatible,
    units_detected: units,
    methodology_changed: methodologyChanged,
    methods_detected: methods,
    safeguard_warning: !unitsCompatible
      ? `Blocked automated arithmetic delta: incompatible units detected (${units.join(' vs ')}).`
      : methodologyChanged
      ? `Clinical notice: laboratory methodology changed across periods (${methods.join(' vs ')}). Compare with reference range context.`
      : null,
    series,
    delta_summary: deltaSummary,
  });
});

// Smart Test Repetition Assistance (Module 8: NEVER blocks or cancels, prompts doctor to review)
router.post('/check-repetition', requireAuth, (req: AuthedRequest, res) => {
  const { patient_id, canonical_code, window_days = 30 } = req.body as {
    patient_id: string;
    canonical_code: string;
    window_days?: number;
  };

  const access = verifyPatientAccess(req.user!, patient_id);
  if (!access.authorized) return res.status(403).json({ error: access.reason });

  const rows = db
    .prepare(
      `SELECT o.*, d.title as document_title
       FROM clinical_observations o
       JOIN medical_documents d ON d.id = o.document_id
       WHERE o.patient_id = ? AND o.canonical_code = ?
       ORDER BY o.observed_at DESC LIMIT 1`
    )
    .all(patient_id, canonical_code) as Array<{
    test_name: string;
    value_text: string;
    unit: string;
    observed_at: string;
    lab_name: string;
    document_id: string;
    document_title: string;
  }>;

  if (rows.length === 0) {
    return res.json({ recent_found: false, decision_authority: 'doctor_decides' });
  }

  const latest = rows[0];
  const daysAgo = Math.max(0, Math.round((Date.now() - new Date(latest.observed_at).getTime()) / (1000 * 60 * 60 * 24)));

  if (daysAgo <= window_days) {
    return res.json({
      recent_found: true,
      days_ago: daysAgo,
      prompt_message: `Similar ${latest.test_name} report available from ${daysAgo} day(s) ago (${latest.value_text} ${latest.unit} on ${latest.observed_at} at ${latest.lab_name}). Please review the previous result before ordering.`,
      previous_observation: latest,
      decision_authority: 'doctor_decides_never_auto_blocked',
    });
  }

  res.json({
    recent_found: false,
    last_recorded_days_ago: daysAgo,
    previous_observation: latest,
    decision_authority: 'doctor_decides',
  });
});

export default router;
