import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, BookOpen, HelpCircle, Pill, Sparkles, FileText } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { SUPPORTED_LANGUAGES } from '../i18n';

interface CompanionResponse {
  id: string;
  mode: 'live_gemini' | 'demo_fallback';
  fallback_reason: string | null;
  model: string;
  prompt_version: string;
  latency_ms: number;
  explanation: {
    language: string;
    friendly_overview: string;
    what_the_report_says: Array<{ topic: string; plain_explanation: string; source_document_id: string }>;
    values_needing_clinician_attention: Array<{
      test_name: string;
      recorded_value: string;
      why_to_discuss: string;
      urgency: string;
      source_document_id: string;
    }>;
    clinician_documented_instructions: Array<{
      instruction_type: string;
      exact_clinician_text: string;
      plain_context: string;
      source_document_id: string;
    }>;
    questions_to_ask_your_doctor: string[];
    glossary: Array<{ term: string; meaning: string }>;
    uncertainty_and_safety_notice: string;
  };
  authorized_documents: Array<{
    id: string;
    title: string;
    facility_name: string;
    document_date: string;
    raw_extracted_text: string;
  }>;
}

export const AiCompanionPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { activePatientId, pushToast } = useAuthStore();
  const [targetLang, setTargetLang] = useState(i18n.language || 'en');
  const [result, setResult] = useState<CompanionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!activePatientId) return;
    setLoading(true);
    try {
      const res = await apiFetch<CompanionResponse>('/api/ai/patient-companion', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: activePatientId,
          language: targetLang,
        }),
      });
      setResult(res);
      if (res.authorized_documents[0]) setSelectedDocId(res.authorized_documents[0].id);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to generate explanation.');
    } finally {
      setLoading(false);
    }
  };

  const activeDoc = result?.authorized_documents.find((d) => d.id === selectedDocId) || result?.authorized_documents[0];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Patient Companion</h1>
          <p className="text-xs text-slate-500 mt-1">
            Plain-language explanation of your verified reports alongside the original records. Preserves exact medication instructions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                Explain in {l.nativeLabel} ({l.label})
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Generating Safe Explanation…' : 'Explain My Reports'}
          </button>
        </div>
      </div>

      {!result && !loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-teal-700 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">Ready to Translate & Explain Your Vault Reports</p>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Select your preferred language above and click "Explain My Reports". The Patient Companion agent retrieves only your authorized records and renders a calm, jargon-free guide next to your original documents.
          </p>
        </div>
      )}

      {loading && <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />}

      {result && (
        <div className="space-y-4">
          {result.mode === 'demo_fallback' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Source-Grounded Fallback Mode: </span>
                {result.fallback_reason}
              </div>
            </div>
          )}

          {/* Side-by-side Explanation + Original Report */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="text-xs text-slate-500">
                  Overview · {result.model} · {result.prompt_version} · {result.latency_ms}ms
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">{result.explanation.friendly_overview}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">What Your Reports Say</h2>
                <div className="divide-y divide-slate-100">
                  {result.explanation.what_the_report_says.map((item, idx) => (
                    <div key={idx} className="py-2.5 space-y-1">
                      <button
                        onClick={() => setSelectedDocId(item.source_document_id)}
                        className="text-xs font-semibold text-teal-800 hover:underline text-start"
                      >
                        {item.topic}
                      </button>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.plain_explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Values to Discuss With Your Clinician</h2>
                <div className="divide-y divide-slate-100">
                  {result.explanation.values_needing_clinician_attention.map((val, idx) => (
                    <div key={idx} className="py-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{val.test_name}</span>
                        <span className="text-xs font-mono text-amber-800 font-medium">{val.recorded_value}</span>
                      </div>
                      <p className="text-xs text-slate-600">{val.why_to_discuss}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-teal-700" />
                  Documented Clinician Instructions (Preserved Verbatim)
                </h2>
                <div className="divide-y divide-slate-100">
                  {result.explanation.clinician_documented_instructions.map((inst, idx) => (
                    <div key={idx} className="py-2.5 space-y-1">
                      <p className="text-xs font-mono font-semibold text-slate-900">{inst.exact_clinician_text}</p>
                      <p className="text-xs text-slate-500">{inst.plain_context}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-teal-700" />
                  Helpful Questions for Your Next Doctor Visit
                </h2>
                <ul className="list-disc ps-5 space-y-1.5 text-xs text-slate-700">
                  {result.explanation.questions_to_ask_your_doctor.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700">
                {result.explanation.uncertainty_and_safety_notice}
              </div>
            </div>

            {/* Right: Side-by-Side Original Source Report Viewer */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 sticky top-20">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-700" />
                  Original Source Document
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.authorized_documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border ${
                      activeDoc?.id === doc.id
                        ? 'bg-teal-50 border-teal-300 text-teal-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {doc.document_date} · {doc.title.slice(0, 22)}…
                  </button>
                ))}
              </div>
              {activeDoc && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-700">
                    {activeDoc.title} — {activeDoc.facility_name}
                  </p>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-[11px] font-mono text-slate-800 whitespace-pre-wrap max-h-[420px] overflow-y-auto leading-relaxed">
                    {activeDoc.raw_extracted_text}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
