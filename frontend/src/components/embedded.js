import React, { useState, useEffect, useCallback, useRef } from 'react';

// NGROK: set to '' to proxy via React dev server (ngrok mode)
// TO REVERT TO LOCALHOST: change back to 'http://localhost:5000'
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Apple and Google return their own raw contact shapes, so branch on
// detail.type before reading fields. Apple uses givenName/familyName and an
// addressLines array; Google uses a single name and address1.
const normaliseWalletContact = (detail) => {
  if (!detail || !detail.type) return null;
  const pick = (addr) => {
    if (!addr) return null;
    if (detail.type === 'applepay') {
      return {
        firstName: addr.givenName ?? null,
        lastName: addr.familyName ?? null,
        addressLine1: Array.isArray(addr.addressLines) ? (addr.addressLines[0] ?? null) : null,
        addressLine2: Array.isArray(addr.addressLines) ? (addr.addressLines[1] ?? null) : null,
        city: addr.locality ?? null,
        county: addr.administrativeArea ?? null,
        postCode: addr.postalCode ?? null,
        country: addr.countryCode ?? null,
        email: addr.emailAddress ?? null,
        phone: addr.phoneNumber ?? null,
      };
    }
    // googlepay
    return {
      firstName: (addr.name || '').split(' ')[0] || null,
      lastName: (addr.name || '').split(' ').slice(1).join(' ') || null,
      addressLine1: addr.address1 ?? null,
      addressLine2: addr.address2 ?? null,
      city: addr.locality ?? null,
      county: addr.administrativeArea ?? null,
      postCode: addr.postalCode ?? null,
      country: addr.countryCode ?? null,
      email: addr.emailAddress ?? null,
      phone: addr.phoneNumber ?? null,
    };
  };
  return {
    type: detail.type,
    email: detail.email ?? null,
    billing: pick(detail.billingAddress),
    shipping: pick(detail.shippingAddress),
  };
};

const CheckoutPage = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Controls the "Place Order" button visibility based on the global SDK object
  const [isSdkReady, setIsSdkReady] = useState(false);

  const [sdkConfig, setSdkConfig] = useState(() => {
    const saved = localStorage.getItem('sdk_config');
    return saved ? { ...JSON.parse(saved), subtitle: 'Pay with Super and earn cash rewards' } : {
      paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
      preSelectedPaymentMethod: 'CARD',
      title: 'Secure Checkout',
      subtitle: 'Pay with Super and earn cash rewards',
      amount: 15000,
    };
  });

  const [billingDetails, setBillingDetails] = useState({
    firstName: 'Mark',
    lastName: 'SFour',
    email: 'SFour@hotmail.com',
    phoneNumber: '07462753541',
    street: 'London Street',
    country: 'United Kingdom',
    postcode: 'SW1A 1AA'
  });

  // Always holds the latest billing details for the wallets handler closure
  const billingDetailsRef = useRef(billingDetails);
  useEffect(() => { billingDetailsRef.current = billingDetails; }, [billingDetails]);

  const walletsListenerAdded = useRef(false);

  /**
   * REFINED READINESS CHECK
   * Instead of probing the Shadow DOM, we monitor the global window object.
   */
  useEffect(() => {
    const savedConfig = localStorage.getItem('sdk_config');
    if (savedConfig) {
      setSdkConfig(JSON.parse(savedConfig));
    }

    console.log("Payment method Order: " + sdkConfig.paymentMethodsOrder)

    const checkInterval = setInterval(() => {
      // Logic suggested by engineer: Check for the submit method on the global object
      const ready = Boolean(window.superCheckout && window.superCheckout.submit);

      if (ready) {
        console.log('✅ SDK submit method detected. Component is ready.');
        setIsSdkReady(true);
        clearInterval(checkInterval);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, []);

  // Register Apple Pay / Google Pay express button handler.
  // Must be registered BEFORE <super-checkout> renders so the SDK can show wallet buttons.
  // Follows the official docs pattern: poll every 500ms with a listenerAdded guard.
  useEffect(() => {
    if (!checkoutSessionId) return;
    walletsListenerAdded.current = false;

    const interval = setInterval(() => {
      if (window.superCheckout && !walletsListenerAdded.current) {
        walletsListenerAdded.current = true;
        clearInterval(interval);

        window.superCheckout.registerWalletsHandler(async (event) => {
          const detail = event?.detail;
          // Log the raw object. A JSON round-trip drops keys whose value is
          // undefined, which is exactly what hid the address fields before.
          console.log('[Wallets] raw event.detail:', detail);
          console.log('[Wallets] detail keys:', detail ? Object.keys(detail) : null);
          console.log('[Wallets] type:', detail?.type);
          console.log('[Wallets] email:', detail?.email);
          console.log('[Wallets] billingAddress:', detail?.billingAddress);
          console.log('[Wallets] shippingAddress:', detail?.shippingAddress);
          const contact = normaliseWalletContact(detail);
          console.log('[Wallets] normalised:', contact);
          // By the time this fires the SDK has already created a paymentIntent
          // with the wallet token and resolved the wallet sheet. Nothing thrown
          // or returned here can stop that; only /proceed completes the payment.
          console.log('[Wallets] handler fired — sheet already resolved; calling /proceed next');
          try {
            const bd = billingDetailsRef.current;
            const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: sdkConfig.amount,
                firstName: contact?.billing?.firstName || bd.firstName,
                lastName: contact?.billing?.lastName || bd.lastName,
                email: contact?.email || contact?.billing?.email || bd.email,
                phone: contact?.billing?.phone || bd.phoneNumber,
                externalReference: `ORDER_${Date.now()}`,
              }),
            });
            const proceedData = await response.json();
            console.log('[Wallets] proceed HTTP', response.status, proceedData);
            if (proceedData.redirectUrl) {
              console.log('[Wallets] redirecting to', proceedData.redirectUrl);
              window.location.href = proceedData.redirectUrl;
              return;
            }
            // No redirect means the payment was not completed. Surface it —
            // wallets have no submit()-style { status, errorMessage } result.
            const msg = proceedData.detail || proceedData.error || `Proceed failed (HTTP ${response.status})`;
            console.error('[Wallets] no redirectUrl returned:', msg);
            setErrorMessage(msg);
          } catch (err) {
            console.error('[Wallets] handler error:', err);
            setErrorMessage(err?.message || 'Communication error completing the wallet payment.');
          }
        });
        console.log('✅ Wallets handler registered');
      }
    }, 500);

    // The SDK attaches the handler as a window listener and overwrites its
    // AbortController on each register, so an unpaired re-register leaks a
    // listener that can never be removed — and each extra listener fires another
    // /proceed. Always unregister on cleanup.
    return () => {
      clearInterval(interval);
      if (walletsListenerAdded.current) {
        walletsListenerAdded.current = false;
        try {
          window.superCheckout?.unregisterWalletHandler?.();
          console.log('🧹 Wallets handler unregistered');
        } catch (err) {
          console.warn('Wallets handler unregister failed:', err);
        }
      }
    };
  }, [checkoutSessionId]);

  const handleSaveDetails = useCallback(() => {
    localStorage.setItem('billing_cache', JSON.stringify(billingDetails));
  }, [billingDetails]);

  const handlePlaceOrder = async () => {
    if (!window.superCheckout) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await window.superCheckout.submit({
        customerInformation: {
          firstName: billingDetails.firstName,
          lastName: billingDetails.lastName,
          email: billingDetails.email,
          phoneNumber: billingDetails.phoneNumber,
        },
      });

      console.log("Result Status " + result.status)

      if (result.status === 'FAILURE') {
        setErrorMessage(result.errorMessage || 'Payment Failed');
        setLoading(false);
        return;
      }

      // Backend Proceed call
      const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: sdkConfig.amount,
          firstName: billingDetails.firstName,
          lastName: billingDetails.lastName,
          email: billingDetails.email,
          phone: billingDetails.phoneNumber,
          externalReference: `ORDER_${Date.now()}`,
        }),
      });

      const proceedData = await response.json();
      console.log("Proceed Response Error: " + proceedData.detail)
      console.log("Proceed Response Redirect URL: " + proceedData.redirectUrl)
      console.log("Proceed Response Decline Reason: " + proceedData.extensions?.issues?.declineReason)
      if (proceedData.redirectUrl) {
        window.location.href = proceedData.redirectUrl;
      }
    } catch (err) {
      setErrorMessage('Communication error with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_BASE}/checkout-sessions`, { method: 'POST' });
        const data = await res.json();
        if (data.checkoutSessionToken) {
          setSessionToken(data.checkoutSessionToken);
          setCheckoutSessionId(data.checkoutSessionId);
        }
      } catch (e) { console.error("Session failed"); }
    };
    init();
  }, []);

  const refreshKey = `${sessionToken}-${sdkConfig.paymentMethodsOrder}`;
  const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', boxSizing: 'border-box' };

  return (
    <div className="layout-two-col">
      
      {/* LEFT COLUMN: BILLING FORM */}
      <div>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px' }}>Billing Address</h2>
        <div className="form-grid-two-col" style={{ marginTop: '20px' }}>
          <input placeholder="First Name" style={inputStyle} value={billingDetails.firstName} onChange={e => setBillingDetails({...billingDetails, firstName: e.target.value})} />
          <input placeholder="Last Name" style={inputStyle} value={billingDetails.lastName} onChange={e => setBillingDetails({...billingDetails, lastName: e.target.value})} />
          <input placeholder="Email" style={{...inputStyle, gridColumn: 'span 2'}} value={billingDetails.email} onChange={e => setBillingDetails({...billingDetails, email: e.target.value})} />
          <input placeholder="Phone" style={{...inputStyle, gridColumn: 'span 2', border: '2px solid #000'}} value={billingDetails.phoneNumber} onChange={e => setBillingDetails({...billingDetails, phoneNumber: e.target.value})} />
          <input placeholder="Street" style={{...inputStyle, gridColumn: 'span 2'}} value={billingDetails.street} onChange={e => setBillingDetails({...billingDetails, street: e.target.value})} />
          <input placeholder="Postcode" style={inputStyle} value={billingDetails.postcode} onChange={e => setBillingDetails({...billingDetails, postcode: e.target.value})} />
          <select style={inputStyle} value={billingDetails.country} onChange={e => setBillingDetails({...billingDetails, country: e.target.value})}>
            <option value="United Kingdom">United Kingdom</option>
          </select>
        </div>
        <button 
          onClick={handleSaveDetails}
          style={{ width: '100%', marginTop: '20px', padding: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Save Details
        </button>
      </div>

      {/* RIGHT COLUMN: SDK & CONDITIONAL BUTTON */}
      <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '25px' }}>Embedded Checkout</h2>
        {sessionToken ? (
          <>
            <super-checkout
              key={refreshKey}
              amount={String(sdkConfig.amount)}
              checkout-session-token={sessionToken}
              title={sdkConfig.title}
              subtitle={sdkConfig.subtitle}
              {...(sdkConfig.paymentMethodsOrder
                ? { 'payment-methods-order': sdkConfig.paymentMethodsOrder } : {})}
              {...(sdkConfig.preSelectedPaymentMethod
                ? { 'pre-selected-payment-method': sdkConfig.preSelectedPaymentMethod } : {})}
            />

            {isSdkReady && (
              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                style={{
                  width: '100%', marginTop: '25px', padding: '18px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1
                }}
              >
                {loading ? 'Processing Order...' : `Place Order — £${(sdkConfig.amount / 100).toFixed(2)}`}
              </button>
            )}
            
            {errorMessage && <p style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>{errorMessage}</p>}
          </>
        ) : <p>Initializing gateway...</p>}
      </div>
    </div>
  );
};

export default CheckoutPage;