import React, { useState, useEffect } from 'react';

const STAGE = {
  IDLE: 'IDLE',
  REGISTERING: 'REGISTERING',
  CARD_READY: 'CARD_READY',
  FIRST_DEPOSIT: 'FIRST_DEPOSIT',
  PAYING: 'PAYING',
  ACTIVE: 'ACTIVE',
  PAID: 'PAID',
};

const DepositFlow = () => {
  const [stage, setStage] = useState(STAGE.IDLE);
  const [sessionToken, setSessionToken] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [savedCard, setSavedCard] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Plan configuration — set during IDLE
  const [plan, setPlan] = useState({
    totalAmount: 100000,   // £1000.00
    depositAmount: 5000,   // £50.00
    monthlyAmount: 5000,   // £50.00/month
  });

  // Derived balance
  const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, plan.totalAmount - totalPaid);
  const progressPct = Math.min(100, Math.round((totalPaid / plan.totalAmount) * 100));
  const isPaidOff = balance === 0 && totalPaid > 0;

  // Poll for <super-card> SDK readiness
  useEffect(() => {
    if (stage !== STAGE.CARD_READY) return;
    const interval = setInterval(() => {
      if (window.superCard && typeof window.superCard.submit === 'function') {
        setIsSdkReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [stage]);

  // ── Step 1: Card setup ───────────────────────────────────────────────────────
  const handleStartSetup = async () => {
    setStage(STAGE.REGISTERING);
    setStatusMessage('');
    window.__stripeCardData = null;
    window.__capturedCardData = null;

    try {
      const custRes = await fetch('http://localhost:5000/customers', { method: 'POST' });
      const custData = await custRes.json();

      const pmRes = await fetch('http://localhost:5000/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: custData.id }),
      });
      const pmData = await pmRes.json();
      setPaymentMethodId(pmData.id);

      const setupRes = await fetch(`http://localhost:5000/payment-methods/${pmData.id}/setup-intents`, {
        method: 'POST',
      });
      const setupData = await setupRes.json();
      setSessionToken(setupData.sessionToken);
      setStage(STAGE.CARD_READY);
    } catch (e) {
      console.error('Setup failed', e);
      setStatusMessage('Failed to initialise card setup. Please try again.');
      setStage(STAGE.IDLE);
    }
  };

  // ── Step 2: Save card then immediately trigger initial deposit ──────────────
  const handleSaveCard = async () => {
    if (!window.superCard?.submit) return;
    setStatusMessage('');
    try {
      const result = await window.superCard.submit();
      if (result?.status === 'FAILURE') {
        setStatusMessage(result.errorMessage || 'Card submission failed.');
        return;
      }
      setSavedCard(resolveCardData(result));
      await handlePayment(plan.depositAmount, 'Initial deposit');
    } catch (e) {
      console.error('Save card error', e);
      setStatusMessage('Error saving card. Please try again.');
    }
  };

  // ── Step 3 & 4: Execute off-session payment ──────────────────────────────────
  const handlePayment = async (amount, label) => {
    if (!paymentMethodId) return;
    setStage(STAGE.PAYING);
    setStatusMessage('');

    try {
      const res = await fetch('http://localhost:5000/create-off-session-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentMethodId }),
      });
      const data = await res.json();

      if (res.ok && (data.status === 'SUCCESS' || data.status === 'PENDING' || data.id)) {
        const entry = {
          id: data.id || `pay_${Date.now()}`,
          amount,
          label,
          status: data.status || 'SUCCESS',
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        };
        setPaymentHistory(prev => [entry, ...prev]);
        setStage(STAGE.ACTIVE);
      } else {
        const msg = data.message || data.error || data.errorMessage || 'Payment failed.';
        setStatusMessage(msg);
        setStage(paymentHistory.length === 0 ? STAGE.FIRST_DEPOSIT : STAGE.ACTIVE);
      }
    } catch (e) {
      setStatusMessage('Network error. Please try again.');
      setStage(paymentHistory.length === 0 ? STAGE.FIRST_DEPOSIT : STAGE.ACTIVE);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const resolveCardData = (result) => {
    const intercepted = window.__stripeCardData || window.__capturedCardData;
    if (intercepted?.last4) return intercepted;
    const hit = findCard(result);
    if (hit?.last4) return hit;
    return { last4: null, brand: 'CARD' };
  };

  const findCard = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 8) return null;
    const l4 = obj.last4 ?? obj.Last4 ?? obj.last_four;
    if (l4 && String(l4).replace(/\D/g, '').length === 4) {
      return { last4: String(l4).replace(/\D/g, ''), brand: (obj.brand || obj.display_brand || obj.network || '').toUpperCase() };
    }
    if (obj.card?.last4) {
      return { last4: String(obj.card.last4), brand: (obj.card.brand || obj.card.display_brand || '').toUpperCase() };
    }
    for (const key of Object.keys(obj)) {
      const hit = findCard(obj[key], depth + 1);
      if (hit) return hit;
    }
    return null;
  };

  const fmt = (pence) => `£${(pence / 100).toFixed(2)}`;

  const getBrandMark = (brand = '') => {
    const b = brand.toUpperCase();
    if (b === 'VISA') return { label: 'VISA', color: '#1A1F71' };
    if (b === 'MASTERCARD') return { label: '●●', color: '#EB001B' };
    if (b === 'AMEX') return { label: 'AMEX', color: '#006FCF' };
    return { label: b || 'CARD', color: '#555' };
  };

  // Next payment: clamp to remaining balance so we never overpay
  const nextPaymentAmount = Math.min(plan.monthlyAmount, balance);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* ── Left: Summary panel ── */}
      <div style={s.summary}>
        <div style={s.summaryInner}>
          <p style={s.merchantLabel}>Super Integration</p>
          <h1 style={s.heading}>Deposit &amp; Pay</h1>
          <p style={s.subheading}>Save a card, pay your balance in monthly instalments.</p>

          {/* Balance breakdown — shown once plan is configured */}
          {stage !== STAGE.IDLE && (
            <>
              <div style={s.divider} />

              <div style={s.balanceBlock}>
                <div style={s.balanceRow}>
                  <span style={s.balanceLabel}>Total</span>
                  <span style={s.balanceValue}>{fmt(plan.totalAmount)}</span>
                </div>
                <div style={s.balanceRow}>
                  <span style={s.balanceLabel}>Paid</span>
                  <span style={{ ...s.balanceValue, color: '#27ae60' }}>−{fmt(totalPaid)}</span>
                </div>
                <div style={s.divider} />
                <div style={s.balanceRow}>
                  <span style={{ ...s.balanceLabel, fontWeight: '700', color: '#1a1a2e' }}>Remaining</span>
                  <span style={{ ...s.balanceValue, fontWeight: '700', fontSize: '20px', color: isPaidOff ? '#27ae60' : '#1a1a2e' }}>
                    {isPaidOff ? 'Paid in full' : fmt(balance)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={s.progressTrack}>
                <div style={s.progressFill(progressPct)} />
              </div>
              <p style={s.progressLabel}>{progressPct}% paid</p>
            </>
          )}

          {/* Saved card chip */}
          {savedCard && (
            <>
              <div style={s.divider} />
              <p style={s.merchantLabel}>Card on file</p>
              <div style={s.cardMini}>
                <span style={{ ...s.brandMini, color: getBrandMark(savedCard.brand).color }}>
                  {getBrandMark(savedCard.brand).label}
                </span>
                <span style={s.cardMiniNumber}>•••• {savedCard.last4 || '––––'}</span>
              </div>
            </>
          )}

          {/* Payment history */}
          {paymentHistory.length > 0 && (
            <>
              <div style={s.divider} />
              <p style={s.merchantLabel}>Payment history</p>
              {paymentHistory.map(p => (
                <div key={p.id} style={s.historyRow}>
                  <div>
                    <p style={s.historyLabel}>{p.label}</p>
                    <p style={s.historyMeta}>{p.date} · {p.time}</p>
                  </div>
                  <span style={s.historyAmount}>{fmt(p.amount)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Action panel ── */}
      <div style={s.panel}>
        <div style={s.panelInner}>

          {/* IDLE — configure plan */}
          {stage === STAGE.IDLE && (
            <>
              <h2 style={s.panelTitle}>Configure your plan</h2>
              <p style={s.panelSubtitle}>
                Set the total cost, how much you'd like to deposit upfront, and the fixed monthly payment amount.
              </p>

              <label style={s.label}>Total item cost</label>
              <div style={s.amountRow}>
                <span style={s.currencySymbol}>£</span>
                <input
                  type="number" min="1" style={s.amountInput}
                  value={(plan.totalAmount / 100).toFixed(2)}
                  onChange={e => setPlan(p => ({ ...p, totalAmount: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                />
              </div>

              <label style={s.label}>Initial deposit</label>
              <div style={s.amountRow}>
                <span style={s.currencySymbol}>£</span>
                <input
                  type="number" min="1" style={s.amountInput}
                  value={(plan.depositAmount / 100).toFixed(2)}
                  onChange={e => setPlan(p => ({ ...p, depositAmount: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                />
              </div>

              <label style={s.label}>Monthly payment</label>
              <div style={{ ...s.amountRow, marginBottom: '28px' }}>
                <span style={s.currencySymbol}>£</span>
                <input
                  type="number" min="1" style={s.amountInput}
                  value={(plan.monthlyAmount / 100).toFixed(2)}
                  onChange={e => setPlan(p => ({ ...p, monthlyAmount: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                />
              </div>

              <button onClick={handleStartSetup} style={s.primaryBtn(false)}>
                Set up card &amp; start
              </button>
            </>
          )}

          {/* REGISTERING */}
          {stage === STAGE.REGISTERING && (
            <div style={s.centred}>
              <div style={s.spinner} />
              <p style={s.panelSubtitle}>Initialising secure card setup…</p>
            </div>
          )}

          {/* CARD_READY */}
          {stage === STAGE.CARD_READY && (
            <>
              <h2 style={s.panelTitle}>Add your card</h2>
              <p style={s.panelSubtitle}>
                Your card will be saved and your initial deposit of <strong>{fmt(plan.depositAmount)}</strong> will be charged automatically.
              </p>
              <div style={s.cardWidget}>
                <super-card session-token={sessionToken} />
              </div>
              {isSdkReady && (
                <button onClick={handleSaveCard} style={s.primaryBtn(false)}>
                  Save card
                </button>
              )}
              {statusMessage && <p style={s.error}>{statusMessage}</p>}
            </>
          )}

          {/* FIRST_DEPOSIT — only reached if the automatic deposit failed after card save */}
          {stage === STAGE.FIRST_DEPOSIT && (
            <>
              <h2 style={s.panelTitle}>Deposit failed</h2>
              <p style={s.panelSubtitle}>
                Your card was saved but the initial deposit of{' '}
                <strong>{fmt(plan.depositAmount)}</strong> could not be processed. Please retry below.
              </p>
              <div style={s.summaryCard}>
                <div style={s.summaryCardRow}>
                  <span>Total</span><strong>{fmt(plan.totalAmount)}</strong>
                </div>
                <div style={s.summaryCardRow}>
                  <span>Deposit today</span><strong>{fmt(plan.depositAmount)}</strong>
                </div>
                <div style={s.summaryCardRow}>
                  <span>Remaining after deposit</span>
                  <strong>{fmt(plan.totalAmount - plan.depositAmount)}</strong>
                </div>
              </div>
              <button
                onClick={() => handlePayment(plan.depositAmount, 'Initial deposit')}
                style={s.primaryBtn(false)}
              >
                Pay deposit - {fmt(plan.depositAmount)}
              </button>
              {statusMessage && <p style={s.error}>{statusMessage}</p>}
            </>
          )}

          {/* PAYING */}
          {stage === STAGE.PAYING && (
            <div style={s.centred}>
              <div style={s.spinner} />
              <p style={s.panelSubtitle}>Processing payment…</p>
            </div>
          )}

          {/* ACTIVE — monthly payments */}
          {stage === STAGE.ACTIVE && !isPaidOff && (
            <>
              <h2 style={s.panelTitle}>Monthly payment</h2>
              <p style={s.panelSubtitle}>
                Using card •••• {savedCard?.last4 || '––––'}. No card entry needed.
              </p>

              <div style={s.balanceHighlight}>
                <p style={s.balanceHighlightLabel}>Remaining balance</p>
                <p style={s.balanceHighlightAmount}>{fmt(balance)}</p>
              </div>

              <div style={s.summaryCard}>
                <div style={s.summaryCardRow}>
                  <span>This payment</span>
                  <strong>{fmt(nextPaymentAmount)}</strong>
                </div>
                <div style={s.summaryCardRow}>
                  <span>Balance after</span>
                  <strong>{fmt(balance - nextPaymentAmount)}</strong>
                </div>
              </div>

              <button
                onClick={() => handlePayment(nextPaymentAmount, 'Monthly payment')}
                style={s.primaryBtn(false)}
              >
                Pay {fmt(nextPaymentAmount)}
              </button>
              {statusMessage && <p style={s.error}>{statusMessage}</p>}
              <p style={s.secureNote}>🔒 Off-session · No re-authentication required</p>
            </>
          )}

          {/* PAID IN FULL */}
          {(stage === STAGE.ACTIVE && isPaidOff) && (
            <div style={s.paidBox}>
              <div style={s.paidIcon}>✓</div>
              <h2 style={s.paidTitle}>Paid in full</h2>
              <p style={s.paidMsg}>
                All {fmt(plan.totalAmount)} has been paid across{' '}
                {paymentHistory.length} payment{paymentHistory.length !== 1 ? 's' : ''}.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

/* ─── Styles ────────────────────────────────────────────────────────────────── */
const s = {
  page: {
    display: 'flex',
    minHeight: 'calc(100vh - 54px)',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  summary: {
    width: '380px',
    minWidth: '300px',
    backgroundColor: '#f6f9fc',
    borderRight: '1px solid #e4e9f0',
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '60px 40px',
    boxSizing: 'border-box',
  },
  summaryInner: { width: '100%', maxWidth: '300px' },
  merchantLabel: {
    fontSize: '12px', fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px',
  },
  heading: { fontSize: '26px', fontWeight: '700', margin: '0 0 4px', color: '#1a1a2e' },
  subheading: { fontSize: '13px', color: '#888', margin: 0, lineHeight: '1.5' },
  divider: { borderTop: '1px solid #e4e9f0', margin: '20px 0' },

  balanceBlock: { display: 'flex', flexDirection: 'column', gap: '10px' },
  balanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  balanceLabel: { fontSize: '13px', color: '#666' },
  balanceValue: { fontSize: '15px', fontWeight: '600', color: '#1a1a2e' },

  progressTrack: {
    height: '6px', borderRadius: '99px',
    backgroundColor: '#e4e9f0', marginTop: '16px', overflow: 'hidden',
  },
  progressFill: (pct) => ({
    height: '100%', width: `${pct}%`,
    backgroundColor: '#6366f1', borderRadius: '99px',
    transition: 'width 0.4s ease',
  }),
  progressLabel: { fontSize: '12px', color: '#888', margin: '6px 0 0', textAlign: 'right' },

  cardMini: {
    display: 'flex', alignItems: 'center', gap: '10px',
    backgroundColor: '#fff', border: '1px solid #e4e9f0',
    borderRadius: '10px', padding: '12px 14px',
  },
  brandMini: { fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px' },
  cardMiniNumber: { fontFamily: 'monospace', fontSize: '14px', color: '#1a1a2e', letterSpacing: '1px' },

  historyRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #f0f0f0',
  },
  historyLabel: { fontSize: '13px', fontWeight: '600', color: '#1a1a2e', margin: '0 0 2px' },
  historyMeta: { fontSize: '11px', color: '#aaa', margin: 0 },
  historyAmount: { fontSize: '14px', fontWeight: '700', color: '#1a1a2e', whiteSpace: 'nowrap' },

  // Right panel
  panel: {
    flex: 1, display: 'flex', justifyContent: 'flex-start',
    padding: '60px', backgroundColor: '#fff',
  },
  panelInner: { width: '100%', maxWidth: '420px' },
  panelTitle: { fontSize: '22px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 6px' },
  panelSubtitle: { fontSize: '13px', color: '#888', margin: '0 0 24px', lineHeight: '1.6' },

  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '8px' },
  amountRow: {
    display: 'flex', alignItems: 'center',
    border: '2px solid #e4e9f0', borderRadius: '10px',
    overflow: 'hidden', marginBottom: '18px',
  },
  currencySymbol: {
    padding: '14px', fontSize: '18px', fontWeight: '600', color: '#1a1a2e',
    backgroundColor: '#f6f9fc', borderRight: '2px solid #e4e9f0', lineHeight: 1,
  },
  amountInput: {
    flex: 1, padding: '14px 16px', border: 'none', outline: 'none',
    fontSize: '20px', fontWeight: '700', color: '#1a1a2e',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },

  summaryCard: {
    backgroundColor: '#f6f9fc', borderRadius: '12px',
    padding: '16px 20px', marginBottom: '24px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  summaryCardRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: '14px', color: '#555',
  },

  balanceHighlight: {
    backgroundColor: '#f5f3ff', borderRadius: '12px',
    padding: '20px', marginBottom: '20px', textAlign: 'center',
  },
  balanceHighlightLabel: { fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' },
  balanceHighlightAmount: { fontSize: '32px', fontWeight: '700', color: '#6366f1', margin: 0 },

  primaryBtn: (disabled) => ({
    width: '100%', padding: '16px', borderRadius: '10px', border: 'none',
    backgroundColor: disabled ? '#a5b4fc' : '#6366f1',
    color: '#fff', fontSize: '16px', fontWeight: '700',
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginBottom: '14px', transition: 'background-color 0.2s',
  }),
  cardWidget: {
    border: '1px solid #e4e9f0', borderRadius: '12px',
    padding: '20px', marginBottom: '20px', backgroundColor: '#fafafa',
  },
  centred: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: '200px', gap: '16px',
  },
  spinner: {
    width: '40px', height: '40px',
    border: '4px solid #e4e9f0', borderTop: '4px solid #6366f1',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  error: { color: '#e74c3c', fontSize: '13px', marginTop: '8px' },
  secureNote: { fontSize: '12px', color: '#aaa', textAlign: 'center', margin: 0 },

  paidBox: {
    textAlign: 'center', padding: '50px 20px',
    borderRadius: '16px', backgroundColor: '#f0fdf4',
    border: '2px solid #bbf7d0',
  },
  paidIcon: {
    width: '64px', height: '64px', borderRadius: '50%',
    backgroundColor: '#22c55e', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '28px', fontWeight: '700', margin: '0 auto 20px',
  },
  paidTitle: { fontSize: '24px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 10px' },
  paidMsg: { fontSize: '14px', color: '#555', margin: 0, lineHeight: '1.6' },
};

if (!document.getElementById('deposit-flow-styles')) {
  const el = document.createElement('style');
  el.id = 'deposit-flow-styles';
  el.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(el);
}

export default DepositFlow;
