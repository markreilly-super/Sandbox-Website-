import React, { useState, useEffect, useRef } from 'react';
import { proceedAddressFields } from '../walletAddress';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Super's own brand values, taken from the SDK bundle's CSS custom properties.
const SUPER = {
  orange: '#FF7506',      // --color-superOrange-100
  orangeTint: '#FFEEE6',  // --color-superOrange-50
  ink: '#1E0032',         // --color-novaNeutral-800
  border: '#e0e0e0',
};

// Renders <super-checkout> only once the shopper opens it, so the component
// mounts and unmounts repeatedly — the case where wallet handlers leak unless
// every register is paired with an unregister.
const DropdownCheckout = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [open, setOpen] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [sdkConfig] = useState(() => {
    const saved = localStorage.getItem('sdk_config');
    return saved ? JSON.parse(saved) : {
      amount: 15000,
      paymentMethodsOrder: 'CARD,BNPL,OPEN_BANKING',
      preSelectedPaymentMethod: 'CARD',
      title: 'Secure Checkout',
      subtitle: 'Pay with Super and earn cash rewards',
    };
  });

  const walletsRegistered = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/checkout-sessions`, { method: 'POST' });
        const data = await res.json();
        if (data.checkoutSessionToken) {
          setSessionToken(data.checkoutSessionToken);
          setCheckoutSessionId(data.checkoutSessionId);
        } else {
          setSessionError(data.detail || data.error || 'Failed to create session');
        }
      } catch (err) {
        setSessionError(err.message);
      }
    })();
  }, []);

  // The SDK attaches its methods to the instance about a second after the
  // element appears, so poll for the method rather than trusting the element.
  useEffect(() => {
    if (!open || !sessionToken) return;
    setSdkReady(false);
    walletsRegistered.current = false;

    const interval = setInterval(() => {
      const el = document.querySelector('super-checkout');
      if (!el || typeof el.submit !== 'function') return;
      clearInterval(interval);
      setSdkReady(true);

      if (window.superCheckout?.registerWalletsHandler && !walletsRegistered.current) {
        walletsRegistered.current = true;
        window.superCheckout.registerWalletsHandler(async (event) => {
          console.log('[Dropdown] wallets handler fired:', event?.detail?.type);
          await sendProceed(event?.detail);
        });
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (walletsRegistered.current) {
        walletsRegistered.current = false;
        // Collapsing unmounts the component, but the SDK keeps its wallet
        // listener on window and orphans the old one on re-register — each
        // leak fires another /proceed. Pair every register with an unregister.
        try {
          window.superCheckout?.unregisterWalletHandler?.();
          console.log('[Dropdown] wallets handler unregistered');
        } catch (err) {
          console.warn('[Dropdown] unregister failed:', err);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionToken]);

  const sendProceed = async (detail) => {
    const res = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: sdkConfig.amount,
        email: 'customer@example.com',
        phone: '07700900000',
        externalReference: `DROPDOWN_ORDER_${Date.now()}`,
        ...proceedAddressFields(detail),
      }),
    });
    const data = await res.json();
    console.log('[Dropdown] proceed HTTP', res.status, data);
    if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
    setErrorMessage(data.detail || data.error || `Proceed failed (HTTP ${res.status})`);
  };

  const placeOrder = async () => {
    if (!window.superCheckout) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await window.superCheckout.submit({
        customerInformation: {
          firstName: 'Test', lastName: 'User',
          email: 'customer@example.com', phoneNumber: '07700900000',
        },
      });
      console.log('[Dropdown] submit() →', result?.status);
      if (result?.status !== 'SUCCESS') {
        setErrorMessage(result?.errorMessage || 'Payment failed');
        return;
      }
      await sendProceed();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout-page">
      <div style={{ maxWidth: '560px' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '6px', color: SUPER.ink }}>Checkout</h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
          The component is only mounted once the dropdown is opened, and unmounted
          again when it closes.
        </p>

        {/* Order summary */}
        <div style={{ border: `1px solid ${SUPER.border}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            <span>Subtotal</span><span>£{(sdkConfig.amount / 100).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#2e7d32', marginBottom: '10px' }}>
            <span>Delivery</span><span>FREE</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', paddingTop: '10px', borderTop: `1px solid ${SUPER.border}`, color: SUPER.ink }}>
            <span>Total</span><span>£{(sdkConfig.amount / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* The dropdown trigger */}
        <button
          onClick={() => { setOpen(v => !v); setErrorMessage(''); }}
          disabled={!sessionToken}
          aria-expanded={open}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', border: 'none',
            borderRadius: open ? '12px 12px 0 0' : '12px',
            backgroundColor: SUPER.orange, color: '#fff',
            fontSize: '16px', fontWeight: '700',
            cursor: sessionToken ? 'pointer' : 'not-allowed',
            opacity: sessionToken ? 1 : 0.6,
          }}
        >
          <span>Super Checkout</span>
          <span style={{ fontSize: '13px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
        </button>

        {sessionError && (
          <p style={{ color: '#e74c3c', fontSize: '13px', marginTop: '10px' }}>{sessionError}</p>
        )}

        {/* The component, mounted only while open */}
        {open && sessionToken && (
          <div style={{
            border: `1px solid ${SUPER.orange}`, borderTop: 'none',
            borderRadius: '0 0 12px 12px', padding: '18px',
            backgroundColor: '#fff',
          }}>
            <super-checkout
              key={sessionToken}
              amount={String(sdkConfig.amount)}
              currency="GBP"
              checkout-session-token={sessionToken}
              title={sdkConfig.title}
              subtitle={sdkConfig.subtitle}
              {...(sdkConfig.paymentMethodsOrder
                ? { 'payment-methods-order': sdkConfig.paymentMethodsOrder } : {})}
              {...(sdkConfig.preSelectedPaymentMethod
                ? { 'pre-selected-payment-method': sdkConfig.preSelectedPaymentMethod } : {})}
              {...(sdkConfig.hidePostcode
                ? { 'hide-postcode': 'true' } : {})}
              support-express-wallets="true"
            />

            {sdkReady && (
              <button
                onClick={placeOrder}
                disabled={loading}
                style={{
                  width: '100%', marginTop: '18px', padding: '16px', border: 'none',
                  borderRadius: '8px', backgroundColor: SUPER.ink, color: '#fff',
                  fontSize: '15px', fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Processing...' : `Place Order — £${(sdkConfig.amount / 100).toFixed(2)}`}
              </button>
            )}

            {errorMessage && (
              <p style={{ color: '#e74c3c', fontSize: '13px', marginTop: '10px' }}>{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DropdownCheckout;
