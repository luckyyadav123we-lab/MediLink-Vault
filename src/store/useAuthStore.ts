import { create } from 'zustand';

export type UserRole = 'patient' | 'doctor' | 'hospital_admin' | 'lab_admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: UserRole;
  preferred_language: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  ownPatientId: string | null;
  ownHealthId: string | null;
  activePatientId: string | null;
  activePatientLabel: string | null;
  toasts: ToastMessage[];
  setAuth: (token: string, user: AuthUser) => void;
  setPatientMeta: (patientId: string, healthId: string) => void;
  setActivePatient: (patientId: string, label: string) => void;
  setLanguage: (lang: string) => void;
  logout: () => void;
  pushToast: (type: ToastMessage['type'], title: string) => void;
  dismissToast: (id: string) => void;
}

const storedToken = typeof window !== 'undefined' ? localStorage.getItem('medilink_token') : null;
const storedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('medilink_user') : null;
const storedUser: AuthUser | null = storedUserRaw ? JSON.parse(storedUserRaw) : null;

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  user: storedUser,
  ownPatientId: null,
  ownHealthId: null,
  activePatientId: null,
  activePatientLabel: null,
  toasts: [],
  setAuth: (token, user) => {
    localStorage.setItem('medilink_token', token);
    localStorage.setItem('medilink_user', JSON.stringify(user));
    set({ token, user });
  },
  setPatientMeta: (patientId, healthId) =>
    set((state) => ({
      ownPatientId: patientId,
      ownHealthId: healthId,
      activePatientId: state.activePatientId || patientId,
      activePatientLabel: state.activePatientLabel || state.user?.full_name || 'Self',
    })),
  setActivePatient: (patientId, label) =>
    set({ activePatientId: patientId, activePatientLabel: label }),
  setLanguage: (lang) =>
    set((state) => {
      localStorage.setItem('medilink_lang', lang);
      if (!state.user) return state;
      const updated = { ...state.user, preferred_language: lang };
      localStorage.setItem('medilink_user', JSON.stringify(updated));
      return { user: updated };
    }),
  logout: () => {
    localStorage.removeItem('medilink_token');
    localStorage.removeItem('medilink_user');
    set({
      token: null,
      user: null,
      ownPatientId: null,
      ownHealthId: null,
      activePatientId: null,
      activePatientLabel: null,
    });
  },
  pushToast: (type, title) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, title }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
