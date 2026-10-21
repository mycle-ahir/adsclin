import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import type { CryptoCurrency } from '../../shared/types';
import adsclinLogo from '../assets/adsclin-logo.png';

export function PaywallModal() {
  const {
    session,
    wallets,
    fetchWallets,
    activateSubscription,
    submitting,
    error,
    clearError,
    closePaywall,
  } = useAuthStore();

  const [selectedCurrency, setSelectedCurrency] = useState<CryptoCurrency>('USDT_TRC20');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // NOWPayments automated checkout states
  const [payMethod, setPayMethod] = useState<'nowpayments' | 'manual'>('nowpayments');
  const [nowLoading, setNowLoading] = useState(false);
  const [nowInvoice, setNowInvoice] = useState<{
    invoiceUrl?: string | undefined;
    paymentId?: string | undefined;
    payAddress?: string | undefined;
    payAmount?: number | undefined;
    payCurrency?: string | undefined;
  } | null>(null);
  const [nowVerifying, setNowVerifying] = useState(false);
  const [nowStatusMsg, setNowStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (wallets.length === 0) {
      void fetchWallets();
    }
  }, [wallets.length, fetchWallets]);

  const activeWallet = wallets.find((w) => w.currency === selectedCurrency) || wallets[0];

  const handleCopy = () => {
    if (!activeWallet) return;
    navigator.clipboard.writeText(activeWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNowPayment = async () => {
    setNowLoading(true);
    clearError();
    setNowStatusMsg(null);
    try {
      const userId = session?.user?.id || 'guest';
      const res = await window.api.nowpaymentsCreateInvoice(userId, 'usdttrc20');
      if (res.success) {
        setNowInvoice({
          invoiceUrl: res.invoiceUrl,
          paymentId: res.paymentId || res.invoiceId,
          payAddress: res.payAddress,
          payAmount: res.payAmount,
          payCurrency: res.payCurrency,
        });
        if (res.invoiceUrl) {
          window.open(res.invoiceUrl, '_blank');
        }
      } else {
        setNowStatusMsg(res.error || 'Failed to create payment invoice.');
      }
    } catch (err: any) {
      setNowStatusMsg(err?.message || 'Failed to connect to NOWPayments.');
    } finally {
      setNowLoading(false);
    }
  };

  const handleVerifyNowPayment = async () => {
    if (!nowInvoice?.paymentId) return;
    setNowVerifying(true);
    setNowStatusMsg('Checking payment confirmation on blockchain…');
    try {
      const userId = session?.user?.id || 'guest';
      const res = await window.api.nowpaymentsVerifyPayment(nowInvoice.paymentId, userId);
      if (res.isPaid) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          void useAuthStore.getState().fetchSession();
          closePaywall();
        }, 2000);
      } else {
        setNowStatusMsg(res.message);
      }
    } catch (err: any) {
      setNowStatusMsg(err?.message || 'Verification check failed.');
    } finally {
      setNowVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);

    const trimmed = txHash.trim();
    if (!trimmed) {
      return;
    }

    try {
      await activateSubscription(selectedCurrency, trimmed);
      setSuccessMsg('Payment verified! Adsclin Pro is now active on your account for 30 days.');
      setTimeout(() => {
        closePaywall();
      }, 2500);
    } catch (err: any) {
      // Error handled by store
    }
  };

  const isLocked = session && !session.canLaunchBrowser;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-2xl bg-[#06140e] border border-[#103425] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#e2f9ed] font-mono">
        {/* Modal Top Header */}
        <div className="relative bg-[#040e09] border-b border-[#103425] p-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <img src={adsclinLogo} alt="Adsclin" className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(0,255,136,0.6)]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
                  Adsclin Pro
                </h2>
                <span className="bg-[#00ff88] text-gray-950 text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  $9 / month
                </span>
              </div>
              <p className="text-xs text-emerald-500/80 mt-0.5">
                Full anti-detect engine, proxy forwarder, automation API & unlimited profiles
              </p>
            </div>
          </div>

          {!isLocked && (
            <button
              onClick={closePaywall}
              className="text-gray-400 hover:text-white p-1 rounded-xl hover:bg-[#081b13] transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Reason Alert Banner */}
          {session?.trialDeniedReason ? (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h4 className="text-sm font-bold text-amber-200">Hardware Free Trial Claimed</h4>
                <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                  {session.trialDeniedReason}
                </p>
              </div>
            </div>
          ) : session && !session.canLaunchBrowser ? (
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl">⌛</span>
              <div>
                <h4 className="text-sm font-bold text-rose-200">1-Month Free Trial Expired</h4>
                <p className="text-xs text-rose-300/80 mt-0.5 leading-relaxed">
                  Your 30-day trial period has concluded. Subscribe to the $9/mo plan with cryptocurrency below to unlock immediate access.
                </p>
              </div>
            </div>
          ) : null}

          {/* Payment Method Switcher */}
          <div className="flex items-center gap-2 p-1 bg-[#040e0a] border border-[#103425] rounded-2xl">
            <button
              type="button"
              onClick={() => setPayMethod('nowpayments')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-2 cursor-pointer ${
                payMethod === 'nowpayments'
                  ? 'bg-[#00ff88] text-black shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>⚡ Automated Crypto Checkout (NOWPayments)</span>
            </button>
            <button
              type="button"
              onClick={() => setPayMethod('manual')}
              className={`py-2 px-4 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-2 cursor-pointer ${
                payMethod === 'manual'
                  ? 'bg-[#00ff88] text-black shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>📋 Direct Wallet Transfer</span>
            </button>
          </div>

          {/* Tab 1: NOWPayments Automated Checkout */}
          {payMethod === 'nowpayments' ? (
            <div className="space-y-4">
              <div className="bg-[#081b13] border border-[#123827] rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
                    <span className="text-xs font-bold text-white font-sans">Automated Instant Activation</span>
                  </div>
                  <span className="text-xs font-black text-[#00ff88] font-mono">$9.00 USD / Month</span>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed font-sans">
                  Pay securely with over <strong>100+ cryptocurrencies</strong> including USDT (TRC-20 & ERC-20), Bitcoin, Ethereum, Solana, TON, and Litecoin. Your license activates automatically as soon as the blockchain confirms your transaction.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['USDT (TRC20)', 'Bitcoin (BTC)', 'Ethereum (ETH)', 'Solana (SOL)', 'TON', 'Litecoin (LTC)'].map((coin) => (
                    <span key={coin} className="text-[10px] font-mono bg-[#040e0a] text-emerald-400 px-2 py-0.5 rounded-md border border-[#103425]">
                      {coin}
                    </span>
                  ))}
                  <span className="text-[10px] font-mono text-gray-500 py-0.5 px-1">+100 more</span>
                </div>

                {!nowInvoice ? (
                  <button
                    type="button"
                    disabled={nowLoading}
                    onClick={handleCreateNowPayment}
                    className="w-full mt-2 bg-[#00ff88] hover:bg-[#05eb8a] text-black font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_16px_rgba(0,255,136,0.35)] flex items-center justify-center gap-2 font-mono cursor-pointer disabled:opacity-50"
                  >
                    {nowLoading ? (
                      <span>Connecting to NOWPayments…</span>
                    ) : (
                      <>
                        <span>Proceed to Secure Crypto Checkout ($9.00)</span>
                        <span className="text-base font-bold">➔</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="pt-2 border-t border-[#103425] space-y-3">
                    <div className="bg-[#040e0a] border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Invoice ID:</span>
                        <span className="text-[#00ff88] font-mono select-all">{nowInvoice.paymentId}</span>
                      </div>
                      {nowInvoice.payAddress && (
                        <div className="space-y-1">
                          <span className="text-[11px] text-gray-400">Deposit Address ({nowInvoice.payCurrency?.toUpperCase()}):</span>
                          <div className="bg-[#081b13] p-2 rounded-lg text-xs font-mono text-white break-all select-all border border-[#143d2c]">
                            {nowInvoice.payAddress}
                          </div>
                        </div>
                      )}
                      {nowInvoice.payAmount && (
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-gray-400">Send Exactly:</span>
                          <span className="text-[#00ff88] font-mono font-bold">{nowInvoice.payAmount} {nowInvoice.payCurrency?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {nowInvoice.invoiceUrl && (
                        <a
                          href={nowInvoice.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 text-center bg-[#0d2a1d] hover:bg-[#123927] border border-[#00ff88]/40 text-[#00ff88] font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          🌐 Open Hosted Payment Page
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={nowVerifying}
                        onClick={handleVerifyNowPayment}
                        className="flex-1 bg-[#00ff88] hover:bg-[#05eb8a] text-black font-black py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,255,136,0.3)] cursor-pointer disabled:opacity-50"
                      >
                        <span>{nowVerifying ? 'Checking Blockchain…' : '🔄 Check Payment Status'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {nowStatusMsg && (
                <div className="bg-[#081b13] border border-[#103425] rounded-xl p-3 text-xs text-gray-300 flex items-center gap-2">
                  <span className="text-[#00ff88]">ℹ</span>
                  <span>{nowStatusMsg}</span>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Direct Wallet Transfer (Manual TXID fallback) */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                  Select Crypto Wallet ($9.00 USD)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {wallets.map((w) => {
                    const isSelected = selectedCurrency === w.currency;
                    return (
                      <button
                        key={w.currency}
                        type="button"
                        onClick={() => {
                          setSelectedCurrency(w.currency);
                          clearError();
                        }}
                        className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-[#1e2029] border-[#2e3140] text-gray-400 hover:text-gray-200 hover:border-[#3d4154]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-gray-200">{w.name}</span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono mt-0.5">{w.network}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeWallet && (
                <div className="bg-[#1b1c24] border border-[#2d303f] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-300">
                      Send $9.00 in {activeWallet.name} ({activeWallet.network}):
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">$9.00 USD</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-[#121318] border border-[#303344] rounded-xl px-3.5 py-2.5 font-mono text-xs text-emerald-300 break-all select-all">
                      {activeWallet.address}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                        copied
                          ? 'bg-emerald-500 text-gray-950 font-black'
                          : 'bg-[#292c3a] hover:bg-[#34384a] text-white border border-[#3d4156]'
                      }`}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                    Transaction ID / Hash (TXID)
                  </label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="Paste your transaction hash here"
                    className="w-full bg-[#1e2029] border border-[#343746] focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-xs font-mono placeholder-gray-500 outline-none transition-all"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !txHash.trim()}
                  className="w-full bg-gradient-to-r from-[#00ff88] to-[#10b981] hover:brightness-110 text-gray-950 font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_18px_rgba(0,255,136,0.35)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 font-mono cursor-pointer"
                >
                  {submitting ? 'Verifying on Blockchain…' : 'Activate 30-Day Pro Access ($9.00) ⚡'}
                </button>
              </form>
            </div>
          )}

          {error && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
              <span className="text-rose-400 font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#00ff88]/15 border border-[#00ff88]/40 rounded-xl p-3.5 text-xs text-[#00ff88] font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,136,0.2)]">
              <span className="text-base">✓</span>
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#040e09] border-t border-[#103425] px-6 py-3 flex items-center justify-between text-xs text-emerald-600 font-mono">
          <span>Adsclin License Engine v1.0</span>
          <span>
            Made with <span className="text-rose-500">❤️</span> by <span className="text-[#00ff88] font-semibold font-sans">Growdemy</span>
          </span>
          <span>Instant Automated Activation</span>
        </div>
      </div>
    </div>
  );
}
