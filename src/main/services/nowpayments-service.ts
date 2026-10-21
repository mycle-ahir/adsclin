import https from 'https';
import { getDb } from '../db/database';
import { activateSubscription } from './auth-service';

const NOWPAYMENTS_API_BASE = 'api.nowpayments.io';

export const PRODUCTION_NOWPAYMENTS_API_KEY = 'VMFNBAV-SDK48PA-J26CJX1-FQNW8Y1';

// Default / fallback API Key (configured via NOWPAYMENTS_API_KEY env, app_settings, or production constant)
function getNowPaymentsApiKey(): string {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'nowpayments_api_key'").get() as { value: string } | undefined;
    if (row?.value) return row.value;
  } catch {
    // ignore
  }
  return process.env.NOWPAYMENTS_API_KEY || PRODUCTION_NOWPAYMENTS_API_KEY;
}

function requestNowPayments(path: string, method: 'GET' | 'POST', body?: any): Promise<any> {
  const apiKey = getNowPaymentsApiKey();

  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';

    const options: https.RequestOptions = {
      hostname: NOWPAYMENTS_API_BASE,
      port: 443,
      path,
      method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('NOWPayments request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Creates a NOWPayments invoice or payment for the $9/mo subscription.
 */
export async function createSubscriptionInvoice(userId: string, payCurrency = 'usdttrc20'): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceUrl?: string;
  payAddress?: string;
  payAmount?: number;
  payCurrency?: string;
  paymentId?: string;
  error?: string;
}> {
  try {
    const orderId = `ADSCLIN-${userId.slice(0, 8)}-${Date.now()}`;
    const payload = {
      price_amount: 9.0,
      price_currency: 'usd',
      pay_currency: payCurrency.toLowerCase(),
      order_id: orderId,
      order_description: 'Adsclin Pro — 30-Day Anti-Detect Access',
      ipn_callback_url: 'https://ulfylnwaxcbzarwugofc.supabase.co/rest/v1/rpc/nowpayments_webhook',
      success_url: 'https://adsclin.com/payment-success',
      cancel_url: 'https://adsclin.com/payment-cancel',
    };

    // Try creating payment directly for exact address & amount
    const paymentRes = await requestNowPayments('/v1/payment', 'POST', payload);

    if (paymentRes.payment_id) {
      return {
        success: true,
        paymentId: paymentRes.payment_id,
        invoiceId: paymentRes.payment_id,
        invoiceUrl: paymentRes.invoice_url || `https://nowpayments.io/payment/?iid=${paymentRes.payment_id}`,
        payAddress: paymentRes.pay_address,
        payAmount: paymentRes.pay_amount,
        payCurrency: paymentRes.pay_currency,
      };
    }

    // Fallback to general hosted invoice
    const invoiceRes = await requestNowPayments('/v1/invoice', 'POST', {
      price_amount: 9.0,
      price_currency: 'usd',
      order_id: orderId,
      order_description: 'Adsclin Pro — 30-Day Anti-Detect Access',
    });

    if (invoiceRes.invoice_url || invoiceRes.id) {
      return {
        success: true,
        invoiceId: invoiceRes.id,
        invoiceUrl: invoiceRes.invoice_url,
      };
    }

    return {
      success: false,
      error: paymentRes.message || invoiceRes.message || 'Failed to initialize payment with NOWPayments.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Connection to NOWPayments failed.',
    };
  }
}

/**
 * Checks the status of a NOWPayments payment and automatically unlocks the user's account if completed.
 */
export async function verifyPaymentStatus(paymentId: string, userId: string): Promise<{
  status: string;
  isPaid: boolean;
  message: string;
}> {
  try {
    const res = await requestNowPayments(`/v1/payment/${paymentId}`, 'GET');
    const paymentStatus = res.payment_status || 'waiting';

    // Statuses in NOWPayments: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired
    const isCompleted = paymentStatus === 'finished' || paymentStatus === 'confirmed';

    if (isCompleted) {
      // Automatically activate subscription
      const session = activateSubscription(userId, 'USDT_TRC20' as any, `NP_${paymentId}`);
      if (session && session.isSubscriptionActive) {
        return {
          status: paymentStatus,
          isPaid: true,
          message: 'Payment confirmed! Adsclin Pro is now active for 30 days.',
        };
      }
    }

    if (paymentStatus === 'waiting') {
      return {
        status: paymentStatus,
        isPaid: false,
        message: 'Awaiting transaction on the blockchain…',
      };
    }

    if (paymentStatus === 'confirming') {
      return {
        status: paymentStatus,
        isPaid: false,
        message: 'Transaction detected! Confirming blocks on blockchain…',
      };
    }

    return {
      status: paymentStatus,
      isPaid: false,
      message: `Payment status: ${paymentStatus}.`,
    };
  } catch (err: any) {
    return {
      status: 'error',
      isPaid: false,
      message: err?.message || 'Could not reach NOWPayments verification server.',
    };
  }
}
