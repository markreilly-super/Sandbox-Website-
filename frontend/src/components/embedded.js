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
      // SDK Submission using the method we just verified exists
      const result = await window.superCheckout.submit({
        customerInformation: {
          firstName: billingDetails.firstName,
          lastName: billingDetails.lastName,
          email: billingDetails.email,
          phoneNumber: billingDetails.phoneNumber,
        },
      });

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
          amount: 12000,
          email: billingDetails.email,
          phone: billingDetails.phoneNumber,
          externalReference: `ORDER_${Date.now()}`,
        }),
      });

      const proceedData = await response.json();
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
        <h2 style={{ fontSize: '1.4rem', marginBottom: '25px' }}>Payment</h2>
        {sessionToken ? (
          <>
            <super-checkout 
              key={refreshKey} 
              amount="12000" 
              checkout-session-token={sessionToken}
              title={sdkConfig.title}
              subtitle={sdkConfig.subtitle}
              payment-methods-order={sdkConfig.paymentMethodsOrder}
              pre-selected-payment-method={sdkConfig.preSelectedPaymentMethod}
            />

            {/* BUTTON REVEALED VIA ENGINEER'S Boolean Check */}
            {isSdkReady && (
              <button 
                onClick={handlePlaceOrder}
                disabled={loading}
                style={{ 
                  width: '100%', marginTop: '25px', padding: '18px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Processing Order...' : 'Place Order — £120.00'}
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