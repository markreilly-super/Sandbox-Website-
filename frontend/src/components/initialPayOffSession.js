import React, { useState, useEffect, useCallback, useRef } from 'react';

// TO REVERT TO LOCALHOST: change back to 'http://localhost:5000'
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const GLOBAL_EVENTS = {
  DISPLAY_BY_PHONE: 'superpayments:displaySignIn',
};

const InitialPayOffSession = () => {
  const [step, setStep] = useState(0); // 0=idle, 1=creating customer, 2=creating session, 3=ready to pay
  const [customerId, setCustomerId] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSdkReady, setIsSdkReady] = useState(false);

  const sdkConfig = {
    paymentMethodsOrder: 'CARD',
    preSelectedPaymentMethod: 'CARD',
    title: 'Secure Checkout',
    subtitle: 'Pay with Super and save your card',
  };

  const [billingDetails, setBillingDetails] = useState({
    firstName: 'John',
    lastName: 'Smith',
    email: 'johnsmith@hotmail.com',
    phoneNumber: '07462123456',
    street: 'London Street',
    country: 'United Kingdom',
    postcode: 'SW1A 1AA',
  });

  const phoneRef = useRef(billingDetails.phoneNumber);
  useEffect(() => { phoneRef.current = billingDetails.phoneNumber; }, [billingDetails.phoneNumber]);

  // Always holds latest billing details for the wallets handler closure
  const billingDetailsRef = useRef(billingDetails);
  useEffect(() => { billingDetailsRef.current = billingDetails; }, [billingDetails]);

  const bnplObserverRef = useRef(null);
  const walletsListenerAdded = useRef(false);

  const triggerCustomPhoneNumberEvent = useCallback((phoneNumber) => {
    const el = document.querySelector('super-checkout');
    if (el && phoneNumber) {
      document.dispatchEvent(new CustomEvent(GLOBAL_EVENTS.DISPLAY_BY_PHONE, {
        bubbles: true, cancelable: false, composed: true,
        detail: { phoneNumber },
      }));
    }
  }, []);

  // Poll for SDK readiness once a session exists
  useEffect(() => {
    if (!sessionToken) return;
    const interval = setInterval(() => {
      if (window.superCheckout?.submit) {
        setIsSdkReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sessionToken]);

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

        window.superCheckout.registerWalletsHandler(async () => {
          try {
            const bd = billingDetailsRef.current;
            const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: 15000,
                email: bd.email,
                phone: bd.phoneNumber,
                externalReference: `ORDER_${Date.now()}`,
                customerId,
              }),
            });
            const proceedData = await response.json();
            if (proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;
          } catch (err) {
            console.error('Wallets handler error:', err);
          }
        });
        console.log('✅ Wallets handler registered');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [checkoutSessionId, customerId]);

  // MutationObserver for BNPL phone injection (same pattern as embedded.js)
  useEffect(() => {
    if (!sessionToken) return;
    let pollInterval;
    pollInterval = setInterval(() => {
      const el = document.querySelector('super-checkout');
      if (el?.shadowRoot) { clearInterval(pollInterval); }
    }, 200);
    return () => {
      clearInterval(pollInterval);
      if (bnplObserverRef.current) { bnplObserverRef.current.disconnect(); bnplObserverRef.current = null; }
    };
  }, [sessionToken]);

  const handleInitialize = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      // Step 1: Create customer with billing details
      setStep(1);
      const custRes = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: billingDetails.firstName,
          lastName: billingDetails.lastName,
          emailAddress: billingDetails.email,
          phoneNumber: billingDetails.phoneNumber,
          externalReference: `customer_${Date.now()}`,
        }),
      });
      const custData = await custRes.json();
      if (!custData.id) throw new Error(custData.detail || custData.error || 'Failed to create customer');
      setCustomerId(custData.id);

      // Step 2: Create checkout session with the customer ID attached
      setStep(2);
      const sessRes = await fetch(`${API_BASE}/checkout-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: custData.id }),
      });
      const sessData = await sessRes.json();
      if (!sessData.checkoutSessionToken) throw new Error(sessData.detail || sessData.error || 'Failed to create session');
      setSessionToken(sessData.checkoutSessionToken);
      setCheckoutSessionId(sessData.checkoutSessionId);
      setStep(3);
    } catch (err) {
      setErrorMessage(err.message || 'Initialization failed');
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

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
      if (result.status === 'FAILURE') {
        setErrorMessage(result.errorMessage || 'Payment failed');
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 15000,
          email: billingDetails.email,
          phone: billingDetails.phoneNumber,
          externalReference: `ORDER_${Date.now()}`,
          customerId,
        }),
      });
      const proceedData = await response.json();
      if (proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;
    } catch (err) {
      setErrorMessage('Communication error with server.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
    fontSize: '14px', width: '100%', boxSizing: 'border-box',
  };

  const steps = [
    { label: 'Create Customer', done: step >= 2, active: step === 1 },
    { label: 'Create Session',  done: step >= 3, active: step === 2 },
    { label: 'Complete Payment', done: false,   active: step === 3 },
  ];

  const isFormDisabled = step > 0;

  return (
    <div className="layout-page">

      {/* Staging notice */}
      <div style={{
        background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px',
        padding: '12px 20px', marginBottom: '28px', fontSize: '14px', color: '#555',
      }}>
        Environment is controlled by your selection on the <strong>Account Settings</strong> page.
      </div>

      <div className="layout-two-col" style={{ padding: 0 }}>

        {/* LEFT: customer details + step tracker */}
        <div>
          <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: 0 }}>
            Customer Details
          </h2>

          {/* Step tracker */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', marginTop: '20px', marginBottom: '24px' }}>
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    margin: '0 auto 6px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 'bold', fontSize: '14px',
                    backgroundColor: s.done ? '#4CAF50' : s.active ? '#000' : '#e0e0e0',
                    color: s.done || s.active ? 'white' : '#666',
                  }}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: '11px', color: s.done ? '#4CAF50' : s.active ? '#000' : '#999' }}>
                    {s.label}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 'none', width: '24px', height: '2px', backgroundColor: step > i + 1 ? '#4CAF50' : '#e0e0e0', marginTop: '15px' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="form-grid-two-col">
            <input
              placeholder="First Name" style={inputStyle} disabled={isFormDisabled}
              value={billingDetails.firstName}
              onChange={e => setBillingDetails({ ...billingDetails, firstName: e.target.value })}
            />
            <input
              placeholder="Last Name" style={inputStyle} disabled={isFormDisabled}
              value={billingDetails.lastName}
              onChange={e => setBillingDetails({ ...billingDetails, lastName: e.target.value })}
            />
            <input
              placeholder="Email" style={{ ...inputStyle, gridColumn: 'span 2' }} disabled={isFormDisabled}
              value={billingDetails.email}
              onChange={e => setBillingDetails({ ...billingDetails, email: e.target.value })}
            />
            <input
              placeholder="Phone" disabled={isFormDisabled}
              style={{ ...inputStyle, gridColumn: 'span 2', border: '2px solid #000' }}
              value={billingDetails.phoneNumber}
              onChange={e => setBillingDetails({ ...billingDetails, phoneNumber: e.target.value })}
            />
            <input
              placeholder="Street" style={{ ...inputStyle, gridColumn: 'span 2' }} disabled={isFormDisabled}
              value={billingDetails.street}
              onChange={e => setBillingDetails({ ...billingDetails, street: e.target.value })}
            />
            <input
              placeholder="Postcode" style={inputStyle} disabled={isFormDisabled}
              value={billingDetails.postcode}
              onChange={e => setBillingDetails({ ...billingDetails, postcode: e.target.value })}
            />
            <select
              style={inputStyle} disabled={isFormDisabled}
              value={billingDetails.country}
              onChange={e => setBillingDetails({ ...billingDetails, country: e.target.value })}
            >
              <option value="United Kingdom">United Kingdom</option>
            </select>
          </div>

          {customerId && (
            <div style={{
              marginTop: '16px', padding: '12px', backgroundColor: '#f0fdf4',
              border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px',
            }}>
              <strong>Customer ID:</strong> <code style={{ wordBreak: 'break-all' }}>{customerId}</code>
            </div>
          )}

          {step === 0 && (
            <button
              onClick={handleInitialize}
              disabled={loading}
              style={{
                width: '100%', marginTop: '20px', padding: '16px',
                backgroundColor: '#000', color: 'white', border: 'none',
                borderRadius: '8px', fontWeight: 'bold', fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Initializing...' : 'Create Customer & Start Checkout'}
            </button>
          )}

          {errorMessage && (
            <p style={{ color: 'red', marginTop: '12px', fontSize: '14px' }}>{errorMessage}</p>
          )}
        </div>

        {/* RIGHT: embedded checkout */}
        <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
          <h2 style={{ fontSize: '1.4rem', marginTop: 0, marginBottom: '25px' }}>Embedded Checkout</h2>
          {sessionToken ? (
            <>
              <super-checkout
                key={sessionToken}
                amount="15000"
                checkout-session-token={sessionToken}
                pre-selected-payment-method={sdkConfig.preSelectedPaymentMethod}
              />
              {isSdkReady && (
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  style={{
                    width: '100%', marginTop: '25px', padding: '18px',
                    backgroundColor: '#000', color: '#fff', border: 'none',
                    borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Processing...' : 'Place Order — £150.00'}
                </button>
              )}
              {errorMessage && (
                <p style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>{errorMessage}</p>
              )}
            </>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '200px', color: '#999', textAlign: 'center', fontSize: '14px',
            }}>
              {step === 0
                ? 'Fill in the customer details and click "Create Customer & Start Checkout" to begin.'
                : 'Setting up checkout...'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default InitialPayOffSession;
