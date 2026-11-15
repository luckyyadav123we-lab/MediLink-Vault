import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  GitCompare,
  Link2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { formatRegionalDate } from '../i18n';
import { DynamicQrModal } from '../components/QrComponents';

interface PatientOverviewData {
  patient: {
    id: string;
    full_name: string;
    health_id: string;
    date_of_birth: string;
    gender: string;
    blood_group: string;
    abha_linked: number;
    abha_number_masked: string | null;
    has_smartphone: number;
  };
  profile: {
    chronic_conditions: string[];
    allergies: string[];
    baseline_notes: string;
  };
  stats: {
    total_records: number;
    active_consents: number;
    upcoming_appointments: number;
  };
  recent_documents: Array<{
    id: string;
    title: string;
    category: string;
    facility_name: string;
    document_date: string;
    verification_status: string;
    page_count: number;
  }>;
  medications: Array<{
    id: string;
    drug_name: string;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    prescribed_by: string;
    status: string;
  }>;
  upcoming_appointments: Array<{
    id: string;
    service_type: string;
    scheduled_at: string;
    status: string;
    hospital_name: string;
    doctor_name: string;
    reason: string;
  }>;
}

interface ComparisonSnapshot {
  selected_code: string;
  series: Array<{ test_name: string; value_numeric: number; unit: string; observed_at: string; flag: string }>;
  delta_summary: {
    from_date: string;
    to_date: string;
    from_value: number;
    to_value: number;
    unit: string;
    absolute_change: number;
    percent_change: number;
  } | null;
}

export const PatientDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activePatientId, pushToast } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PatientOverviewData | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [compareSnap, setCompareSnap] = useState<ComparisonSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(searchParams.get('qr') === '1');
  const [abhaInput, setAbhaInput] = useState('');
  const [linkingAbha, setLinkingAbha] = useState(false);
  const navigate = useNavigate();

  const loadOverview = async () => {
    if (!activePatientId) return;
    setLoading(true);
    try {
      const [ov, qr, cmp] = await Promise.all([
        apiFetch<PatientOverviewData>(`/api/patients/${activePatientId}/overview`),
        apiFetch<{ qr_data_url: string }>(`/api/patients/${activePatientId}/qr`).catch(() => null),
        apiFetch<ComparisonSnapshot>(`/api/records/compare?patient_id=${encodeURIComponent(activePatientId)}&canonical_code=HBA1C`).catch(() => null),
      ]);
      setData(ov);
      if (qr) setQrImage(qr.qr_data_url);
      if (cmp) setCompareSnap(cmp);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load patient dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [activePatientId]);

  const handleCopyHealthId = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.patient.health_id);
      pushToast('success', `Copied Health ID ${data.patient.health_id}`);
    } catch {
      pushToast('info', `Health ID: ${data.patient.health_id}`);
    }
  };

  const handleLinkAbha = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkingAbha(true);
    try {
      const res = await apiFetch<{ abha_number_masked: string }>('/api/auth/abha-link', {
        method: 'POST',
        body: JSON.stringify({ abha_number: abhaInput }),
      });
      pushToast('success', `ABHA linked (${res.abha_number_masked})`);
      setAbhaInput('');
      await loadOverview();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Invalid ABHA number.');
    } finally {
      setLinkingAbha(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-36 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        Unable to load patient profile. Please refresh or sign in again.
      </div>
    );
  }

  const latestObs = compareSnap?.series[compareSnap.series.length - 1];

  return (
    <div className="space-y-6">
      {/* Soft Medical Teal Hero Banner matching UI/UX Concept */}
      <section className="bg-gradient-to-br from-[#E6F9F6] via-[#EFF8FA] to-white border border-[#BDE5E8] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#087F8C]">
            {data.patient.full_name} · {t('common.demoBadge')}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#123047] tracking-tight text-balance">
            Your Health Records, Always With You
          </h1>
          <p className="text-xs text-slate-600">
            Secure · Shareable · AI-Powered · Multilingual · Blood {data.patient.blood_group} · DOB {formatRegionalDate(data.patient.date_of_birth, i18n.language)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/vault?upload=1')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#087F8C] text-white rounded-lg text-sm font-semibold hover:bg-[#06636D] whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            {t('common.uploadRecord')}
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#087F8C]/30 bg-white text-[#123047] rounded-lg text-sm font-semibold hover:border-[#087F8C] whitespace-nowrap"
          >
            <QrCode className="w-4 h-4 text-[#087F8C]" />
            Share via QR
          </button>
        </div>
      </section>

      {/* 4-Column KPI Row matching Concept */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/vault')}
          className="text-start bg-white border border-slate-200 rounded-xl p-4 hover:border-[#087F8C] transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">{t('patient.recordsStored')}</p>
          <p className="text-2xl font-bold text-[#123047] mt-1 tabular-nums">{data.stats.total_records}</p>
          <p className="text-[11px] text-[#087F8C] font-medium mt-1">Medical Reports</p>
        </button>

        <button
          onClick={() => navigate('/services')}
          className="text-start bg-white border border-slate-200 rounded-xl p-4 hover:border-[#087F8C] transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">{t('patient.upcomingVisits')}</p>
          <p className="text-2xl font-bold text-[#123047] mt-1 tabular-nums">{data.stats.upcoming_appointments}</p>
          <p className="text-[11px] text-[#087F8C] font-medium mt-1">Appointments</p>
        </button>

        <button
          onClick={() => navigate('/consent')}
          className="text-start bg-white border border-slate-200 rounded-xl p-4 hover:border-[#087F8C] transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">{t('patient.activeConsents')}</p>
          <p className="text-2xl font-bold text-[#123047] mt-1 tabular-nums">{data.stats.active_consents}</p>
          <p className="text-[11px] text-[#087F8C] font-medium mt-1">Access Grants</p>
        </button>

        <button
          onClick={() => navigate('/family')}
          className="text-start bg-white border border-slate-200 rounded-xl p-4 hover:border-[#087F8C] transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">ABHA & Interop</p>
          <p className="text-sm font-mono font-bold text-[#123047] mt-2 truncate">
            {data.patient.abha_linked ? data.patient.abha_number_masked : 'Not Linked'}
          </p>
          <p className="text-[11px] text-[#087F8C] font-medium mt-1.5">Family & Caregivers</p>
        </button>
      </section>

      {/* Middle 2-Column Core Cards: Your Health ID (with inline QR) + AI Health Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Your Health ID & Dynamic QR */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#123047] flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#087F8C]" />
              Your Health ID
            </h2>
            <span className="text-[11px] font-medium text-slate-500">5-min Dynamic Token</span>
          </div>

          <div className="flex items-center justify-between gap-4 bg-[#EFF8FA] border border-[#BDE5E8] rounded-xl p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-[#123047]">
                  {data.patient.health_id}
                </span>
                <button
                  onClick={handleCopyHealthId}
                  className="p-1 text-slate-500 hover:text-[#087F8C]"
                  aria-label="Copy Health ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Show this QR or ID at any partner hospital to share authorized records.
              </p>
            </div>
            {qrImage && (
              <img
                src={qrImage}
                alt={`Dynamic QR for ${data.patient.health_id}`}
                className="w-24 h-24 rounded-lg border border-slate-200 bg-white p-1 shrink-0"
              />
            )}
          </div>

          <button
            onClick={() => setShowQrModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#087F8C] text-white rounded-lg text-xs font-semibold hover:bg-[#06636D]"
          >
            <Download className="w-4 h-4" />
            Open Full QR Card, Print & SMS ID
          </button>
        </section>

        {/* Right: AI Health Summary Preview */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#123047] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#087F8C]" />
                AI Health Summary
              </h2>
              <span className="text-xs text-slate-500">
                Latest: {data.recent_documents[0]?.title || 'No reports yet'}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
              {data.profile.chronic_conditions.length > 0 && (
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
                  <span>
                    <strong>Documented Conditions:</strong> {data.profile.chronic_conditions.join(' · ')}
                  </span>
                </p>
              )}
              {latestObs && (
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Latest {latestObs.test_name}:</strong> {latestObs.value_numeric} {latestObs.unit} on {latestObs.observed_at} ({latestObs.flag})
                  </span>
                </p>
              )}
              {data.profile.allergies.length > 0 && (
                <p className="flex items-start gap-2 text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Allergies:</strong> {data.profile.allergies.join(' · ')}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Assistive summary only · Preserves exact clinician dosages
            </p>
            <button
              onClick={() => navigate('/companion')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#123047] text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
            >
              <span>View Detailed Summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* Bottom 2-Column Section: Report Comparison Snapshot + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-[#123047] flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#087F8C]" />
              Report Comparison
            </h2>
            {compareSnap?.delta_summary ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-xs text-slate-500">{latestObs?.test_name || 'HbA1c'}</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#123047] flex items-center gap-2">
                  {compareSnap.delta_summary.to_value} {compareSnap.delta_summary.unit}
                  <span className="text-xs font-semibold text-[#087F8C] inline-flex items-center gap-1">
                    {compareSnap.delta_summary.absolute_change < 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <TrendingUp className="w-4 h-4" />
                    )}
                    {compareSnap.delta_summary.percent_change}%
                  </span>
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  vs {compareSnap.delta_summary.from_value} {compareSnap.delta_summary.unit} ({compareSnap.delta_summary.from_date})
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Upload 2+ compatible lab reports to track historical trends.</p>
            )}
          </div>
          <button
            onClick={() => navigate('/compare')}
            className="w-full py-2.5 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-[#123047] hover:border-[#087F8C]"
          >
            Compare Reports
          </button>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-bold text-[#123047]">{t('patient.quickActions')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Book Appointment', icon: Calendar, to: '/services' },
              { label: 'Find Hospital', icon: Building2, to: '/services' },
              { label: 'Find Doctor', icon: Stethoscope, to: '/services' },
              { label: 'Upload Report', icon: Upload, to: '/vault?upload=1' },
            ].map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.label}
                  onClick={() => navigate(act.to)}
                  className="p-4 rounded-xl bg-[#EFF8FA] border border-slate-200 hover:border-[#087F8C] transition-colors flex flex-col items-center text-center gap-2"
                >
                  <span className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#087F8C]">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-[#123047]">{act.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Recent Medical Documents & Active Medications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#123047] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#087F8C]" />
              Recent Medical Documents
            </h2>
            <button onClick={() => navigate('/vault')} className="text-xs font-semibold text-[#087F8C] hover:underline">
              View All
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent_documents.map((doc) => (
              <div key={doc.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#123047] truncate">{doc.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {doc.facility_name} · {formatRegionalDate(doc.document_date, i18n.language)} · {doc.category.replace('_', ' ')}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 shrink-0 capitalize">
                  {doc.verification_status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
            <h2 className="text-sm font-bold text-[#123047]">Active Medications</h2>
            <div className="divide-y divide-slate-100">
              {data.medications.map((m) => (
                <div key={m.id} className="py-2 text-xs">
                  <p className="font-semibold text-[#123047]">
                    {m.drug_name} <span className="font-mono">{m.dose}</span>
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    {m.route} · {m.frequency} · {m.duration}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {!data.patient.abha_linked && (
            <form onSubmit={handleLinkAbha} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-[#123047] flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-[#087F8C]" />
                Optional ABHA Linkage
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={abhaInput}
                  onChange={(e) => setAbhaInput(e.target.value)}
                  placeholder="14-digit ABHA (e.g. 91-4820-1234-1932)"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                />
                <button
                  type="submit"
                  disabled={linkingAbha}
                  className="px-3 py-1.5 bg-[#123047] text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                >
                  Link
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {showQrModal && activePatientId && (
        <DynamicQrModal patientId={activePatientId} onClose={() => setShowQrModal(false)} />
      )}
    </div>
  );
};
