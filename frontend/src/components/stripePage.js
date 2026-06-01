import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// NGROK: set to '' to proxy via React dev server (ngrok mode)
// TO REVERT TO LOCALHOST: change back to 'http://localhost:5000'
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const DEFAULT_STRIPE_PK = 'pk_test_51T7KVpPsnVv1kXWyxSjJ1qghY7aRGnVAG4mWcwbJiJ83bKE9Clmr5t9SFyKdnhJLE7zzIvLy89HsoiuD8q22SvDO00XZEQmfNs';

// ─── Inner form — works for both PaymentIntent and SetupIntent ────────────────
const CheckoutForm = ({ mode, onError }) => {
  const stripe     = useStripe();
  const elements   = useElements();
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState('');

  const isSetup = mode === 'setup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setMessage('');

    let result;

    if (isSetup) {
      // SetupIntent — saves card without charging
      result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
        },
      });
    } else {
      // PaymentIntent — charges the card
      result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
        },
      });
    }

    // Both methods only return here on an immediate error — success redirects
    if (result.error) {
      const msg = result.error.message || 'Something went wrong.';
      setMessage(msg);
      onError && onError(msg);
    }

    setBusy(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {message && (
        <div style={{
          marginTop: '12px', padding: '10px 14px', borderRadius: '6px',
          backgroundColor: '#fff1f0', color: '#cf1322', fontSize: '14px',
          border: '1px solid #ffa39e',
        }}>
          {message}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || busy}
        style={{
          marginTop: '20px', width: '100%', padding: '14px',
          backgroundColor: busy ? '#999' : (isSetup ? '#0a2540' : '#635bff'),
          color: 'white', border: 'none', borderRadius: '6px',
          fontSize: '16px', fontWeight: '600',
          cursor: busy ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        {busy ? 'Processing…' : (isSetup ? 'Save Card' : 'Pay Now')}
      </button>
    </form>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const StripePage = () => {
  const [mode, setMode]                   = useState('payment'); // 'payment' | 'setup'
  const [stripePk, setStripePk]           = useState(DEFAULT_STRIPE_PK);
  const [clientSecret, setClientSecret]   = useState('');
  const [inputSecret, setInputSecret]     = useState('');
  const [amount, setAmount]               = useState('1000');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [stripePromise, setStripePromise] = useState(null);
  const [intentInfo, setIntentInfo]       = useState(null); // stores id + type after creation

  const activateElements = (pk, secret, info) => {
    setStripePromise(loadStripe(pk));
    setClientSecret(secret);
    setIntentInfo(info);
    setError('');
  };

  const reset = () => {
    setClientSecret('');
    setInputSecret('');
    setIntentInfo(null);
    setError('');
  };

  // ── Option A: Create PaymentIntent ─────────────────────────────────────────
  const handleCreatePaymentIntent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amount, 10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PaymentIntent');
      console.log('[Stripe] PaymentIntent created:', data);
      activateElements(stripePk, data.client_secret, {
        id: data.payment_intent_id,
        type: 'PaymentIntent',
        amount: data.amount,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Option A: Create SetupIntent ───────────────────────────────────────────
  const handleCreateSetupIntent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/stripe/create-setup-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create SetupIntent');
      console.log('[Stripe] SetupIntent created:', data);
      activateElements(stripePk, data.client_secret, {
        id: data.setup_intent_id,
        type: 'SetupIntent',
        customerId: data.customer_id,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Option B: Paste a client_secret ────────────────────────────────────────
  const handleUseSecret = () => {
    const s = inputSecret.trim();
    const expectedPrefix = mode === 'setup' ? 'seti_' : 'pi_';
    if (!s.startsWith(expectedPrefix)) {
      setError(`client_secret for a ${mode === 'setup' ? 'SetupIntent' : 'PaymentIntent'} should start with "${expectedPrefix}"`);
      return;
    }
    activateElements(stripePk, s, { id: s.split('_secret_')[0], type: mode === 'setup' ? 'SetupIntent' : 'PaymentIntent' });
  };

  const elementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: { colorPrimary: mode === 'setup' ? '#0a2540' : '#635bff' },
    },
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f6f9fc', padding: '40px 20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0, color: '#1a1a1a', fontSize: '24px' }}>Stripe Elements</h2>
          <p style={{ margin: '6px 0 0', color: '#666', fontSize: '14px' }}>
            Charge a card via PaymentIntent, or save it for later via SetupIntent.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { value: 'payment', label: '💳  Charge Card' },
            { value: 'setup',   label: '🔒  Save Card' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setMode(value); reset(); }}
              style={{
                flex: 1, padding: '10px', border: '2px solid',
                borderColor: mode === value ? (value === 'setup' ? '#0a2540' : '#635bff') : '#d1d5db',
                borderRadius: '8px', backgroundColor: mode === value ? (value === 'setup' ? '#0a2540' : '#635bff') : 'white',
                color: mode === value ? 'white' : '#444',
                fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Config panel */}
        {!clientSecret && (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1a1a1a' }}>Configuration</h3>

            <label style={labelStyle}>Stripe Publishable Key</label>
            <input
              style={inputStyle}
              value={stripePk}
              onChange={e => setStripePk(e.target.value)}
              placeholder="pk_test_..."
              spellCheck={false}
            />

            <div style={{ borderTop: '1px solid #eee', margin: '20px 0' }} />

            {/* Option A */}
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#444', fontWeight: '600' }}>
              Option A — Create a new {mode === 'setup' ? 'SetupIntent' : 'PaymentIntent'}
            </h4>

            {mode === 'payment' && (
              <>
                <label style={labelStyle}>Amount (pence)</label>
                <input
                  style={{ ...inputStyle, width: '120px' }}
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="50"
                />
                <p style={{ margin: '4px 0 12px', fontSize: '12px', color: '#888' }}>
                  £{(parseInt(amount, 10) / 100).toFixed(2)}
                </p>
              </>
            )}

            {mode === 'setup' && (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>
                Creates a Stripe Customer and attaches a SetupIntent to it. No charge is made — the card is saved for future use.
              </p>
            )}

            <button
              onClick={mode === 'setup' ? handleCreateSetupIntent : handleCreatePaymentIntent}
              disabled={loading}
              style={primaryBtnStyle(loading, mode === 'setup' ? '#0a2540' : '#635bff')}
            >
              {loading ? 'Creating…' : `Create ${mode === 'setup' ? 'SetupIntent' : 'PaymentIntent'}`}
            </button>

            <div style={{ borderTop: '1px solid #eee', margin: '20px 0' }} />

            {/* Option B */}
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#444', fontWeight: '600' }}>
              Option B — Paste an existing client_secret
            </h4>
            <label style={labelStyle}>client_secret</label>
            <input
              style={inputStyle}
              value={inputSecret}
              onChange={e => setInputSecret(e.target.value)}
              placeholder={mode === 'setup' ? 'seti_xxx_secret_xxx' : 'pi_xxx_secret_xxx'}
              spellCheck={false}
            />
            <button
              onClick={handleUseSecret}
              disabled={!inputSecret}
              style={{ ...primaryBtnStyle(!inputSecret, '#444'), marginTop: '12px' }}
            >
              Use this secret
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: '6px',
            backgroundColor: '#fff1f0', color: '#cf1322',
            border: '1px solid #ffa39e', marginBottom: '16px', fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {/* Intent info badge */}
        {intentInfo && (
          <div style={{
            padding: '10px 14px', borderRadius: '6px', marginBottom: '12px',
            backgroundColor: '#f0f4ff', border: '1px solid #c7d2fe', fontSize: '13px', color: '#3730a3',
          }}>
            <strong>{intentInfo.type}</strong>: <code style={{ fontSize: '12px' }}>{intentInfo.id}</code>
            {intentInfo.amount && <span style={{ marginLeft: '12px' }}>£{(intentInfo.amount / 100).toFixed(2)}</span>}
            {intentInfo.customerId && <span style={{ marginLeft: '12px' }}>Customer: <code style={{ fontSize: '12px' }}>{intentInfo.customerId}</code></span>}
          </div>
        )}

        {/* Stripe Elements */}
        {clientSecret && stripePromise && (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1a1a1a' }}>
                {mode === 'setup' ? 'Save a card' : 'Enter card details'}
              </h3>
              <button
                onClick={reset}
                style={{ background: 'none', border: 'none', color: '#635bff', cursor: 'pointer', fontSize: '13px' }}
              >
                ← Start over
              </button>
            </div>
            <Elements stripe={stripePromise} options={elementsOptions}>
              <CheckoutForm mode={mode} onError={msg => setError(msg)} />
            </Elements>
          </div>
        )}

      </div>
    </div>
  );
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#444', marginBottom: '6px',
};

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
  borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
  fontFamily: 'monospace', marginBottom: '4px',
};

const primaryBtnStyle = (disabled, color = '#635bff') => ({
  padding: '10px 20px',
  backgroundColor: disabled ? '#999' : color,
  color: 'white', border: 'none', borderRadius: '6px',
  fontSize: '14px', fontWeight: '600',
  cursor: disabled ? 'not-allowed' : 'pointer',
  width: '100%',
});

export default StripePage;
