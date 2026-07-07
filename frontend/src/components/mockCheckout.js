import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const GLOBAL_EVENTS = {
  DISPLAY_BY_PHONE: 'superpayments:displaySignIn',
};

const PRODUCT = {
  name: 'Super Wireless Headphones',
  description: 'Premium noise-cancelling headphones with 30-hour battery life, adaptive ANC, and hi-res audio.',
  price: 4999,
  priceDisplay: '£49.99',
  emoji: '🎧',
};

const EXPERIENCES = [
  {
    id: 'normal',
    title: 'Standard Checkout',
    description: 'Embedded checkout with BNPL, card, and open banking payment options.',
    emoji: '🛒',
    badgeColor: '#4CAF50',
    badgeLabel: 'Normal',
  },
  {
    id: 'save-card',
    title: 'Pay & Save Card',
    description: 'Pay now and save your card for faster future checkouts.',
    emoji: '💳',
    badgeColor: '#1976d2',
    badgeLabel: 'Save Card',
  },
  {
    id: 'add-card',
    title: 'Add Card First',
    description: 'Add a card to your account, then use it to pay in one click.',
    emoji: '➕',
    badgeColor: '#9c27b0',
    badgeLabel: 'Add Card',
  },
];

// ── Shared sub-components ────────────────────────────────────────────────────

const ExperienceBadge = ({ experience, onChangeExperience }) => {
  const exp = EXPERIENCES.find(e => e.id === experience);
  if (!exp) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
        backgroundColor: exp.badgeColor, color: '#fff',
      }}>
        {exp.emoji} {exp.badgeLabel}
      </span>
      <button
        onClick={onChangeExperience}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#666', textDecoration: 'underline', padding: 0 }}
      >
        ← Change experience
      </button>
    </div>
  );
};

const SavedCardDisplay = ({ brand, last4 }) => {
  const brandColors = { VISA: '#1A1F71', MASTERCARD: '#EB001B', AMEX: '#006FCF', DISCOVER: '#FF6000' };
  const brandLogos = { VISA: '𝐕𝐈𝐒𝐀', MASTERCARD: '●●', AMEX: 'AMEX', DISCOVER: 'DISC' };
  const color = brandColors[brand] || '#333';
  const logo = brandLogos[brand] || (brand || 'CARD');

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      borderRadius: '16px', padding: '28px', color: '#fff',
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxWidth: '340px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '28px', borderRadius: '4px', background: 'linear-gradient(135deg, #d4af37 0%, #f2d06b 50%, #d4af37 100%)' }} />
        <span style={{ fontWeight: 'bold', color, fontSize: '16px', letterSpacing: '1px' }}>{logo}</span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '20px', letterSpacing: '4px', marginBottom: '20px' }}>
        •••• •••• •••• {last4 || '????'}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {brand || 'CARD'}
      </div>
    </div>
  );
};

const OrderSummary = () => (
  <div style={{ backgroundColor: '#f9f9f9', padding: '24px', borderRadius: '12px', border: '1px solid #eee' }}>
    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700' }}>Order Summary</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #e0e0e0', marginBottom: '16px' }}>
      <span style={{ fontSize: '32px' }}>{PRODUCT.emoji}</span>
      <div>
        <div style={{ fontWeight: '600', fontSize: '14px' }}>{PRODUCT.name}</div>
        <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Qty: 1</div>
      </div>
      <div style={{ marginLeft: 'auto', fontWeight: '700', fontSize: '15px' }}>{PRODUCT.priceDisplay}</div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '8px' }}>
      <span>Subtotal</span><span>{PRODUCT.priceDisplay}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4CAF50', marginBottom: '12px' }}>
      <span>Delivery</span><span>FREE</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', paddingTop: '12px', borderTop: '2px solid #333' }}>
      <span>Total</span><span>{PRODUCT.priceDisplay}</span>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const MockCheckout = () => {
  // ── Core navigation state ──────────────────────────────────────────────────
  const [step, setStep] = useState('select'); // select | product | basket | billing | checkout | card-setup | card-saved
  const [experience, setExperience] = useState(null);

  // ── Customer / payment state ───────────────────────────────────────────────
  const [customerId, setCustomerId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [savedCard, setSavedCard] = useState(null); // { last4, brand }
  const [addCardPass, setAddCardPass] = useState(1); // 1 = add card, 2 = pay with saved card

  // ── SDK readiness ──────────────────────────────────────────────────────────
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isCardSdkReady, setIsCardSdkReady] = useState(false);

  // ── Billing form ───────────────────────────────────────────────────────────
  const [billing, setBilling] = useState({
    firstName: 'John',
    lastName: 'Smith',
    email: 'johnsmith@hotmail.com',
    phone: '07462123456',
  });

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Refs ───────────────────────────────────────────────────────────────────
  const walletsListenerAdded = useRef(false);
  const billingDetailsRef = useRef(billing);
  useEffect(() => { billingDetailsRef.current = billing; }, [billing]);

  // ── Phone event helper ─────────────────────────────────────────────────────
  const triggerPhoneEvent = (phone) => {
    const el = document.querySelector('super-checkout');
    if (el && phone) {
      document.dispatchEvent(new CustomEvent(GLOBAL_EVENTS.DISPLAY_BY_PHONE, {
        bubbles: true, cancelable: false, composed: true, detail: { phoneNumber: phone },
      }));
    }
  };

  // ── Poll for super-checkout SDK readiness ──────────────────────────────────
  useEffect(() => {
    if (!sessionToken) return;
    setIsSdkReady(false);
    const interval = setInterval(() => {
      if (window.superCheckout?.submit) {
        setIsSdkReady(true);
        clearInterval(interval);
        triggerPhoneEvent(billing.phone);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll for super-card SDK readiness ──────────────────────────────────────
  useEffect(() => {
    if (!sessionToken || step !== 'card-setup') return;
    setIsCardSdkReady(false);
    const interval = setInterval(() => {
      if (window.superCard?.submit) {
        setIsCardSdkReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sessionToken, step]);

  // ── Register wallets handler (save-card experience) ────────────────────────
  useEffect(() => {
    if (experience !== 'save-card' || !checkoutSessionId) return;
    walletsListenerAdded.current = false;

    const interval = setInterval(() => {
      if (window.superCheckout && !walletsListenerAdded.current) {
        walletsListenerAdded.current = true;
        clearInterval(interval);

        window.superCheckout.registerWalletsHandler(async () => {
          try {
            const bd = billingDetailsRef.current;
            const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: PRODUCT.price,
                email: bd.email,
                phone: bd.phone,
                externalReference: `MOCK_ORDER_${Date.now()}`,
                customerId,
              }),
            });
            const data = await response.json();
            if (data.redirectUrl) window.location.href = data.redirectUrl;
          } catch (err) {
            console.error('Wallets handler error:', err);
          }
        });
        console.log('Wallets handler registered');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [experience, checkoutSessionId, customerId]);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const goBack = () => {
    const backMap = {
      product: 'select',
      basket: 'product',
      billing: 'basket',
      checkout: 'billing',
      'card-setup': 'billing',
      'card-saved': 'billing',
    };
    setError('');
    setStep(backMap[step] || 'select');
  };

  const handleSelectExperience = (exp) => {
    setExperience(exp);
    setStep('product');
    // Reset all payment state when changing experience
    setCustomerId(null);
    setPaymentMethodId(null);
    setSessionToken(null);
    setCheckoutSessionId(null);
    setSavedCard(null);
    setAddCardPass(1);
    setIsSdkReady(false);
    setIsCardSdkReady(false);
    setError('');
  };

  // ── Checkout session creation ──────────────────────────────────────────────
  const createCheckoutSession = async (cId) => {
    const body = cId ? { customerId: cId } : {};
    const res = await fetch(`${API_BASE}/checkout-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  // ── handleProceedToBilling: called from basket step ─────────────────────────
  const handleProceedToCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      if (experience === 'normal') {
        const data = await createCheckoutSession(null);
        if (!data.checkoutSessionToken) throw new Error('No session token returned');
        setSessionToken(data.checkoutSessionToken);
        setCheckoutSessionId(data.checkoutSessionId);
        setStep('checkout');
      } else if (experience === 'save-card') {
        // Create customer then checkout session
        const custRes = await fetch(`${API_BASE}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: billing.firstName,
            lastName: billing.lastName,
            emailAddress: billing.email,
            phoneNumber: billing.phone,
            externalReference: `MOCK_CUST_${Date.now()}`,
          }),
        });
        const custData = await custRes.json();
        const cId = custData.id;
        setCustomerId(cId);

        const sessData = await createCheckoutSession(cId);
        if (!sessData.checkoutSessionToken) throw new Error('No session token returned');
        setSessionToken(sessData.checkoutSessionToken);
        setCheckoutSessionId(sessData.checkoutSessionId);
        setStep('checkout');
      } else if (experience === 'add-card') {
        if (addCardPass === 1) {
          // First pass: create customer + payment method + setup intent
          const custRes = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: billing.firstName,
              lastName: billing.lastName,
              emailAddress: billing.email,
              phoneNumber: billing.phone,
              externalReference: `MOCK_CUST_${Date.now()}`,
            }),
          });
          const custData = await custRes.json();
          const cId = custData.id;
          setCustomerId(cId);

          const pmRes = await fetch(`${API_BASE}/payment-methods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: cId }),
          });
          const pmData = await pmRes.json();
          setPaymentMethodId(pmData.id);

          const setupRes = await fetch(`${API_BASE}/payment-methods/${pmData.id}/setup-intents`, {
            method: 'POST',
          });
          const setupData = await setupRes.json();
          setSessionToken(setupData.sessionToken);
          setStep('card-setup');
        } else {
          // Second pass: use saved card for off-session payment
          setStep('checkout');
        }
      }
    } catch (err) {
      console.error('Checkout flow error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handlePlaceOrder: normal / save-card embedded checkout submit ──────────
  const handlePlaceOrder = async () => {
    if (!window.superCheckout) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.superCheckout.submit({
        customerInformation: {
          firstName: billing.firstName,
          lastName: billing.lastName,
          email: billing.email,
          phoneNumber: billing.phone,
        },
      });

      if (result?.status === 'FAILURE') {
        setError(result.errorMessage || 'Payment failed.');
        setLoading(false);
        return;
      }

      const body = {
        amount: PRODUCT.price,
        email: billing.email,
        phone: billing.phone,
        externalReference: `MOCK_ORDER_${Date.now()}`,
      };
      if (customerId) body.customerId = customerId;

      const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const proceedData = await response.json();
      if (proceedData.redirectUrl) {
        window.location.href = proceedData.redirectUrl;
      }
    } catch (err) {
      setError('Communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handleSaveCard: add-card flow first pass ───────────────────────────────
  const handleSaveCard = async () => {
    if (!window.superCard?.submit) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.superCard.submit();
      if (result?.status === 'FAILURE') {
        setError(result.errorMessage || 'Card save failed.');
        setLoading(false);
        return;
      }

      // Fetch card details
      let cardData = window.__stripeCardData || null;
      if (!cardData?.last4) {
        try {
          const pmRes = await fetch(`${API_BASE}/payment-methods/${paymentMethodId}`);
          const pmData = await pmRes.json();
          const findLast4 = (obj, depth = 0) => {
            if (!obj || typeof obj !== 'object' || depth > 8) return null;
            const l4 = obj.last4 ?? obj.Last4 ?? obj.last_four;
            if (l4 && String(l4).replace(/\D/g, '').length === 4) {
              return { last4: String(l4).replace(/\D/g, ''), brand: (obj.brand || obj.display_brand || obj.network || '').toUpperCase() };
            }
            for (const key of Object.keys(obj)) {
              const hit = findLast4(obj[key], depth + 1);
              if (hit) return hit;
            }
            return null;
          };
          cardData = findLast4(pmData);
        } catch (e) {
          console.warn('Could not fetch card details:', e);
        }
      }

      setSavedCard({ last4: cardData?.last4 || null, brand: cardData?.brand || 'CARD' });

      // Reset session/sdk state before moving to card-saved step
      setSessionToken(null);
      setIsCardSdkReady(false);
      setStep('card-saved');
    } catch (err) {
      setError('Error saving card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── handlePayWithSavedCard: add-card flow second pass ─────────────────────
  const handlePayWithSavedCard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/create-off-session-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          paymentMethodId,
          amount: PRODUCT.price,
          externalReference: `MOCK_ORDER_${Date.now()}`,
        }),
      });
      const data = await response.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = '/success';
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputStyle = {
    padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '14px', width: '100%', boxSizing: 'border-box',
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
  const backBtn = {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
    color: '#666', textDecoration: 'underline', padding: '0 0 20px 0', display: 'block',
  };

  // ── Render steps ───────────────────────────────────────────────────────────

  // SELECT
  if (step === 'select') {
    return (
      <div className="layout-page">
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Mock Checkout</h1>
        <p style={{ color: '#666', marginBottom: '32px', fontSize: '15px' }}>
          Choose a checkout experience to simulate a real customer journey.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          {EXPERIENCES.map(exp => (
            <div
              key={exp.id}
              onClick={() => handleSelectExperience(exp.id)}
              style={{
                padding: '28px', borderRadius: '16px', border: '2px solid #e0e0e0',
                cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s',
                backgroundColor: '#fff',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = exp.badgeColor;
                e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.1)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{exp.emoji}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>{exp.title}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#666', lineHeight: '1.5' }}>{exp.description}</p>
              <span style={{
                display: 'inline-block', marginTop: '16px', padding: '4px 12px',
                borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                backgroundColor: exp.badgeColor, color: '#fff',
              }}>{exp.badgeLabel}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // PRODUCT
  if (step === 'product') {
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <button style={backBtn} onClick={goBack}>← Back</button>
        <div className="layout-two-col">
          {/* Left: image placeholder */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#f5f5f5', borderRadius: '16px', minHeight: '320px',
            fontSize: '100px',
          }}>
            {PRODUCT.emoji}
          </div>
          {/* Right: product details */}
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>{PRODUCT.name}</h1>
            <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.6', marginBottom: '20px' }}>{PRODUCT.description}</p>
            <ul style={{ paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '2', marginBottom: '24px' }}>
              <li>30-hour battery life</li>
              <li>Adaptive Active Noise Cancellation</li>
              <li>Hi-Res Audio certified</li>
              <li>Foldable premium design</li>
              <li>USB-C fast charging</li>
            </ul>
            <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '24px' }}>{PRODUCT.priceDisplay}</div>
            <button style={primaryBtn} onClick={() => setStep('basket')}>
              Add to Basket
            </button>
          </div>
        </div>
      </div>
    );
  }

  // BASKET
  if (step === 'basket') {
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <button style={backBtn} onClick={goBack}>← Back</button>
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
          <button style={secondaryBtn} onClick={() => setStep('product')}>← Continue Shopping</button>
          <button style={{ ...primaryBtn, width: 'auto', padding: '12px 32px' }} onClick={() => setStep('billing')}>
            Proceed to Checkout →
          </button>
        </div>
      </div>
    );
  }

  // BILLING
  if (step === 'billing') {
    const isSecondPass = experience === 'add-card' && addCardPass === 2;
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <button style={backBtn} onClick={goBack}>← Back</button>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Your Details</h1>

        {isSecondPass && (
          <div style={{
            padding: '16px 20px', marginBottom: '24px', backgroundColor: '#e8f5e9',
            border: '1px solid #4CAF50', borderRadius: '10px', fontSize: '14px', color: '#2e7d32',
          }}>
            ✅ You have a saved card — confirm your details to proceed.
          </div>
        )}

        <div style={{ maxWidth: '500px' }}>
          <div className="form-grid-two-col" style={{ marginBottom: '16px' }}>
            <input
              placeholder="First Name"
              style={inputStyle}
              value={billing.firstName}
              onChange={e => setBilling({ ...billing, firstName: e.target.value })}
            />
            <input
              placeholder="Last Name"
              style={inputStyle}
              value={billing.lastName}
              onChange={e => setBilling({ ...billing, lastName: e.target.value })}
            />
            <input
              placeholder="Email"
              style={{ ...inputStyle, gridColumn: 'span 2' }}
              value={billing.email}
              onChange={e => setBilling({ ...billing, email: e.target.value })}
            />
            <input
              placeholder="Phone"
              style={{ ...inputStyle, gridColumn: 'span 2', border: '2px solid #000' }}
              value={billing.phone}
              onChange={e => setBilling({ ...billing, phone: e.target.value })}
            />
          </div>
          {error && <p style={{ color: '#e53935', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}
          <button
            style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            onClick={handleProceedToCheckout}
            disabled={loading}
          >
            {loading ? 'Processing...' : isSecondPass ? 'Continue to Payment →' : 'Continue to Checkout →'}
          </button>
        </div>
      </div>
    );
  }

  // CHECKOUT (normal + save-card embedded, or add-card second pass saved card)
  if (step === 'checkout') {
    const isAddCardSecondPass = experience === 'add-card' && addCardPass === 2;

    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <button style={backBtn} onClick={goBack}>← Back</button>
        <div className="layout-two-col">
          {/* Left: order summary */}
          <OrderSummary />

          {/* Right: checkout */}
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
            {isAddCardSecondPass ? (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>Pay with Saved Card</h2>
                {savedCard && <SavedCardDisplay brand={savedCard.brand} last4={savedCard.last4} />}
                {error && <p style={{ color: '#e53935', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}
                <button
                  style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                  onClick={handlePayWithSavedCard}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : `Pay ${PRODUCT.priceDisplay}`}
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>Secure Checkout</h2>
                {sessionToken ? (
                  <>
                    <super-checkout
                      key={sessionToken}
                      amount={String(PRODUCT.price)}
                      checkout-session-token={sessionToken}
                      title="Secure Checkout"
                      subtitle="Pay with Super and earn cash rewards"
                      payment-methods-order="BNPL,CARD,OPEN_BANKING"
                      pre-selected-payment-method="CARD"
                      {...(experience === 'save-card' ? { 'support-express-wallets': 'true' } : {})}
                    />
                    {isSdkReady && (
                      <button
                        onClick={handlePlaceOrder}
                        disabled={loading}
                        style={{
                          ...primaryBtn, marginTop: '24px',
                          opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {loading ? 'Processing...' : `Place Order — ${PRODUCT.priceDisplay}`}
                      </button>
                    )}
                    {error && <p style={{ color: '#e53935', fontSize: '14px', marginTop: '10px' }}>{error}</p>}
                  </>
                ) : (
                  <p style={{ color: '#666' }}>Initializing gateway...</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CARD SETUP (add-card flow, first pass)
  if (step === 'card-setup') {
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <button style={backBtn} onClick={goBack}>← Back</button>
        <div style={{ maxWidth: '480px' }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Add a Card</h1>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '28px' }}>
            No payment taken now — your card will be saved securely for future use.
          </p>
          <div style={{ border: '1px solid #e0e0e0', padding: '24px', borderRadius: '12px', marginBottom: '20px', backgroundColor: '#fff' }}>
            {sessionToken ? (
              <super-card session-token={sessionToken} test-use-otp="true" />
            ) : (
              <p style={{ color: '#666' }}>Loading card form...</p>
            )}
          </div>
          {error && <p style={{ color: '#e53935', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}
          {sessionToken && (
            <button
              style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              onClick={handleSaveCard}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Card'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // CARD SAVED
  if (step === 'card-saved') {
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <div style={{ maxWidth: '480px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Card Saved!</h1>
          <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
            Your card has been saved to your account. Next time you check out,
            you can pay in one click without re-entering your card details.
          </p>
          {savedCard && <SavedCardDisplay brand={savedCard.brand} last4={savedCard.last4} />}
          <button
            style={{ ...primaryBtn, marginTop: '8px' }}
            onClick={() => {
              setAddCardPass(2);
              setStep('product');
            }}
          >
            Continue Shopping →
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default MockCheckout;
