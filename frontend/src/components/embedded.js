import React, { useState, useEffect, useCallback, useRef } from 'react';

const GLOBAL_EVENTS = {
  DISPLAY_BY_PHONE: 'superpayments:displaySignIn',
  COMPONENT_READY: 'superpayments:ready',
};

const CheckoutPage = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    firstName: 'John',
    lastName: 'Smith',
    email: 'johnsmith@hotmail.com',
    phoneNumber: '7462569556',
    street: 'London Street',
    country: 'United Kingdom',
    postcode: 'SW1A 1AA'
  });

  // Ref to track if the initial sync has occurred to avoid redundant triggers
  const initialSyncDone = useRef(false);

  /**
   * CORE LOGIC: Injects the phone number into the SDK via CustomEvent.
   * Uses 'composed: true' to cross the Shadow DOM boundary.
   */
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
      console.log('📡 Phone number injected:', phoneNumber);
    }
  }, []);

  /**
   * 1. WAIT FOR READY STATE & INITIAL SYNC
   * Listens for the SDK's internal 'ready' signal before firing the first injection.
   */
  useEffect(() => {
    const handleReady = () => {
      console.log('✅ SDK Signal: READY');
      if (!initialSyncDone.current) {
        triggerCustomPhoneNumberEvent(billingDetails.phoneNumber);
        initialSyncDone.current = true;
      }
    };

    document.addEventListener(GLOBAL_EVENTS.COMPONENT_READY, handleReady);

    // Fallback: If component is already in DOM, sync immediately
    if (document.querySelector('super-checkout') && !initialSyncDone.current) {
      triggerCustomPhoneNumberEvent(billingDetails.phoneNumber);
      initialSyncDone.current = true;
    }

    return () => document.removeEventListener(GLOBAL_EVENTS.COMPONENT_READY, handleReady);
  }, [billingDetails.phoneNumber, triggerCustomPhoneNumberEvent]);

  /**
   * 2. HANDLE SEQUENTIAL UPDATES
   * Resets the SDK UI state (OTP panel -> Phone panel) before injecting a new number.
   */
  const handleSaveAndSync = useCallback(() => {
    setLoading(true);
    localStorage.setItem('billing_cache', JSON.stringify(billingDetails));

    const superCheckout = document.querySelector('super-checkout');
    
    // Reset internal SDK state if user is stuck on the OTP verification screen
    if (superCheckout?.shadowRoot) {
      const editBtn = superCheckout.shadowRoot.querySelector('[data-testid="change-phone-number-button"]');
      if (editBtn) {
        editBtn.click(); // Triggers internal handleEditAndResetPhoneNumber logic
        console.log('♻️ SDK UI Reset triggered');
      }
    }

    // Short delay to allow the React state inside the Web Component to transition
    setTimeout(() => {
      triggerCustomPhoneNumberEvent(billingDetails.phoneNumber);
      setLoading(false);
    }, 200);
  }, [billingDetails, triggerCustomPhoneNumberEvent]);

  // Initial Session Fetching
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('http://localhost:5000/checkout-sessions', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.checkoutSessionToken) {
          setSessionToken(data.checkoutSessionToken);
          setCheckoutSessionId(data.checkoutSessionId);
        }
      } catch (e) {
        console.error("Session failed to load");
      }
    };
    init();
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', padding: '50px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Arial' }}>
      
      {/* LEFT COLUMN: BILLING FORM */}
      <div>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px' }}>Billing Address</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
          <input 
            placeholder="First Name" 
            style={inputStyle} 
            value={billingDetails.firstName}
            onChange={e => setBillingDetails({...billingDetails, firstName: e.target.value})} 
          />
          <input 
            placeholder="Last Name" 
            style={inputStyle} 
            value={billingDetails.lastName}
            onChange={e => setBillingDetails({...billingDetails, lastName: e.target.value})} 
          />
          <input 
            placeholder="Email Address" 
            style={{...inputStyle, gridColumn: 'span 2'}} 
            value={billingDetails.email}
            onChange={e => setBillingDetails({...billingDetails, email: e.target.value})} 
          />
          
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#444' }}>Phone Number (Syncs with Payment)</label>
            <input 
              placeholder="07462..." 
              style={{...inputStyle, width: '100%', marginTop: '5px', border: '2px solid #000'}} 
              value={billingDetails.phoneNumber}
              onChange={e => setBillingDetails({...billingDetails, phoneNumber: e.target.value})} 
            />
          </div>

          <input placeholder="Street" style={{...inputStyle, gridColumn: 'span 2'}} value={billingDetails.street} onChange={e => setBillingDetails({...billingDetails, street: e.target.value})} />
          <input placeholder="Postcode" style={inputStyle} value={billingDetails.postcode} onChange={e => setBillingDetails({...billingDetails, postcode: e.target.value})} />
          <select style={inputStyle} value={billingDetails.country} onChange={e => setBillingDetails({...billingDetails, country: e.target.value})}>
            <option>United Kingdom</option>
          </select>
        </div>

        <button 
          onClick={handleSaveAndSync}
          disabled={loading}
          style={{ width: '100%', marginTop: '30px', padding: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
        >
          {loading ? 'Saving & Syncing...' : 'Save Details & Apply Rewards'}
        </button>
      </div>

      {/* RIGHT COLUMN: SUPER PAYMENTS */}
      <div style={{ backgroundColor: '#fcfcfc', padding: '30px', borderRadius: '16px', border: '1px solid #eee' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '25px' }}>Payment</h2>
        
        {sessionToken ? (
          <div style={{ minHeight: '300px' }}>
            <super-checkout 
              key={sessionToken} 
              amount="12000" 
              checkout-session-token={sessionToken} 
            />
          </div>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <p>Initializing secure payment gateway...</p>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle = { padding: '14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', width: '100%', boxSizing: 'border-box' };

export default CheckoutPage;