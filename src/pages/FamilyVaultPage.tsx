import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCheck, UserPlus, XCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface CaregiverPermission {
  id: string;
  patient_id: string;
  caregiver_name: string;
  relationship: string;
  can_view_records: number;
  can_upload_records: number;
  can_manage_consent: number;
  status: string;
  patient_name?: string;
  health_id?: string;
  date_of_birth?: string;
  blood_group?: string;
  has_smartphone?: number;
}

export const FamilyVaultPage: React.FC = () => {
  const { user, ownPatientId, activePatientId, setActivePatient, pushToast } = useAuthStore();
  const [managedProfiles, setManagedProfiles] = useState<CaregiverPermission[]>([]);
  const [myCaregivers, setMyCaregivers] = useState<CaregiverPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const [caregiverContact, setCaregiverContact] = useState('');
  const [relationship, setRelationship] = useState('Spouse / Caregiver');
  const [canView, setCanView] = useState(true);
  const [canUpload, setCanUpload] = useState(false);
  const [canConsent, setCanConsent] = useState(false);

  const navigate = useNavigate();

  const loadFamily = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        managed_profiles: CaregiverPermission[];
        my_caregivers: CaregiverPermission[];
      }>('/api/patients/family/vault');
      setManagedProfiles(res.managed_profiles);
      setMyCaregivers(res.my_caregivers);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load Family Vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamily();
  }, []);

  const handleAddCaregiver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/patients/family/caregivers', {
        method: 'POST',
        body: JSON.stringify({
          caregiver_email_or_phone: caregiverContact,
          relationship,
          can_view_records: canView,
          can_upload_records: canUpload,
          can_manage_consent: canConsent,
        }),
      });
      pushToast('success', 'Granular caregiver authorization granted.');
      setCaregiverContact('');
      await loadFamily();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to authorize caregiver.');
    }
  };

  const handleTogglePerm = async (id: string, field: 'can_view_records' | 'can_upload_records' | 'can_manage_consent', val: boolean) => {
    try {
      await apiFetch(`/api/patients/family/caregivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: val }),
      });
      await loadFamily();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiFetch(`/api/patients/family/caregivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'revoked' }),
      });
      pushToast('info', 'Caregiver authorization revoked immediately.');
      await loadFamily();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Revocation failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Family Health Vault & Caregiver Authorization</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Separate patient profiles with explicit, granular guardian permissions and instant revocation. Family members never receive automatic unrestricted access.
        </p>
      </div>

      {/* Active Profile Switcher */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Switch Active Vault Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ownPatientId && (
            <button
              onClick={() => {
                setActivePatient(ownPatientId, user?.full_name || 'Self');
                pushToast('success', 'Switched to your primary Health Vault.');
                navigate('/patient');
              }}
              className={`text-start p-4 rounded-xl border transition-colors ${
                activePatientId === ownPatientId ? 'border-teal-700 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{user?.full_name} (Own Profile)</p>
              <p className="text-xs text-slate-500 mt-0.5">Primary Vault Owner</p>
            </button>
          )}

          {managedProfiles.map((mp) => (
            <div
              key={mp.id}
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                activePatientId === mp.patient_id ? 'border-teal-700 bg-teal-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {mp.patient_name} · <span className="font-mono text-xs">{mp.health_id}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mp.relationship} · Blood {mp.blood_group} · {mp.has_smartphone ? 'Smartphone' : 'Keypad SMS Profile'}
                </p>
              </div>
              {mp.status === 'active' && mp.can_view_records === 1 ? (
                <button
                  onClick={() => {
                    setActivePatient(mp.patient_id, mp.patient_name || 'Dependent');
                    pushToast('success', `Viewing ${mp.patient_name}'s authorized vault`);
                    navigate('/patient');
                  }}
                  className="px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-800 shrink-0"
                >
                  Open Vault
                </button>
              ) : (
                <span className="text-xs text-slate-400">Access Revoked</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Authorize a Caregiver on Own Profile */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-teal-700" />
          Authorize a Caregiver or Family Member
        </h2>
        <form onSubmit={handleAddCaregiver} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={caregiverContact}
              onChange={(e) => setCaregiverContact(e.target.value)}
              placeholder="Caregiver registered email or mobile number"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Relationship (e.g. Spouse, Adult Child, Parent)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
              required
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={canView} onChange={(e) => setCanView(e.target.checked)} className="accent-teal-700" />
              Can View Records
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={canUpload} onChange={(e) => setCanUpload(e.target.checked)} className="accent-teal-700" />
              Can Upload Reports
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={canConsent} onChange={(e) => setCanConsent(e.target.checked)} className="accent-teal-700" />
              Can Manage Hospital Consent
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
          >
            Grant Granular Caregiver Access
          </button>
        </form>
      </section>

      {/* Caregivers on My Profile */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          Caregivers Authorized on Your Profile
        </h2>
        {loading ? (
          <div className="h-24 bg-slate-100 rounded animate-pulse" />
        ) : myCaregivers.length === 0 ? (
          <p className="text-xs text-slate-500">No external caregivers currently authorized on your profile.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {myCaregivers.map((cg) => (
              <div key={cg.id} className="py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                    {cg.caregiver_name} · <span className="text-slate-500 font-normal">{cg.relationship}</span>
                  </p>
                  <p className="text-slate-500 mt-0.5 capitalize">Status: {cg.status}</p>
                </div>
                {cg.status === 'active' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={cg.can_view_records === 1}
                        onChange={(e) => handleTogglePerm(cg.id, 'can_view_records', e.target.checked)}
                        className="accent-teal-700"
                      />
                      View
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={cg.can_upload_records === 1}
                        onChange={(e) => handleTogglePerm(cg.id, 'can_upload_records', e.target.checked)}
                        className="accent-teal-700"
                      />
                      Upload
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={cg.can_manage_consent === 1}
                        onChange={(e) => handleTogglePerm(cg.id, 'can_manage_consent', e.target.checked)}
                        className="accent-teal-700"
                      />
                      Consent
                    </label>
                    <button
                      onClick={() => handleRevoke(cg.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-700 rounded hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
