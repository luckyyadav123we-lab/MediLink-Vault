import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  KeyRound,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

interface DynamicQrModalProps {
  patientId: string;
  onClose: () => void;
}

export const DynamicQrModal: React.FC<DynamicQrModalProps> = ({ patientId, onClose }) => {
  const { pushToast } = useAuthStore();
  const [qrData, setQrData] = useState<{
    health_id: string;
    patient_name: string;
    blood_group: string;
    emergency_contact_phone: string;
    qr_data_url: string;
    expires_at: string;
    security_note: string;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [loading, setLoading] = useState(true);
  const [smsSending, setSmsSending] = useState(false);
  const [smsNotice, setSmsNotice] = useState<string | null>(null);

  const loadQr = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<NonNullable<typeof qrData>>(`/api/patients/${patientId}/qr`);
      setQrData(data);
      const diff = Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to generate QR.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQr();
  }, [patientId]);

  useEffect(() => {
    if (!qrData) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [qrData]);

  const handleSendSmsId = async () => {
    setSmsSending(true);
    try {
      const res = await apiFetch<{
        provider_mode: string;
        masked_destination: string;
        demo_otp_preview?: string;
        note: string;
      }>('/api/patients/otp/send', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, channel: 'sms', purpose: 'Keypad Phone Health ID & Verification' }),
      });
      setSmsNotice(
        res.demo_otp_preview
          ? `${res.note} Verification code for ${qrData?.health_id}: ${res.demo_otp_preview}`
          : res.note
      );
      pushToast('success', `SMS Health ID notice dispatched to ${res.masked_destination}`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to dispatch SMS.');
    } finally {
      setSmsSending(false);
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 no-print">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dynamic Health ID & QR</h2>
            <p className="text-xs text-slate-500 mt-0.5">Identity matching token · Never embeds raw medical records</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close QR dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !qrData ? (
          <div className="h-64 bg-slate-100 rounded-lg animate-pulse flex items-center justify-center text-xs text-slate-500">
            Generating short-lived signed QR…
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs text-slate-500">MediLink Vault Health Card</p>
                <p className="text-base font-semibold text-slate-900">{qrData.patient_name}</p>
              </div>
              <div className="text-end">
                <p className="text-[11px] text-slate-500">Blood Group</p>
                <p className="text-sm font-mono font-semibold text-slate-900">{qrData.blood_group}</p>
              </div>
            </div>

            <div className="flex flex-col items-center py-2 bg-white border border-slate-200 rounded-lg">
              <img src={qrData.qr_data_url} alt={`Health ID QR for ${qrData.health_id}`} className="w-48 h-48" />
              <p className="font-mono text-base font-semibold tracking-wider text-slate-900 mt-1 pb-2">
                {qrData.health_id}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
              <span>
                Token expires in{' '}
                <strong className={secondsLeft < 60 ? 'text-amber-700' : 'text-teal-800'}>
                  {mins}:{String(secs).padStart(2, '0')}
                </strong>
              </span>
              <button
                onClick={loadQr}
                className="inline-flex items-center gap-1 text-teal-800 hover:underline font-medium no-print"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Token
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">{qrData.security_note}</p>
          </div>
        )}

        {smsNotice && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900">
            {smsNotice}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-3 py-2.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            Print Card
          </button>
          <button
            onClick={handleSendSmsId}
            disabled={smsSending}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-800 disabled:opacity-60"
          >
            <Smartphone className="w-4 h-4" />
            {smsSending ? 'Sending…' : 'SMS Health ID'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface LookupResult {
  patient: {
    patient_id: string;
    health_id: string;
    full_name: string;
    date_of_birth: string;
    gender: string;
    blood_group: string;
    has_smartphone: boolean;
    phone_masked: string;
  };
  verification_method: string;
  authorized: boolean;
  access_mode: string;
  allowed_categories: string[];
  message: string;
}

interface QrScannerPanelProps {
  onAuthorizedPatient: (patient: LookupResult['patient'], accessMode: string) => void;
}

export const QrScannerPanel: React.FC<QrScannerPanelProps> = ({ onAuthorizedPatient }) => {
  const { pushToast } = useAuthStore();
  const [healthIdInput, setHealthIdInput] = useState('MV-8K29-X7P4');
  const [scanning, setScanning] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Consent escalation states
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [consentTab, setConsentTab] = useState<'otp' | 'assisted' | 'break_glass'>('otp');
  const [assistedWitness, setAssistedWitness] = useState('');
  const [assistedDocType, setAssistedDocType] = useState('Aadhaar / Govt Photo ID');
  const [assistedLastFour, setAssistedLastFour] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [clinicalUnit, setClinicalUnit] = useState('Emergency Triage Unit');

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const runLookup = async (payload: { qr_payload?: string; health_id?: string }) => {
    setLoading(true);
    try {
      const res = await apiFetch<LookupResult>('/api/patients/lookup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setLookup(res);
      if (res.authorized) {
        onAuthorizedPatient(res.patient, res.access_mode);
        pushToast('success', `Authorized access active for ${res.patient.full_name}`);
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Patient lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const startCameraScan = async () => {
    setScanning(true);
    try {
      const scanner = new Html5Qrcode('medilink-qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          await stopCameraScan();
          await runLookup({ qr_payload: decodedText });
        },
        () => {}
      );
    } catch {
      setScanning(false);
      pushToast('info', 'Camera unavailable in this preview. Use manual Health ID lookup (e.g., MV-8K29-X7P4).');
    }
  };

  const stopCameraScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleSendOtp = async () => {
    if (!lookup) return;
    try {
      const res = await apiFetch<{ demo_otp_preview?: string; masked_destination: string; note: string }>(
        '/api/patients/otp/send',
        {
          method: 'POST',
          body: JSON.stringify({
            patient_id: lookup.patient.patient_id,
            channel: 'sms',
            purpose: 'Clinical Consultation Record Access',
          }),
        }
      );
      setOtpPreview(res.demo_otp_preview || null);
      pushToast('info', `Consent OTP dispatched to ${res.masked_destination}`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup) return;
    try {
      await apiFetch('/api/patients/otp/verify', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: lookup.patient.patient_id,
          otp_code: otpCode,
          purpose: 'Clinical Consultation Record Access',
        }),
      });
      await runLookup({ health_id: lookup.patient.health_id });
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Invalid OTP.');
    }
  };

  const handleAssistedConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup) return;
    try {
      await apiFetch(`/api/patients/${lookup.patient.patient_id}/assisted-consent`, {
        method: 'POST',
        body: JSON.stringify({
          witness_name: assistedWitness,
          id_document_type: assistedDocType,
          id_last_four: assistedLastFour,
          purpose: 'Assisted in-person hospital intake (no smartphone/phone)',
        }),
      });
      await runLookup({ health_id: lookup.patient.health_id });
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Assisted consent failed.');
    }
  };

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup) return;
    try {
      await apiFetch('/api/consent/break-glass', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: lookup.patient.patient_id,
          emergency_reason: emergencyReason,
          clinical_unit: clinicalUnit,
        }),
      });
      pushToast('info', 'Controlled 2-hour break-glass emergency access logged and patient notified.');
      await runLookup({ health_id: lookup.patient.health_id });
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Break-glass request failed.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Patient Identification & Consent Gate</h2>
          <p className="text-xs text-slate-500">
            Scan dynamic Health ID QR or enter alphanumeric ID · Health ID matches identity only; access requires consent
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!scanning ? (
            <button
              type="button"
              onClick={startCameraScan}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Camera className="w-4 h-4 text-teal-700" />
              Scan QR Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCameraScan}
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-xs font-medium text-red-700"
            >
              Stop Camera
            </button>
          )}
        </div>
      </div>

      {scanning && <div id="medilink-qr-reader" className="max-w-xs mx-auto rounded-lg overflow-hidden border border-slate-200" />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runLookup({ health_id: healthIdInput });
        }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative flex-1 min-w-[220px]">
          <QrCode className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={healthIdInput}
            onChange={(e) => setHealthIdInput(e.target.value.toUpperCase())}
            placeholder="Enter Health ID (e.g. MV-8K29-X7P4 or MV-3P91-K2M8)"
            className="w-full ps-9 pe-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800 disabled:opacity-60"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Matching…' : 'Lookup Health ID'}
        </button>
        <button
          type="button"
          onClick={() => {
            setHealthIdInput('MV-3P91-K2M8');
            runLookup({ health_id: 'MV-3P91-K2M8' });
          }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Try Keypad Patient (MV-3P91-K2M8)
        </button>
      </form>

      {lookup && (
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {lookup.patient.full_name} · <span className="font-mono">{lookup.patient.health_id}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {lookup.patient.gender} · DOB {lookup.patient.date_of_birth} · Blood {lookup.patient.blood_group} · Phone {lookup.patient.phone_masked}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              {lookup.authorized ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  Consent Verified ({lookup.access_mode.replace('_', ' ')})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4" />
                  Verification Required Before Record Access
                </span>
              )}
            </div>
          </div>

          {!lookup.authorized && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setConsentTab('otp')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    consentTab === 'otp' ? 'bg-white border border-slate-200 text-slate-900' : 'text-slate-600'
                  }`}
                >
                  SMS / Keypad OTP Verification
                </button>
                <button
                  type="button"
                  onClick={() => setConsentTab('assisted')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    consentTab === 'assisted' ? 'bg-white border border-slate-200 text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Assisted In-Person Consent (No Phone)
                </button>
                <button
                  type="button"
                  onClick={() => setConsentTab('break_glass')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    consentTab === 'break_glass' ? 'bg-red-50 border border-red-200 text-red-800' : 'text-red-700'
                  }`}
                >
                  Emergency Break-Glass
                </button>
              </div>

              {consentTab === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send 6-Digit Consent OTP
                    </button>
                    {otpPreview && (
                      <span className="text-xs font-mono text-teal-800 bg-teal-50 border border-teal-200 rounded px-2.5 py-1.5">
                        Demo OTP: <strong>{otpPreview}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono w-44 bg-white"
                      required
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-800"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Verify & Unlock Records
                    </button>
                  </div>
                </form>
              )}

              {consentTab === 'assisted' && (
                <form onSubmit={handleAssistedConsent} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={assistedWitness}
                    onChange={(e) => setAssistedWitness(e.target.value)}
                    placeholder="Desk Staff / Guardian Witness Name"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                  <input
                    type="text"
                    value={assistedDocType}
                    onChange={(e) => setAssistedDocType(e.target.value)}
                    placeholder="Physical ID Type"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={assistedLastFour}
                      onChange={(e) => setAssistedLastFour(e.target.value)}
                      placeholder="Last 4 digits"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white w-28 font-mono"
                      required
                    />
                    <button
                      type="submit"
                      className="flex-1 px-3 py-2 bg-teal-700 text-white rounded-lg text-xs font-medium hover:bg-teal-800"
                    >
                      Record Consent
                    </button>
                  </div>
                </form>
              )}

              {consentTab === 'break_glass' && (
                <form onSubmit={handleBreakGlass} className="space-y-3">
                  <div className="flex items-start gap-2 text-xs text-red-800">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      Controlled Break-Glass grants 2-hour minimum-necessary access for unconscious or critical emergencies. The patient and compliance officer receive an immediate post-event audit alert.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={clinicalUnit}
                      onChange={(e) => setClinicalUnit(e.target.value)}
                      placeholder="Clinical Unit (e.g. ER Bay 2)"
                      className="px-3 py-2 border border-red-200 rounded-lg text-xs bg-white"
                      required
                    />
                    <input
                      type="text"
                      value={emergencyReason}
                      onChange={(e) => setEmergencyReason(e.target.value)}
                      placeholder="Documented clinical emergency reason (min 12 chars)"
                      className="md:col-span-2 px-3 py-2 border border-red-200 rounded-lg text-xs bg-white"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-700 text-white rounded-lg text-xs font-medium hover:bg-red-800"
                  >
                    Activate Audited Break-Glass Access
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
