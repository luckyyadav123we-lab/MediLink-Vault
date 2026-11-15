import React, { useEffect, useState } from 'react';
import { CheckCircle2, FlaskConical, Send } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface LabOverview {
  lab: {
    id: string;
    name: string;
    city: string;
    accreditation: string;
    api_key_prefix: string;
    verification_status: string;
  };
  submissions: Array<{
    id: string;
    title: string;
    document_date: string;
    facility_name: string;
    verification_status: string;
    health_id: string;
    patient_name: string;
  }>;
  total_structured_observations: number;
}

export const LabDashboard: React.FC = () => {
  const { pushToast } = useAuthStore();
  const [data, setData] = useState<LabOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const [healthId, setHealthId] = useState('MV-8K29-X7P4');
  const [reportTitle, setReportTitle] = useState('Follow-Up HbA1c & Lipid Check');
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
  const [testName, setTestName] = useState('HbA1c (Glycated Hemoglobin)');
  const [canonicalCode, setCanonicalCode] = useState('HBA1C');
  const [valueNumeric, setValueNumeric] = useState('6.4');
  const [unit, setUnit] = useState('%');
  const [refLow, setRefLow] = useState('4.0');
  const [refHigh, setRefHigh] = useState('5.6');
  const [methodology, setMethodology] = useState('HPLC (NGSP certified)');
  const [submitting, setSubmitting] = useState(false);

  const loadLab = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<LabOverview>('/api/admin/lab/overview');
      setData(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load diagnostic lab dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLab();
  }, []);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/lab/submit-report', {
        method: 'POST',
        body: JSON.stringify({
          health_id: healthId.trim().toUpperCase(),
          title: reportTitle,
          observed_at: observedAt,
          lab_name: data?.lab.name || 'MetroPath Diagnostics & Reference Lab (Demo)',
          observations: [
            {
              test_name: testName,
              canonical_code: canonicalCode,
              value_numeric: Number(valueNumeric),
              unit,
              ref_low: Number(refLow),
              ref_high: Number(refHigh),
              methodology,
            },
          ],
        }),
      });
      pushToast('success', `Structured lab report delivered to Health ID ${healthId}.`);
      await loadLab();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) {
    return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4" />
            Diagnostic Laboratory LIS & Structured Reporting Portal
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{data.lab.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.lab.city} · {data.lab.accreditation} · API Key Prefix <span className="font-mono">{data.lab.api_key_prefix}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4" />
          NABL Verified Lab
        </span>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Delivered Lab Reports</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{data.submissions.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Normalized Observations Indexed</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{data.total_structured_observations}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Delivery Success Rate</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-800 mt-1">100%</p>
        </div>
      </div>

      {/* Structured Observation Submission */}
      <form onSubmit={handleSubmitReport} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Submit Structured Lab Report to Patient Vault</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Patient Health ID</label>
            <input
              type="text"
              value={healthId}
              onChange={(e) => setHealthId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Report Title</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Observation Date</label>
            <input
              type="date"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Analyte</label>
            <select
              value={canonicalCode}
              onChange={(e) => {
                const code = e.target.value;
                setCanonicalCode(code);
                if (code === 'HBA1C') {
                  setTestName('HbA1c (Glycated Hemoglobin)');
                  setUnit('%');
                  setRefLow('4.0');
                  setRefHigh('5.6');
                } else if (code === 'FPG') {
                  setTestName('Fasting Plasma Glucose');
                  setUnit('mg/dL');
                  setRefLow('70');
                  setRefHigh('99');
                } else if (code === 'LDL_C') {
                  setTestName('LDL Cholesterol (Direct)');
                  setUnit('mg/dL');
                  setRefLow('0');
                  setRefHigh('100');
                }
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="HBA1C">HbA1c (%)</option>
              <option value="FPG">Fasting Glucose (mg/dL)</option>
              <option value="LDL_C">LDL Cholesterol (mg/dL)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Result Value</label>
            <input
              type="number"
              step="0.01"
              value={valueNumeric}
              onChange={(e) => setValueNumeric(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Unit</label>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Ref Range</label>
            <input
              type="text"
              value={`${refLow}-${refHigh}`}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Methodology</label>
            <input type="text" value={methodology} onChange={(e) => setMethodology(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? 'Delivering…' : 'Deliver Verified Report'}
        </button>
      </form>

      {/* Recent Submissions Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Delivered Laboratory Reports</h2>
        </div>
        <table className="w-full text-start border-collapse text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2.5 px-4 text-start">Report Title</th>
              <th className="py-2.5 px-4 text-start">Patient & Health ID</th>
              <th className="py-2.5 px-4 text-start">Observed Date</th>
              <th className="py-2.5 px-4 text-end">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.submissions.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">{s.title}</td>
                <td className="py-3 px-4 text-slate-600">
                  {s.patient_name} · <span className="font-mono">{s.health_id}</span>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-600">{s.document_date}</td>
                <td className="py-3 px-4 text-end text-emerald-800 font-semibold capitalize">{s.verification_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
