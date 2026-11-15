import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Download, ShieldCheck, X, XCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { formatRegionalCurrency, formatRegionalDate } from '../i18n';
import { useTranslation } from 'react-i18next';

interface Plan {
  code: 'patient_plus' | 'starter' | 'professional' | 'enterprise';
  audience: string;
  name: string;
  price_inr: number;
  price_usd: number;
  billing_cycle: string;
  limits: string[];
}

interface BillingOverview {
  subscriptions: Array<{ id: string; plan_code: string; status: string; provider: string; amount_cents: number; currency: string; current_period_end: string }>;
  transactions: Array<{ id: string; provider: string; order_id: string; payment_id: string | null; signature_verified: number; amount_cents: number; currency: string; status: string; created_at: string }>;
  invoices: Array<{ id: string; invoice_number: string; amount_cents: number; currency: string; line_items_json: string; issued_at: string }>;
}

export const BillingPage: React.FC = () => {
  const { i18n } = useTranslation();
  const { pushToast } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [gatewayMode, setGatewayMode] = useState<'demo_mode' | 'live_gateway'>('demo_mode');
  const [safetyPledge, setSafetyPledge] = useState('');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [overview, setOverview] = useState<BillingOverview | null>(null);

  const [checkoutOrder, setCheckoutOrder] = useState<{
    transaction_id: string;
    order_id: string;
    plan: Plan;
    amount_cents: number;
    currency: string;
    provider: string;
    demo_checkout_payload?: { simulated_payment_id: string; simulated_signature: string };
  } | null>(null);

  const loadBilling = async () => {
    try {
      const [pRes, oRes] = await Promise.all([
        apiFetch<{ plans: Plan[]; gateway_mode: 'demo_mode' | 'live_gateway'; safety_pledge: string }>('/api/billing/plans'),
        apiFetch<BillingOverview>('/api/billing/overview'),
      ]);
      setPlans(pRes.plans);
      setGatewayMode(pRes.gateway_mode);
      setSafetyPledge(pRes.safety_pledge);
      setOverview(oRes);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to load billing.');
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handleStartCheckout = async (planCode: Plan['code']) => {
    try {
      const res = await apiFetch<NonNullable<typeof checkoutOrder>>('/api/billing/create-order', {
        method: 'POST',
        body: JSON.stringify({ plan_code: planCode, provider, currency }),
      });
      setCheckoutOrder(res);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not initiate checkout order.');
    }
  };

  const handleVerifyPayment = async (simulateFailure = false) => {
    if (!checkoutOrder) return;
    try {
      const res = await apiFetch<{ verified: boolean; invoice_number: string }>('/api/billing/verify', {
        method: 'POST',
        body: JSON.stringify({
          transaction_id: checkoutOrder.transaction_id,
          order_id: checkoutOrder.order_id,
          payment_id: checkoutOrder.demo_checkout_payload?.simulated_payment_id || 'pay_unknown',
          signature: checkoutOrder.demo_checkout_payload?.simulated_signature || 'invalid',
          plan_code: checkoutOrder.plan.code,
          simulate_failure: simulateFailure,
        }),
      });
      pushToast('success', `Backend HMAC verified! Invoice ${res.invoice_number} issued.`);
      setCheckoutOrder(null);
      await loadBilling();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Payment failed or declined.');
      setCheckoutOrder(null);
      await loadBilling();
    }
  };

  const handleCancelSub = async (subId: string) => {
    try {
      await apiFetch(`/api/billing/subscriptions/${subId}/cancel`, { method: 'POST' });
      pushToast('info', 'Subscription cancelled.');
      await loadBilling();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Cancel failed.');
    }
  };

  const handleRefundTxn = async (txnId: string) => {
    try {
      await apiFetch(`/api/billing/transactions/${txnId}/refund`, { method: 'POST' });
      pushToast('info', 'Refund workflow processed.');
      await loadBilling();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Refund failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Plans, Subscriptions & Online Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Razorpay (India) & Stripe (International) hosted checkout · Backend HMAC signature verified · Zero card/CVV storage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as 'razorpay' | 'stripe';
              setProvider(p);
              setCurrency(p === 'razorpay' ? 'INR' : 'USD');
            }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
          >
            <option value="razorpay">Razorpay (INR)</option>
            <option value="stripe">Stripe (USD International)</option>
          </select>
        </div>
      </div>

      {/* Patient Safety & Gateway Mode Notice */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3 text-xs text-teal-900">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Clinical Safety Guarantee: </span>
          {safetyPledge} ({gatewayMode === 'demo_mode' ? 'Gateway currently in transparent Demo HMAC Verification Mode — configure RAZORPAY_KEY_SECRET or STRIPE_SECRET_KEY for live charges.' : 'Live Payment Gateway Active'})
        </div>
      </div>

      {/* Plan Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => {
          const price = currency === 'INR' ? `₹${p.price_inr.toLocaleString('en-IN')}` : `$${p.price_usd}`;
          return (
            <div key={p.code} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-medium text-teal-800">{p.audience}</p>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">{p.name}</h2>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                    {price} <span className="text-xs font-sans font-normal text-slate-500">/ month</span>
                  </p>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  {p.limits.map((lim, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                      <span>{lim}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handleStartCheckout(p.code)}
                className="w-full py-2 px-3 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
              >
                Select {p.name}
              </button>
            </div>
          );
        })}
      </section>

      {/* Active Subscriptions & Invoices */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Your Subscriptions & Transactions</h2>
            {overview.transactions.length === 0 ? (
              <p className="text-xs text-slate-500">No payment transactions recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {overview.transactions.map((txn) => (
                  <div key={txn.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono font-semibold text-slate-900">{txn.order_id}</p>
                      <p className="text-slate-500">
                        {txn.provider.toUpperCase()} · {formatRegionalCurrency(txn.amount_cents, txn.currency, i18n.language)} ·{' '}
                        {txn.signature_verified ? 'HMAC Verified' : 'Unverified'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold capitalize ${
                          txn.status === 'succeeded' ? 'text-emerald-800' : txn.status === 'failed' ? 'text-red-700' : 'text-amber-800'
                        }`}
                      >
                        {txn.status}
                      </span>
                      {txn.status === 'succeeded' && (
                        <button
                          onClick={() => handleRefundTxn(txn.id)}
                          className="px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-700 hover:bg-slate-50"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {overview.subscriptions.length > 0 && (
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Active / Past Subscriptions</p>
                {overview.subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between text-xs">
                    <span>
                      <strong>{sub.plan_code}</strong> · {sub.status} · renews {formatRegionalDate(sub.current_period_end, i18n.language)}
                    </span>
                    {sub.status === 'active' && (
                      <button onClick={() => handleCancelSub(sub.id)} className="text-red-700 hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Downloadable Invoices</h2>
            {overview.invoices.length === 0 ? (
              <p className="text-xs text-slate-500">Invoices are generated automatically upon backend-verified payment.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {overview.invoices.map((inv) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono font-semibold text-slate-900">{inv.invoice_number}</p>
                      <p className="text-slate-500">
                        {formatRegionalDate(inv.issued_at, i18n.language)} · {formatRegionalCurrency(inv.amount_cents, inv.currency, i18n.language)}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded text-teal-800 hover:bg-teal-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Print Invoice
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Hosted Checkout Simulator Modal */}
      {checkoutOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-700" />
                  {checkoutOrder.provider.toUpperCase()} Hosted Checkout (Demo Mode)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Order {checkoutOrder.order_id}</p>
              </div>
              <button onClick={() => setCheckoutOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-900">{checkoutOrder.plan.name}</p>
              <p className="text-lg font-bold font-mono tabular-nums text-teal-800">
                {formatRegionalCurrency(checkoutOrder.amount_cents, checkoutOrder.currency, i18n.language)}
              </p>
              <p className="text-[11px] text-slate-500">
                Card details & CVV are never collected or stored by MediLink Vault. Verification uses server-side HMAC-SHA256 signatures.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVerifyPayment(true)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Simulate Declined
              </button>
              <button
                onClick={() => handleVerifyPayment(false)}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete & Verify HMAC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
