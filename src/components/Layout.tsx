import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Building2,
  CreditCard,
  FileText,
  FlaskConical,
  GitCompare,
  HeartHandshake,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Globe,
  QrCode,
} from 'lucide-react';
import { useAuthStore, type UserRole } from '../store/useAuthStore';
import { SUPPORTED_LANGUAGES, applyDocumentDirection } from '../i18n';
import { apiFetch } from '../lib/api';
import { BrandLogo } from './BrandLogo';

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/patient', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['patient'] },
  { to: '/vault', labelKey: 'nav.vault', icon: FileText, roles: ['patient'] },
  { to: '/compare', labelKey: 'nav.compare', icon: GitCompare, roles: ['patient'] },
  { to: '/companion', labelKey: 'nav.companion', icon: Sparkles, roles: ['patient'] },
  { to: '/family', labelKey: 'nav.family', icon: Users, roles: ['patient'] },
  { to: '/consent', labelKey: 'nav.consent', icon: ShieldCheck, roles: ['patient'] },

  { to: '/doctor', labelKey: 'nav.doctorDesk', icon: Stethoscope, roles: ['doctor'] },
  { to: '/hospital', labelKey: 'nav.hospitalConsole', icon: Building2, roles: ['hospital_admin'] },
  { to: '/lab', labelKey: 'nav.labPortal', icon: FlaskConical, roles: ['lab_admin'] },
  { to: '/super-admin', labelKey: 'nav.superAdmin', icon: Activity, roles: ['super_admin'] },

  { to: '/services', labelKey: 'nav.services', icon: HeartHandshake, roles: ['patient', 'doctor', 'hospital_admin', 'lab_admin', 'super_admin'] },
  { to: '/billing', labelKey: 'nav.billing', icon: CreditCard, roles: ['patient', 'doctor', 'hospital_admin', 'lab_admin', 'super_admin'] },
];

export const Layout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, activePatientLabel, ownHealthId, logout, setLanguage, toasts, dismissToast } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const currentNav = visibleNav.find((n) => location.pathname.startsWith(n.to));
  const breadcrumbLabel = currentNav ? t(currentNav.labelKey) : t('nav.dashboard');

  const handleLanguageChange = async (code: string) => {
    await i18n.changeLanguage(code);
    applyDocumentDirection(code);
    setLanguage(code);
    try {
      await apiFetch('/api/auth/language', {
        method: 'PATCH',
        body: JSON.stringify({ language: code }),
      });
    } catch {
      // Saved locally even if offline
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#EFF8FA] text-[#123047] flex flex-col lg:flex-row">
      {/* Desktop Deep Navy Sidebar (#123047) matching Concept Design */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:shrink-0 bg-[#123047] text-slate-100 min-h-screen no-print">
        <div className="h-16 px-6 flex items-center border-b border-white/10">
          <button
            onClick={() => navigate('/')}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded"
            aria-label="MediLink Vault Home"
          >
            <BrandLogo variant="light" size="md" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
          <p className="text-[11px] text-slate-300 mt-0.5 capitalize">
            {user.role.replace('_', ' ')}
            {ownHealthId ? ` · ${ownHealthId}` : ''}
          </p>
          {user.role === 'patient' && activePatientLabel && activePatientLabel !== user.full_name && (
            <p className="mt-2 text-[11px] font-medium text-teal-100 bg-[#087F8C]/40 border border-teal-400/30 rounded px-2 py-1 truncate">
              Viewing: {activePatientLabel}
            </p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Sidebar Navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#087F8C] text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1.5">
          <button
            onClick={() => navigate('/services?tab=support')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LifeBuoy className="w-4 h-4 shrink-0 text-teal-300" />
            <span>Help & Support Center</span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-red-200 hover:bg-red-500/15 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{t('common.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Single-Row Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ms-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden">
              <BrandLogo variant="default" size="sm" />
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 whitespace-nowrap">{t('brand')}</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-[#123047] truncate">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {user.role === 'patient' && (
              <button
                onClick={() => navigate('/patient?qr=1')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#087F8C] bg-[#E6F9F6] border border-[#BFE7EA] rounded-lg hover:bg-[#d5f4ef] whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Health ID QR</span>
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <Globe className="w-4 h-4 text-[#087F8C] shrink-0" />
              <select
                aria-label={t('common.language')}
                value={i18n.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#123047] focus:outline-none focus:ring-2 focus:ring-[#087F8C]"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeLabel} ({lang.label})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 max-w-[1240px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#123047] text-white h-full flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <BrandLogo variant="light" size="sm" />
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-300" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                        isActive ? 'bg-[#087F8C] text-white' : 'text-slate-300 hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-200 bg-red-500/20 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('common.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simplified Mobile Bottom Nav for Patients */}
      {user.role === 'patient' && (
        <nav
          aria-label="Mobile Quick Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around z-30 no-print"
        >
          {[
            { to: '/patient', label: 'Home', icon: LayoutDashboard },
            { to: '/vault', label: 'Reports', icon: FileText },
            { to: '/companion', label: 'AI Help', icon: Sparkles },
            { to: '/services', label: 'Services', icon: HeartHandshake },
            { to: '/consent', label: 'Access', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2.5 py-1 rounded text-[11px] font-medium min-h-[44px] justify-center ${
                    isActive ? 'text-[#087F8C]' : 'text-slate-500'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-20 lg:bottom-6 end-4 z-50 space-y-2 max-w-sm w-full pointer-events-none no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border bg-white shadow-sm ${
              toast.type === 'error'
                ? 'border-red-300 text-red-900'
                : toast.type === 'success'
                ? 'border-emerald-300 text-emerald-900'
                : 'border-slate-300 text-slate-900'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-medium flex-1">{toast.title}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
