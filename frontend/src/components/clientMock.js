import React, { useState, useEffect, useRef, createElement } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Every knob that has differed between client integrations so far. Edit this
// as JSON on the page, or load it from a shared link / preset.
const DEFAULT_CONFIG = {
  component: 'super-checkout',
  attributes: {
    amount: 15000,
    currency: 'GBP',
    'payment-methods-order': 'CARD,BNPL,OPEN_BANKING',
    'pre-selected-payment-method': 'CARD',
    'support-express-wallets': 'true',
  },
  handlers: ['registerCardDetailsHandler', 'registerWalletsHandler'],
  placeOrder: 'submit',
  session: {},
  proceed: {
    amount: 15000,
    currency: 'GBP',
    externalReference: 'MOCK_ORDER',
    preferNativeActions: true,
  },
};

const PRESETS = {
  'Embedded — card': {
    component: 'super-checkout',
    attributes: { amount: 15000, currency: 'GBP', 'pre-selected-payment-method': 'CARD' },
    handlers: ['registerCardDetailsHandler'],
    placeOrder: 'submit',
    session: {},
    proceed: { amount: 15000, currency: 'GBP', externalReference: 'MOCK_ORDER' },
  },
  'Save card + take payment': {
    component: 'super-single-checkout',
    attributes: {
      amount: 15000, currency: 'GBP',
      'payment-to-display': 'CARD', 'support-credit-popup': 'true',
    },
    handlers: ['registerCardDetailsHandler', 'registerWalletsHandler'],
    placeOrder: 'submit',
    session: { customer: { id: 'cus_REPLACE_ME' } },
    proceed: {
      amount: 15000, currency: 'GBP', externalReference: 'MOCK_ORDER',
      preferNativeActions: true,
      customer: { id: 'cus_REPLACE_ME', savePaymentMethodOptions: { futureUsage: 'OFF_SESSION' } },
    },
  },
  'Upsell — saved card': {
    component: 'super-upsell-checkout',
    attributes: { amount: 4999, currency: 'GBP' },
    handlers: [],
    placeOrder: 'triggerUpsell',
    session: { customer: { id: 'cus_REPLACE_ME', existingPaymentMethodId: 'pm_REPLACE_ME' } },
    proceed: { amount: 4999, currency: 'GBP', externalReference: 'MOCK_ORDER', preferNativeActions: true },
  },
  'Express wallets': {
    component: 'super-single-checkout',
    attributes: { amount: 15000, currency: 'GBP', 'payment-to-display': 'EXPRESS_WALLETS' },
    handlers: ['registerWalletsHandler'],
    placeOrder: 'submit',
    session: { customer: { id: 'cus_REPLACE_ME' } },
    proceed: {
      amount: 15000, currency: 'GBP', externalReference: 'MOCK_ORDER',
      preferNativeActions: true,
      customer: { id: 'cus_REPLACE_ME', savePaymentMethodOptions: { futureUsage: 'OFF_SESSION' } },
    },
  },
};

const encodeConfig = (cfg) => {
  try { return btoa(encodeURIComponent(JSON.stringify(cfg))); } catch (e) { return ''; }
};
const decodeConfig = (s) => {
  try { return JSON.parse(decodeURIComponent(atob(s))); } catch (e) { return null; }
};

const ClientMock = () => {
  const [configText, setConfigText] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('c');
    const decoded = fromUrl ? decodeConfig(fromUrl) : null;
    return JSON.stringify(decoded || DEFAULT_CONFIG, null, 2);
  });

  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [cardValid, setCardValid] = useState(null);
  const [events, setEvents] = useState([]);

  // Handlers are registered once but read the latest config/session id.
  const liveRef = useRef({});
  const registeredRef = useRef(false);

  let config = null;
  let parseError = null;
  try { config = JSON.parse(configText); } catch (err) { parseError = err.message; }

  useEffect(() => {
    liveRef.current = { config, checkoutSessionId };
  });

  const log = (line) => setEvents(e => [...e, new Date().toLocaleTimeString() + '  ' + line]);

  // ── Divergence checks — the class of bug behind the client 500 ───────────
  const warnings = [];
  if (config) {
    const attrAmount = Number(config.attributes && config.attributes.amount);
    const proceedAmount = Number(config.proceed && config.proceed.amount);
    if (attrAmount && proceedAmount && attrAmount !== proceedAmount) {
      warnings.push('amount mismatch: component ' + attrAmount + ' vs proceed ' + proceedAmount);
    }
    if (config.component === 'super-single-checkout' && !(config.attributes || {})['payment-to-display']) {
      warnings.push('super-single-checkout requires payment-to-display, or it throws and never initialises');
    }
    if (config.placeOrder === 'triggerUpsell' && config.component !== 'super-upsell-checkout') {
      warnings.push('triggerUpsell only exists on super-upsell-checkout');
    }
    if ((config.handlers || []).includes('registerWalletsHandler')
        && !(config.proceed || {}).preferNativeActions) {
      warnings.push('wallets without preferNativeActions: true will redirect to the hosted page');
    }
  }

  // ── Create the session from the raw body in the config ───────────────────
  const createSession = async () => {
    if (!config) return;
    setLoading(true); setStatus(null); setEvents([]); setCardValid(null);
    setSessionToken(null); setCheckoutSessionId(null); setSdkReady(false);
    try {
      const res = await fetch(API_BASE + '/checkout-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawSession: config.session || {} }),
      });
      const data = await res.json();
      if (!data.checkoutSessionToken) {
        setStatus({ ok: false, text: 'HTTP ' + res.status + '\n\n' + JSON.stringify(data, null, 2) });
        return;
      }
      setSessionToken(data.checkoutSessionToken);
      setCheckoutSessionId(data.checkoutSessionId);
      log('session created — ' + data.checkoutSessionId);
    } catch (err) {
      setStatus({ ok: false, text: 'Request failed: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Proceed, using the raw body from the config ──────────────────────────
  const sendProceed = async (el) => {
    const cfg = liveRef.current.config;
    const id = liveRef.current.checkoutSessionId;
    if (!cfg || !id) return;
    const res = await fetch(API_BASE + '/checkout-sessions/' + id + '/proceed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawPayload: cfg.proceed || {} }),
    });
    const data = await res.json();
    setStatus({ ok: res.ok, text: 'HTTP ' + res.status + '\n\n' + JSON.stringify(data, null, 2) });
    log('proceed → HTTP ' + res.status);

    if (data.nativeNextAction && el && el.handleNextAction) {
      log('resolving nativeNextAction');
      const result = await el.handleNextAction(data.nativeNextAction);
      log('handleNextAction → ' + (result && result.status));
      if (result && result.status === 'SUCCESS') window.location.href = result.redirectUrl;
      return;
    }
    if (data.redirectUrl) window.location.href = data.redirectUrl;
  };

  // ── Register the handlers the config asks for ────────────────────────────
  // The SDK attaches these to the instance ~1s after the element is defined,
  // so poll for the method rather than trusting querySelector.
  useEffect(() => {
    if (!sessionToken || !config) return;
    const wanted = config.handlers || [];
    const tag = config.component;
    registeredRef.current = false;

    const interval = setInterval(() => {
      const el = document.querySelector(tag);
      if (!el || typeof el.submit !== 'function' || registeredRef.current) return;
      registeredRef.current = true;
      clearInterval(interval);
      setSdkReady(true);
      log('component ready');

      if (wanted.includes('registerCardDetailsHandler') && el.registerCardDetailsHandler) {
        el.registerCardDetailsHandler((event) => {
          const valid = !!(event.detail && event.detail.cardDetailsValid);
          setCardValid(valid);
          log('cardDetailsValid: ' + valid);
        });
        log('registerCardDetailsHandler registered');
      }

      if (wanted.includes('registerWalletsHandler') && el.registerWalletsHandler) {
        el.registerWalletsHandler(async (event) => {
          log('wallets handler fired (' + ((event && event.detail && event.detail.type) || 'unknown') + ')');
          await sendProceed(el);
        });
        log('registerWalletsHandler registered');
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (registeredRef.current) {
        registeredRef.current = false;
        // Paired unregister: the SDK keeps this listener on window and orphans
        // the previous one on re-register, firing a duplicate /proceed per leak.
        try {
          const el = document.querySelector(tag);
          if (el && el.unregisterWalletHandler) el.unregisterWalletHandler();
        } catch (err) { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, configText]);

  const placeOrder = async () => {
    const cfg = liveRef.current.config;
    const el = document.querySelector(cfg.component);
    if (!el) return;
    setLoading(true);
    try {
      const method = cfg.placeOrder === 'triggerUpsell' ? 'triggerUpsell' : 'submit';
      log('calling ' + method + '()');
      const amount = Number((cfg.attributes || {}).amount) || undefined;
      const result = await el[method]({ amount: amount });
      log(method + '() → ' + (result && result.status));
      if (!result || result.status !== 'SUCCESS') {
        setStatus({
          ok: false,
          text: method + '() returned ' + (result && result.status) + '\n\n' + ((result && result.errorMessage) || ''),
        });
        return;
      }
      await sendProceed(el);
    } catch (err) {
      log('error: ' + err.message);
      setStatus({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const shareLink = () => {
    if (!config) return;
    const url = window.location.origin + window.location.pathname + '?c=' + encodeConfig(config);
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    log('share link copied to clipboard');
  };

  const btn = {
    padding: '12px 18px', borderRadius: '8px', border: 'none', color: '#fff',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  };

  return (
    <div className="layout-two-col">
      {/* LEFT: the scenario */}
      <div>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
          Client Mock
        </h2>
        <p style={{ fontSize: '13px', color: '#666', margin: '10px 0 14px' }}>
          Describe a client's integration as JSON and run it. The session and proceed
          bodies are sent verbatim, so you can reproduce their exact request shape
          without a code change.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {Object.keys(PRESETS).map(name => (
            <button
              key={name}
              onClick={() => setConfigText(JSON.stringify(PRESETS[name], null, 2))}
              style={{ ...btn, padding: '7px 12px', fontSize: '12px', backgroundColor: '#555' }}
            >
              {name}
            </button>
          ))}
        </div>

        <textarea
          value={configText}
          onChange={e => setConfigText(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%', minHeight: '380px', boxSizing: 'border-box',
            fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5',
            padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
            backgroundColor: '#fafafa', resize: 'vertical',
          }}
        />

        {parseError && (
          <p style={{ color: '#e74c3c', fontSize: '12px', marginTop: '8px' }}>Invalid JSON: {parseError}</p>
        )}

        {warnings.length > 0 && (
          <div style={{
            marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
            backgroundColor: '#fff8e1', border: '1px solid #ffc107', fontSize: '12px',
          }}>
            {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            onClick={createSession}
            disabled={!config || loading}
            style={{ ...btn, backgroundColor: '#1976d2', opacity: (!config || loading) ? 0.5 : 1, flex: 1 }}
          >
            {loading ? 'Working...' : 'Create Session & Render'}
          </button>
          <button
            onClick={shareLink}
            disabled={!config}
            style={{ ...btn, backgroundColor: '#555', opacity: config ? 1 : 0.5 }}
          >
            Copy share link
          </button>
        </div>

        {status && (
          <pre style={{
            marginTop: '12px', padding: '12px', borderRadius: '8px', border: '1px solid',
            borderColor: status.ok ? '#4CAF50' : '#e74c3c',
            backgroundColor: status.ok ? '#f1f8f2' : '#fdf3f2',
            fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            maxHeight: '240px', overflowY: 'auto',
          }}>{status.text}</pre>
        )}
      </div>

      {/* RIGHT: the rendered component */}
      <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.4rem', marginTop: 0, marginBottom: '6px' }}>
          {(config && config.component) || 'component'}
        </h2>
        {cardValid !== null && (
          <p style={{ fontSize: '12px', color: cardValid ? '#2e7d32' : '#999', margin: '0 0 14px' }}>
            cardDetailsValid: {String(cardValid)}
          </p>
        )}

        {sessionToken && config ? (
          <>
            {createElement(config.component, {
              key: sessionToken + '-' + JSON.stringify(config.attributes),
              ...Object.fromEntries(
                Object.entries(config.attributes || {}).map(([k, v]) => [k, String(v)])
              ),
              'checkout-session-token': sessionToken,
            })}

            {sdkReady && (
              <button
                onClick={placeOrder}
                disabled={loading}
                style={{
                  ...btn, width: '100%', marginTop: '22px', padding: '16px',
                  backgroundColor: '#000', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Processing...' : 'Place Order (' + (config.placeOrder || 'submit') + ')'}
              </button>
            )}
          </>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '200px', color: '#999', fontSize: '14px', textAlign: 'center',
          }}>
            Edit the config, then click "Create Session &amp; Render".
          </div>
        )}

        {events.length > 0 && (
          <pre style={{
            marginTop: '18px', padding: '12px', borderRadius: '8px',
            backgroundColor: '#1e1e1e', color: '#d4d4d4', fontSize: '11px',
            maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap',
          }}>{events.join('\n')}</pre>
        )}
      </div>
    </div>
  );
};

export default ClientMock;
