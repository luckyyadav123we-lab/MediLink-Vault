import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Calendar, FlaskConical, LifeBuoy, PhoneCall, Stethoscope } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface DirectoryResponse {
  data_notice: string;
  hospitals: Array<{ id: string; name: string; city: string; state: string; accreditation: string; emergency_phone: string }>;
  doctors: Array<{ id: string; full_name: string; specialty: string; hospital_name: string; city: string; consultation_fee_inr: number; available_days: string }>;
  laboratories: Array<{ id: string; name: string; city: string; accreditation: string }>;
}

interface Ticket {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export const ServicesSupportPage: React.FC = () => {
  const { activePatientId, ownPatientId, pushToast } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'services' | 'support'>(searchParams.get('tab') === 'support' ? 'support' : 'services');

  const [cityFilter, setCityFilter] = useState('');
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);

  // Appointment booking
  const [serviceType, setServiceType] = useState<'consultation' | 'second_opinion' | 'health_checkup' | 'teleconsultation'>('consultation');
  const [hospitalId, setHospitalId] = useState('hosp-1');
  const [scheduledAt, setScheduledAt] = useState('2026-11-22 10:30');
  const [reason, setReason] = useState('');

  // Jurisdiction-verified emergency info
  const [jurisdiction, setJurisdiction] = useState('');
  const [emergencyInfo, setEmergencyInfo] = useState<{
    country: string;
    emergency: string;
    ambulance: string;
    poison_or_helpline: string;
  } | null>(null);

  // Support tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tCategory, setTCategory] = useState<'technical' | 'login' | 'payment' | 'data_privacy'>('technical');
  const [tSubject, setTSubject] = useState('');
  const [tDesc, setTDesc] = useState('');

  const loadDirectory = async (city = '') => {
    try {
      const res = await apiFetch<DirectoryResponse>(`/api/services/directory?city=${encodeURIComponent(city)}`);
      setDirectory(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load directory.');
    }
  };

  const loadTickets = async () => {
    try {
      const res = await apiFetch<{ tickets: Ticket[] }>('/api/services/tickets');
      setTickets(res.tickets);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadDirectory();
    loadTickets();
  }, []);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPid = activePatientId || ownPatientId || 'pat-1';
    try {
      await apiFetch('/api/services/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: targetPid,
          hospital_id: hospitalId,
          doctor_id: 'doc-1',
          service_type: serviceType,
          scheduled_at: scheduledAt,
          reason,
        }),
      });
      pushToast('success', `${serviceType.replace('_', ' ')} booked for ${scheduledAt}`);
      setReason('');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Booking failed.');
    }
  };

  const handleVerifyJurisdiction = async (code: string) => {
    setJurisdiction(code);
    if (!code) {
      setEmergencyInfo(null);
      return;
    }
    try {
      const res = await apiFetch<NonNullable<typeof emergencyInfo> & { verified: boolean }>(
        `/api/services/emergency-info?jurisdiction=${code}`
      );
      setEmergencyInfo(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Jurisdiction verification failed.');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/services/tickets', {
        method: 'POST',
        body: JSON.stringify({ category: tCategory, subject: tSubject, description: tDesc }),
      });
      pushToast('success', 'Support ticket created.');
      setTSubject('');
      setTDesc('');
      await loadTickets();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not create ticket.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Healthcare Services & Support Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Find hospitals, doctors, and diagnostic labs · Book appointments & second opinions · Jurisdiction-verified emergency numbers
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            onClick={() => setTab('services')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              tab === 'services' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Healthcare Services
          </button>
          <button
            onClick={() => setTab('support')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              tab === 'support' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Help & Support Tickets
          </button>
        </div>
      </div>

      {tab === 'services' ? (
        <div className="space-y-6">
          {/* City Filter + Demo Notice */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Filter by city (Pune, Mumbai, Bengaluru)…"
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs w-64"
              />
              <button
                onClick={() => loadDirectory(cityFilter)}
                className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium"
              >
                Filter
              </button>
            </div>
            <p className="text-[11px] text-slate-500">{directory?.data_notice}</p>
          </div>

          {/* Directory Columns */}
          {directory && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-700" />
                  Verified Hospitals
                </h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {directory.hospitals.map((h) => (
                    <div key={h.id} className="py-2.5">
                      <p className="font-semibold text-slate-900">{h.name}</p>
                      <p className="text-slate-500">
                        {h.city}, {h.state} · {h.accreditation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-700" />
                  Specialists & Second Opinion
                </h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {directory.doctors.map((d) => (
                    <div key={d.id} className="py-2.5">
                      <p className="font-semibold text-slate-900">{d.full_name}</p>
                      <p className="text-slate-500">
                        {d.specialty} · {d.hospital_name}
                      </p>
                      <p className="text-teal-800 font-mono mt-0.5">
                        ₹{d.consultation_fee_inr} · {d.available_days}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-700" />
                  Diagnostic Laboratories
                </h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {directory.laboratories.map((l) => (
                    <div key={l.id} className="py-2.5">
                      <p className="font-semibold text-slate-900">{l.name}</p>
                      <p className="text-slate-500">
                        {l.city} · {l.accreditation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Book Service & Jurisdiction Emergency Info */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleBookAppointment} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                Book Appointment, Second Opinion, or Preventive Checkup
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as typeof serviceType)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                >
                  <option value="consultation">Specialist Consultation</option>
                  <option value="second_opinion">Medical Second Opinion</option>
                  <option value="health_checkup">Preventive Health Checkup</option>
                  <option value="teleconsultation">Teleconsultation</option>
                </select>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                >
                  {directory?.hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  required
                />
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Clinical reason or preferred test package"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                required
              />
              <button type="submit" className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800">
                Confirm Booking
              </button>
            </form>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-red-700" />
                Jurisdiction-Verified Emergency Contacts
              </h2>
              <p className="text-xs text-slate-500">
                Emergency helpline numbers are displayed only after verifying your region.
              </p>
              <select
                value={jurisdiction}
                onChange={(e) => handleVerifyJurisdiction(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
              >
                <option value="">Select & Verify Country / Jurisdiction…</option>
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="AE">United Arab Emirates (AE)</option>
              </select>
              {emergencyInfo && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1 text-red-900">
                  <p className="font-semibold">Verified Emergency Numbers ({emergencyInfo.country})</p>
                  <p className="font-mono">National Emergency: {emergencyInfo.emergency}</p>
                  <p className="font-mono">Ambulance Dispatch: {emergencyInfo.ambulance}</p>
                  <p className="font-mono">Health Helpline: {emergencyInfo.poison_or_helpline}</p>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <form onSubmit={handleCreateTicket} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-teal-700" />
                Raise a Support Ticket
              </h2>
              <select
                value={tCategory}
                onChange={(e) => setTCategory(e.target.value as typeof tCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
              >
                <option value="technical">Technical Assistance</option>
                <option value="login">Login & Health ID Access</option>
                <option value="payment">Payments & Invoices</option>
                <option value="data_privacy">Data Privacy & Consent Inquiry</option>
              </select>
              <input
                type="text"
                value={tSubject}
                onChange={(e) => setTSubject(e.target.value)}
                placeholder="Subject"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                required
              />
              <textarea
                rows={3}
                value={tDesc}
                onChange={(e) => setTDesc(e.target.value)}
                placeholder="Describe your issue (never include sensitive passwords or card numbers)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                required
              />
              <button type="submit" className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800">
                Submit Ticket
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5 text-xs">
              <h3 className="text-sm font-semibold text-slate-900">Frequently Asked Questions</h3>
              <p>
                <strong>Does scanning my QR code give permanent access?</strong> No. Dynamic QR tokens expire in 5 minutes and only identify your Health ID; records require active consent or OTP verification.
              </p>
              <p>
                <strong>Can keypad phone users share records?</strong> Yes. Use the SMS Health ID workflow, printed QR card, or assisted hospital desk consent.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Your Support Tickets</h2>
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-500">No support tickets raised yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {tickets.map((t) => (
                  <div key={t.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{t.subject}</span>
                      <span className={`font-medium capitalize ${t.status === 'resolved' ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{t.description}</p>
                    {t.admin_notes && <p className="text-teal-800 bg-teal-50 p-2 rounded">Resolution: {t.admin_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
