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

const UPSELL_PRODUCT = {
  name: 'Super Carry Case',
  description: 'Premium travel case with custom-fit foam protection designed for your new headphones.',
  price: 1999,
  priceDisplay: '£19.99',
  emoji: '🎒',
};

const TIERS = {
  standard: {
    label: 'Standard',
    emoji: '🛒',
    amount: PRODUCT.price,
    color: '#4CAF50',
    perks: ['Standard delivery (3–5 days)', 'Email support'],
  },
  vip: {
    label: 'VIP',
    emoji: '👑',
    amount: PRODUCT.price + 1000,
    color: '#7b1fa2',
    perks: ['Express delivery (next day)', 'Priority phone support', 'Extended 3-year warranty', 'Gift wrapping included'],
  },
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
  {
    id: 'upsell',
    title: 'Pay, Save & Upsell',
    description: 'Pay and save your card, then get offered a one-click upsell charged instantly to the saved card.',
    emoji: '🛍️',
    badgeColor: '#ff6f00',
    badgeLabel: 'Upsell',
  },
  {
    id: 'tiered',
    title: 'VIP vs Standard',
    description: 'Customer picks a tier (VIP or Standard) after the session loads — each has a different amount, updating the checkout live.',
    emoji: '👑',
    badgeColor: '#7b1fa2',
    badgeLabel: 'Tiered',
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
  const [step, setStep] = useState('select'); // select | product | basket | billing | checkout | card-setup | card-saved | upsell | upsell-complete
  const [experience, setExperience] = useState(null);

  // ── Customer / payment state ───────────────────────────────────────────────
  const [customerId, setCustomerId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [savedCard, setSavedCard] = useState(null); // { last4, brand }
  const [addCardPass, setAddCardPass] = useState(1); // 1 = add card, 2 = pay with saved card
  const [upsellPaymentMethodId, setUpsellPaymentMethodId] = useState(null);

  // ── Tiered experience state ────────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState(null); // null | 'standard' | 'vip'
  const [checkoutAmount, setCheckoutAmount] = useState(PRODUCT.price);

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
      upsell: null, // order already placed — no going back
      'upsell-complete': null,
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
    setUpsellPaymentMethodId(null);
    setSelectedTier(null);
    setCheckoutAmount(PRODUCT.price);
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
      if (experience === 'normal' || experience === 'tiered') {
        const data = await createCheckoutSession(null);
        if (!data.checkoutSessionToken) throw new Error('No session token returned');
        setSessionToken(data.checkoutSessionToken);
        setCheckoutSessionId(data.checkoutSessionId);
        setStep('checkout');
      } else if (experience === 'save-card' || experience === 'upsell') {
        // Create customer then checkout session (card will be saved after payment)
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
        amount: experience === 'tiered' ? checkoutAmount : PRODUCT.price,
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

      if (experience === 'upsell') {
        // Don't redirect — poll webhooks for customer.payment_method.enabled event
        // to get the paymentMethodId of the card saved during checkout.
        console.log('[Upsell] Polling webhooks for customer.payment_method.enabled...');
        let pmId = null;
        const pollStart = Date.now();
        while (Date.now() - pollStart < 15000) {
          try {
            const whRes = await fetch(`${API_BASE}/webhooks`);
            const webhooks = await whRes.json();
            const event = webhooks.find(w =>
              w.payload?.eventType === 'customer.payment_method.enabled' &&
              w.payload?.data?.customerId === customerId
            );
            if (event) {
              pmId = event.payload.data.paymentMethodId;
              console.log('[Upsell] Found paymentMethodId from webhook:', pmId);
              break;
            }
          } catch (e) {
            console.warn('[Upsell] Webhook poll error:', e);
          }
          await new Promise(r => setTimeout(r, 1500));
        }

        if (!pmId) {
          setError('Could not retrieve saved payment method — webhook not received within 15s. Please try again.');
          setLoading(false);
          return;
        }

        setUpsellPaymentMethodId(pmId);
        setSavedCard({
          last4: window.__stripeCardData?.last4 || null,
          brand: (window.__adyenCardBrand || window.__stripeCardData?.brand || 'CARD').toUpperCase(),
        });
        setStep('upsell');
      } else if (proceedData.redirectUrl) {
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

  // ── handleUpsellPurchase: one-click buy with saved card ───────────────────
  const handleUpsellPurchase = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/create-off-session-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          paymentMethodId: upsellPaymentMethodId,
          amount: UPSELL_PRODUCT.price,
          externalReference: `MOCK_UPSELL_${Date.now()}`,
        }),
      });
      const data = await response.json();
      console.log('[Upsell] Off-session payment result:', data);
      setStep('upsell-complete');
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

  // CHECKOUT (normal + save-card + upsell embedded, tiered, or add-card second pass)
  if (step === 'checkout') {
    const isAddCardSecondPass = experience === 'add-card' && addCardPass === 2;
    const isTiered = experience === 'tiered';

    // For tiered: update amount attribute directly on the mounted web component — no remount
    const handleSelectTier = (tier) => {
      const newAmount = TIERS[tier].amount;
      setSelectedTier(tier);
      setCheckoutAmount(newAmount);
      const el = document.querySelector('super-checkout');
      if (el) el.setAttribute('amount', String(newAmount));
    };

    const activeAmount = isTiered ? checkoutAmount : PRODUCT.price;
    const activePriceDisplay = `£${(activeAmount / 100).toFixed(2)}`;

    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <button style={backBtn} onClick={goBack}>← Back</button>

        {/* Tiered: full-width tier selector above the checkout columns */}
        {isTiered && (
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: '700' }}>
              Choose your package
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '680px' }}>
              {Object.entries(TIERS).map(([key, tier]) => {
                const isActive = selectedTier === key;
                return (
                  <div
                    key={key}
                    onClick={() => handleSelectTier(key)}
                    style={{
                      padding: '20px', borderRadius: '12px', cursor: 'pointer',
                      border: `2px solid ${isActive ? tier.color : '#e0e0e0'}`,
                      backgroundColor: isActive ? `${tier.color}10` : '#fff',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <span style={{ fontSize: '20px', marginRight: '8px' }}>{tier.emoji}</span>
                        <span style={{ fontWeight: '700', fontSize: '16px' }}>{tier.label}</span>
                      </div>
                      <span style={{
                        fontWeight: '800', fontSize: '18px',
                        color: isActive ? tier.color : '#333',
                      }}>
                        £{(tier.amount / 100).toFixed(2)}
                      </span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#555', lineHeight: '1.8' }}>
                      {tier.perks.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                    {isActive && (
                      <div style={{
                        marginTop: '10px', padding: '4px 10px',
                        backgroundColor: tier.color, color: '#fff',
                        borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                        display: 'inline-block',
                      }}>
                        ✓ Selected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="layout-two-col">
          {/* Left: order summary (dynamic total for tiered) */}
          <div style={{ backgroundColor: '#f9f9f9', padding: '24px', borderRadius: '12px', border: '1px solid #eee' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700' }}>Order Summary</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #e0e0e0', marginBottom: '16px' }}>
              <span style={{ fontSize: '32px' }}>{PRODUCT.emoji}</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{PRODUCT.name}</div>
                {isTiered && selectedTier && (
                  <div style={{ fontSize: '12px', color: TIERS[selectedTier].color, fontWeight: '600', marginTop: '2px' }}>
                    {TIERS[selectedTier].label} Package
                  </div>
                )}
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Qty: 1</div>
              </div>
              <div style={{ marginLeft: 'auto', fontWeight: '700', fontSize: '15px' }}>{activePriceDisplay}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              <span>Subtotal</span><span>{activePriceDisplay}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4CAF50', marginBottom: '12px' }}>
              <span>Delivery</span><span>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', paddingTop: '12px', borderTop: '2px solid #333' }}>
              <span>Total</span><span>{activePriceDisplay}</span>
            </div>
          </div>

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
            ) : isTiered && !selectedTier ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', flexDirection: 'column', gap: '12px', color: '#999' }}>
                <span style={{ fontSize: '40px' }}>☝️</span>
                <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>Select a package above to load the checkout</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>Secure Checkout</h2>
                {sessionToken ? (
                  <>
                    <super-checkout
                      key={sessionToken}
                      amount={String(activeAmount)}
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
                        {loading ? 'Processing...' : `Place Order — ${activePriceDisplay}`}
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

  // UPSELL
  if (step === 'upsell') {
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />

        {/* Post-purchase confirmation banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 24px', marginBottom: '36px',
          backgroundColor: '#e8f5e9', border: '1px solid #4CAF50', borderRadius: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>✅</span>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#2e7d32' }}>Order confirmed!</div>
            <div style={{ fontSize: '13px', color: '#388e3c', marginTop: '2px' }}>
              Your {PRODUCT.name} is on its way. Your card has been saved for future purchases.
            </div>
          </div>
        </div>

        {/* Upsell offer */}
        <div style={{ maxWidth: '680px' }}>
          <div style={{
            padding: '6px 16px', backgroundColor: '#ff6f00', color: '#fff',
            borderRadius: '20px', fontSize: '12px', fontWeight: '700',
            display: 'inline-block', marginBottom: '16px', letterSpacing: '0.5px',
          }}>
            ⚡ SPECIAL OFFER — Just for you
          </div>
          <h1 style={{ fontSize: '1.7rem', margin: '0 0 8px' }}>Complete the set</h1>
          <p style={{ color: '#666', fontSize: '15px', marginBottom: '28px' }}>
            Customers who bought the {PRODUCT.name} also love this:
          </p>

          <div style={{
            display: 'flex', gap: '28px', padding: '28px',
            backgroundColor: '#fff', border: '2px solid #ff6f00',
            borderRadius: '16px', alignItems: 'center', marginBottom: '28px',
            boxShadow: '0 4px 20px rgba(255,111,0,0.1)',
          }}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '12px',
              backgroundColor: '#fff8f0', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '52px', flexShrink: 0,
            }}>
              {UPSELL_PRODUCT.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>{UPSELL_PRODUCT.name}</h2>
              <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
                {UPSELL_PRODUCT.description}
              </p>
              <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{UPSELL_PRODUCT.priceDisplay}</div>
            </div>
          </div>

          {/* Saved card confirmation */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 18px', backgroundColor: '#f5f5f5',
            borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#555',
          }}>
            <span style={{ fontSize: '20px' }}>💳</span>
            <span>
              Charged instantly to your saved card
              {savedCard?.last4 ? ` •••• ${savedCard.last4}` : ''}
              {savedCard?.brand ? ` (${savedCard.brand})` : ''}
              {' '}— no checkout needed.
            </span>
          </div>

          {error && <p style={{ color: '#e53935', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              style={{
                flex: 1, minWidth: '200px', padding: '16px',
                backgroundColor: '#ff6f00', color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
              onClick={handleUpsellPurchase}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Buy Now — ${UPSELL_PRODUCT.priceDisplay}`}
            </button>
            <button
              style={{
                padding: '16px 24px', backgroundColor: '#fff', color: '#666',
                border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px',
                fontWeight: '600', cursor: 'pointer',
              }}
              onClick={() => setStep('upsell-complete')}
              disabled={loading}
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UPSELL COMPLETE
  if (step === 'upsell-complete') {
    const boughtUpsell = upsellPaymentMethodId !== null;
    return (
      <div className="layout-page">
        <ExperienceBadge experience={experience} onChangeExperience={() => setStep('select')} />
        <div style={{ maxWidth: '520px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
            {boughtUpsell ? 'All done — great choice!' : 'Order complete!'}
          </h1>
          <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
            {boughtUpsell
              ? `Your ${PRODUCT.name} and ${UPSELL_PRODUCT.name} are confirmed. The upsell was charged in one click with your saved card — no re-entering details.`
              : `Your ${PRODUCT.name} is confirmed. Your card is saved for next time.`}
          </p>

          {/* Order recap */}
          <div style={{
            backgroundColor: '#f9f9f9', borderRadius: '12px',
            border: '1px solid #e0e0e0', overflow: 'hidden', marginBottom: '28px',
          }}>
            <div style={{ padding: '14px 20px', fontWeight: '700', fontSize: '13px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f0f0f0' }}>
              Order Summary
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>
              <span>{PRODUCT.emoji} {PRODUCT.name}</span>
              <span style={{ fontWeight: '600' }}>{PRODUCT.priceDisplay}</span>
            </div>
            {boughtUpsell && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}>
                <span>{UPSELL_PRODUCT.emoji} {UPSELL_PRODUCT.name}</span>
                <span style={{ fontWeight: '600' }}>{UPSELL_PRODUCT.priceDisplay}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', fontSize: '15px', fontWeight: '700' }}>
              <span>Total</span>
              <span>£{((PRODUCT.price + (boughtUpsell ? UPSELL_PRODUCT.price : 0)) / 100).toFixed(2)}</span>
            </div>
          </div>

          <button
            style={{ padding: '14px 28px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
            onClick={() => setStep('select')}
          >
            ← Back to experiences
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default MockCheckout;
