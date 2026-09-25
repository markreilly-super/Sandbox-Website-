import React, { useState, useEffect, useCallback, useRef } from 'react';

// TO REVERT TO LOCALHOST: change back to 'http://localhost:5000'
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const GLOBAL_EVENTS = {
  DISPLAY_BY_PHONE: 'superpayments:displaySignIn',
};

const TokenCheckout = () => {
  // Token inputs — user supplies these from their own session creation
  const [tokenInput, setTokenInput] = useState('');
  const [sessionIdInput, setSessionIdInput] = useState('');

  // Active session values (set on "Load Checkout")
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);

  const [isSdkReady, setIsSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [sdkConfig] = useState(() => {
    const saved = localStorage.getItem('sdk_config');
    return saved ? JSON.parse(saved) : {
      paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
      preSelectedPaymentMethod: 'CARD',
      title: 'Secure Checkout',
      subtitle: 'Pay with Super and earn cash rewards',
      amount: 15000,
    };
  });
  // Saved configs from older builds may predate the amount field
  const checkoutAmount = Number(sdkConfig.amount) || 15000;

  // Editable proceed request body (Token Checkout lets you hand-craft this)
  const [proceedBody, setProceedBody] = useState(() => JSON.stringify({
    amount: checkoutAmount,
    currency: 'GBP',
    externalReference: `ORDER_${Date.now()}`,
    successUrl: `${window.location.origin}/success`,
    failureUrl: `${window.location.origin}/failure`,
    cancelUrl: `${window.location.origin}/cancel`,
    shippingAddress: {
      firstName: 'Test', lastName: 'User', addressLine1: '123 Test Street',
      city: 'London', postCode: 'SW1A 1AA', country: 'GB',
      email: 'customer@example.com', phone: '07700900000',
    },
    billingAddress: {
      firstName: 'Test', lastName: 'User', addressLine1: '123 Test Street',
      city: 'London', postCode: 'SW1A 1AA', country: 'GB',
      email: 'customer@example.com', phone: '07700900000',
    },
  }, null, 2));
  const [proceedResult, setProceedResult] = useState(null);
  const [sendingProceed, setSendingProceed] = useState(false);

  const [billingDetails, setBillingDetails] = useState({
    firstName: 'Mark',
    lastName: 'Reilly',
    email: 'test@hotmail.com',
    phoneNumber: '07462753542',
  });

  const phoneRef = useRef(billingDetails.phoneNumber);
  useEffect(() => { phoneRef.current = billingDetails.phoneNumber; }, [billingDetails.phoneNumber]);

  // Always holds latest billing details for the wallets handler closure
  const billingDetailsRef = useRef(billingDetails);
  useEffect(() => { billingDetailsRef.current = billingDetails; }, [billingDetails]);

  const bnplObserverRef = useRef(null);
  const initialSyncDone = useRef(false);
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

  // Poll for SDK readiness once a session token is loaded
  useEffect(() => {
    if (!sessionToken) return;
    initialSyncDone.current = false;
    const interval = setInterval(() => {
      if (window.superCheckout?.submit) {
        setIsSdkReady(true);
        if (!initialSyncDone.current) {
          triggerCustomPhoneNumberEvent(billingDetails.phoneNumber);
          initialSyncDone.current = true;
        }
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sessionToken, triggerCustomPhoneNumberEvent, billingDetails.phoneNumber]);

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
                amount: checkoutAmount,
                email: bd.email,
                phone: bd.phoneNumber,
                externalReference: `ORDER_${Date.now()}`,
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
  }, [checkoutSessionId]);

  // MutationObserver for BNPL phone injection
  useEffect(() => {
    if (!sessionToken) return;
    let pollInterval;

    const fillTelInput = (shadowRoot, attempt = 1) => {
      const telInput = shadowRoot.querySelector('input[type="tel"]');
      if (telInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(telInput, phoneRef.current);
        telInput.dispatchEvent(new Event('input', { bubbles: true }));
        telInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (attempt < 5) {
        setTimeout(() => fillTelInput(shadowRoot, attempt + 1), 150);
      }
    };

    const attachObserver = (shadowRoot) => {
      if (bnplObserverRef.current) bnplObserverRef.current.disconnect();
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const isSuperCredit =
              node.id === 'super-credit-container' ||
              node.querySelector?.('#super-credit-container') ||
              node.querySelector?.('[data-testid="super-credit-step-authentication"]');
            const iframes = node.tagName === 'IFRAME'
              ? [node] : Array.from(node.querySelectorAll?.('iframe') ?? []);
            if (isSuperCredit) {
              triggerCustomPhoneNumberEvent(phoneRef.current);
              setTimeout(() => fillTelInput(shadowRoot), 100);
            } else if (iframes.length > 0) {
              triggerCustomPhoneNumberEvent(phoneRef.current);
            }
          }
        }
      });
      observer.observe(shadowRoot, { childList: true, subtree: true });
      bnplObserverRef.current = observer;
    };

    pollInterval = setInterval(() => {
      const el = document.querySelector('super-checkout');
      if (el?.shadowRoot) { clearInterval(pollInterval); attachObserver(el.shadowRoot); }
    }, 200);

    return () => {
      clearInterval(pollInterval);
      if (bnplObserverRef.current) { bnplObserverRef.current.disconnect(); bnplObserverRef.current = null; }
    };
  }, [sessionToken, triggerCustomPhoneNumberEvent]);

  const handleLoadCheckout = () => {
    const token = tokenInput.trim();
    const sessionId = sessionIdInput.trim();
    if (!token) { setErrorMessage('Please enter a checkout session token.'); return; }
    if (!sessionId) { setErrorMessage('Please enter a checkout session ID.'); return; }
    setErrorMessage('');
    setIsSdkReady(false);
    setSessionToken(token);
    setCheckoutSessionId(sessionId);
  };

  const handleReset = () => {
    setSessionToken(null);
    setCheckoutSessionId(null);
    setIsSdkReady(false);
    setErrorMessage('');
  };

  // Parses the textarea and POSTs it verbatim via the rawPayload override.
  const sendProceed = async () => {
    let parsed;
    try {
      parsed = JSON.parse(proceedBody);
    } catch (err) {
      setProceedResult({ ok: false, text: `Invalid JSON: ${err.message}` });
      return null;
    }
    const response = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawPayload: parsed }),
    });
    const data = await response.json();
    setProceedResult({ ok: response.ok, text: `HTTP ${response.status}\n\n${JSON.stringify(data, null, 2)}` });
    return data;
  };

  const handleSendProceedOnly = async () => {
    setSendingProceed(true);
    setProceedResult(null);
    try {
      await sendProceed();
    } catch (err) {
      setProceedResult({ ok: false, text: `Request failed: ${err.message}` });
    } finally {
      setSendingProceed(false);
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
      const proceedData = await sendProceed();
      if (proceedData && proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;
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
  const monoInputStyle = {
    ...inputStyle,
    fontFamily: 'monospace', fontSize: '13px',
    backgroundColor: '#fafafa',
  };

  return (
    <div className="layout-two-col">

      {/* LEFT: token inputs + billing */}
      <div>
        {/* Session token inputs */}
        <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: 0 }}>
          Session Tokens
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Checkout Session Token
            </label>
            <textarea
              rows={3}
              placeholder="Paste checkoutSessionToken here..."
              style={{ ...monoInputStyle, resize: 'vertical' }}
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              disabled={!!sessionToken}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Checkout Session ID
            </label>
            <input
              placeholder="e.g. cs_abc123..."
              style={monoInputStyle}
              value={sessionIdInput}
              onChange={e => setSessionIdInput(e.target.value)}
              disabled={!!sessionToken}
            />
          </div>

          {!sessionToken ? (
            <button
              onClick={handleLoadCheckout}
              style={{
                padding: '14px', backgroundColor: '#000', color: 'white', border: 'none',
                borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
              }}
            >
              Load Checkout
            </button>
          ) : (
            <button
              onClick={handleReset}
              style={{
                padding: '14px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd',
                borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
              }}
            >
              ← Use a different token
            </button>
          )}
        </div>

        {errorMessage && !sessionToken && (
          <p style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>{errorMessage}</p>
        )}

        {/* Billing details — shown once a session is loaded */}
        {sessionToken && (
          <>
            <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: '32px' }}>
              Billing Details
            </h2>
            <div className="form-grid-two-col" style={{ marginTop: '20px' }}>
              <input placeholder="First Name" style={inputStyle} value={billingDetails.firstName}
                onChange={e => setBillingDetails({ ...billingDetails, firstName: e.target.value })} />
              <input placeholder="Last Name" style={inputStyle} value={billingDetails.lastName}
                onChange={e => setBillingDetails({ ...billingDetails, lastName: e.target.value })} />
              <input placeholder="Email" style={{ ...inputStyle, gridColumn: 'span 2' }} value={billingDetails.email}
                onChange={e => setBillingDetails({ ...billingDetails, email: e.target.value })} />
              <input placeholder="Phone" style={{ ...inputStyle, gridColumn: 'span 2', border: '2px solid #000' }}
                value={billingDetails.phoneNumber}
                onChange={e => setBillingDetails({ ...billingDetails, phoneNumber: e.target.value })} />
            </div>

            <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px', marginTop: '32px' }}>
              Proceed Request
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: '10px 0' }}>
              Sent verbatim to <code>/checkout-sessions/{checkoutSessionId}/proceed</code>.
              Edit freely — <code>paymentInitiatorId</code> is added by the backend only if you omit it.
              "Place Order" uses this same body after the card is submitted.
            </p>
            <textarea
              value={proceedBody}
              onChange={e => setProceedBody(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: '320px', boxSizing: 'border-box',
                fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5',
                padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                backgroundColor: '#fafafa', resize: 'vertical',
              }}
            />
            <button
              onClick={handleSendProceedOnly}
              disabled={sendingProceed}
              style={{
                width: '100%', marginTop: '12px', padding: '14px',
                backgroundColor: '#1976d2', color: '#fff', border: 'none',
                borderRadius: '8px', fontSize: '15px', fontWeight: 'bold',
                cursor: sendingProceed ? 'not-allowed' : 'pointer',
                opacity: sendingProceed ? 0.7 : 1,
              }}
            >
              {sendingProceed ? 'Sending...' : 'Send Proceed Request'}
            </button>

            {proceedResult && (
              <pre style={{
                marginTop: '12px', padding: '12px', borderRadius: '8px',
                border: '1px solid', borderColor: proceedResult.ok ? '#4CAF50' : '#e74c3c',
                backgroundColor: proceedResult.ok ? '#f1f8f2' : '#fdf3f2',
                fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: '260px', overflowY: 'auto',
              }}>
                {proceedResult.text}
              </pre>
            )}
          </>
        )}
      </div>

      {/* RIGHT: embedded checkout */}
      <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.4rem', marginTop: 0, marginBottom: '25px' }}>Embedded Checkout</h2>
        {sessionToken ? (
          <>
            <super-checkout
              key={sessionToken}
              amount={String(checkoutAmount)}
              checkout-session-token={sessionToken}
              title={sdkConfig.title}
              subtitle={sdkConfig.subtitle}
              payment-methods-order={sdkConfig.paymentMethodsOrder}
              pre-selected-payment-method={sdkConfig.preSelectedPaymentMethod}
              support-express-wallets="true"
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
                {loading ? 'Processing...' : `Place Order — £${(checkoutAmount / 100).toFixed(2)}`}
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
            Paste your session token and ID, then click "Load Checkout".
          </div>
        )}
      </div>

    </div>
  );
};

export default TokenCheckout;
