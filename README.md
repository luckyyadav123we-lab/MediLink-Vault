# MediLink Vault

**One QR Code. Zero Lost Files. Instant AI Clinical Clarity.**

MediLink Vault is a multilingual, consent-first healthcare record management, cross-hospital interoperability, and AI clinical intelligence platform.

> **Clinical & Data Notice**: All pre-seeded records, hospitals, laboratories, and patient profiles in the workspace use synthetic demo data. Do not deploy with real patient PHI until formal security, clinical, and DPDP/ABDM regulatory reviews are complete.

---

## Architecture & Folder Structure

```text
├── server.ts                          # Express + Vite full-stack server (port 3000)
├── server/
│   ├── db.ts                          # Normalized SQLite schema (25+ relational tables), migrations & synthetic seed
│   ├── middleware/
│   │   └── auth.ts                    # JWT auth, RBAC enforcement, rate limiting, consent verification, audit logger
│   ├── services/
│   │   └── geminiAgentService.ts      # Server-only @google/genai Dual AI Layer & FunctionDeclaration tool orchestration
│   └── routes/
│       ├── auth.ts                    # Registration (smartphone + keypad), login, demo-login, ABHA linkage
│       ├── patients.ts                # Patient overview, dynamic signed QR, lookup, OTP/assisted consent, Family Vault
│       ├── records.ts                 # Vault upload (SHA-256 duplicate check), signed URLs, timeline, comparison, repetition check
│       ├── consent.ts                 # Grant/revoke consent, access audit log, controlled emergency break-glass
│       ├── ai.ts                      # Doctor Clinical Summary, Patient Companion, clinician feedback & audit history
│       ├── services.ts                # Hospital/doctor/lab directory, appointments, jurisdiction emergency contacts, support tickets
│       ├── billing.ts                 # Plans, checkout orders, backend HMAC verification, invoices, cancel & refund
│       └── admin.ts                   # Hospital admin, Diagnostic lab structured submissions, Super Admin console
└── src/
    ├── i18n/index.ts                  # i18next setup for 13 languages + Arabic RTL + regional date/currency formatters
    ├── store/useAuthStore.ts          # Zustand auth, Family Vault switcher, and toast notifications
    ├── lib/api.ts                     # Typed fetch client
    ├── components/
    │   ├── Layout.tsx                 # Responsive hospital sidebar + patient mobile bottom bar + 3-zone header
    │   └── QrComponents.tsx           # Dynamic 5-min QR card/print/SMS modal & html5-qrcode scanner + consent gate
    └── pages/                         # Role dashboards & clinical modules
```

---

## Local Development & Verification

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment variables** (see `.env.example`):
   - `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser). When unset, the AI layer transparently runs in `demo_fallback` source-grounded extraction mode.
   - `GEMINI_MODEL`: Defaults to `gemini-4-hydrogen`.
   - `JWT_SECRET`: Secret for session and short-lived QR/document tokens.
   - Optional live integrations: `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, `MSG91_AUTH_KEY`, `TWILIO_ACCOUNT_SID`.
3. **Run development server** (runs Express API + Vite SPA on port `3000`):
   ```bash
   npm run dev
   ```
4. **Typecheck & Production Build**:
   ```bash
   npm run lint
   npm run build
   ```

---

## Implemented Modules & Safety Guardrails

- **5 Role-Based Workspaces**: Patient, Doctor, Hospital Admin, Diagnostic Laboratory, and Platform Super Admin with backend-enforced RBAC.
- **Health ID & Dynamic QR Sharing**: Unique IDs (`MV-8K29-X7P4`) are never used as primary keys and never independently authorize access. Dynamic QR codes embed short-lived signed identity tokens only—never raw medical records.
- **Keypad Phone & No-Phone Accessibility**: SMS Health ID delivery, printable physical QR cards, and documented in-person assisted-consent workflows (`MV-3P91-K2M8`).
- **Dual AI Medical Report Summarization + Agent Tool Orchestration**:
  - **Doctor Clinical Summary Agent**: Tool-orchestrated extraction + structured JSON summary with clickable source citations, methodology shift flags, missing-data warnings, and clinician correction feedback.
  - **Patient Companion Agent**: Multilingual plain-language explanation alongside original reports, preserving exact medication name, dose, route, frequency, and duration.
- **Old vs New Comparison & Smart Test Repetition Assistance**: Enforces unit compatibility before computing deltas and alerts physicians to recent equivalent tests without ever auto-blocking clinical judgment.
- **Controlled Emergency Break-Glass**: Requires clinical staff role + documented emergency reason, enforces 2-hour minimum-necessary scope, logs permanent audit entries, and notifies the patient immediately.
