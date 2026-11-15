import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, Lock, UserPlus, LogIn, Smartphone, Globe, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore, type AuthUser, type UserRole } from '../store/useAuthStore';
import { SUPPORTED_LANGUAGES, applyDocumentDirection } from '../i18n';
import i18n from '../i18n';
import { BrandLogo } from '../components/BrandLogo';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Enter email or mobile number'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone: z.string().min(8, 'Valid mobile number is required'),
  email: z.string().email('Enter valid email').optional().or(z.literal('')),
  password: z.string().min(6, 'Minimum 6 characters'),
  date_of_birth: z.string().min(4),
  gender: z.string(),
  blood_group: z.string(),
  has_smartphone: z.boolean(),
});

const ROLE_HOME: Record<UserRole, string> = {
  patient: '/patient',
  doctor: '/doctor',
  hospital_admin: '/hospital',
  lab_admin: '/lab',
  super_admin: '/super-admin',
};

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const { setAuth, pushToast, setLanguage } = useAuthStore();
  const navigate = useNavigate();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: 'aarav.sharma@demo.medilink.in', password: 'MediLink@2026' },
  });

  const regForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      password: '',
      date_of_birth: '1988-05-15',
      gender: 'Female',
      blood_group: 'O+',
      has_smartphone: true,
    },
  });

  const completeLogin = async (token: string, user: AuthUser) => {
    setAuth(token, user);
    await i18n.changeLanguage(user.preferred_language || 'en');
    applyDocumentDirection(user.preferred_language || 'en');
    setLanguage(user.preferred_language || 'en');
    navigate(ROLE_HOME[user.role]);
  };

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await completeLogin(res.token, res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser; health_id: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...values, preferred_language: i18n.language }),
      });
      pushToast('success', `Account created. Your Health ID is ${res.health_id}`);
      await completeLogin(res.token, res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleDemoRole = async (role: UserRole) => {
    setLoadingRole(role);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      await completeLogin(res.token, res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Demo sign-in failed');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFF8FA] flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-12 flex items-center justify-between gap-8">
        <button onClick={() => navigate('/')} className="whitespace-nowrap shrink-0">
          <BrandLogo variant="default" size="md" />
        </button>

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#087F8C]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Overview
          </button>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#087F8C]" />
            <select
              aria-label="Language"
              value={i18n.language}
              onChange={(e) => {
                i18n.changeLanguage(e.target.value);
                applyDocumentDirection(e.target.value);
              }}
              className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#123047]"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeLabel} ({l.label})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <section className="lg:col-span-6 space-y-6 pt-2">
          <p className="text-xs font-semibold text-[#087F8C] tracking-wide">
            Cross-Hospital Interoperability · Consent-First Architecture
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-[#123047] tracking-tight text-balance leading-tight">
            One Health Record. Everywhere.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            MediLink Vault connects patients, physicians, hospitals, and diagnostic laboratories with verified longitudinal records, source-linked AI synthesis, and keypad-phone SMS accessibility.
          </p>

          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#123047]">Instant Demo Workspace Access (Synthetic Patient Data)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { role: 'patient' as UserRole, title: 'Patient Portal', sub: 'Aarav Sharma · MV-8K29-X7P4' },
                { role: 'doctor' as UserRole, title: 'Doctor Clinical Desk', sub: 'Dr. Meera Nair, MD' },
                { role: 'hospital_admin' as UserRole, title: 'Hospital Admin', sub: 'City Care Multi-Specialty' },
                { role: 'lab_admin' as UserRole, title: 'Diagnostic Laboratory', sub: 'MetroPath Reference Lab' },
                { role: 'super_admin' as UserRole, title: 'Platform Super Admin', sub: 'Compliance & Billing Ops' },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  disabled={loadingRole !== null}
                  onClick={() => handleDemoRole(item.role)}
                  className="text-start p-3 bg-white border border-slate-200 rounded-lg hover:border-[#087F8C] transition-colors disabled:opacity-60"
                >
                  <p className="text-sm font-semibold text-[#123047]">
                    {loadingRole === item.role ? 'Signing in…' : item.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-500 pt-2">
            <ShieldCheck className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
            <span>
              Notice: Demo workspace records are synthetic test profiles designed for clinical interoperability evaluation.
            </span>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-1 p-1 bg-[#EFF8FA] rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-[#123047] shadow-sm' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register' ? 'bg-white text-[#123047] shadow-sm' : 'text-slate-600'
              }`}
            >
              Create Patient Health ID
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-800">
              {errorMsg}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email or Mobile Number</label>
                <input
                  type="text"
                  {...loginForm.register('identifier')}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#087F8C]"
                />
                {loginForm.formState.errors.identifier && (
                  <p className="text-xs text-red-600 mt-1">{loginForm.formState.errors.identifier.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  {...loginForm.register('password')}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#087F8C]"
                />
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-red-600 mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loginForm.formState.isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#087F8C] text-white rounded-lg text-sm font-semibold hover:bg-[#06636D] disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                {loginForm.formState.isSubmitting ? 'Verifying…' : 'Sign In Securely'}
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Backend-enforced JWT + RBAC session security</span>
              </div>
            </form>
          ) : (
            <form onSubmit={regForm.handleSubmit(onRegisterSubmit)} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    {...regForm.register('full_name')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="+919800012345"
                    {...regForm.register('phone')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email (Optional for keypad users)</label>
                  <input
                    type="email"
                    {...regForm.register('email')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    {...regForm.register('password')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">DOB</label>
                  <input
                    type="date"
                    {...regForm.register('date_of_birth')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                  <select {...regForm.register('gender')} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white">
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
                  <select {...regForm.register('blood_group')} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white">
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2.5 p-3 bg-[#EFF8FA] border border-slate-200 rounded-lg cursor-pointer">
                <input type="checkbox" {...regForm.register('has_smartphone')} className="mt-0.5 accent-[#087F8C]" />
                <span className="text-xs text-slate-700">
                  <strong className="inline-flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-[#087F8C]" /> Patient uses a smartphone
                  </strong>
                  <span className="block text-slate-500 mt-0.5">
                    Uncheck to enable SMS Health ID + Printable QR Card + Assisted-Consent mode for keypad phones.
                  </span>
                </span>
              </label>
              <button
                type="submit"
                disabled={regForm.formState.isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#087F8C] text-white rounded-lg text-sm font-semibold hover:bg-[#06636D] disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {regForm.formState.isSubmitting ? 'Issuing Health ID…' : 'Register & Generate Health ID'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};
