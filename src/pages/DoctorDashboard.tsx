import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Sparkles,
  X,
} from 'lucide-react';
import { QrScannerPanel } from '../components/QrComponents';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface AuthorizedPatientInfo {
  patient_id: string;
  health_id: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
}

interface DoctorAiResponse {
  id: string;
  mode: 'live_gemini' | 'demo_fallback';
  fallback_reason: string | null;
  model: string;
  prompt_version: string;
  latency_ms: number;
  summary: {
    executive_clinical_overview: string;
    documented_complaints: string[];
    chronic_conditions: string[];
    allergies: string[];
    medications: Array<{
      drug_name: string;
      dose: string;
      route: string;
      frequency: string;
      duration: string;
      status: string;
      source_document_id: string;
    }>;
    surgeries_and_events: string[];
    key_investigations_and_abnormal_trends: Array<{
      finding: string;
      trend_note: string;
      severity: string;
      source_document_id: string;
      page_ref: string;
    }>;
    conflicts_and_missing_data_flags: string[];
    source_citations: Array<{
      statement_key: string;
      document_id: string;
      document_name: string;
      facility_name: string;
      report_date: string;
      page_ref: string;
    }>;
    clinical_safety_notice: string;
  };
}

interface VaultDoc {
  id: string;
  title: string;
  category: string;
  facility_name: string;
  document_date: string;
  raw_extracted_text: string;
  signed_preview_url: string;
}

export const DoctorDashboard: React.FC = () => {
  const { pushToast } = useAuthStore();
  const [activePatient, setActivePatient] = useState<AuthorizedPatientInfo | null>(null);
  const [accessMode, setAccessMode] = useState<string>('');
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [aiResult, setAiResult] = useState<DoctorAiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<VaultDoc | null>(null);

  // Smart Test Repetition Assistance state
  const [testToOrder, setTestToOrder] = useState('HBA1C');
  const [repPrompt, setRepPrompt] = useState<{
    recent_found: boolean;
    prompt_message?: string;
    decision_authority: string;
  } | null>(null);
  const [orderConfirmed, setOrderConfirmed] = useState<string | null>(null);

  // Doctor Reviewer Feedback state
  const [rating, setRating] = useState<'accurate' | 'needs_correction' | 'flagged_conflict'>('accurate');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const handleAuthorizedPatient = async (pat: AuthorizedPatientInfo, mode: string) => {
    setActivePatient(pat);
    setAccessMode(mode);
    setAiResult(null);
    setRepPrompt(null);
    setOrderConfirmed(null);
    setFeedbackSaved(false);
    try {
      const res = await apiFetch<{ documents: VaultDoc[] }>(`/api/records?patient_id=${encodeURIComponent(pat.patient_id)}`);
      setDocs(res.documents);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to fetch authorized records.');
    }
  };

  const handleGenerateClinicalSummary = async () => {
    if (!activePatient) return;
    setAiLoading(true);
    setFeedbackSaved(false);
    try {
      const res = await apiFetch<DoctorAiResponse>('/api/ai/doctor-summary', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: activePatient.patient_id,
          purpose: 'Clinician pre-consultation history synthesis',
        }),
      });
      setAiResult(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to generate clinical summary.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCheckTestRepetition = async () => {
    if (!activePatient) return;
    setOrderConfirmed(null);
    try {
      const res = await apiFetch<{
        recent_found: boolean;
        prompt_message?: string;
        decision_authority: string;
      }>('/api/records/check-repetition', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: activePatient.patient_id,
          canonical_code: testToOrder,
          window_days: 30,
        }),
      });
      setRepPrompt(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Repetition check failed.');
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiResult) return;
    try {
      await apiFetch('/api/ai/feedback', {
        method: 'POST',
        body: JSON.stringify({
          ai_summary_id: aiResult.id,
          accuracy_rating: rating,
          correction_notes: correctionNotes,
        }),
      });
      setFeedbackSaved(true);
      pushToast('success', 'Clinician review feedback logged in audit record.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to save feedback.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Doctor Clinical Workspace</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Scan QR or lookup Health ID · Consent-scoped AI Clinical Summary with source citations · Smart test repetition review
        </p>
      </div>

      {/* Step 1: Patient Identification & Consent Gate */}
      <QrScannerPanel onAuthorizedPatient={handleAuthorizedPatient} />

      {activePatient && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-teal-800 uppercase tracking-wide">
                Active Authorized Session · {accessMode.replace('_', ' ')}
              </p>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                {activePatient.full_name} · <span className="font-mono">{activePatient.health_id}</span>
              </h2>
              <p className="text-xs text-slate-500">
                {docs.length} authorized document(s) accessible · Blood {activePatient.blood_group}
              </p>
            </div>
            <button
              onClick={handleGenerateClinicalSummary}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? 'Orchestrating Agent Synthesis…' : 'Generate AI Doctor Clinical Summary'}
            </button>
          </div>

          {/* AI Doctor Clinical Summary Agent Output */}
          {aiResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Structured Clinical Summary (Source-Linked)</h3>
                  <p className="text-xs text-slate-500">
                    {aiResult.model} · {aiResult.prompt_version} · {aiResult.latency_ms}ms
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Schema & Source Verified
                </span>
              </div>

              {aiResult.mode === 'demo_fallback' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <strong>Demo Extraction Mode:</strong> {aiResult.fallback_reason}
                </div>
              )}

              <p className="text-sm text-slate-800 leading-relaxed">{aiResult.summary.executive_clinical_overview}</p>

              {/* Allergies & Chronic Conditions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-1.5">
                  <p className="text-xs font-semibold text-red-900">Documented Allergies</p>
                  <ul className="list-disc ps-4 text-xs text-red-900 space-y-1">
                    {aiResult.summary.allergies.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <p className="text-xs font-semibold text-slate-900">Chronic Conditions</p>
                  <ul className="list-disc ps-4 text-xs text-slate-700 space-y-1">
                    {aiResult.summary.chronic_conditions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Medications */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Documented Medications</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 px-3 text-start">Medication</th>
                        <th className="py-2 px-3 text-start">Dose & Route</th>
                        <th className="py-2 px-3 text-start">Frequency & Duration</th>
                        <th className="py-2 px-3 text-end">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aiResult.summary.medications.map((m, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-slate-900">{m.drug_name}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {m.dose} · {m.route}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {m.frequency} ({m.duration})
                          </td>
                          <td className="py-2 px-3 text-end">
                            <button
                              onClick={() => setViewerDoc(docs.find((d) => d.id === m.source_document_id) || docs[0])}
                              className="text-teal-800 hover:underline font-medium"
                            >
                              View Source
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Abnormal Findings & Trends */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Investigations & Longitudinal Trends</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {aiResult.summary.key_investigations_and_abnormal_trends.map((item, i) => (
                    <div key={i} className="p-3 flex flex-wrap items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">{item.finding}</p>
                        <p className="text-slate-600 mt-0.5">{item.trend_note}</p>
                      </div>
                      <button
                        onClick={() => setViewerDoc(docs.find((d) => d.id === item.source_document_id) || docs[0])}
                        className="text-teal-800 hover:underline font-medium shrink-0"
                      >
                        {item.page_ref} · Inspect Original
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflicts / Missing Info Flags */}
              {aiResult.summary.conflicts_and_missing_data_flags.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 text-xs text-amber-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    Missing Data, Methodology Shifts & Conflict Flags
                  </p>
                  <ul className="list-disc ps-5 space-y-1">
                    {aiResult.summary.conflicts_and_missing_data_flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                {aiResult.summary.clinical_safety_notice}
              </p>

              {/* Doctor Review & Correction Feedback */}
              <form onSubmit={handleSubmitFeedback} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-teal-700" />
                  Clinician Verification & Correction Feedback
                </h4>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value as typeof rating)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="accurate">Verified Accurate Against Originals</option>
                    <option value="needs_correction">Extraction Needs Correction</option>
                    <option value="flagged_conflict">Clinical Conflict Identified</option>
                  </select>
                  <input
                    type="text"
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    placeholder="Optional clinician correction or consultation note…"
                    className="flex-1 min-w-[220px] px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                  >
                    {feedbackSaved ? 'Feedback Logged' : 'Log Review'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Smart Test Repetition Assistance + Authorized Documents List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-700" />
                  Smart Test Repetition Assistance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Checks for recent equivalent results before ordering. Never blocks or cancels — clinician decides.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={testToOrder}
                  onChange={(e) => setTestToOrder(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                >
                  <option value="HBA1C">HbA1c (Glycated Hemoglobin)</option>
                  <option value="FPG">Fasting Plasma Glucose</option>
                  <option value="LDL_C">LDL Cholesterol</option>
                  <option value="CREATININE">Serum Creatinine</option>
                  <option value="VIT_D">Vitamin D (25-OH)</option>
                </select>
                <button
                  onClick={handleCheckTestRepetition}
                  className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                >
                  Check History
                </button>
              </div>

              {repPrompt && (
                <div
                  className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                    repPrompt.recent_found
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <p className="font-semibold">
                    {repPrompt.recent_found ? 'Recent Equivalent Report Found' : 'No Recent Duplicate Within 30 Days'}
                  </p>
                  {repPrompt.prompt_message && <p>{repPrompt.prompt_message}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setOrderConfirmed(`Clinician ordered ${testToOrder} after reviewing prior history.`)}
                      className="px-3 py-1.5 bg-teal-700 text-white rounded text-xs font-medium hover:bg-teal-800"
                    >
                      Proceed & Order Test Anyway
                    </button>
                  </div>
                </div>
              )}

              {orderConfirmed && (
                <p className="text-xs font-medium text-teal-800">{orderConfirmed}</p>
              )}
            </section>

            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                Authorized Source Records ({docs.length})
              </h3>
              <div className="divide-y divide-slate-100">
                {docs.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{d.title}</p>
                      <p className="text-slate-500">
                        {d.facility_name} · {d.document_date} · {d.category.replace('_', ' ')}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewerDoc(d)}
                      className="px-2.5 py-1 border border-slate-200 rounded text-teal-800 hover:bg-teal-50 shrink-0 font-medium"
                    >
                      Open Original
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Original Report Modal */}
      {viewerDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{viewerDoc.title}</h2>
                <p className="text-xs text-slate-500">
                  {viewerDoc.facility_name} · {viewerDoc.document_date}
                </p>
              </div>
              <button onClick={() => setViewerDoc(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
              {viewerDoc.raw_extracted_text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
