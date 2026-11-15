import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Plug, Shield, Upload, UserPlus } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface HospitalOverview {
  hospital: {
    id: string;
    name: string;
    city: string;
    state: string;
    accreditation: string;
    verification_status: string;
    emergency_phone: string;
  };
  staff: Array<{ id: string; full_name: string; email: string; staff_role: string; department: string; status: string }>;
  doctors: Array<{ id: string; full_name: string; specialty: string; registration_number: string; verification_status: string }>;
  recent_uploads: Array<{
    id: string;
    title: string;
    category: string;
    document_date: string;
    verification_status: string;
    health_id: string;
  }>;
  audit_logs: Array<{ id: string; actor_name: string; action: string; purpose: string; created_at: string; is_emergency_break_glass: number }>;
  integrations: Array<{ id: string; provider_name: string; fhir_endpoint: string; status: string; last_synced_at: string }>;
}

export const HospitalDashboard: React.FC = () => {
  const { pushToast } = useAuthStore();
  const [data, setData] = useState<HospitalOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('Attending Physician');
  const [department, setDepartment] = useState('Internal Medicine');
  const [accountRole, setAccountRole] = useState<'doctor' | 'hospital_admin'>('doctor');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<HospitalOverview>('/api/admin/hospital/overview');
      setData(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load hospital console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOnboardStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/hospital/staff', {
        method: 'POST',
        body: JSON.stringify({
          full_name: staffName,
          email: staffEmail,
          staff_role: staffRole,
          department,
          role: accountRole,
        }),
      });
      pushToast('success', `${staffName} onboarded with verified facility RBAC.`);
      setStaffName('');
      setStaffEmail('');
      await loadData();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Onboarding failed.');
    }
  };

  if (loading || !data) {
    return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {/* Hospital Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            Hospital Administration & Interoperability Console
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{data.hospital.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.hospital.city}, {data.hospital.state} · {data.hospital.accreditation} · Emergency {data.hospital.emergency_phone}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4" />
          Facility {data.hospital.verification_status}
        </span>
      </section>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Verified Doctors</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{data.doctors.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Staff RBAC Accounts</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{data.staff.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Records Uploaded</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{data.recent_uploads.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Active FHIR / Lab Bridges</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{data.integrations.length}</p>
        </div>
      </section>

      {/* Onboard Staff + Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleOnboardStaff} className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700" />
            Onboard Verified Clinician or Staff
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Full Name (e.g. Dr. Kavita Rao)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
            <input
              type="email"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="Hospital Email"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value)}
              placeholder="Title"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Department"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
            <select
              value={accountRole}
              onChange={(e) => setAccountRole(e.target.value as 'doctor' | 'hospital_admin')}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="doctor">Doctor RBAC</option>
              <option value="hospital_admin">Records Admin</option>
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800">
            Create Verified Staff Account
          </button>
        </form>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Plug className="w-4 h-4 text-teal-700" />
            HMS / EMR & Laboratory API Integrations
          </h2>
          <div className="divide-y divide-slate-100">
            {data.integrations.map((intg) => (
              <div key={intg.id} className="py-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{intg.provider_name}</span>
                  <span className="text-emerald-800 font-medium capitalize">{intg.status}</span>
                </div>
                <p className="font-mono text-[11px] text-slate-500 truncate">{intg.fhir_endpoint}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Uploads & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-teal-700" />
            Recent Patient Record Deliveries
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {data.recent_uploads.map((u) => (
              <div key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{u.title}</p>
                  <p className="text-slate-500">
                    Health ID <span className="font-mono">{u.health_id}</span> · {u.document_date}
                  </p>
                </div>
                <span className="text-emerald-800 font-medium capitalize">{u.verification_status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            Security & Access Audit Log
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {data.audit_logs.slice(0, 8).map((l) => (
              <div key={l.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{l.actor_name}</span>
                  <span className="font-mono text-[11px] text-slate-400">{l.created_at.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <p className={l.is_emergency_break_glass ? 'text-red-700 font-medium' : 'text-slate-500'}>
                  {l.action} · {l.purpose}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
