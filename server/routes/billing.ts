import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = Router();

const PLANS = [
  {
    code: 'patient_plus',
    audience: 'For Individuals & Families',
    name: 'Patient Vault Plus',
    price_inr: 199,
    price_usd: 4,
    billing_cycle: 'monthly',
    limits: [
      'Core Health ID, QR sharing & emergency access remain FREE always (never paywalled)',
      'Unlimited Family Vault profiles (up to 6 members)',
      '50 multilingual AI Patient Companion explanations / month',
      '10 GB encrypted radiology & DICOM archive',
    ],
  },
  {
    code: 'starter',
    audience: 'For Single Clinics & Practitioners',
    name: 'Clinic Starter',
    price_inr: 2999,
    price_usd: 39,
    billing_cycle: 'monthly',
    limits: ['Up to 5 verified clinicians', '300 QR / OTP patient intakes / month', '150 AI Clinical Summaries / month'],
  },
  {
    code: 'professional',
    audience: 'For Multi-Specialty Hospitals & Labs',
    name: 'Hospital Professional',
    price_inr: 14999,
    price_usd: 199,
    billing_cycle: 'monthly',
    limits: ['Up to 50 clinicians & lab desks', 'Unlimited QR / SMS Health ID lookups', '2,500 AI Clinical Summaries / month', 'HL7 FHIR R4 Lab Bridge'],
  },
  {
    code: 'enterprise',
    audience: 'For Hospital Networks & Health Systems',
    name: 'Enterprise Interop',
    price_inr: 49999,
    price_usd: 649,
    billing_cycle: 'monthly',
    limits: ['Unlimited facilities & staff RBAC', 'Dedicated FHIR & LIS webhooks', 'Custom retention & DPDP audit exports', 'Priority 24/7 clinical support SLA'],
  },
];

// HMAC signing secret for demo/Razorpay-compatible webhook verification
const CHECKOUT_HMAC_SECRET = process.env.RAZORPAY_KEY_SECRET || 'medilink-demo-gateway-hmac-secret';

router.get('/plans', (_req, res) => {
  const liveConfigured = Boolean(process.env.RAZORPAY_KEY_SECRET || process.env.STRIPE_SECRET_KEY);
  res.json({
    plans: PLANS,
    gateway_mode: liveConfigured ? 'live_gateway' : 'demo_mode',
    safety_pledge: 'Essential emergency medical record access and QR Health ID sharing are never paywalled.',
  });
});

router.get('/overview', requireAuth, (req: AuthedRequest, res) => {
  const subscriptions = db
    .prepare('SELECT * FROM subscriptions WHERE subscriber_user_id = ? ORDER BY created_at DESC')
    .all(req.user!.id);
  const transactions = db
    .prepare('SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user!.id);
  const invoices = db
    .prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY issued_at DESC')
    .all(req.user!.id);

  res.json({ subscriptions, transactions, invoices });
});

// Step 1: Create server-side checkout order (never mark succeeded from frontend!)
router.post('/create-order', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    plan_code: z.enum(['patient_plus', 'starter', 'professional', 'enterprise']),
    provider: z.enum(['razorpay', 'stripe']),
    currency: z.enum(['INR', 'USD']).default('INR'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid plan or payment provider.' });

  const plan = PLANS.find((p) => p.code === parsed.data.plan_code)!;
  const amountCents = parsed.data.currency === 'INR' ? plan.price_inr * 100 : plan.price_usd * 100;
  const orderId = `order_${parsed.data.provider}_${crypto.randomBytes(6).toString('hex')}`;
  const txnId = `txn-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO payment_transactions (id, user_id, provider, order_id, signature_verified, amount_cents, currency, status, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, 'pending', ?)
  `).run(txnId, req.user!.id, parsed.data.provider, orderId, amountCents, parsed.data.currency, nowIso);

  // In live Razorpay/Stripe, gateway returns payment_id + signature upon user completing hosted checkout.
  // In Demo Mode, we prepare a realistic gateway challenge payload so backend cryptographic verification still runs!
  const demoPaymentId = `pay_demo_${crypto.randomBytes(5).toString('hex')}`;
  const demoGatewaySignature = crypto
    .createHmac('sha256', CHECKOUT_HMAC_SECRET)
    .update(`${orderId}|${demoPaymentId}`)
    .digest('hex');

  const liveConfigured = Boolean(process.env.RAZORPAY_KEY_SECRET || process.env.STRIPE_SECRET_KEY);

  res.status(201).json({
    transaction_id: txnId,
    order_id: orderId,
    plan,
    amount_cents: amountCents,
    currency: parsed.data.currency,
    provider: parsed.data.provider,
    gateway_mode: liveConfigured ? 'live_gateway' : 'demo_mode',
    // Demo checkout simulator token so user can test both valid signature & failure states without storing card/CVV
    demo_checkout_payload: liveConfigured
      ? undefined
      : {
          simulated_payment_id: demoPaymentId,
          simulated_signature: demoGatewaySignature,
        },
  });
});

// Step 2: Backend cryptographic HMAC signature verification (never trust frontend redirect alone)
router.post('/verify', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    transaction_id: z.string(),
    order_id: z.string(),
    payment_id: z.string(),
    signature: z.string(),
    plan_code: z.string(),
    simulate_failure: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid verification payload.' });

  const txn = db
    .prepare('SELECT * FROM payment_transactions WHERE id = ? AND user_id = ?')
    .get(parsed.data.transaction_id, req.user!.id) as
    | { id: string; order_id: string; provider: string; amount_cents: number; currency: string }
    | undefined;

  if (!txn || txn.order_id !== parsed.data.order_id) {
    return res.status(404).json({ error: 'Order record not found.' });
  }

  if (parsed.data.simulate_failure) {
    db.prepare(`UPDATE payment_transactions SET status = 'failed', signature_verified = 0 WHERE id = ?`).run(txn.id);
    return res.status(402).json({ verified: false, status: 'failed', error: 'Gateway declined or user cancelled checkout.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', CHECKOUT_HMAC_SECRET)
    .update(`${parsed.data.order_id}|${parsed.data.payment_id}`)
    .digest('hex');

  const isValid =
    expectedSignature.length === parsed.data.signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(parsed.data.signature));

  if (!isValid) {
    db.prepare(`UPDATE payment_transactions SET status = 'failed', signature_verified = 0 WHERE id = ?`).run(txn.id);
    return res.status(400).json({ verified: false, error: 'Payment signature verification failed.' });
  }

  const nowIso = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const subId = `sub-${crypto.randomUUID()}`;
  const plan = PLANS.find((p) => p.code === parsed.data.plan_code);

  db.prepare(`
    INSERT INTO subscriptions (id, subscriber_user_id, subscriber_type, plan_code, status, provider, amount_cents, currency, current_period_end, created_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
  `).run(
    subId,
    req.user!.id,
    req.user!.role,
    parsed.data.plan_code,
    txn.provider,
    txn.amount_cents,
    txn.currency,
    periodEnd,
    nowIso
  );

  db.prepare(`
    UPDATE payment_transactions
    SET subscription_id = ?, payment_id = ?, signature_verified = 1, status = 'succeeded'
    WHERE id = ?
  `).run(subId, parsed.data.payment_id, txn.id);

  const invoiceNumber = `MLV-INV-${new Date().getFullYear()}-${String(crypto.randomInt(1000, 9999))}`;
  const invoiceId = `inv-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO invoices (id, transaction_id, user_id, invoice_number, amount_cents, currency, line_items_json, issued_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    txn.id,
    req.user!.id,
    invoiceNumber,
    txn.amount_cents,
    txn.currency,
    JSON.stringify([{ description: `${plan?.name || parsed.data.plan_code} (30-Day Subscription)`, amount_cents: txn.amount_cents }]),
    nowIso
  );

  res.json({
    verified: true,
    status: 'succeeded',
    subscription_id: subId,
    invoice_number: invoiceNumber,
  });
});

// Cancel or request refund on subscription
router.post('/subscriptions/:id/cancel', requireAuth, (req: AuthedRequest, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND subscriber_user_id = ?').get(req.params.id, req.user!.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found.' });

  db.prepare(`UPDATE subscriptions SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
  res.json({ cancelled: true });
});

router.post('/transactions/:id/refund', requireAuth, (req: AuthedRequest, res) => {
  const txn = db
    .prepare(`SELECT * FROM payment_transactions WHERE id = ? AND user_id = ? AND status = 'succeeded'`)
    .get(req.params.id, req.user!.id);
  if (!txn) return res.status(404).json({ error: 'Eligible succeeded transaction not found.' });

  db.prepare(`UPDATE payment_transactions SET status = 'refunded' WHERE id = ?`).run(req.params.id);
  res.json({ refunded: true, status: 'refunded' });
});

export default router;
