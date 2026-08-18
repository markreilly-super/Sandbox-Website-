import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const PRODUCT = {
  name: 'Super Wireless Headphones',
  description: 'Premium noise-cancelling headphones with 30-hour battery life, adaptive ANC, and hi-res audio.',
  price: 4999,
  priceDisplay: '£49.99',
  emoji: '🎧',
};

const WowcherCheckout = () => {
  const [step, setStep] = useState('basket'); // basket | wowcher-checkout
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [wowcherPaymentMethod, setWowcherPaymentMethod] = useState(null); // { id, last4, brand }
  const [isWowcherSdkReady, setIsWowcherSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const billingRef = useRef({ email: '', phone: '' });

  // ── Poll for super-single-checkout readiness ──────────────────────────────
  useEffect(() => {
    if (step !== 'wowcher-checkout' || !sessionToken) return;
    setIsWowcherSdkReady(false);
    const interval = setInterval(() => {
      const el = document.querySelector('super-single-checkout#wowcher-single-checkout');
      if (el && typeof el.submit === 'function') {
        setIsWowcherSdkReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [step, sessionToken]);

  // ── handleWowcherProceed: fetch saved card + create locked session ────────
  const handleWowcherProceed = async () => {
    setLoading(true);
    setError('');
    try {
      const env = localStorage.getItem('super_environment') || 'test';
      const storedCustomerId = localStorage.getItem(`super_customer_id_${env}`);
      if (!storedCustomerId) throw new Error('No saved customer found. Please add a card on the Account Settings page first.');

      const custRes = await fetch(`${API_BASE}/customers/${storedCustomerId}`);
      const custData = await custRes.json();

      const enabledCard = (custData.paymentMethods || []).find(
        pm => pm.type === 'CARD' && pm.status === 'ENABLED'
      );
      if (!enabledCard) throw new Error('No enabled saved card found. Please add a card on the Account Settings page first.');

      billingRef.current = {
        email: custData.emailAddress || '',
        phone: custData.phoneNumber || '',
      };

      setWowcherPaymentMethod({
        id: enabledCard.id,
        last4: enabledCard.card?.last4,
        brand: (enabledCard.card?.brand || 'CARD').toUpperCase(),
      });

      const sessRes = await fetch(`${API_BASE}/checkout-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: storedCustomerId, paymentMethodId: enabledCard.id }),
      });
      const sessData = await sessRes.json();
      if (!sessData.checkoutSessionToken) throw new Error(sessData.detail || 'Failed to create checkout session');

      setSessionToken(sessData.checkoutSessionToken);
      setCheckoutSessionId(sessData.checkoutSessionId);
      setStep('wowcher-checkout');
    } catch (err) {
      setError(err.message || 'Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handleWowcherPlaceOrder: submit via element then /proceed ─────────────
  const handleWowcherPlaceOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const el = document.getElementById('wowcher-single-checkout');
      const result = await el.submit();
      console.log('[Wowcher] submit result:', result);

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
      console.log('[Wowcher] proceed response:', proceedData);
      if (proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;
      else setError(proceedData.detail || 'No redirect URL returned.');
    } catch (err) {
      console.error('[Wowcher] error:', err);
      setError(err?.message || 'Communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const primaryBtn = {
    width: '100%', padding: '16px', backgroundColor: '#000', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700',
    cursor: 'pointer',
  };
  const secondaryBtn = {
    padding: '12px 24px', backgroundColor: '#fff', color: '#333',
    border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer',
  };

  // ── BASKET ────────────────────────────────────────────────────────────────
  if (step === 'basket') {
    return (
      <div className="layout-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
            backgroundColor: '#e91e8c', color: '#fff',
          }}>
            ⚡ Wowcher
          </span>
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
          <button style={secondaryBtn} onClick={() => window.history.back()}>← Continue Shopping</button>
          <button
            style={{ ...primaryBtn, width: 'auto', padding: '12px 32px', backgroundColor: '#e91e8c' }}
            onClick={handleWowcherProceed}
            disabled={loading}
          >
            {loading ? 'Loading saved card...' : '⚡ Pay with Saved Card →'}
          </button>
        </div>

        {error && <p style={{ color: 'red', marginTop: '12px', fontSize: '14px' }}>{error}</p>}
      </div>
    );
  }

  // ── WOWCHER CHECKOUT ──────────────────────────────────────────────────────
  if (step === 'wowcher-checkout') {
    const brandLabel = wowcherPaymentMethod?.brand || 'CARD';
    const last4 = wowcherPaymentMethod?.last4;

    return (
      <div className="layout-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
            backgroundColor: '#e91e8c', color: '#fff',
          }}>
            ⚡ Wowcher
          </span>
          <button
            onClick={() => setStep('basket')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#666', textDecoration: 'underline', padding: 0 }}
          >
            ← Back
          </button>
        </div>

        <div style={{ maxWidth: '560px' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>One-click Checkout</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '28px' }}>
            Your saved card is ready. No card details needed — just confirm your order.
          </p>

          {wowcherPaymentMethod && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '16px 20px', borderRadius: '12px', marginBottom: '24px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              color: '#fff',
            }}>
              <div style={{ width: '36px', height: '26px', borderRadius: '4px', background: 'linear-gradient(135deg, #d4af37 0%, #f2d06b 50%, #d4af37 100%)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>Paying with</div>
                <div style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px' }}>
                  {brandLabel} •••• •••• •••• {last4 || '????'}
                </div>
              </div>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '20px', backgroundColor: '#4CAF50', fontWeight: '600' }}>SAVED</span>
            </div>
          )}

          <super-single-checkout
            ref={el => { if (el) { el.displayAuth = 'CARD'; el.paymentToDisplay = 'CARD'; el.supportCreditPopup = true; } }}
            id="wowcher-single-checkout"
            key={sessionToken}
            amount={String(PRODUCT.price)}
            checkout-session-token={sessionToken}
            currency="GBP"
            support-credit-popup="true"
          />

          {isWowcherSdkReady && (
            <button
              onClick={handleWowcherPlaceOrder}
              disabled={loading}
              style={{
                ...primaryBtn, marginTop: '20px',
                backgroundColor: '#e91e8c',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Processing...' : `⚡ Pay ${PRODUCT.priceDisplay} with ••••${last4 || '????'}`}
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
