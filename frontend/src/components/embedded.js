import React, { useState, useEffect, useCallback, useRef } from 'react';

const GLOBAL_EVENTS = {
  DISPLAY_BY_PHONE: 'superpayments:displaySignIn',
};

const CheckoutPage = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Controls the "Place Order" button visibility based on the global SDK object
  const [isSdkReady, setIsSdkReady] = useState(false); 

  const [sdkConfig, setSdkConfig] = useState({
    paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
    preSelectedPaymentMethod: 'CARD',
    title: 'Secure Checkout',
    subtitle: 'Pay with Super and earn cash rewards'
  });

  const [billingDetails, setBillingDetails] = useState({
    firstName: 'Mark',
    lastName: 'Reilly',
    email: 'test@hotmail.com',
    phoneNumber: '7462569556',
    street: 'London Street',
    country: 'United Kingdom',
    postcode: 'SW1A 1AA'
  });

  const initialSyncDone = useRef(false);

  // Always holds the latest phone number so the MutationObserver callback
  // never captures a stale value from its closure
  const phoneRef = useRef(billingDetails.phoneNumber);
  useEffect(() => { phoneRef.current = billingDetails.phoneNumber; }, [billingDetails.phoneNumber]);

  // Holds the active MutationObserver so we can disconnect it on cleanup
  const bnplObserverRef = useRef(null);

  const triggerCustomPhoneNumberEvent = useCallback((phoneNumber) => {
    const superCheckoutElement = document.querySelector('super-checkout');
    if (superCheckoutElement && phoneNumber) {
      const event = new CustomEvent(GLOBAL_EVENTS.DISPLAY_BY_PHONE, {
        bubbles: true,
        cancelable: false,
        composed: true, 
        detail: { phoneNumber }
      });
      document.dispatchEvent(event);
      console.log('📡 Phone number synced:', phoneNumber);
    }
  }, []);

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
        
        // Ensure initial phone sync happens once the SDK is ready
        if (!initialSyncDone.current) {
          triggerCustomPhoneNumberEvent(billingDetails.phoneNumber);
          initialSyncDone.current = true;
        }
        clearInterval(checkInterval);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [triggerCustomPhoneNumberEvent, billingDetails.phoneNumber]);

  /**
   * BNPL PHONE INJECTION
   * The marketing/rewards components are in the DOM on page load so the initial
   * superpayments:displaySignIn event reaches them fine. The BNPL iframe is lazy —
   * it only mounts when the user clicks "Pay Later". We use a MutationObserver on
   * the super-checkout shadow root to detect the moment that iframe appears, then
   * immediately re-fire the phone number event so the BNPL flow pre-populates it.
   */
  useEffect(() => {
    if (!sessionToken) return;

    console.log('🔍 [BNPL Observer] Session active — polling for super-checkout shadow root...');

    let pollInterval;

    const attachObserver = (shadowRoot) => {
      // Disconnect any previous observer (e.g. after a session refresh)
      if (bnplObserverRef.current) {
        bnplObserverRef.current.disconnect();
        console.log('♻️  [BNPL Observer] Previous observer disconnected before re-attaching');
      }

      // Helper: directly populate the tel input inside the shadow DOM.
      // Super Credit is a React app inside the shadow DOM, so we can't just set
      // .value — we need to use the native HTMLInputElement setter to bypass React's
      // synthetic event system, then dispatch 'input' to trigger its state update.
      const fillTelInput = (attempt = 1) => {
        const telInput = shadowRoot.querySelector('input[type="tel"]');
        if (telInput) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          nativeSetter.call(telInput, phoneRef.current);
          telInput.dispatchEvent(new Event('input',  { bubbles: true }));
          telInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('📱 [BNPL Observer] Tel input populated:', phoneRef.current);
        } else if (attempt < 5) {
          // Input may not be in the DOM yet — retry up to 5× every 150 ms
          console.log(`⏳ [BNPL Observer] Tel input not found (attempt ${attempt}), retrying...`);
          setTimeout(() => fillTelInput(attempt + 1), 150);
        } else {
          console.warn('⚠️ [BNPL Observer] Tel input not found after 5 attempts');
        }
      };

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            // Super Credit renders as a plain div (NOT an iframe).
            // Detect it by its container id or the authentication step testid.
            const isSuperCredit =
              node.id === 'super-credit-container' ||
              node.querySelector?.('#super-credit-container') ||
              node.querySelector?.('[data-testid="super-credit-step-authentication"]');

            // Keep iframe detection as a fallback for other BNPL providers
            const iframes = node.tagName === 'IFRAME'
              ? [node]
              : Array.from(node.querySelectorAll?.('iframe') ?? []);

            if (isSuperCredit) {
              console.log('🎯 [BNPL Observer] Super Credit container detected in shadow DOM');
              console.log('   ↳ Firing superpayments:displaySignIn with phone:', phoneRef.current);
              triggerCustomPhoneNumberEvent(phoneRef.current);
              // Give React one tick to finish rendering the input, then fill it
              setTimeout(() => fillTelInput(), 100);
            } else if (iframes.length > 0) {
              const src = iframes[0].src || iframes[0].getAttribute('src') || '(no src yet)';
              console.log('🎯 [BNPL Observer] iframe detected in shadow DOM');
              console.log('   ↳ src:', src);
              console.log('   ↳ Firing superpayments:displaySignIn with phone:', phoneRef.current);
              triggerCustomPhoneNumberEvent(phoneRef.current);
            }
          }
        }
      });

      observer.observe(shadowRoot, { childList: true, subtree: true });
      bnplObserverRef.current = observer;
      console.log('✅ [BNPL Observer] MutationObserver attached — watching for Super Credit div & iframes');
    };

    pollInterval = setInterval(() => {
      const superCheckout = document.querySelector('super-checkout');
      if (superCheckout?.shadowRoot) {
        clearInterval(pollInterval);
        attachObserver(superCheckout.shadowRoot);
      }
    }, 200);

    return () => {
      clearInterval(pollInterval);
      if (bnplObserverRef.current) {
        bnplObserverRef.current.disconnect();
        bnplObserverRef.current = null;
        console.log('🧹 [BNPL Observer] Disconnected on cleanup');
      }
    };
  }, [sessionToken, triggerCustomPhoneNumberEvent]);

  const handleSaveAndSync = useCallback(() => {
    setLoading(true);
    localStorage.setItem('billing_cache', JSON.stringify(billingDetails));
    
    const superCheckout = document.querySelector('super-checkout');
    if (superCheckout?.shadowRoot) {
      const editBtn = superCheckout.shadowRoot.querySelector('[data-testid="change-phone-number-button"]');
      if (editBtn) editBtn.click(); 
    }

    setTimeout(() => {
      triggerCustomPhoneNumberEvent(billingDetails.phoneNumber);
      setLoading(false);
    }, 200);
  }, [billingDetails, triggerCustomPhoneNumberEvent]);

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

      console.log("Result Status" + result.status)

      if (result.status === 'FAILURE') {
        setErrorMessage(result.errorMessage || 'Payment Failed');
        setLoading(false);
        return;
      }

      // Backend Proceed call
      const response = await fetch(`http://localhost:5000/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 15000,
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
        const res = await fetch('http://localhost:5000/checkout-sessions', { method: 'POST' });
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', padding: '40px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Arial' }}>
      
      {/* LEFT COLUMN: BILLING FORM */}
      <div>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px' }}>Billing Address</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
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
          onClick={handleSaveAndSync}
          style={{ width: '100%', marginTop: '20px', padding: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Save & Sync Details
        </button>
      </div>

      {/* RIGHT COLUMN: SDK & CONDITIONAL BUTTON */}
      <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '25px' }}>Embedded Checkout</h2>
        {sessionToken ? (
          <>
            <super-checkout 
              key={refreshKey} 
              amount="15000" 
              checkout-session-token={sessionToken}
              title={sdkConfig.title}
              subtitle={sdkConfig.subtitle}
              payment-methods-order={sdkConfig.paymentMethodsOrder}
              pre-selected-payment-method={sdkConfig.preSelectedPaymentMethod}
            />

            {isSdkReady && (
              <button 
                onClick={handlePlaceOrder}
                disabled={loading}
                style={{ 
                  width: '100%', marginTop: '25px', padding: '18px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Processing Order...' : 'Place Order — £150.00'}
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