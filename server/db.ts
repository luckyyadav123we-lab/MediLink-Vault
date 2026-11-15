import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'medilink.db');
export const UPLOAD_ROOT = UPLOADS_DIR;

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('patient','doctor','hospital_admin','lab_admin','super_admin')),
      preferred_language TEXT NOT NULL DEFAULT 'en',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      is_verified INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      accreditation TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      emergency_phone TEXT NOT NULL,
      api_enabled INTEGER NOT NULL DEFAULT 1,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS laboratories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      accreditation TEXT NOT NULL,
      api_key_prefix TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hospital_id TEXT REFERENCES hospitals(id),
      specialty TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      consultation_fee_inr INTEGER NOT NULL DEFAULT 800,
      available_days TEXT NOT NULL DEFAULT 'Mon-Sat',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospital_staff (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      staff_role TEXT NOT NULL,
      department TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_of_birth TEXT NOT NULL,
      gender TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      has_smartphone INTEGER NOT NULL DEFAULT 1,
      abha_linked INTEGER NOT NULL DEFAULT 0,
      abha_number_masked TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      jurisdiction TEXT NOT NULL DEFAULT 'IN',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patient_health_ids (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      health_id TEXT UNIQUE NOT NULL,
      qr_token_secret TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      issued_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_id_lookup ON patient_health_ids(health_id);

    CREATE TABLE IF NOT EXISTS patient_profiles (
      id TEXT PRIMARY KEY,
      patient_id TEXT UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      chronic_conditions_json TEXT NOT NULL DEFAULT '[]',
      allergies_json TEXT NOT NULL DEFAULT '[]',
      baseline_notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medical_documents (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
      source_hospital_id TEXT REFERENCES hospitals(id),
      source_lab_id TEXT REFERENCES laboratories(id),
      facility_name TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('lab_report','prescription','discharge_summary','radiology_dicom','consultation_note')),
      document_date TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      sha256_hash TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      raw_extracted_text TEXT NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 1,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_med_docs_patient ON medical_documents(patient_id, document_date);
    CREATE INDEX IF NOT EXISTS idx_med_docs_hash ON medical_documents(patient_id, sha256_hash);

    CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES medical_documents(id) ON DELETE CASCADE,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      summary_headline TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      clinician_name TEXT NOT NULL,
      facility_name TEXT NOT NULL,
      provenance_status TEXT NOT NULL DEFAULT 'verified'
    );

    CREATE TABLE IF NOT EXISTS clinical_observations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES medical_documents(id) ON DELETE CASCADE,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      test_name TEXT NOT NULL,
      canonical_code TEXT NOT NULL,
      value_numeric REAL,
      value_text TEXT NOT NULL,
      unit TEXT NOT NULL,
      ref_low REAL,
      ref_high REAL,
      methodology TEXT NOT NULL,
      lab_name TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      is_abnormal INTEGER NOT NULL DEFAULT 0,
      flag TEXT NOT NULL DEFAULT 'normal'
    );
    CREATE INDEX IF NOT EXISTS idx_obs_patient_code ON clinical_observations(patient_id, canonical_code, observed_at);

    CREATE TABLE IF NOT EXISTS diagnoses (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES medical_documents(id),
      icd_code TEXT NOT NULL,
      condition_name TEXT NOT NULL,
      diagnosed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      clinician_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES medical_documents(id),
      drug_name TEXT NOT NULL,
      dose TEXT NOT NULL,
      route TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration TEXT NOT NULL,
      prescribed_by TEXT NOT NULL,
      started_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      document_id TEXT REFERENCES medical_documents(id),
      notes TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_id TEXT REFERENCES doctors(id),
      hospital_id TEXT REFERENCES hospitals(id),
      service_type TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consent_records (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      grantee_user_id TEXT REFERENCES users(id),
      grantee_hospital_id TEXT REFERENCES hospitals(id),
      grantee_name TEXT NOT NULL,
      grantee_role TEXT NOT NULL,
      purpose TEXT NOT NULL,
      scope_categories_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
      verification_method TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_consent_patient ON consent_records(patient_id, status);

    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      facility_name TEXT NOT NULL,
      action TEXT NOT NULL,
      purpose TEXT NOT NULL,
      records_accessed_json TEXT NOT NULL,
      is_emergency_break_glass INTEGER NOT NULL DEFAULT 0,
      emergency_reason TEXT,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_access_logs_patient ON access_logs(patient_id, created_at);

    CREATE TABLE IF NOT EXISTS otp_verifications (
      id TEXT PRIMARY KEY,
      target_phone_or_id TEXT NOT NULL,
      patient_id TEXT REFERENCES patients(id),
      otp_code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      channel TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS caregiver_permissions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      caregiver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caregiver_name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      can_view_records INTEGER NOT NULL DEFAULT 1,
      can_upload_records INTEGER NOT NULL DEFAULT 0,
      can_manage_consent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_summaries (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      requested_by_user_id TEXT NOT NULL REFERENCES users(id),
      summary_type TEXT NOT NULL CHECK(summary_type IN ('doctor_clinical','patient_companion')),
      language TEXT NOT NULL DEFAULT 'en',
      model_name TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      structured_json TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      source_doc_ids_json TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      token_usage_json TEXT NOT NULL,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      reviewer_feedback_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_summary_sources (
      id TEXT PRIMARY KEY,
      ai_summary_id TEXT NOT NULL REFERENCES ai_summaries(id) ON DELETE CASCADE,
      statement_key TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES medical_documents(id) ON DELETE CASCADE,
      document_name TEXT NOT NULL,
      facility_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      page_ref TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS report_comparisons (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      canonical_code TEXT NOT NULL,
      doc_a_id TEXT NOT NULL REFERENCES medical_documents(id),
      doc_b_id TEXT NOT NULL REFERENCES medical_documents(id),
      compatible INTEGER NOT NULL,
      incompatibility_reason TEXT,
      delta_summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      subscriber_user_id TEXT NOT NULL REFERENCES users(id),
      subscriber_type TEXT NOT NULL,
      plan_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      provider TEXT NOT NULL DEFAULT 'razorpay',
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      current_period_end TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      subscription_id TEXT REFERENCES subscriptions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      order_id TEXT NOT NULL,
      payment_id TEXT,
      signature_verified INTEGER NOT NULL DEFAULT 0,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES payment_transactions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      invoice_number TEXT UNIQUE NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      line_items_json TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_configurations (
      id TEXT PRIMARY KEY,
      facility_type TEXT NOT NULL,
      facility_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      fhir_endpoint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_synced_at TEXT NOT NULL
    );
  `);
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function seedDatabaseIfEmpty() {
  const countRow = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (countRow.c > 0) return;

  const now = new Date().toISOString();
  const demoPassHash = bcrypt.hashSync('MediLink@2026', 10);

  // 1. Users (all 5 roles + elderly keypad-phone patient)
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, phone, password_hash, full_name, role, preferred_language, mfa_enabled, is_verified, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);

  insertUser.run('usr-patient-1', 'aarav.sharma@demo.medilink.in', '+919820112233', demoPassHash, 'Aarav Sharma', 'patient', 'en', 0, 1, now);
  insertUser.run('usr-patient-2', 'kamla.devi@demo.medilink.in', '+919415009988', demoPassHash, 'Kamla Devi (Keypad SMS Profile)', 'patient', 'hi', 0, 1, now);
  insertUser.run('usr-doctor-1', 'dr.meera.nair@demo.medilink.in', '+919811223344', demoPassHash, 'Dr. Meera Nair, MD', 'doctor', 'en', 1, 1, now);
  insertUser.run('usr-hosp-1', 'admin.citycare@demo.medilink.in', '+919822334455', demoPassHash, 'Rohan Deshmukh (Hospital Admin)', 'hospital_admin', 'en', 1, 1, now);
  insertUser.run('usr-lab-1', 'lab.metropolis@demo.medilink.in', '+919833445566', demoPassHash, 'MetroPath Diagnostics Desk', 'lab_admin', 'en', 1, 1, now);
  insertUser.run('usr-super-1', 'superadmin@medilink.in', '+919800000001', demoPassHash, 'Platform Operations Lead', 'super_admin', 'en', 1, 1, now);

  // 2. Hospitals & Labs (clearly marked is_demo = 1 synthetic/demo records)
  const insertHosp = db.prepare(`
    INSERT INTO hospitals (id, name, city, state, country, accreditation, verification_status, emergency_phone, api_enabled, is_demo, created_at)
    VALUES (?, ?, ?, ?, 'India', ?, 'verified', ?, 1, 1, ?)
  `);
  insertHosp.run('hosp-1', 'City Care Multi-Specialty Hospital (Demo)', 'Pune', 'Maharashtra', 'NABH Accredited', '+91-20-6600-1100', now);
  insertHosp.run('hosp-2', 'Sahyadri Heart & Metabolic Institute (Demo)', 'Mumbai', 'Maharashtra', 'NABH & JCI Demo', '+91-22-4400-9900', now);
  insertHosp.run('hosp-3', 'Metro General Teaching Hospital (Demo)', 'Bengaluru', 'Karnataka', 'NABH Accredited', '+91-80-2211-4400', now);

  const insertLab = db.prepare(`
    INSERT INTO laboratories (id, name, city, accreditation, api_key_prefix, verification_status, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, 'verified', 1, ?)
  `);
  insertLab.run('lab-1', 'MetroPath Diagnostics & Reference Lab (Demo)', 'Pune', 'NABL ISO 15189', 'mlab_live_98a2', now);
  insertLab.run('lab-2', 'Suburban Clinical Pathology Network (Demo)', 'Mumbai', 'NABL Accredited', 'mlab_live_44c1', now);

  // 3. Doctors & Hospital Staff
  db.prepare(`
    INSERT INTO doctors (id, user_id, hospital_id, specialty, registration_number, verification_status, consultation_fee_inr, available_days, created_at)
    VALUES ('doc-1', 'usr-doctor-1', 'hosp-1', 'Internal Medicine & Diabetology', 'MMC-2016-48291', 'verified', 900, 'Mon-Sat · 09:30 - 17:30', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO hospital_staff (id, user_id, hospital_id, staff_role, department, permissions_json, status, created_at)
    VALUES ('staff-1', 'usr-hosp-1', 'hosp-1', 'Medical Records & Interop Admin', 'Health Information Management', '["manage_staff","upload_records","view_audit","manage_billing"]', 'active', ?)
  `).run(now);

  // 4. Patients & Health IDs
  db.prepare(`
    INSERT INTO patients (id, user_id, date_of_birth, gender, blood_group, has_smartphone, abha_linked, abha_number_masked, emergency_contact_name, emergency_contact_phone, jurisdiction, created_at)
    VALUES ('pat-1', 'usr-patient-1', '1982-06-14', 'Male', 'B+', 1, 1, '91-4820-XXXX-1932', 'Priya Sharma (Spouse)', '+919820112299', 'IN', ?)
  `).run(now);
  db.prepare(`
    INSERT INTO patients (id, user_id, date_of_birth, gender, blood_group, has_smartphone, abha_linked, abha_number_masked, emergency_contact_name, emergency_contact_phone, jurisdiction, created_at)
    VALUES ('pat-2', 'usr-patient-2', '1954-11-02', 'Female', 'O+', 0, 0, NULL, 'Aarav Sharma (Son)', '+919820112233', 'IN', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO patient_health_ids (id, patient_id, health_id, qr_token_secret, status, issued_at)
    VALUES ('hid-1', 'pat-1', 'MV-8K29-X7P4', ?, 'active', ?)
  `).run(crypto.randomBytes(16).toString('hex'), now);

  db.prepare(`
    INSERT INTO patient_health_ids (id, patient_id, health_id, qr_token_secret, status, issued_at)
    VALUES ('hid-2', 'pat-2', 'MV-3P91-K2M8', ?, 'active', ?)
  `).run(crypto.randomBytes(16).toString('hex'), now);

  // 5. Patient Clinical Profiles
  db.prepare(`
    INSERT INTO patient_profiles (id, patient_id, chronic_conditions_json, allergies_json, baseline_notes, updated_at)
    VALUES ('prof-1', 'pat-1', ?, ?, ?, ?)
  `).run(
    JSON.stringify(['Type 2 Diabetes Mellitus (diagnosed 2021)', 'Essential Hypertension (controlled)', 'Dyslipidemia']),
    JSON.stringify(['Penicillin (maculopapular rash, documented 2019)', 'Sulfa drugs (mild urticaria)']),
    'Non-smoker. Prior laparoscopic appendectomy in 2014.',
    now
  );

  db.prepare(`
    INSERT INTO patient_profiles (id, patient_id, chronic_conditions_json, allergies_json, baseline_notes, updated_at)
    VALUES ('prof-2', 'pat-2', ?, ?, ?, ?)
  `).run(
    JSON.stringify(['Osteoarthritis (bilateral knee)', 'Hypothyroidism']),
    JSON.stringify(['No known drug allergies documented']),
    'Uses basic keypad mobile phone; SMS Health ID and printed QR card active.',
    now
  );

  // 6. Medical Documents (Synthetic longitudinal dataset across Hospital A, Hospital B, Lab 1, Lab 2)
  const docs = [
    {
      id: 'doc-rec-1',
      patient_id: 'pat-1',
      uploaded_by: 'usr-lab-1',
      hosp_id: null,
      lab_id: 'lab-2',
      facility: 'Suburban Clinical Pathology Network (Demo)',
      title: 'Comprehensive Metabolic & Glycemic Panel — May 2025',
      category: 'lab_report',
      date: '2025-05-12',
      pages: 2,
      text: `FACILITY: Suburban Clinical Pathology Network (Demo) | DATE: 2025-05-12 | PAGE 1 of 2
PATIENT: Aarav Sharma (Health ID: MV-8K29-X7P4) | METHOD: HPLC & Enzymatic Hexokinase
TEST RESULTS:
- HbA1c (Glycated Hemoglobin): 7.9 % [Reference: 4.0 - 5.6 %] FLAG: HIGH (HPLC method)
- Fasting Plasma Glucose: 146 mg/dL [Reference: 70 - 99 mg/dL] FLAG: HIGH
- LDL Cholesterol (Direct): 138 mg/dL [Reference: < 100 mg/dL] FLAG: HIGH
- Serum Creatinine: 1.02 mg/dL [Reference: 0.70 - 1.30 mg/dL] FLAG: NORMAL
- Hemoglobin: 14.1 g/dL [Reference: 13.5 - 17.5 g/dL] FLAG: NORMAL
PAGE 2: Sample collected fasting 08:15 AM. Verified by Dr. S. Kulkarni, MD Pathology.`
    },
    {
      id: 'doc-rec-2',
      patient_id: 'pat-1',
      uploaded_by: 'usr-hosp-1',
      hosp_id: 'hosp-2',
      lab_id: null,
      facility: 'Sahyadri Heart & Metabolic Institute (Demo)',
      title: 'Cardiometabolic Consultation & Prescription',
      category: 'prescription',
      date: '2025-05-18',
      pages: 1,
      text: `FACILITY: Sahyadri Heart & Metabolic Institute (Demo) | DATE: 2025-05-18 | PAGE 1 of 1
CLINICIAN: Dr. Rajesh Deshpande, MD Cardiology
CHIEF COMPLAINT: Routine glycemic & blood pressure review; mild evening fatigue.
ALLERGIES NOTED: Penicillin (rash), Sulfa drugs.
DIAGNOSES: Type 2 Diabetes Mellitus (E11.9), Essential Hypertension (I10), Dyslipidemia (E78.5).
DOCUMENTED MEDICATIONS:
1. Metformin SR 500 mg — Oral — Once daily after dinner — Continue 90 days
2. Telmisartan 40 mg — Oral — Once daily in the morning — Continue 90 days
3. Atorvastatin 10 mg — Oral — Once daily at bedtime — Continue 90 days
CLINICIAN INSTRUCTIONS: 30 minutes brisk walk daily, limit refined carbohydrates, repeat HbA1c and Lipid Profile in 6 months.`
    },
    {
      id: 'doc-rec-3',
      patient_id: 'pat-1',
      uploaded_by: 'usr-lab-1',
      hosp_id: null,
      lab_id: 'lab-1',
      facility: 'MetroPath Diagnostics & Reference Lab (Demo)',
      title: '6-Month Follow-Up Glycemic, Lipid & Renal Panel — Nov 2025',
      category: 'lab_report',
      date: '2025-11-10',
      pages: 2,
      text: `FACILITY: MetroPath Diagnostics & Reference Lab (Demo) | DATE: 2025-11-10 | PAGE 1 of 2
PATIENT: Aarav Sharma (Health ID: MV-8K29-X7P4) | METHOD: HPLC (NGSP certified) & Enzymatic
TEST RESULTS:
- HbA1c (Glycated Hemoglobin): 7.1 % [Reference: 4.0 - 5.6 %] FLAG: BORDERLINE HIGH (Improved from 7.9%)
- Fasting Plasma Glucose: 124 mg/dL [Reference: 70 - 99 mg/dL] FLAG: HIGH
- LDL Cholesterol (Direct): 112 mg/dL [Reference: < 100 mg/dL] FLAG: BORDERLINE HIGH
- Serum Creatinine: 0.98 mg/dL [Reference: 0.70 - 1.30 mg/dL] FLAG: NORMAL
- Hemoglobin: 14.3 g/dL [Reference: 13.5 - 17.5 g/dL] FLAG: NORMAL
PAGE 2: Fasting venous sample. Verified by Dr. Ananya Iyer, MD Pathology.`
    },
    {
      id: 'doc-rec-4',
      patient_id: 'pat-1',
      uploaded_by: 'usr-hosp-1',
      hosp_id: 'hosp-1',
      lab_id: null,
      facility: 'City Care Multi-Specialty Hospital (Demo)',
      title: 'Day-Care Emergency Observation & Discharge Summary',
      category: 'discharge_summary',
      date: '2026-04-22',
      pages: 3,
      text: `FACILITY: City Care Multi-Specialty Hospital (Demo) | DATE: 2026-04-22 | PAGE 1 of 3
SUMMARY: Admitted to Day-Care Observation for acute viral gastroenteritis and mild dehydration.
VITALS AT DISCHARGE: BP 126/78 mmHg, HR 76 bpm, Afebrile, SpO2 99% RA.
INVESTIGATIONS: Serum Creatinine transient mild elevation 1.18 mg/dL (resolved post IV hydration). Electrolytes normal.
PAGE 2: DISCHARGE MEDICATIONS:
1. Metformin SR 500 mg — Oral — Once daily after dinner — Resume after 48 hours of normal oral intake
2. Telmisartan 40 mg — Oral — Once daily morning — Continue
3. Atorvastatin 10 mg — Oral — Once daily at bedtime — Continue
4. Oral Rehydration Salts (ORS) — Oral — 1 sachet in 1L water over 24 hours — For 3 days
PAGE 3: RED FLAG INSTRUCTIONS: Return immediately if persistent vomiting, dizziness, or inability to keep fluids down.`
    },
    {
      id: 'doc-rec-5',
      patient_id: 'pat-1',
      uploaded_by: 'usr-lab-1',
      hosp_id: null,
      lab_id: 'lab-1',
      facility: 'MetroPath Diagnostics & Reference Lab (Demo)',
      title: 'Annual Preventive Cardiometabolic & Renal Panel — Nov 2026',
      category: 'lab_report',
      date: '2026-11-11',
      pages: 2,
      text: `FACILITY: MetroPath Diagnostics & Reference Lab (Demo) | DATE: 2026-11-11 | PAGE 1 of 2
PATIENT: Aarav Sharma (Health ID: MV-8K29-X7P4) | METHOD: HPLC (NGSP certified) & Enzymatic
TEST RESULTS:
- HbA1c (Glycated Hemoglobin): 6.6 % [Reference: 4.0 - 5.6 %] FLAG: MILDLY ELEVATED (Target <7.0% achieved)
- Fasting Plasma Glucose: 108 mg/dL [Reference: 70 - 99 mg/dL] FLAG: BORDERLINE HIGH
- LDL Cholesterol (Direct): 94 mg/dL [Reference: < 100 mg/dL] FLAG: NORMAL
- Serum Creatinine: 0.96 mg/dL [Reference: 0.70 - 1.30 mg/dL] FLAG: NORMAL
- Hemoglobin: 14.4 g/dL [Reference: 13.5 - 17.5 g/dL] FLAG: NORMAL
- Vitamin D (25-OH): 19.4 ng/mL [Reference: 30.0 - 100.0 ng/mL] FLAG: LOW (Deficient)
PAGE 2: Verified by Dr. Ananya Iyer, MD Pathology. Note: Recent HbA1c performed 4 days ago.`
    },
    {
      id: 'doc-rec-6',
      patient_id: 'pat-2',
      uploaded_by: 'usr-hosp-1',
      hosp_id: 'hosp-1',
      lab_id: null,
      facility: 'City Care Multi-Specialty Hospital (Demo)',
      title: 'Thyroid & Knee Orthopedic Follow-Up Note',
      category: 'consultation_note',
      date: '2026-10-05',
      pages: 1,
      text: `FACILITY: City Care Multi-Specialty Hospital (Demo) | DATE: 2026-10-05 | PAGE 1 of 1
PATIENT: Kamla Devi (Health ID: MV-3P91-K2M8) | ASSISTED ACCESS: Keypad Phone / Caregiver Aarav Sharma
TESTS: TSH 3.4 mIU/L [0.4 - 4.2 mIU/L] NORMAL.
MEDICATIONS: Levothyroxine 50 mcg — Oral — Once daily empty stomach morning — Ongoing.`
    }
  ];

  const insertDoc = db.prepare(`
    INSERT INTO medical_documents (id, patient_id, uploaded_by_user_id, source_hospital_id, source_lab_id, facility_name, title, category, document_date, mime_type, file_size_bytes, sha256_hash, storage_path, raw_extracted_text, page_count, verification_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'text/plain', ?, ?, ?, ?, ?, 'verified', ?)
  `);
  const insertRec = db.prepare(`
    INSERT INTO medical_records (id, document_id, patient_id, record_type, summary_headline, recorded_at, clinician_name, facility_name, provenance_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified')
  `);

  for (const d of docs) {
    const relPath = path.join(UPLOADS_DIR, `${d.id}.txt`);
    fs.writeFileSync(relPath, d.text, 'utf8');
    insertDoc.run(
      d.id,
      d.patient_id,
      d.uploaded_by,
      d.hosp_id,
      d.lab_id,
      d.facility,
      d.title,
      d.category,
      d.date,
      Buffer.byteLength(d.text, 'utf8'),
      sha256(d.text),
      relPath,
      d.text,
      d.pages,
      now
    );
    insertRec.run(`rec-${d.id}`, d.id, d.patient_id, d.category, d.title, d.date, d.lab_id ? 'Pathology Sign-off' : 'Attending Clinician', d.facility);
  }

  // 7. Structured Clinical Observations (for Old vs New Report Comparison + Recharts + Repetition Guardrail)
  const obsList = [
    ['obs-1', 'doc-rec-1', 'pat-1', 'HbA1c (Glycated Hemoglobin)', 'HBA1C', 7.9, '7.9', '%', 4.0, 5.6, 'HPLC', 'Suburban Clinical Pathology Network (Demo)', '2025-05-12', 1, 'high'],
    ['obs-2', 'doc-rec-3', 'pat-1', 'HbA1c (Glycated Hemoglobin)', 'HBA1C', 7.1, '7.1', '%', 4.0, 5.6, 'HPLC', 'MetroPath Diagnostics & Reference Lab (Demo)', '2025-11-10', 1, 'high'],
    ['obs-3', 'doc-rec-5', 'pat-1', 'HbA1c (Glycated Hemoglobin)', 'HBA1C', 6.6, '6.6', '%', 4.0, 5.6, 'HPLC', 'MetroPath Diagnostics & Reference Lab (Demo)', '2026-11-11', 1, 'high'],

    ['obs-4', 'doc-rec-1', 'pat-1', 'Fasting Plasma Glucose', 'FPG', 146, '146', 'mg/dL', 70, 99, 'Hexokinase', 'Suburban Clinical Pathology Network (Demo)', '2025-05-12', 1, 'high'],
    ['obs-5', 'doc-rec-3', 'pat-1', 'Fasting Plasma Glucose', 'FPG', 124, '124', 'mg/dL', 70, 99, 'Hexokinase', 'MetroPath Diagnostics & Reference Lab (Demo)', '2025-11-10', 1, 'high'],
    ['obs-6', 'doc-rec-5', 'pat-1', 'Fasting Plasma Glucose', 'FPG', 108, '108', 'mg/dL', 70, 99, 'Hexokinase', 'MetroPath Diagnostics & Reference Lab (Demo)', '2026-11-11', 1, 'high'],

    ['obs-7', 'doc-rec-1', 'pat-1', 'LDL Cholesterol (Direct)', 'LDL_C', 138, '138', 'mg/dL', 0, 100, 'Direct Enzymatic', 'Suburban Clinical Pathology Network (Demo)', '2025-05-12', 1, 'high'],
    ['obs-8', 'doc-rec-3', 'pat-1', 'LDL Cholesterol (Direct)', 'LDL_C', 112, '112', 'mg/dL', 0, 100, 'Direct Enzymatic', 'MetroPath Diagnostics & Reference Lab (Demo)', '2025-11-10', 1, 'high'],
    ['obs-9', 'doc-rec-5', 'pat-1', 'LDL Cholesterol (Direct)', 'LDL_C', 94, '94', 'mg/dL', 0, 100, 'Direct Enzymatic', 'MetroPath Diagnostics & Reference Lab (Demo)', '2026-11-11', 0, 'normal'],

    ['obs-10', 'doc-rec-1', 'pat-1', 'Serum Creatinine', 'CREATININE', 1.02, '1.02', 'mg/dL', 0.7, 1.3, 'Jaffe Kinetic', 'Suburban Clinical Pathology Network (Demo)', '2025-05-12', 0, 'normal'],
    ['obs-11', 'doc-rec-3', 'pat-1', 'Serum Creatinine', 'CREATININE', 0.98, '0.98', 'mg/dL', 0.7, 1.3, 'Enzymatic', 'MetroPath Diagnostics & Reference Lab (Demo)', '2025-11-10', 0, 'normal'],
    ['obs-12', 'doc-rec-5', 'pat-1', 'Serum Creatinine', 'CREATININE', 0.96, '0.96', 'mg/dL', 0.7, 1.3, 'Enzymatic', 'MetroPath Diagnostics & Reference Lab (Demo)', '2026-11-11', 0, 'normal'],

    ['obs-13', 'doc-rec-5', 'pat-1', 'Vitamin D (25-OH)', 'VIT_D', 19.4, '19.4', 'ng/mL', 30, 100, 'CLIA', 'MetroPath Diagnostics & Reference Lab (Demo)', '2026-11-11', 1, 'low'],
    ['obs-14', 'doc-rec-6', 'pat-2', 'Thyroid Stimulating Hormone (TSH)', 'TSH', 3.4, '3.4', 'mIU/L', 0.4, 4.2, 'CLIA', 'City Care Multi-Specialty Hospital (Demo)', '2026-10-05', 0, 'normal']
  ];

  const insertObs = db.prepare(`
    INSERT INTO clinical_observations (id, document_id, patient_id, test_name, canonical_code, value_numeric, value_text, unit, ref_low, ref_high, methodology, lab_name, observed_at, is_abnormal, flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const o of obsList) {
    insertObs.run(...(o as [string, string, string, string, string, number, string, string, number, number, string, string, string, number, string]));
  }

  // 8. Diagnoses & Medications
  const insertDiag = db.prepare(`INSERT INTO diagnoses (id, patient_id, document_id, icd_code, condition_name, diagnosed_at, status, clinician_name) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`);
  insertDiag.run('diag-1', 'pat-1', 'doc-rec-2', 'E11.9', 'Type 2 Diabetes Mellitus without complications', '2021-03-15', 'Dr. Rajesh Deshpande, MD');
  insertDiag.run('diag-2', 'pat-1', 'doc-rec-2', 'I10', 'Essential (primary) hypertension', '2022-08-10', 'Dr. Rajesh Deshpande, MD');
  insertDiag.run('diag-3', 'pat-1', 'doc-rec-2', 'E78.5', 'Dyslipidemia', '2024-01-20', 'Dr. Rajesh Deshpande, MD');

  const insertMed = db.prepare(`INSERT INTO medications (id, patient_id, document_id, drug_name, dose, route, frequency, duration, prescribed_by, started_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`);
  insertMed.run('med-1', 'pat-1', 'doc-rec-2', 'Metformin SR', '500 mg', 'Oral', 'Once daily after dinner', 'Ongoing (90-day review)', 'Dr. Rajesh Deshpande, MD', '2025-05-18');
  insertMed.run('med-2', 'pat-1', 'doc-rec-2', 'Telmisartan', '40 mg', 'Oral', 'Once daily in the morning', 'Ongoing (90-day review)', 'Dr. Rajesh Deshpande, MD', '2025-05-18');
  insertMed.run('med-3', 'pat-1', 'doc-rec-2', 'Atorvastatin', '10 mg', 'Oral', 'Once daily at bedtime', 'Ongoing (90-day review)', 'Dr. Rajesh Deshpande, MD', '2025-05-18');
  insertMed.run('med-4', 'pat-2', 'doc-rec-6', 'Levothyroxine', '50 mcg', 'Oral', 'Once daily empty stomach', 'Ongoing', 'Dr. Meera Nair, MD', '2026-10-05');

  // 9. Active Consent for Dr. Meera Nair (pat-1) + Caregiver Permission (pat-2 -> usr-patient-1)
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO consent_records (id, patient_id, grantee_user_id, grantee_hospital_id, grantee_name, grantee_role, purpose, scope_categories_json, status, verification_method, granted_at, expires_at)
    VALUES ('cons-1', 'pat-1', 'usr-doctor-1', 'hosp-1', 'Dr. Meera Nair, MD (City Care Multi-Specialty)', 'doctor', 'Annual cardiometabolic review & consultation', '["lab_report","prescription","discharge_summary","consultation_note"]', 'active', 'qr_otp', ?, ?)
  `).run(now, thirtyDaysLater);

  db.prepare(`
    INSERT INTO caregiver_permissions (id, patient_id, caregiver_user_id, caregiver_name, relationship, can_view_records, can_upload_records, can_manage_consent, status, created_at)
    VALUES ('care-1', 'pat-2', 'usr-patient-1', 'Aarav Sharma', 'Son / Authorized Guardian', 1, 1, 1, 'active', ?)
  `).run(now);

  // 10. Access Logs
  db.prepare(`
    INSERT INTO access_logs (id, patient_id, actor_user_id, actor_name, actor_role, facility_name, action, purpose, records_accessed_json, is_emergency_break_glass, emergency_reason, created_at)
    VALUES ('log-1', 'pat-1', 'usr-doctor-1', 'Dr. Meera Nair, MD', 'doctor', 'City Care Multi-Specialty Hospital (Demo)', 'VIEW_RECORDS', 'Annual cardiometabolic review', '["doc-rec-3","doc-rec-5"]', 0, NULL, ?)
  `).run(now);
  db.prepare(`
    INSERT INTO access_logs (id, patient_id, actor_user_id, actor_name, actor_role, facility_name, action, purpose, records_accessed_json, is_emergency_break_glass, emergency_reason, created_at)
    VALUES ('log-2', 'pat-1', 'usr-lab-1', 'MetroPath Diagnostics Desk', 'lab_admin', 'MetroPath Diagnostics & Reference Lab (Demo)', 'UPLOAD_REPORT', 'Structured lab report delivery', '["doc-rec-5"]', 0, NULL, ?)
  `).run(now);

  // 11. Appointments
  const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  db.prepare(`
    INSERT INTO appointments (id, patient_id, doctor_id, hospital_id, service_type, scheduled_at, status, reason, created_at)
    VALUES ('appt-1', 'pat-1', 'doc-1', 'hosp-1', 'consultation', ?, 'confirmed', 'Review November 2026 HbA1c & Vitamin D levels', ?)
  `).run(nextWeek, now);

  // 12. Subscriptions, Transactions & Invoices
  db.prepare(`
    INSERT INTO subscriptions (id, subscriber_user_id, subscriber_type, plan_code, status, provider, amount_cents, currency, current_period_end, created_at)
    VALUES ('sub-1', 'usr-hosp-1', 'hospital', 'professional', 'active', 'razorpay', 1499900, 'INR', ?, ?)
  `).run(thirtyDaysLater, now);

  db.prepare(`
    INSERT INTO payment_transactions (id, subscription_id, user_id, provider, order_id, payment_id, signature_verified, amount_cents, currency, status, created_at)
    VALUES ('txn-1', 'sub-1', 'usr-hosp-1', 'razorpay', 'order_demo_99182', 'pay_demo_77213', 1, 1499900, 'INR', 'succeeded', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO invoices (id, transaction_id, user_id, invoice_number, amount_cents, currency, line_items_json, issued_at)
    VALUES ('inv-1', 'txn-1', 'usr-hosp-1', 'MLV-INV-2026-0041', 1499900, 'INR', '[{"description":"Hospital Professional Plan (Monthly Interop & AI Quota)","amount_cents":1499900}]', ?)
  `).run(now);

  // 13. Support Tickets & Notifications & Integrations
  db.prepare(`
    INSERT INTO support_tickets (id, user_id, category, subject, description, status, admin_notes, created_at)
    VALUES ('tkt-1', 'usr-patient-1', 'data_privacy', 'Verify ABHA masked linkage visibility', 'Wanted to confirm that my ABHA number stays masked on printed QR cards.', 'resolved', 'Confirmed: only masked last-4 digits are displayed on cards.', ?)
  `).run(now);

  db.prepare(`
    INSERT INTO notifications (id, user_id, channel, title, message, is_read, created_at)
    VALUES ('notif-1', 'usr-patient-1', 'in_app', 'New Verified Lab Report Available', 'MetroPath Diagnostics uploaded your Annual Preventive Cardiometabolic & Renal Panel (Nov 2026).', 0, ?)
  `).run(now);

  db.prepare(`
    INSERT INTO integration_configurations (id, facility_type, facility_id, provider_name, webhook_url, fhir_endpoint, status, last_synced_at)
    VALUES ('int-1', 'hospital', 'hosp-1', 'HL7 FHIR R4 Bridge (Sandbox)', 'https://hms-sandbox.citycare.example/webhooks/medilink', 'https://fhir-sandbox.citycare.example/r4', 'active', ?)
  `).run(now);
}
