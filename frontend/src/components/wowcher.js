import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const PRODUCT = {
  name: 'Super Wireless Headphones',
  description: 'Premium noise-cancelling headphones with 30-hour battery life, adaptive ANC, and hi-res audio.',
  price: 4999,
  priceDisplay: '£49.99',
  emoji: '🎧',
};

const DISPLAY_OPTIONS = [
  { value: 'CARD',            label: 'Card & BNPL',        emoji: '💳', description: 'Shows card entry and Buy Now Pay Later options.' },
  { value: 'EXPRESS_WALLETS', label: 'Apple & Google Pay', emoji: '📱', description: 'Shows Apple Pay and Google Pay express buttons.' },
  { value: 'APPLE_PAY',       label: 'Apple Pay',          emoji: '🍎', description: 'Shows Apple Pay only.' },
  { value: 'GOOGLE_PAY',      label: 'Google Pay',         emoji: '🔵', description: 'Shows Google Pay only.' },
  { value: 'OPEN_BANKING',    label: 'Open Banking',       emoji: '🏦', description: 'Shows Open Banking payment option.' },
];

const FLOWS = [
  {
    id: 'upsell',
    title: 'Upsell',
    emoji: '⚡',
    description: 'Session locked to customer\'s saved card. Uses super-checkout. No card entry — instant charge.',
    badge: 'paymentMethodId',
    color: '#e91e8c',
  },
  {
    id: 'save-card',
    title: 'Save Card + Take Payment',
    emoji: '💾',
    description: 'Customer enters (or selects) a payment method which is saved. Uses super-single-checkout with configurable display.',
    badge: 'savePaymentMethod',
    color: '#1976d2',
  },
];

const WowcherBadge = ({ flow }) => {
  const f = FLOWS.find(f => f.id === flow);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
      backgroundColor: f ? f.color : '#e91e8c', color: '#fff',
    }}>
      {f ? f.emoji : '⚡'} Wowcher{f ? ` — ${f.title}` : ''}
    </span>
  );
};

const WowcherCheckout = () => {
  // step: flow-select | display-select | basket | upsell-checkout | save-card-checkout
  const [step, setStep] = useState('flow-select');
  const [flow, setFlow] = useState(null);
  const [paymentToDisplay, setPaymentToDisplay] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isSingleSdkReady, setIsSingleSdkReady] = useState(false);
  const [displayAuth, setDisplayAuth] = useState(false);
  const [isCardValid, setIsCardValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const billingRef = useRef({ email: '', phone: '' });

  // ── Poll for super-checkout SDK readiness (upsell flow) ──────────────────
  useEffect(() => {
    if (step !== 'upsell-checkout' || !sessionToken) return;
    setIsSdkReady(false);
    const interval = setInterval(() => {
      if (typeof window.superCheckout?.submit === 'function') {
        setIsSdkReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step, sessionToken]);

  // ── Poll for super-single-checkout readiness (save-card flow) ────────────
  useEffect(() => {
    if (step !== 'save-card-checkout' || !sessionToken) return;
    setIsSingleSdkReady(false);
    setIsCardValid(false);
    const interval = setInterval(() => {
      const el = document.querySelector('super-single-checkout#wowcher-single-checkout');
      if (el && typeof el.submit === 'function') {
        setIsSingleSdkReady(true);
        clearInterval(interval);
        if (typeof el.registerCardDetailsHandler === 'function') {
          let hasBeenInvalid = false;
          el.registerCardDetailsHandler((event) => {
            const valid = !!event.detail?.cardDetailsValid;
            if (!valid) hasBeenInvalid = true;
            // Only enable once the form has been invalid (user interacted) then becomes valid
            setIsCardValid(hasBeenInvalid && valid);
          });
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step, sessionToken]);

  // ── Shared: load customer from localStorage ───────────────────────────────
  const loadCustomer = async () => {
    const env = localStorage.getItem('super_environment') || 'test';
    const storedCustomerId = localStorage.getItem(`super_customer_id_${env}`);
    if (!storedCustomerId) throw new Error('No saved customer found. Please add a card on the Account Settings page first.');
    const custRes = await fetch(`${API_BASE}/customers/${storedCustomerId}`);
    const custData = await custRes.json();
    billingRef.current = { email: custData.emailAddress || '', phone: custData.phoneNumber || '' };
    const enabledCard = (custData.paymentMethods || []).find(pm => pm.type === 'CARD' && pm.status === 'ENABLED');
    if (!enabledCard) throw new Error('No enabled saved card found. Please add a card on the Account Settings page first.');
    return { customerId: storedCustomerId, enabledCard };
  };

  // ── handleUpsellProceed: lock session to saved card, use super-checkout ───
  const handleUpsellProceed = async () => {
    setLoading(true);
    setError('');
    try {
      const { customerId, enabledCard } = await loadCustomer();
      const sessRes = await fetch(`${API_BASE}/checkout-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, paymentMethodId: enabledCard.id, upsellFlow: true }),
      });
      const sessData = await sessRes.json();
      if (!sessData.checkoutSessionToken) throw new Error(sessData.detail || 'Failed to create checkout session');
      setSessionToken(sessData.checkoutSessionToken);
      setCheckoutSessionId(sessData.checkoutSessionId);
      setStep('upsell-checkout');
    } catch (err) {
      setError(err.message || 'Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handleSaveCardProceed: create session with savePaymentMethod ──────────
  const handleSaveCardProceed = async () => {
    setLoading(true);
    setError('');
    try {
      const { customerId } = await loadCustomer();
      const sessRes = await fetch(`${API_BASE}/checkout-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, wowcherFlow: true }),
      });
      const sessData = await sessRes.json();
      if (!sessData.checkoutSessionToken) throw new Error(sessData.detail || 'Failed to create checkout session');
      setSessionToken(sessData.checkoutSessionToken);
      setCheckoutSessionId(sessData.checkoutSessionId);
      setStep('save-card-checkout');
    } catch (err) {
      setError(err.message || 'Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handleUpsellPlaceOrder: submit locked session then /proceed ──────────
  const handleUpsellPlaceOrder = async () => {
    if (!window.superCheckout?.submit) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.superCheckout.submit();
      console.log('[Upsell] submit result:', result);
      if (result?.status === 'FAILURE') {
        setError(result.errorMessage || 'Something went wrong. No money has been taken from your account. Please try again.');
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: PRODUCT.price,
          email: billingRef.current.email,
          phone: billingRef.current.phone,
          externalReference: `UPSELL_ORDER_${Date.now()}`,
        }),
      });
      const proceedData = await response.json();
      console.log('[Upsell] proceed response:', proceedData);
      if (proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;
      else setError(proceedData.detail || 'No redirect URL returned.');
    } catch (err) {
      console.error('[Upsell] error:', err);
      setError(err?.message || 'Communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handleSaveCardPlaceOrder: super-single-checkout el.submit then /proceed
  const handleSaveCardPlaceOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const el = document.getElementById('wowcher-single-checkout');
      const result = await el.submit();
      console.log('[SaveCard] submit result:', result);
      if (result?.status === 'FAILURE') {
        setError(result.errorMessage || 'Payment failed. Please try again.');
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: PRODUCT.price,
          email: billingRef.current.email,
          phone: billingRef.current.phone,
          externalReference: `WOWCHER_ORDER_${Date.now()}`,
        }),
      });
      const proceedData = await response.json();
      console.log('[SaveCard] proceed response:', proceedData);
      if (proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;
      else setError(proceedData.detail || 'No redirect URL returned.');
    } catch (err) {
      console.error('[SaveCard] error:', err);
      setError(err?.message || 'Communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const primaryBtn = {
    width: '100%', padding: '16px', backgroundColor: '#000', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
  };
  const secondaryBtn = {
    padding: '12px 24px', backgroundColor: '#fff', color: '#333',
    border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  };

  // ── FLOW SELECT ───────────────────────────────────────────────────────────
  if (step === 'flow-select') {
    return (
      <div className="layout-page">
        <div style={{ marginBottom: '24px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
            backgroundColor: '#e91e8c', color: '#fff',
          }}>
            ⚡ Wowcher
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Wowcher Integration</h1>
        <p style={{ color: '#666', marginBottom: '32px', fontSize: '15px' }}>Choose the flow to simulate.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '700px' }}>
          {FLOWS.map(f => (
            <div
              key={f.id}
              onClick={() => {
                setFlow(f.id);
                setStep(f.id === 'save-card' ? 'display-select' : 'basket');
              }}
              style={{
                padding: '28px', borderRadius: '16px', border: '2px solid #e0e0e0',
                cursor: 'pointer', backgroundColor: '#fff', transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '36px', marginBottom: '14px' }}>{f.emoji}</div>
              <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '8px' }}>{f.title}</div>
              <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.5', marginBottom: '14px' }}>{f.description}</div>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#f5f5f5', fontSize: '11px', fontFamily: 'monospace', color: '#555' }}>
                {f.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── DISPLAY SELECT (save-card flow only) ──────────────────────────────────
  if (step === 'display-select') {
    return (
      <div className="layout-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <WowcherBadge flow={flow} />
          <button onClick={() => setStep('flow-select')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#666', textDecoration: 'underline', padding: 0 }}>
            ← Change flow
          </button>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Payment Display</h1>
        <p style={{ color: '#666', marginBottom: '24px', fontSize: '15px' }}>Choose which payment method to show in the checkout.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', padding: '14px 18px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '10px', maxWidth: '360px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, fontSize: '14px', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={displayAuth}
              onChange={e => setDisplayAuth(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            displayAuth
          </label>
          <span style={{ fontSize: '12px', fontFamily: 'monospace', backgroundColor: displayAuth ? '#e8f5e9' : '#fff', color: displayAuth ? '#2e7d32' : '#888', border: `1px solid ${displayAuth ? '#a5d6a7' : '#e0e0e0'}`, padding: '2px 10px', borderRadius: '4px', fontWeight: '600' }}>
            {displayAuth ? 'true' : 'false'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '800px' }}>
          {DISPLAY_OPTIONS.map(opt => (
            <div
              key={opt.value}
              onClick={() => { setPaymentToDisplay(opt.value); setStep('basket'); }}
              style={{
                padding: '24px', borderRadius: '14px', border: '2px solid #e0e0e0',
                cursor: 'pointer', backgroundColor: '#fff', transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1976d2'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{opt.emoji}</div>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>{opt.label}</div>
              <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.4' }}>{opt.description}</div>
              <div style={{ marginTop: '12px', display: 'inline-block', padding: '3px 10px', borderRadius: '20px', backgroundColor: '#f5f5f5', fontSize: '11px', fontFamily: 'monospace', color: '#555' }}>
                {opt.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── BASKET ────────────────────────────────────────────────────────────────
  if (step === 'basket') {
    const selectedOpt = DISPLAY_OPTIONS.find(o => o.value === paymentToDisplay);
    const backStep = flow === 'save-card' ? 'display-select' : 'flow-select';
    return (
      <div className="layout-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <WowcherBadge flow={flow} />
          {selectedOpt && (
            <span style={{ fontSize: '13px', color: '#555', fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '4px 10px', borderRadius: '20px' }}>
              {selectedOpt.emoji} {selectedOpt.value}
            </span>
          )}
          <button onClick={() => setStep(backStep)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#666', textDecoration: 'underline', padding: 0 }}>
            ← Back
          </button>
        </div>

        <h1 style={{ fontSize: '1.8rem', marginBottom: '24px' }}>Your Basket</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', marginBottom: '24px' }}>
          <span style={{ fontSize: '48px' }}>{PRODUCT.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{PRODUCT.name}</div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>{PRODUCT.description}</div>
          </div>
          <div style={{ fontWeight: '700', fontSize: '18px' }}>{PRODUCT.priceDisplay}</div>
        </div>

        <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', marginBottom: '24px', maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            <span>Subtotal</span><span>{PRODUCT.priceDisplay}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#4CAF50', marginBottom: '12px' }}>
            <span>Delivery</span><span>FREE</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '17px', paddingTop: '12px', borderTop: '2px solid #333' }}>
            <span>Total</span><span>{PRODUCT.priceDisplay}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button style={secondaryBtn} onClick={() => setStep(backStep)}>← Back</button>
          <button
            style={{ ...primaryBtn, width: 'auto', padding: '12px 32px', backgroundColor: flow === 'upsell' ? '#e91e8c' : '#1976d2' }}
            onClick={flow === 'upsell' ? handleUpsellProceed : handleSaveCardProceed}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Proceed to Checkout →'}
          </button>
        </div>

        {error && <p style={{ color: 'red', marginTop: '12px', fontSize: '14px' }}>{error}</p>}
      </div>
    );
  }

  // ── UPSELL CHECKOUT ───────────────────────────────────────────────────────
  if (step === 'upsell-checkout') {
    return (
      <div className="layout-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <WowcherBadge flow={flow} />
          <button onClick={() => setStep('basket')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#666', textDecoration: 'underline', padding: 0 }}>
            ← Back
          </button>
        </div>

        <div style={{ maxWidth: '560px' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Confirm Order</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '28px' }}>
            Your saved card will be charged instantly — no card entry required.
          </p>

          {/* Hidden — initialises window.superCheckout without showing the card form */}
          <div style={{ display: 'none' }}>
            {sessionToken && (
              <super-checkout
                key={sessionToken}
                amount={PRODUCT.price}
                checkout-session-token={sessionToken}
              />
            )}
          </div>

          <div style={{ backgroundColor: '#f9f9f9', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', marginBottom: '28px' }}>
            <div style={{ padding: '14px 20px', fontWeight: '700', fontSize: '13px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f0f0f0' }}>
              Order Summary
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>
              <span>{PRODUCT.emoji} {PRODUCT.name}</span>
              <span style={{ fontWeight: '600' }}>{PRODUCT.priceDisplay}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', fontSize: '15px', fontWeight: '700' }}>
              <span>Total</span><span>{PRODUCT.priceDisplay}</span>
            </div>
          </div>

          {!isSdkReady && (
            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px' }}>Initializing…</p>
          )}

          {isSdkReady && (
            <button
              onClick={handleUpsellPlaceOrder}
              disabled={loading}
              style={{
                ...primaryBtn, backgroundColor: '#e91e8c',
                opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Processing...' : `⚡ Place Order — ${PRODUCT.priceDisplay}`}
            </button>
          )}

          {error && <p style={{ color: 'red', marginTop: '12px', fontSize: '14px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── SAVE CARD CHECKOUT ────────────────────────────────────────────────────
  if (step === 'save-card-checkout') {
    const selectedOpt = DISPLAY_OPTIONS.find(o => o.value === paymentToDisplay);
    return (
      <div className="layout-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <WowcherBadge flow={flow} />
          {selectedOpt && (
            <span style={{ fontSize: '13px', color: '#555', fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '4px 10px', borderRadius: '20px' }}>
              {selectedOpt.emoji} {selectedOpt.value}
            </span>
          )}
          <button onClick={() => setStep('basket')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#666', textDecoration: 'underline', padding: 0 }}>
            ← Back
          </button>
        </div>

        <div style={{ maxWidth: '560px' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Checkout</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '28px' }}>
            Complete your payment — your card will be saved for future purchases.
          </p>

          <super-single-checkout
            ref={el => { if (el) { el.paymentToDisplay = paymentToDisplay; el.displayAuth = displayAuth; el.supportCreditPopup = true; } }}
            id="wowcher-single-checkout"
            key={sessionToken}
            amount={PRODUCT.price}
            checkout-session-token={sessionToken}
            currency="GBP"
            support-credit-popup="true"
          />

          {isSingleSdkReady && (
            <button
              onClick={handleSaveCardPlaceOrder}
              disabled={loading || !isCardValid}
              style={{
                ...primaryBtn, marginTop: '20px', backgroundColor: '#1976d2',
                opacity: (loading || !isCardValid) ? 0.4 : 1,
                cursor: (loading || !isCardValid) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Processing...' : `Place Order — ${PRODUCT.priceDisplay}`}
            </button>
          )}

          {error && <p style={{ color: 'red', marginTop: '12px', fontSize: '14px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  return null;
};

export default WowcherCheckout;
