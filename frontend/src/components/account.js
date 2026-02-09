import React, { useState, useEffect } from 'react';

const AccountPage = () => {
  const [setupToken, setSetupToken] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Global SDK Configuration
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('sdk_config');
    return saved ? JSON.parse(saved) : {
      paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
      preSelectedPaymentMethod: 'CARD',
      title: 'Secure Checkout'
    };
  });

  /**
   * ENGINEER'S READY CHECK: Polling for global submit method
   */
  useEffect(() => {
    if (!setupToken) return;
    const check = setInterval(() => {
      if (Boolean(window.superCheckout && window.superCheckout.submit)) {
        setIsSdkReady(true);
        clearInterval(check);
      }
    }, 500);
    return () => clearInterval(check);
  }, [setupToken]);

  /**
   * OFF-SESSION WORKFLOW: Customer -> Payment Method -> Setup Intent
   */
  const handleRegisterCard = async () => {
    setLoading(true);
    try {
      // 1. Create Customer and get ID
      const custRes = await fetch('http://localhost:5000/customers', { method: 'POST' });
      const customerData = await custRes.json();
      const customerId = customerData.id; // response.id

      // 2. Create Payment Method using the Customer ID
      const pmRes = await fetch('http://localhost:5000/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerId })
      });
      const pmData = await pmRes.json();
      setPaymentMethodId(pmData.id); // response.id
      console.log("Payment Method created with ID:", pmData.id);
    

      // 3. Create Setup Intent using the Payment Method ID
      const setupRes = await fetch(`http://localhost:5000/payment-methods/${pmData.id}/setup-intents`, { 
        method: 'POST' 
      });
      const setupData = await setupRes.json();
      
      setSetupToken(setupData.sessionToken); // Initiate embedded component
    } catch (e) {
      console.error("Card registration workflow failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = async () => {
    if (!window.superCheckout) return;
    const result = await window.superCheckout.submit();

    try {
      if (result.status === 'FAILURE') {
        setErrorMessage(result.errorMessage || 'Payment Failed');
        setLoading(false);
        return;
      }

      console.log("Session Token:", setupToken);

      // Backend Proceed call
      const response = await fetch(`http://localhost:5000/checkout-sessions/${setupToken}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 0,
          externalReference: `ORDER_${Date.now()}`,
        }),
      });

      const proceedData = await response.json();
      setPaymentIntentId(proceedData.paymentIntentId)
      if (proceedData.redirectUrl) {
        console.log("Payment Method created with ID:", paymentMethodId);
        window.location.href = proceedData.redirectUrl; 
        const response = await fetch(`http://localhost:5000//create-off-session-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount:2500,
            paymentMethodId: paymentMethodId,
        }),
      });
      }
    } catch (err) {
      setErrorMessage('Communication error with server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
      {/* Configuration Section */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px' }}>
        <h2>SDK Settings</h2>
        <label style={labelStyle}>Method Order</label>
        <input style={inputStyle} value={config.paymentMethodsOrder} onChange={e => setConfig({...config, paymentMethodsOrder: e.target.value})} />
        <button onClick={() => localStorage.setItem('sdk_config', JSON.stringify(config))} style={btnStyle}>Save Settings</button>
      </div>

      {/* Off-Session Card Registration Section */}
      <div>
        <h2>Saved Cards</h2>
        {!setupToken ? (
          <button onClick={handleRegisterCard} disabled={loading} style={btnSetup}>
            {loading ? 'Initializing...' : '+ Add Saved Card'}
          </button>
        ) : (
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '12px' }}>
            <super-checkout amount="0" checkout-session-token={setupToken} />
            {isSdkReady && (
              <button onClick={handleAuthorize} style={{...btnStyle, marginTop: '20px', backgroundColor: '#000', color: '#fff'}}>
                Authorize and Save Card
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%', marginBottom: '15px' };
const labelStyle = { fontWeight: 'bold', fontSize: '12px', display: 'block', marginBottom: '5px' };
const btnStyle = { width: '100%', padding: '15px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' };
const btnSetup = { padding: '15px 30px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };

export default AccountPage;