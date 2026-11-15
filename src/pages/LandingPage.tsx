import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  FlaskConical,
  Globe,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Lock,
  QrCode,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingDown,
  User,
  Users,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { SUPPORTED_LANGUAGES, applyDocumentDirection } from '../i18n';
import { apiFetch } from '../lib/api';
import { useAuthStore, type AuthUser, type UserRole } from '../store/useAuthStore';

const ROLE_HOME: Record<UserRole, string> = {
  patient: '/patient',
  doctor: '/doctor',
  hospital_admin: '/hospital',
  lab_admin: '/lab',
  super_admin: '/super-admin',
};

const ROLE_HERO_TABS: Array<{
  id: 'patient' | 'doctor' | 'hospital_admin';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  subcopy: string;
}> = [
  {
    id: 'patient',
    label: 'Patient',
    icon: User,
    headline: 'Your medical records. One Health ID. Shared only on your consent.',
    subcopy:
      'MediLink Vault keeps every report, prescription and scan in one secure vault, gives you a dynamic QR code for controlled sharing, and adds source-linked AI summaries — original reports always remain the source of truth.',
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    headline: 'Instant cross-hospital clinical clarity — with every fact source-cited.',
    subcopy:
      'Scan a patient’s dynamic QR or enter their Health ID, verify consent via OTP or audited break-glass, compare historical lab trends safely, and review structured AI summaries linked directly to original records.',
  },
  {
    id: 'hospital_admin',
    label: 'Hospital Staff',
    icon: Building2,
    headline: 'Interoperable patient intake, verified uploads and zero-trust audit logs.',
    subcopy:
      'Connect hospital HMS/EMR and NABL laboratories, onboard clinicians with strict backend RBAC, support keypad-phone patients via SMS and assisted consent, and monitor every access event.',
  },
];

type BiomarkerKey = 'hba1c' | 'fpg' | 'ldl';

const DEMO_BIOMARKERS: Record<
  BiomarkerKey,
  {
    label: string;
    unit: string;
    delta: string;
    status: string;
    reference: string;
    points: Array<{ date: string; value: number; lab: string }>;
  }
> = {
  hba1c: {
    label: 'HbA1c',
    unit: '%',
    delta: '-1.3% over 14 months',
    status: 'Improving toward target',
    reference: 'HPLC Method · Target < 7.0%',
    points: [
      { date: 'Sep 25', value: 8.1, lab: 'Apex Diagnostics' },
      { date: 'Jan 26', value: 7.7, lab: 'City Care Lab' },
      { date: 'May 26', value: 7.3, lab: 'MetroPath Lab' },
      { date: 'Aug 26', value: 7.0, lab: 'MetroPath Lab' },
      { date: 'Nov 26', value: 6.8, lab: 'MetroPath Lab' },
    ],
  },
  fpg: {
    label: 'Fasting Glucose',
    unit: 'mg/dL',
    delta: '-34 mg/dL over 14 months',
    status: 'Controlled fasting trend',
    reference: 'Hexokinase Assay · Ref 70–99 mg/dL',
    points: [
      { date: 'Sep 25', value: 146, lab: 'Apex Diagnostics' },
      { date: 'Jan 26', value: 134, lab: 'City Care Lab' },
      { date: 'May 26', value: 124, lab: 'MetroPath Lab' },
      { date: 'Aug 26', value: 118, lab: 'MetroPath Lab' },
      { date: 'Nov 26', value: 112, lab: 'MetroPath Lab' },
    ],
  },
  ldl: {
    label: 'LDL Cholesterol',
    unit: 'mg/dL',
    delta: '-29 mg/dL over 14 months',
    status: 'Optimal lipid response',
    reference: 'Direct Enzymatic · Target < 100 mg/dL',
    points: [
      { date: 'Sep 25', value: 128, lab: 'Apex Diagnostics' },
      { date: 'Jan 26', value: 119, lab: 'City Care Lab' },
      { date: 'May 26', value: 111, lab: 'MetroPath Lab' },
      { date: 'Aug 26', value: 104, lab: 'MetroPath Lab' },
      { date: 'Nov 26', value: 99, lab: 'MetroPath Lab' },
    ],
  },
};

export const LandingPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { user, token, setAuth, setLanguage, pushToast } = useAuthStore();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [activeHeroTab, setActiveHeroTab] = useState<'patient' | 'doctor' | 'hospital_admin'>('patient');
  const [enteringRole, setEnteringRole] = useState<UserRole | null>(null);
  const [sampleQrUrl, setSampleQrUrl] = useState<string>('');
  const [selectedBiomarker, setSelectedBiomarker] = useState<BiomarkerKey>('hba1c');
  const [aiPreviewMode, setAiPreviewMode] = useState<'doctor' | 'patient'>('doctor');

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    restDelta: 0.001,
  });

  useEffect(() => {
    QRCode.toDataURL(
      JSON.stringify({ v: 1, health_id: 'MV-8K29-X7P4', preview: true }),
      { width: 128, margin: 1, color: { dark: '#0F2334', light: '#FFFFFF' } }
    )
      .then(setSampleQrUrl)
      .catch(() => {});
  }, []);

  const handleLanguageSelect = async (code: string) => {
    await i18n.changeLanguage(code);
    applyDocumentDirection(code);
    setLanguage(code);
  };

  const handleRoleDemoEntry = async (role: UserRole) => {
    setEnteringRole(role);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setAuth(res.token, res.user);
      navigate(ROLE_HOME[res.user.role]);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to enter demo workspace.');
    } finally {
      setEnteringRole(null);
    }
  };

  const currentHero = ROLE_HERO_TABS.find((t) => t.id === activeHeroTab) || ROLE_HERO_TABS[0];
  const biomarkerData = DEMO_BIOMARKERS[selectedBiomarker];

  const scrollReveal = (delay = 0) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.16 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="min-h-screen bg-[#EFF8FA] text-[#0F2334]">
      {/* Clean 3-Zone Top Bar matching Screenshot */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-12 flex items-center justify-between gap-8 sticky top-0 z-30">
        <a href="#top" className="whitespace-nowrap shrink-0">
          <BrandLogo variant="default" size="md" />
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#roles" className="hover:text-[#0E7C86] transition-colors whitespace-nowrap shrink-0">
            Workspaces
          </a>
          <a href="#capabilities" className="hover:text-[#0E7C86] transition-colors whitespace-nowrap shrink-0">
            Capabilities
          </a>
          <a href="#languages" className="hover:text-[#0E7C86] transition-colors whitespace-nowrap shrink-0">
            Languages
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {user && token ? (
            <button
              type="button"
              onClick={() => navigate(ROLE_HOME[user.role])}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0E7C86] rounded-lg hover:bg-[#0B6770] transition-colors whitespace-nowrap shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Open Workspace
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="hidden sm:inline-block text-sm font-medium text-slate-700 hover:text-[#0E7C86] px-2 py-1 whitespace-nowrap shrink-0"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => navigate('/login?tab=register')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0E7C86] rounded-lg hover:bg-[#0B6770] transition-colors whitespace-nowrap shrink-0"
              >
                Register
              </button>
            </>
          )}
        </div>

        {/* Subtle Scroll Progress Indicator */}
        {!shouldReduceMotion && (
          <motion.div
            style={{ scaleX }}
            className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0E7C86] origin-left pointer-events-none"
          />
        )}
      </header>

      {/* Hero Section matching Deep Navy-Teal Gradient Screenshot */}
      <section
        id="top"
        className="bg-gradient-to-br from-[#0F2334] via-[#134150] to-[#11646C] text-white"
      >
        <div className="max-w-6xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            {/* Interactive Role Switcher Segmented Tabs */}
            <div
              role="tablist"
              aria-label="Preview workspace by role"
              className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-white/10 border border-white/15"
            >
              {ROLE_HERO_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeHeroTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setActiveHeroTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-[#0F2334] shadow-sm'
                        : 'text-slate-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[48px] font-bold text-white tracking-tight text-balance leading-[1.12]">
              {currentHero.headline}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
              {currentHero.subcopy}
            </p>

            {/* Primary 3 Action Buttons matching Screenshot */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={enteringRole !== null}
                onClick={() => handleRoleDemoEntry('patient')}
                className="px-5 py-2.5 bg-[#0E7C86] hover:bg-[#0B6770] text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {enteringRole === 'patient' ? 'Opening…' : "I'm a Patient"}
              </button>
              <button
                type="button"
                disabled={enteringRole !== null}
                onClick={() => handleRoleDemoEntry('doctor')}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/15 border border-white/30 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {enteringRole === 'doctor' ? 'Opening…' : 'Doctor Workspace'}
              </button>
              <button
                type="button"
                disabled={enteringRole !== null}
                onClick={() => handleRoleDemoEntry('hospital_admin')}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/15 border border-white/30 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {enteringRole === 'hospital_admin' ? 'Opening…' : 'Hospital Staff'}
              </button>
            </div>

            {/* Clean Unboxed Trust Metadata Row */}
            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-teal-100/90">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-300" />
                AES-256 encrypted vault
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-300" />
                Consent-scoped access
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-300" />
                Full audit trail
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-300" />
                India-first (₹ billing)
              </span>
            </div>
          </div>

          {/* Right Elevated Clinical Card matching Screenshot */}
          <div className="lg:col-span-5">
            <div className="bg-white text-[#0F2334] rounded-2xl p-4 sm:p-5 shadow-xl max-w-md mx-auto lg:ms-auto space-y-4">
              {/* Crisp Hospital Clinical Scene Banner */}
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-[#E6F4F6] to-[#D4ECF0] border border-slate-200/80 p-5 flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-[#0E7C86]">Verified Longitudinal Intake</p>
                  <p className="text-sm font-bold text-[#0F2334] leading-snug">
                    Cross-Hospital Record Sharing & Clinical Review
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Lab Reports · Prescriptions · Discharge Summaries
                  </p>
                </div>
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-8 h-8 text-[#0E7C86]" />
                </div>
              </div>

              {/* Dynamic Health ID Card Box matching Screenshot */}
              <div className="bg-[#EFF8FA] border border-[#BEE3E7] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wider text-[#0E7C86] uppercase">
                    Dynamic Health ID
                  </p>
                  <p className="font-mono text-lg font-bold tracking-wide text-[#0F2334] mt-1">
                    MV-8K29-X7P4
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Time-bound QR · refresh anytime
                  </p>
                </div>
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center shrink-0">
                  {sampleQrUrl ? (
                    <img src={sampleQrUrl} alt="Sample Dynamic Health ID QR" className="w-full h-full" />
                  ) : (
                    <QrCode className="w-10 h-10 text-[#0F2334]" />
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed px-0.5">
                AI summaries are non-diagnostic assistance for verified doctors — original reports always remain the source of truth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Below-the-Fold Scroll Experience */}
      <main className="max-w-6xl mx-auto px-6 py-14 space-y-20">
        {/* 5 Role Workspaces */}
        <section id="roles" className="space-y-6">
          <motion.div {...scrollReveal(0)} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#0F2334]">Choose Your Workspace</h2>
              <p className="text-sm text-slate-600 mt-1">
                Explore any of the 5 role-based dashboards with synthetic clinical records, or sign in with your own account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs font-semibold text-[#0E7C86] hover:underline"
            >
              Sign in with Email or Mobile →
            </button>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                role: 'patient' as UserRole,
                title: 'Patient',
                desc: 'Medical vault, QR sharing, AI Companion & Family Health Vault',
                icon: User,
              },
              {
                role: 'doctor' as UserRole,
                title: 'Doctor',
                desc: 'QR/Health ID lookup, OTP & break-glass gate, source-cited AI summary',
                icon: Stethoscope,
              },
              {
                role: 'hospital_admin' as UserRole,
                title: 'Hospital Staff',
                desc: 'Staff RBAC onboarding, FHIR bridges, record uploads & audit logs',
                icon: Building2,
              },
              {
                role: 'lab_admin' as UserRole,
                title: 'Diagnostic Lab',
                desc: 'Structured observation submission with canonical codes & analytics',
                icon: FlaskConical,
              },
              {
                role: 'super_admin' as UserRole,
                title: 'Platform Admin',
                desc: 'Facility verification, break-glass alerts, AI metrics & tickets',
                icon: Settings,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.role}
                  type="button"
                  disabled={enteringRole !== null}
                  onClick={() => handleRoleDemoEntry(item.role)}
                  {...scrollReveal(idx * 0.06)}
                  whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                  className="text-start bg-white border border-slate-200 rounded-xl p-5 hover:border-[#0E7C86] transition-colors flex flex-col justify-between space-y-4 disabled:opacity-60 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EFF8FA] text-[#0E7C86] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0F2334]">{item.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#0E7C86] inline-flex items-center gap-1">
                    {enteringRole === item.role ? 'Opening…' : 'Open Demo'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Scroll Visual 1: How Consent-First Sharing Works */}
        <section id="workflow" className="space-y-6">
          <motion.div {...scrollReveal(0)} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0E7C86]">
              Consent Architecture
            </p>
            <h2 className="text-2xl font-bold text-[#0F2334] mt-1">
              From Scan to Verified Clinical Context in 3 Audited Steps
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              Every cross-hospital handoff requires time-bound patient verification or an audited emergency justification — never silent record scraping.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 Visual Card */}
            <motion.div
              {...scrollReveal(0.05)}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xs"
            >
              <div className="bg-[#EFF8FA] border border-[#CBE7EA] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0E7C86]">
                  <span className="inline-flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5" /> STEP 01 · TOKEN
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[#0F2334]">
                    <Clock className="w-3 h-3 text-[#0E7C86]" /> 04:58
                  </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-mono text-xs font-bold text-[#0F2334]">MV-8K29-X7P4</p>
                    <p className="text-[11px] text-slate-500">Signed QR · Single Session</p>
                  </div>
                  <div className="w-10 h-10 rounded-md bg-[#EFF8FA] border border-[#BEE3E7] flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-[#0F2334]" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Or keypad SMS ID</span>
                  <span className="font-mono font-semibold text-[#0F2334]">SMS: MV-3P91</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#0F2334]">1. Present Dynamic QR or Health ID</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Patients share a 5-minute rotating QR code from the app, or dictate their Health ID via printed card or keypad-phone SMS.
                </p>
              </div>
            </motion.div>

            {/* Step 2 Visual Card */}
            <motion.div
              {...scrollReveal(0.14)}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xs"
            >
              <div className="bg-[#0F2334] text-white rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-teal-300">
                  <span className="inline-flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" /> STEP 02 · VERIFY
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Lock className="w-3 h-3" /> Scoped 30m
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                  {['4', '8', '2', '9', '1', '7'].map((digit, i) => (
                    <div
                      key={i}
                      className="h-9 rounded-md bg-white/10 border border-white/20 flex items-center justify-center font-mono text-sm font-bold text-white"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
                  <span>Scope: Labs + Rx</span>
                  <span className="text-amber-300 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Or Audited Break-Glass
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#0F2334]">2. Patient OTP or Break-Glass Gate</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Physicians unlock scoped access with patient OTP verification, or trigger a time-limited emergency override logged to Super Admin.
                </p>
              </div>
            </motion.div>

            {/* Step 3 Visual Card */}
            <motion.div
              {...scrollReveal(0.23)}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-xs"
            >
              <div className="bg-[#EFF8FA] border border-[#CBE7EA] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0E7C86]">
                  <span className="inline-flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" /> STEP 03 · GROUNDED VIEW
                  </span>
                  <span className="font-mono text-[#0F2334]">3 Sources</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { doc: 'MetroPath HbA1c Assay', date: 'Nov 2026', tag: 'Verified PDF' },
                    { doc: 'City Care Discharge Rx', date: 'Aug 2026', tag: 'Signed Rx' },
                    { doc: 'Apex Lipid Panel', date: 'Sep 2025', tag: 'Baseline' },
                  ].map((row) => (
                    <div
                      key={row.doc}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-medium text-[#0F2334] truncate">{row.doc}</span>
                      <span className="text-[#0E7C86] font-mono shrink-0 ms-2">{row.tag}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#0F2334]">3. Cross-Hospital View & Source Truth</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Doctors see longitudinal biomarker trends and source-cited AI summaries while opening original hospital PDFs with one click.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Scroll Visual 2: Interactive Clinical Intelligence & Biomarker Trend Showcase */}
        <section id="visual-preview" className="space-y-6">
          <motion.div {...scrollReveal(0)} className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0E7C86]">
              Clinical Intelligence Preview
            </p>
            <h2 className="text-2xl font-bold text-[#0F2334] mt-1">
              Longitudinal Lab Comparison & Dual-Role AI Synthesis
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              Compare historical values across labs with unit & method safeguards, and inspect how MediLink separates clinical doctor briefs from patient explanations.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Visual: Interactive Recharts Biomarker Chart */}
            <motion.div
              {...scrollReveal(0.06)}
              className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E7C86]">
                    <Activity className="w-4 h-4" />
                    <span>Old vs. New Biomarker Trajectory</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0F2334] mt-1">
                    {biomarkerData.label} ({biomarkerData.unit})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synthetic Demo Record · {biomarkerData.reference}
                  </p>
                </div>

                {/* Biomarker Selector Tabs */}
                <div className="inline-flex items-center gap-1 p-1 bg-[#EFF8FA] border border-slate-200 rounded-lg">
                  {(['hba1c', 'fpg', 'ldl'] as BiomarkerKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedBiomarker(key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        selectedBiomarker === key
                          ? 'bg-[#0E7C86] text-white'
                          : 'text-slate-600 hover:text-[#0F2334]'
                      }`}
                    >
                      {key === 'hba1c' ? 'HbA1c' : key === 'fpg' ? 'Glucose' : 'LDL-C'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recharts Responsive Area Chart */}
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={biomarkerData.points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="medilinkTealArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0E7C86" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#0E7C86" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F2334',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: '#5EEAD4', fontWeight: 600 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0E7C86"
                      strokeWidth={2.5}
                      fill="url(#medilinkTealArea)"
                      dot={{ r: 4, fill: '#0E7C86', strokeWidth: 2, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6, fill: '#0F2334', stroke: '#5EEAD4', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Grounded Delta Bar */}
              <div className="bg-[#EFF8FA] border border-[#CBE7EA] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F2334]">
                  <TrendingDown className="w-4 h-4 text-[#0E7C86]" />
                  {biomarkerData.delta}
                </span>
                <span className="text-[#0E7C86] font-medium">{biomarkerData.status}</span>
              </div>
            </motion.div>

            {/* Right Visual: Dual AI Layer Interactive Preview */}
            <motion.div
              {...scrollReveal(0.14)}
              className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E7C86]">
                    <Sparkles className="w-4 h-4" />
                    <span>Dual AI Layer Preview</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0F2334] mt-1">
                    {aiPreviewMode === 'doctor'
                      ? 'Doctor Clinical Brief (Source-Cited)'
                      : 'Patient Plain-Language Companion'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Role-isolated prompts · Original PDFs remain authoritative
                  </p>
                </div>

                {/* Mode Switcher */}
                <div className="inline-flex items-center gap-1 p-1 bg-[#EFF8FA] border border-slate-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAiPreviewMode('doctor')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      aiPreviewMode === 'doctor'
                        ? 'bg-[#0F2334] text-white'
                        : 'text-slate-600 hover:text-[#0F2334]'
                    }`}
                  >
                    Doctor Brief
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiPreviewMode('patient')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      aiPreviewMode === 'patient'
                        ? 'bg-[#0E7C86] text-white'
                        : 'text-slate-600 hover:text-[#0F2334]'
                    }`}
                  >
                    Patient View
                  </button>
                </div>
              </div>

              {aiPreviewMode === 'doctor' ? (
                <div className="space-y-3">
                  <div className="bg-[#EFF8FA] border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[#0F2334]">Glycemic & Metabolic Synthesis</p>
                      <span className="font-mono text-[11px] text-[#0E7C86] shrink-0">[doc-rec-4 · MetroPath]</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      HbA1c improved from <strong>8.1%</strong> (Sep 2025, Apex) to <strong>6.8%</strong> (Nov 2026, MetroPath, HPLC). Current regimen: Metformin 500mg BD + Atorvastatin 10mg HS.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-medium text-[#0E7C86]">
                      <span className="bg-white border border-[#CBE7EA] px-2 py-0.5 rounded">
                        Source: MetroPath HbA1c PDF
                      </span>
                      <span className="bg-white border border-[#CBE7EA] px-2 py-0.5 rounded">
                        Source: City Care Rx
                      </span>
                    </div>
                  </div>

                  {/* Smart Test Repetition Assistance Banner */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-950">
                        Smart Test Repetition Assist: HbA1c performed 18 days ago
                      </p>
                      <p className="text-amber-900 mt-0.5">
                        Recent valid result (6.8%) available from MetroPath Lab. Re-ordering is optional — treating doctor always decides.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-[#EFF8FA] border border-[#CBE7EA] rounded-xl p-4 space-y-2.5 text-xs">
                    <p className="font-semibold text-[#0F2334]">Your Health Update in Simple Words</p>
                    <p className="text-slate-700 leading-relaxed">
                      Your 3-month average blood sugar (HbA1c) has steadily improved to <strong>6.8%</strong>. Your cholesterol (LDL 99 mg/dL) is also within your target range.
                    </p>
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <p className="font-semibold text-[#0F2334]">Active Prescriptions (Original Dosages Preserved)</p>
                      <p className="text-slate-600">• Metformin 500mg — Twice daily after meals</p>
                      <p className="text-slate-600">• Atorvastatin 10mg — Once nightly</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-[#0E7C86] shrink-0 mt-0.5" />
                    <span>
                      Available in 13 languages including Hindi, Marathi, Tamil, Telugu & Arabic (RTL). Non-diagnostic explanation — consult your doctor for treatment changes.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <span className="text-slate-500">Zero-hallucination citation guardrails active</span>
                <button
                  type="button"
                  onClick={() => handleRoleDemoEntry(aiPreviewMode === 'doctor' ? 'doctor' : 'patient')}
                  className="font-semibold text-[#0E7C86] hover:underline inline-flex items-center gap-1"
                >
                  Try Live in Workspace <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Core Platform Capabilities */}
        <section id="capabilities" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { icon: ShieldCheck, title: 'Zero-Trust Consent', desc: 'Short-lived QR tokens, OTP verification & instant revocation' },
            { icon: Sparkles, title: 'Dual AI Synthesis', desc: 'Separate Doctor Clinical Summary & Patient Companion agents' },
            { icon: Building2, title: 'Multi-Hospital Sync', desc: 'Old vs New comparison with unit & lab-method safeguards' },
            { icon: Globe, title: '13 Languages + RTL', desc: 'Multilingual UI & plain-language summaries preserving dosages' },
            { icon: Users, title: 'Keypad & Family Access', desc: 'SMS Health ID, printed cards & granular caregiver controls' },
          ].map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                {...scrollReveal(idx * 0.05)}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-xs"
              >
                <Icon className="w-5 h-5 text-[#0E7C86]" />
                <h3 className="text-sm font-semibold text-[#0F2334]">{f.title}</h3>
                <p className="text-xs text-slate-600">{f.desc}</p>
              </motion.div>
            );
          })}
        </section>

        {/* Scroll Visual 3: Inclusive Access (Smartphone + Keypad Phone SMS + Wallet Card) */}
        <motion.section
          {...scrollReveal(0.05)}
          className="bg-gradient-to-br from-[#0F2334] via-[#133D4B] to-[#0E646E] text-white rounded-2xl p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center overflow-hidden"
        >
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
              Built for Every Patient & Family
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight text-balance">
              Works on Smartphones, Keypad Phones & Printed Emergency Cards
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed">
              Elderly relatives or rural patients without smartphones are never left behind. Hospitals issue a printed QR wallet card and keypad SMS Health ID (`MV-3P91-K2M8`), while family caregivers manage uploads with strict permission scopes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 space-y-1">
                <p className="font-semibold text-white inline-flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-teal-300" /> Keypad SMS Consent
                </p>
                <p className="text-slate-200">
                  Receive Health ID & 6-digit approval OTPs via standard SMS without internet.
                </p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 space-y-1">
                <p className="font-semibold text-white inline-flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-teal-300" /> Family Health Vault
                </p>
                <p className="text-slate-200">
                  Switch dependents safely with granular view/upload/consent permissions.
                </p>
              </div>
            </div>
          </div>

          {/* Crisp Vector Multi-Device Showcase */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Keypad Phone SMS Mockup */}
              <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-teal-200">
                  <span className="font-semibold">KEYPAD SMS MODE</span>
                  <span className="font-mono">2G / Offline</span>
                </div>
                <div className="bg-[#0B1C2A] border border-white/15 rounded-xl p-3.5 font-mono text-[11px] text-teal-100 space-y-1.5">
                  <p className="text-slate-400">From: MEDILINK</p>
                  <p>Health ID: MV-3P91-K2M8</p>
                  <p>Dr. Meera Nair requests Rx & Lab view (30m).</p>
                  <p className="text-teal-300 font-bold">OTP: 629104</p>
                </div>
                <p className="text-[11px] text-slate-200">
                  Assisted front-desk verification supported at partner clinics.
                </p>
              </div>

              {/* Printable Laminated Card Mockup */}
              <div className="bg-white text-[#0F2334] rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <BrandLogo variant="default" size="sm" />
                  <span className="text-[10px] font-semibold text-[#0E7C86] uppercase">Wallet Card</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#0F2334]">Kamla Devi · 67 yrs</p>
                  <p className="font-mono text-sm font-bold text-[#0E7C86]">MV-3P91-K2M8</p>
                  <p className="text-[11px] text-slate-600">Blood Group: B+ · Emergency Contact Verified</p>
                </div>
                <div className="bg-[#EFF8FA] border border-[#CBE7EA] rounded-lg px-3 py-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Print-ready A6 layout</span>
                  <QrCode className="w-5 h-5 text-[#0F2334]" />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Multilingual Language Selector Grid */}
        <motion.section
          id="languages"
          {...scrollReveal(0.05)}
          className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-5 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F2334]">Multilingual Support</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Switch interface language and Patient Companion explanations (automatic RTL layout for Arabic).
              </p>
            </div>
            <span className="text-xs font-semibold text-[#0E7C86]">
              Active: {SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.nativeLabel || 'English'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = i18n.language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`px-3 py-2.5 rounded-lg border text-center transition-colors ${
                    isSelected
                      ? 'bg-[#0E7C86] border-[#0E7C86] text-white'
                      : 'bg-[#EFF8FA] border-slate-200 text-[#0F2334] hover:border-[#0E7C86]'
                  }`}
                >
                  <span className="block text-sm font-semibold">{lang.nativeLabel}</span>
                  <span className={`block text-[11px] ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                    {lang.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 px-6 lg:px-12 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <BrandLogo variant="default" size="sm" />
          <p>
            MediLink Vault · Synthetic Demo Workspace · Original source reports remain the clinical truth.
          </p>
        </div>
      </footer>
    </div>
  );
};
