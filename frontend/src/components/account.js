import React, { useState, useEffect, useRef } from 'react';

// NGROK: set to '' to proxy via React dev server (ngrok mode)
// TO REVERT TO LOCALHOST: change back to 'http://localhost:5000'
const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Listen for postMessage events from the <super-card> / Stripe iframe
 * to capture card details (last4, brand). Also deeply inspect the
 * superCard.submit() result.
 */
(function setupCardDataCapture() {
  // Remove any previously registered listener (survives HMR / module re-execution)
  if (window.__cardMessageListener) {
    window.removeEventListener('message', window.__cardMessageListener);
  }

  const findCardData = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;
    const l4 = obj.last4 ?? obj.Last4 ?? obj.last_four;
    if (l4 && String(l4).replace(/\D/g, '').length === 4) {
      return { last4: String(l4).replace(/\D/g, ''), brand: (obj.brand || obj.display_brand || obj.network || '').toUpperCase() };
    }
    if (obj.card?.last4) {
      return { last4: String(obj.card.last4), brand: (obj.card.brand || obj.card.display_brand || '').toUpperCase() };
    }
    for (const key of Object.keys(obj)) {
      const found = findCardData(obj[key], depth + 1);
      if (found) return found;
    }
    return null;
  };

  // Named listener stored on window so it can be removed on next HMR cycle
  window.__cardMessageListener = (event) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      const cardData = findCardData(data);
      if (cardData?.last4) {
        console.log('[postMessage] Captured card data:', cardData);
        window.__stripeCardData = cardData;
      }
    } catch (e) { /* not JSON or not relevant */ }
  };

  window.addEventListener('message', window.__cardMessageListener);
})();

const AccountPage = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [currentPaymentMethodId, setCurrentPaymentMethodId] = useState(null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Environment selection (test / staging) - initialised first so other state can read it
  const [environment] = useState(() => {
    return localStorage.getItem('super_environment') || 'test';
  });

  // Customer ID persisted in localStorage per environment
  const [customerId, setCustomerId] = useState(() => {
    const env = localStorage.getItem('super_environment') || 'test';
    return localStorage.getItem(`super_customer_id_${env}`) || null;
  });

  // Saved cards stored in localStorage per environment
  const [savedCards, setSavedCards] = useState(() => {
    const env = localStorage.getItem('super_environment') || 'test';
    const stored = localStorage.getItem(`saved_cards_${env}`);
    return stored ? JSON.parse(stored) : [];
  });

  // Global SDK Configuration
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('sdk_config');
    return saved ? JSON.parse(saved) : {
      paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
      preSelectedPaymentMethod: 'CARD',
      title: 'Secure Checkout'
    };
  });

  // Custom credentials
  const [customCreds, setCustomCreds] = useState(() => {
    const saved = localStorage.getItem('custom_credentials');
    return saved ? JSON.parse(saved) : { api_key: '', initiator_id: '', brand_id: '', envType: 'test' };
  });
  const [customCredsActive, setCustomCredsActive] = useState(() => {
    return localStorage.getItem('super_environment') === 'custom';
  });
  const [customCredsStatus, setCustomCredsStatus] = useState('');

  // Persist saved cards to localStorage whenever they change (keyed by environment)
  useEffect(() => {
    localStorage.setItem(`saved_cards_${environment}`, JSON.stringify(savedCards));
  }, [savedCards, environment]);

  /**
   * Poll for window.superCard.submit to become available
   */
  useEffect(() => {
    if (!sessionToken) return;
    const check = setInterval(() => {
      if (window.superCard && typeof window.superCard.submit === 'function') {
        setIsSdkReady(true);
        clearInterval(check);
        console.log("superCard SDK ready - submit method available");
      }
    }, 500);
    return () => clearInterval(check);
  }, [sessionToken]);

  const handleEnvironmentChange = async (newEnv) => {
    localStorage.setItem('super_environment', newEnv);
    await fetch(`${API_BASE}/set-environment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment: newEnv })
    });
    // Reload so App.js re-loads the correct SDK scripts and state re-initialises from localStorage
    window.location.reload();
  };

  const handleApplyCustomCreds = async () => {
    if (!customCreds.api_key || !customCreds.initiator_id || !customCreds.brand_id) {
      setCustomCredsStatus('error:Please fill in all three fields.');
      return;
    }
    localStorage.setItem('custom_credentials', JSON.stringify(customCreds));
    localStorage.setItem('super_environment', 'custom');
    const res = await fetch(`${API_BASE}/custom-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customCreds),
    });
    if (res.ok) {
      setCustomCredsActive(true);
      setCustomCredsStatus('success:Custom credentials applied.');
    } else {
      setCustomCredsStatus('error:Failed to apply credentials.');
    }
  };

  const handleClearCustomCreds = async () => {
    localStorage.removeItem('custom_credentials');
    if (localStorage.getItem('super_environment') === 'custom') {
      localStorage.setItem('super_environment', 'test');
    }
    setCustomCreds({ api_key: '', initiator_id: '', brand_id: '', envType: 'test' });
    setCustomCredsActive(false);
    setCustomCredsStatus('');
    await fetch(`${API_BASE}/custom-credentials`, { method: 'DELETE' });
  };

  /**
   * OFF-SESSION WORKFLOW: Customer -> Payment Method -> Setup Intent -> Render super-card
   */
  const handleRegisterCard = async () => {
    setLoading(true);
    setStatusMessage('');
    setIsSdkReady(false);
    window.__stripeCardData = null;    // Reset both variable names before starting fresh
    window.__capturedCardData = null;
    try {
      // Step 1: Create Customer (or reuse existing one)
      let currentCustomerId = customerId;
      if (!currentCustomerId) {
        const custRes = await fetch(`${API_BASE}/customers`, { method: 'POST' });
        const customerData = await custRes.json();
        currentCustomerId = customerData.id;
        setCustomerId(currentCustomerId);
        localStorage.setItem(`super_customer_id_${environment}`, currentCustomerId);
        console.log("Customer created with ID:", currentCustomerId);
      } else {
        console.log("Reusing existing Customer ID:", currentCustomerId);
      }

      // Step 2: Create Payment Method
      const pmRes = await fetch(`${API_BASE}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: currentCustomerId })
      });
      const pmData = await pmRes.json();
      setCurrentPaymentMethodId(pmData.id);
      console.log("Payment Method created with ID:", pmData.id);

      // Step 3: Create Setup Intent -> get sessionToken for <super-card>
      const setupRes = await fetch(`${API_BASE}/payment-methods/${pmData.id}/setup-intents`, {
        method: 'POST'
      });
      const setupData = await setupRes.json();
      console.log("Setup Intent Response:", setupData);

      // Step 4: Render <super-card> with the setup intent session token
      setSessionToken(setupData.sessionToken);

    } catch (e) {
      console.error("Card registration workflow failed", e);
      setStatusMessage('Failed to initialize card registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submit card via window.superCard.submit(), then extract card details
   * from the intercepted Stripe API response.
   */
  /**
   * Resolve card details using three layers, in priority order:
   *  1. window.__stripeCardData  – populated by global fetch/XHR interceptor
   *                                 (App.js) or the postMessage listener above.
   *  2. result object            – deep-scan the superCard.submit() return value
   *                                 in case the SDK embeds card info there.
   *  3. GET /payment-methods/:id – ask the Super API; may return card details
   *                                 once the setup intent has been authorised.
   */
  const resolveCardData = async (result, paymentMethodId) => {
    // Helper: recursively hunt for { last4, brand } in any object
    const findCard = (obj, depth = 0) => {
      if (!obj || typeof obj !== 'object' || depth > 8) return null;
      const l4 = obj.last4 ?? obj.Last4 ?? obj.last_four;
      if (l4 && String(l4).replace(/\D/g, '').length === 4) {
        return { last4: String(l4).replace(/\D/g, ''), brand: (obj.brand || obj.display_brand || obj.network || '').toUpperCase() };
      }
      if (obj.card?.last4) {
        return { last4: String(obj.card.last4), brand: (obj.card.brand || obj.card.display_brand || '').toUpperCase() };
      }
      for (const key of Object.keys(obj)) {
        const hit = findCard(obj[key], depth + 1);
        if (hit) return hit;
      }
      return null;
    };

    // Layer 1 – interceptor / postMessage
    // Check both names: __stripeCardData (current) and __capturedCardData (legacy,
    // may still be populated by a listener registered before an HMR cycle updated it)
    const intercepted = window.__stripeCardData || window.__capturedCardData;
    if (intercepted?.last4) {
      console.log('[resolveCardData] Layer 1 hit – interceptor:', intercepted);
      return intercepted;
    }

    // Layer 2 – deep scan the submit() result
    if (result) {
      const hit = findCard(result);
      if (hit?.last4) {
        console.log('[resolveCardData] Layer 2 hit – result object:', hit);
        return hit;
      }
    }

    // Layer 3 – fetch from Super API
    try {
      console.log('[resolveCardData] Layer 3 – fetching GET /payment-methods/' + paymentMethodId);
      const res = await fetch(`${API_BASE}/payment-methods/${paymentMethodId}`);
      const data = await res.json();
      console.log('[resolveCardData] Super API payment method response:', data);
      const hit = findCard(data);
      if (hit?.last4) {
        console.log('[resolveCardData] Layer 3 hit:', hit);
        return hit;
      }
    } catch (e) {
      console.warn('[resolveCardData] Layer 3 fetch failed:', e);
    }

    // All layers exhausted
    console.log('[resolveCardData] No card data found across all layers');
    return { last4: null, brand: '' };
  };

  const handleSaveCard = async () => {
    if (!window.superCard || !window.superCard.submit) return;
    setSubmitting(true);
    setStatusMessage('');

    try {
      const result = await window.superCard.submit();
      console.log('superCard.submit() result:', result);

      if (result && result.status === 'FAILURE') {
        setStatusMessage(result.errorMessage || 'Card submission failed. Please try again.');
        setSubmitting(false);
        return;
      }

      // Resolve card details through all three layers
      const cardData = await resolveCardData(result, currentPaymentMethodId);
      console.log('Final resolved card data:', cardData);

      const newCard = {
        id: currentPaymentMethodId,
        last4: cardData.last4 || null,
        brand: cardData.brand || 'CARD',
        status: 'ENABLED',
        addedAt: new Date().toISOString()
      };

      setSavedCards(prev => [...prev, newCard]);
      setStatusMessage(
        cardData.last4
          ? `Card ending ${cardData.last4} saved successfully!`
          : 'Card saved successfully!'
      );
      window.__stripeCardData = null;  // Reset both names for next card
      window.__capturedCardData = null;

      // Reset form to allow adding another card
      setSessionToken(null);
      setCurrentPaymentMethodId(null);
      setIsSdkReady(false);

    } catch (err) {
      console.error('handleSaveCard error:', err);
      setStatusMessage('Error saving card. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCard = (cardId) => {
    setSavedCards(prev => prev.filter(c => c.id !== cardId));
  };

  const getBrandColor = (brand) => {
    const colors = {
      'VISA': '#1A1F71',
      'MASTERCARD': '#EB001B',
      'AMEX': '#006FCF',
      'DISCOVER': '#FF6000',
    };
    return colors[brand] || '#333';
  };

  const getBrandLogo = (brand) => {
    const logos = {
      'VISA': '𝐕𝐈𝐒𝐀',
      'MASTERCARD': '●●',
      'AMEX': 'AMEX',
      'DISCOVER': 'DISC',
    };
    return logos[brand] || brand;
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '40px', alignItems: 'start' }}>
      {/* Environment Section */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px', minWidth: '130px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>Environment</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => environment !== 'test' && handleEnvironmentChange('test')}
            style={{
              padding: '10px', borderRadius: '8px', border: '2px solid',
              borderColor: environment === 'test' ? '#4CAF50' : '#ddd',
              backgroundColor: environment === 'test' ? '#e8f5e9' : '#fff',
              fontWeight: 'bold', cursor: environment === 'test' ? 'default' : 'pointer',
              color: environment === 'test' ? '#2e7d32' : '#555'
            }}
          >
            Test
          </button>
          <button
            onClick={() => environment !== 'staging' && handleEnvironmentChange('staging')}
            style={{
              padding: '10px', borderRadius: '8px', border: '2px solid',
              borderColor: environment === 'staging' ? '#1976d2' : '#ddd',
              backgroundColor: environment === 'staging' ? '#e3f2fd' : '#fff',
              fontWeight: 'bold', cursor: environment === 'staging' ? 'default' : 'pointer',
              color: environment === 'staging' ? '#1565c0' : '#555'
            }}
          >
            Staging
          </button>
        </div>
      </div>

      {/* Configuration Section */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px' }}>
        <h2>SDK Settings</h2>
        <label style={labelStyle}>Method Order</label>
        <input style={inputStyle} value={config.paymentMethodsOrder} onChange={e => setConfig({...config, paymentMethodsOrder: e.target.value})} />
        <label style={labelStyle}>Pre-selected Method</label>
        <select style={inputStyle} value={config.preSelectedPaymentMethod} onChange={e => setConfig({...config, preSelectedPaymentMethod: e.target.value})}>
          <option value="CARD">CARD</option>
          <option value="BNPL">BNPL</option>
          <option value="OPEN_BANKING">OPEN_BANKING</option>
        </select>
        <label style={labelStyle}>Checkout Title</label>
        <input style={inputStyle} value={config.title} onChange={e => setConfig({...config, title: e.target.value})} />
        <button onClick={() => localStorage.setItem('sdk_config', JSON.stringify(config))} style={btnStyle}>Save Settings</button>
      </div>

      {/* Off-Session Card Registration Section */}
      <div>
        <h2>Saved Cards</h2>

        {statusMessage && (
          <p style={{ color: statusMessage.includes('success') ? '#27ae60' : '#e74c3c', fontSize: '14px', marginBottom: '10px' }}>
            {statusMessage}
          </p>
        )}

        {/* Saved Cards Display */}
        {savedCards.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {savedCards.map((card) => (
              <div
                key={card.id}
                onClick={() => {
                  console.log("Selected Card ID:", card.id);
                }}
                style={{
                  ...cardDisplayStyle,
                  cursor: 'pointer',
                  border: '2px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={cardChipStyle}>
                    <div style={{ width: '30px', height: '22px', borderRadius: '4px', background: 'linear-gradient(135deg, #d4af37 0%, #f2d06b 50%, #d4af37 100%)' }}></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: getBrandColor(card.brand), fontSize: '14px', letterSpacing: '1px' }}>
                        {getBrandLogo(card.brand)}
                      </span>
                      <span style={{ fontSize: '10px', color: '#fff' }}>{card.brand}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px', color: '#fff' }}>
                      •••• •••• •••• {card.last4}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCard(card.id);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#fff', opacity: 0.7 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customer ID row */}
        {customerId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: '8px', fontSize: '12px', color: '#666' }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Customer: <code style={{ color: '#333' }}>{customerId}</code>
            </span>
            <button
              onClick={() => {
                localStorage.removeItem(`super_customer_id_${environment}`);
                setCustomerId(null);
              }}
              style={{ flexShrink: 0, padding: '4px 10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#e53935', fontWeight: '600' }}
            >
              Reset
            </button>
          </div>
        )}

        {/* Add Card Form / Button */}
        {!sessionToken ? (
          <button onClick={handleRegisterCard} disabled={loading} style={btnSetup}>
            {loading ? 'Initializing...' : '+ Add Saved Card'}
          </button>
        ) : (
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '12px' }}>
            <super-card session-token={sessionToken}></super-card>
            {isSdkReady && (
              <button
                onClick={handleSaveCard}
                disabled={submitting}
                style={{ ...btnStyle, marginTop: '15px', backgroundColor: '#000', color: '#fff' }}
              >
                {submitting ? 'Saving...' : 'Save Card'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Custom Credentials — spans full width below the 3-column grid */}
      <div style={{ gridColumn: '1 / -1', backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Custom Credentials</h2>
          {customCredsActive && (
            <span style={{ padding: '2px 10px', backgroundColor: '#e8f5e9', border: '1px solid #4CAF50', borderRadius: '20px', fontSize: '12px', color: '#2e7d32', fontWeight: 'bold' }}>
              Active
            </span>
          )}
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#666' }}>
          Enter credentials for a custom account. Choose which base URL to use, then click Apply.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ ...labelStyle, display: 'block' }}>Secret Key</label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
              placeholder="sk_test_... or sk_stag_..."
              value={customCreds.api_key}
              onChange={e => setCustomCreds({ ...customCreds, api_key: e.target.value })}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'block' }}>Initiator ID</label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={customCreds.initiator_id}
              onChange={e => setCustomCreds({ ...customCreds, initiator_id: e.target.value })}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'block' }}>Brand ID</label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={customCreds.brand_id}
              onChange={e => setCustomCreds({ ...customCreds, brand_id: e.target.value })}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'block' }}>Base URL</label>
            <select
              style={inputStyle}
              value={customCreds.envType}
              onChange={e => setCustomCreds({ ...customCreds, envType: e.target.value })}
            >
              <option value="test">Test</option>
              <option value="staging">Staging</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
          <button onClick={handleApplyCustomCreds} style={{ ...btnStyle, margin: 0 }}>
            Apply
          </button>
          <button
            onClick={handleClearCustomCreds}
            style={{ ...btnStyle, margin: 0, backgroundColor: '#fff', color: '#e53935', border: '1px solid #e53935' }}
          >
            Clear
          </button>
          {customCredsStatus && (
            <span style={{ fontSize: '13px', color: customCredsStatus.startsWith('success') ? '#2e7d32' : '#e53935' }}>
              {customCredsStatus.split(':')[1]}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

const cardDisplayStyle = {
  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '12px',
  color: '#fff',
  boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
  transition: 'transform 0.2s',
};

const cardChipStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', width: '100%', marginBottom: '15px' };
const labelStyle = { fontWeight: 'bold', fontSize: '12px', display: 'block', marginBottom: '5px' };
const btnStyle = { width: '100%', padding: '15px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' };
const btnSetup = { padding: '15px 30px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };

export default AccountPage;
