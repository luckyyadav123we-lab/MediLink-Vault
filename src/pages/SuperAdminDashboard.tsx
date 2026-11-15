import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, LifeBuoy, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface SuperAdminOverview {
  counts: {
    users: number;
    patients: number;
    doctors: number;
    hospitals: number;
    laboratories: number;
    documents: number;
    ai_summaries: number;
    break_glass_events: number;
  };
  hospitals: Array<{ id: string; name: string; city: string; accreditation: string; verification_status: string }>;
  subscriptions: Array<{ id: string; subscriber_name: string; plan_code: string; status: string; provider: string; amount_cents: number; currency: string }>;
  security_alerts: Array<{ id: string; actor_name: string; facility_name: string; action: string; purpose: string; created_at: string }>;
  tickets: Array<{ id: string; user_name: string; user_role: string; category: string; subject: string; status: string }>;
  ai_metrics: Array<{ id: string; summary_type: string; model_name: string; prompt_version: string; validation_status: string; latency_ms: number; estimated_cost_usd: number }>;
}

export const SuperAdminDashboard: React.FC = () => {
  const { pushToast } = useAuthStore();
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<SuperAdminOverview>('/api/admin/super/overview');
      setData(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load platform admin overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleResolveTicket = async (id: string) => {
    try {
      await apiFetch(`/api/admin/super/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved', admin_notes: 'Reviewed and resolved by Platform Operations.' }),
      });
      pushToast('success', 'Support ticket marked resolved.');
      await loadOverview();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleToggleHospitalVerify = async (id: string, current: string) => {
    const next = current === 'verified' ? 'pending_review' : 'verified';
    try {
      await apiFetch(`/api/admin/super/hospitals/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verification_status: next }),
      });
      await loadOverview();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Verification update failed.');
    }
  };

  if (loading || !data) {
    return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Platform Super Administrator</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Multi-tenant verification, AI cost & latency observability, break-glass audit alerts, subscriptions, and support operations
        </p>
      </div>

      {/* Platform KPI Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts', value: data.counts.users },
          { label: 'Patients & Health IDs', value: data.counts.patients },
          { label: 'Hospitals & Labs', value: data.counts.hospitals + data.counts.laboratories },
          { label: 'Break-Glass Events', value: data.counts.break_glass_events },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{k.value}</p>
          </div>
        ))}
      </section>

      {/* Hospitals & Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
            Hospital Network Verification
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {data.hospitals.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{h.name}</p>
                  <p className="text-slate-500">
                    {h.city} · {h.accreditation}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleHospitalVerify(h.id, h.verification_status)}
                  className={`px-2.5 py-1 rounded border font-medium capitalize ${
                    h.verification_status === 'verified'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {h.verification_status.replace('_', ' ')}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-700" />
            Security, Revocations & Break-Glass Alerts
          </h2>
          {data.security_alerts.length === 0 ? (
            <p className="text-xs text-slate-500">No break-glass or revocation events logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {data.security_alerts.map((s) => (
                <div key={s.id} className="py-2.5 space-y-0.5">
                  <p className="font-semibold text-red-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {s.action} — {s.actor_name}
                  </p>
                  <p className="text-slate-600">{s.purpose}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* AI Agent Observability + Support Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-700" />
            AI Synthesis Audit & Cost Metrics ({data.counts.ai_summaries} runs)
          </h2>
          {data.ai_metrics.length === 0 ? (
            <p className="text-xs text-slate-500">Run Doctor Clinical Summary or Patient Companion to record telemetry.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {data.ai_metrics.map((m) => (
                <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 capitalize">{m.summary_type.replace('_', ' ')}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {m.model_name} · {m.prompt_version}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-slate-700">
                    {m.latency_ms}ms · ${m.estimated_cost_usd.toFixed(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-teal-700" />
            Support Ticket Queue
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {data.tickets.map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{t.subject}</p>
                  <p className="text-slate-500">
                    {t.user_name} ({t.user_role}) · {t.category}
                  </p>
                </div>
                {t.status !== 'resolved' ? (
                  <button
                    onClick={() => handleResolveTicket(t.id)}
                    className="px-2.5 py-1 bg-teal-700 text-white rounded text-xs font-medium hover:bg-teal-800"
                  >
                    Resolve
                  </button>
                ) : (
                  <span className="text-emerald-800 font-medium">Resolved</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
