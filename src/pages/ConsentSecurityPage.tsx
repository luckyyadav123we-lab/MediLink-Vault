import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { formatRegionalDate } from '../i18n';
import { useTranslation } from 'react-i18next';

interface ConsentRecord {
  id: string;
  grantee_name: string;
  grantee_role: string;
  purpose: string;
  scope_categories_json: string;
  status: string;
  verification_method: string;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
}

interface AccessLogRow {
  id: string;
  actor_name: string;
  actor_role: string;
  facility_name: string;
  action: string;
  purpose: string;
  records_accessed_json: string;
  is_emergency_break_glass: number;
  emergency_reason: string | null;
  created_at: string;
}

export const ConsentSecurityPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { activePatientId, pushToast } = useAuthStore();
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [logs, setLogs] = useState<AccessLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [granteeEmail, setGranteeEmail] = useState('dr.meera.nair@demo.medilink.in');
  const [purpose, setPurpose] = useState('Specialist Follow-up Consultation');
  const [durationHours, setDurationHours] = useState(48);

  const loadHistory = async () => {
    if (!activePatientId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ consents: ConsentRecord[]; access_logs: AccessLogRow[] }>(
        `/api/consent/history?patient_id=${encodeURIComponent(activePatientId)}`
      );
      setConsents(res.consents);
      setLogs(res.access_logs);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load consent history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [activePatientId]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatientId) return;
    try {
      await apiFetch('/api/consent/grant', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: activePatientId,
          grantee_email_or_id: granteeEmail,
          purpose,
          scope_categories: ['lab_report', 'prescription', 'discharge_summary', 'consultation_note'],
          duration_hours: durationHours,
        }),
      });
      pushToast('success', 'Time-limited sharing consent granted.');
      await loadHistory();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to grant consent.');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiFetch(`/api/consent/${id}/revoke`, { method: 'POST' });
      pushToast('info', 'Authorization revoked immediately.');
      await loadHistory();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to revoke consent.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Consent Management & Patient Access History</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Every cross-hospital view, upload, AI synthesis, and emergency break-glass event is cryptographically audited.
        </p>
      </div>

      {/* Grant New Time-Limited Consent */}
      <form onSubmit={handleGrant} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          Grant Time-Limited Clinician / Hospital Authorization
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={granteeEmail}
            onChange={(e) => setGranteeEmail(e.target.value)}
            placeholder="Doctor or Hospital Admin email"
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
            required
          />
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Stated clinical purpose"
            className="md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-xs"
            required
          />
          <div className="flex gap-2">
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value={24}>24 Hours</option>
              <option value={72}>72 Hours</option>
              <option value={720}>30 Days</option>
            </select>
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
            >
              Authorize
            </button>
          </div>
        </div>
      </form>

      {/* Active & Historical Consents */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Authorization Grants</h2>
        </div>
        {loading ? (
          <div className="h-32 animate-pulse bg-slate-50" />
        ) : (
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4 text-start">Grantee</th>
                <th className="py-2.5 px-4 text-start">Purpose & Scope</th>
                <th className="py-2.5 px-4 text-start">Method</th>
                <th className="py-2.5 px-4 text-start">Expires</th>
                <th className="py-2.5 px-4 text-start">Status</th>
                <th className="py-2.5 px-4 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {consents.map((c) => {
                const scopes = JSON.parse(c.scope_categories_json) as string[];
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {c.grantee_name}
                      <span className="block text-[11px] text-slate-400 capitalize">{c.grantee_role}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.purpose}
                      <span className="block text-[11px] text-slate-400">{scopes.join(', ')}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">{c.verification_method.replace('_', ' ')}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {formatRegionalDate(c.expires_at, i18n.language)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold capitalize ${
                          c.status === 'active' ? 'text-emerald-800' : 'text-slate-500'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      {c.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-700 rounded hover:bg-red-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Immutable Audit Access History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Audit Access History</h2>
        </div>
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
              <th className="py-2.5 px-4 text-start">Timestamp</th>
              <th className="py-2.5 px-4 text-start">Actor & Facility</th>
              <th className="py-2.5 px-4 text-start">Action</th>
              <th className="py-2.5 px-4 text-start">Stated Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {logs.map((l) => (
              <tr key={l.id} className={l.is_emergency_break_glass ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                  {l.created_at.slice(0, 19).replace('T', ' ')}
                </td>
                <td className="py-3 px-4 text-slate-900 font-medium">
                  {l.actor_name}
                  <span className="block text-[11px] text-slate-500 font-normal">{l.facility_name}</span>
                </td>
                <td className="py-3 px-4">
                  {l.is_emergency_break_glass ? (
                    <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      EMERGENCY BREAK-GLASS
                    </span>
                  ) : (
                    <span className="font-mono text-slate-700">{l.action}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-slate-600">{l.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
