import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Demo page styled to approximate a merchant's own checkout, so the embedded
// component can be shown in something close to its real surroundings.
// The modal reproduces their Bootstrap CSS: a transform on the dialog and
// overflow:hidden on the content. Both are toggleable under Diagnostics.
const BRAND = {
  blue: '#1b9bd8',
  pink: '#e6007e',
  text: '#2c3e50',
  border: '#e3e8ee',
  muted: '#7b8794',
};

const ModalCheckout = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [open, setOpen] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [log, setLog] = useState([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  // Hides the sandbox nav so the page reads as the merchant's own checkout.
  const [demoMode, setDemoMode] = useState(true);

  // Modal CSS knobs — the properties that actually affect the component
  const [useTransform, setUseTransform] = useState(true);
  const [clipOverflow, setClipOverflow] = useState(true);
  const [backdropFilter, setBackdropFilter] = useState(false);
  const [unmountOnClose, setUnmountOnClose] = useState(true);

  const [supportCreditPopup] = useState(
    () => localStorage.getItem('super_credit_popup') !== 'false'
  );

  const [overlay, setOverlay] = useState(null);
  const walletsRegistered = useRef(false);

  const addLog = (line) =>
    setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/checkout-sessions`, { method: 'POST' });
        const data = await res.json();
        if (data.checkoutSessionToken) {
          setSessionToken(data.checkoutSessionToken);
          setCheckoutSessionId(data.checkoutSessionId);
        } else {
          setSessionError(data.detail || data.error || 'Failed to create session');
        }
      } catch (err) {
        setSessionError(err.message);
      }
    })();
  }, []);

  // Methods attach ~1s after the element exists, so poll for the method.
  useEffect(() => {
    if (!open || !sessionToken) return;
    setSdkReady(false);
    walletsRegistered.current = false;

    const interval = setInterval(() => {
      const el = document.querySelector('super-checkout');
      if (!el || typeof el.submit !== 'function') return;
      clearInterval(interval);
      setSdkReady(true);
      addLog('component ready');

      if (window.superCheckout?.registerWalletsHandler && !walletsRegistered.current) {
        walletsRegistered.current = true;
        window.superCheckout.registerWalletsHandler(async (event) => {
          addLog(`wallets handler fired (${event?.detail?.type ?? 'unknown'})`);
          await sendProceed();
        });
        addLog('wallets handler registered');
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (walletsRegistered.current) {
        walletsRegistered.current = false;
        // Without this, reopening stacks a duplicate window listener and each
        // one fires its own /proceed.
        try {
          window.superCheckout?.unregisterWalletHandler?.();
          addLog('wallets handler unregistered');
        } catch (err) {
          addLog(`unregister failed: ${err.message}`);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionToken]);

  // Measure the SDK's full-screen overlay against the viewport.
  useEffect(() => {
    if (!open || !sdkReady) { setOverlay(null); return; }
    const tick = setInterval(() => {
      const el = document.querySelector('super-checkout');
      if (!el?.shadowRoot) return;
      const walk = (root, out = []) => {
        root.querySelectorAll('*').forEach((n) => {
          out.push(n);
          if (n.shadowRoot) walk(n.shadowRoot, out);
        });
        return out;
      };
      const fixed = walk(el.shadowRoot).find((n) => getComputedStyle(n).position === 'fixed');
      if (!fixed) { setOverlay({ found: false }); return; }
      const r = fixed.getBoundingClientRect();
      setOverlay({
        found: true,
        w: Math.round(r.width), h: Math.round(r.height),
        vw: window.innerWidth, vh: window.innerHeight,
        ok: Math.round(r.width) >= window.innerWidth - 2 &&
            Math.round(r.height) >= window.innerHeight - 2,
      });
    }, 500);
    return () => clearInterval(tick);
  }, [open, sdkReady]);

  const sendProceed = async () => {
    const res = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 5800,
        email: 'customer@example.com',
        phone: '07700900000',
        externalReference: `MODAL_ORDER_${Date.now()}`,
      }),
    });
    const data = await res.json();
    addLog(`proceed → HTTP ${res.status}`);
    if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
    setErrorMessage(data.detail || data.error || `Proceed failed (HTTP ${res.status})`);
  };

  const placeOrder = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await window.superCheckout.submit({
        customerInformation: {
          firstName: 'Test', lastName: 'User',
          email: 'customer@example.com', phoneNumber: '07700900000',
        },
      });
      addLog(`submit() → ${result?.status}`);
      if (result?.status !== 'SUCCESS') {
        setErrorMessage(result?.errorMessage || 'Payment failed');
        return;
      }
      await sendProceed();
    } catch (err) {
      addLog(`error: ${err.message}`);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Presentational bits ──────────────────────────────────────────────────
  const card = {
    background: '#fff', border: `1px solid ${BRAND.border}`,
    borderRadius: '8px', padding: '24px', marginBottom: '18px',
  };
  const field = {
    width: '100%', boxSizing: 'border-box', padding: '12px 14px',
    border: `1px solid ${BRAND.border}`, borderRadius: '6px',
    fontSize: '14px', color: BRAND.text, background: '#fff',
  };
  const fieldLabel = { fontSize: '11px', color: BRAND.muted, marginBottom: '4px', display: 'block' };
  const tick = <span style={{ color: '#27ae60', marginLeft: '-26px' }}>✓</span>;

  const row = (label, value, span) => (
    <div style={{ gridColumn: span ? 'span 2' : 'auto', marginBottom: '14px' }}>
      <label style={fieldLabel}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input style={field} defaultValue={value} readOnly />
        {tick}
      </div>
    </div>
  );

  const summaryRow = (label, value, editable) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${BRAND.border}` }}>
      <div>
        <div style={{ fontSize: '11px', color: BRAND.muted }}>{label}</div>
        <div style={{ fontSize: '14px', color: BRAND.text, fontWeight: 500 }}>{value}</div>
      </div>
      {editable && <span style={{ fontSize: '12px', color: BRAND.blue, cursor: 'pointer' }}>edit ✎</span>}
    </div>
  );

  const toggle = (label, value, setter, note) => (
    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', marginBottom: '8px' }}>
      <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} style={{ marginTop: '3px' }} />
      <span><code>{label}</code><br /><span style={{ color: BRAND.muted, fontSize: '12px' }}>{note}</span></span>
    </label>
  );

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100vh', margin: '-20px', paddingBottom: '40px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {demoMode && <style>{'nav { display: none !important; }'}</style>}

      {/* Small escape hatch — the sandbox nav is hidden in demo mode */}
      <button
        onClick={() => setDemoMode((v) => !v)}
        title={demoMode ? 'Show the sandbox nav' : 'Hide the sandbox nav'}
        style={{
          position: 'fixed', bottom: '14px', left: '14px', zIndex: 2000,
          padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(0,0,0,.15)',
          background: 'rgba(255,255,255,.92)', color: BRAND.muted, fontSize: '11px',
          cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.15)',
        }}
      >
        {demoMode ? '◂ sandbox' : '▸ demo mode'}
      </button>

      {/* Brand header */}
      <div style={{ background: BRAND.blue, padding: '14px 32px', display: 'flex', alignItems: 'center', gap: '28px' }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px', letterSpacing: '0.5px' }}>MERCHANT</span>
        {['How it works', "What's Included", 'Why Trust Us?'].map((t) => (
          <span key={t} style={{ color: '#fff', fontSize: '13px', opacity: 0.95 }}>{t}</span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#fff', fontSize: '13px' }}>Log in</span>
      </div>

      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '26px', color: BRAND.text, margin: 0 }}>Confirm your details</h1>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: BRAND.muted }}>Quote ref: 30856214</div>
            <div style={{ fontSize: '22px', color: BRAND.blue, fontWeight: 700 }}>020 8629 5264</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left: booking form */}
          <div style={{ flex: '1 1 580px', minWidth: '320px' }}>
            <div style={card}>
              <h2 style={{ fontSize: '18px', color: BRAND.text, marginTop: 0 }}>Your Booking Details</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                {row('First and Last Name', 'Test User', true)}
                {row('Email Address', 'customer@example.com')}
                {row('Phone Number', '07700900000')}
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: '18px', color: BRAND.text, marginTop: 0 }}>Pickup Details</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                {row('Postcode', 'TW8 0BE')}
                {row('Address', 'Please Select Address (TW8 0BE)')}
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: '18px', color: BRAND.text, marginTop: 0 }}>Delivery Details</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                {row('Postcode', 'TW8 0BE')}
                {row('Contact Name at Delivery', 'Test User')}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button style={{ padding: '14px 26px', border: `1px solid ${BRAND.border}`, background: '#fff', borderRadius: '6px', color: BRAND.muted, fontSize: '15px', cursor: 'pointer' }}>
                ‹ Back
              </button>
              <button
                onClick={() => { setOpen(true); setErrorMessage(''); addLog('payment modal opened'); }}
                disabled={!sessionToken}
                style={{
                  marginLeft: 'auto', padding: '15px 34px', border: 'none', borderRadius: '6px',
                  background: BRAND.pink, color: '#fff', fontSize: '16px', fontWeight: 700,
                  cursor: sessionToken ? 'pointer' : 'not-allowed', opacity: sessionToken ? 1 : 0.5,
                }}
              >
                Next Step ›
              </button>
            </div>
            {sessionError && <p style={{ color: '#e74c3c', fontSize: '13px' }}>{sessionError}</p>}
          </div>

          {/* Right: order summary */}
          <div style={{ flex: '0 1 320px', minWidth: '280px' }}>
            <div style={card}>
              <div style={{ background: '#ece7e1', borderRadius: '6px', height: '120px', marginBottom: '12px' }} />
              {summaryRow('Your Reference', '30856214')}
              {summaryRow('Car Type', 'Ariel Atom', true)}
              {summaryRow('Pickup', 'Mon 26 Oct', true)}
              {summaryRow('Locations', 'TW8 to TW8', true)}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
                <span style={{ fontSize: '16px', color: BRAND.text }}>Total Price</span>
                <span style={{ fontSize: '22px', color: BRAND.blue, fontWeight: 700 }}>£58.00</span>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: BRAND.muted, textAlign: 'center' }}>
              By proceeding, you agree with our Terms of Use.
            </p>
          </div>
        </div>

        {/* Diagnostics — collapsed so it stays out of the way during a demo */}
        <div style={{ marginTop: '30px' }}>
          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            style={{ background: 'none', border: 'none', color: BRAND.muted, fontSize: '12px', cursor: 'pointer', padding: 0 }}
          >
            {showDiagnostics ? '▾' : '▸'} Diagnostics
          </button>

          {showDiagnostics && (
            <div style={{ ...card, marginTop: '10px', display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px' }}>
                <h3 style={{ fontSize: '14px', marginTop: 0 }}>Modal CSS</h3>
                {toggle('.modal-dialog { transform }', useTransform, setUseTransform, "as the merchant has it — Bootstrap .fade residue")}
                {toggle('.modal-content { overflow: hidden }', clipOverflow, setClipOverflow, 'as the merchant has it')}
                {toggle('.modal { backdrop-filter: blur() }', backdropFilter, setBackdropFilter, 'same containing-block effect as transform')}
                {toggle('unmount component on close', unmountOnClose, setUnmountOnClose, 'off = keep mounted and hide instead')}
                <p style={{ fontSize: '12px', color: BRAND.muted }}>
                  <code>support-credit-popup</code> is <strong>{String(supportCreditPopup)}</strong> (Account Settings).
                </p>
              </div>
              <div style={{ flex: '1 1 320px' }}>
                <h3 style={{ fontSize: '14px', marginTop: 0 }}>SDK overlay vs viewport</h3>
                {!open || !overlay ? (
                  <p style={{ fontSize: '13px', color: BRAND.muted }}>Open the payment modal to measure.</p>
                ) : !overlay.found ? (
                  <p style={{ fontSize: '13px', color: BRAND.muted }}>No fixed overlay rendered yet.</p>
                ) : (
                  <div style={{
                    padding: '12px', borderRadius: '8px', fontSize: '13px',
                    border: '1px solid', borderColor: overlay.ok ? '#4CAF50' : '#e74c3c',
                    background: overlay.ok ? '#f1f8f2' : '#fdf3f2',
                  }}>
                    <strong>{overlay.ok ? '✅ Covers the viewport' : '❌ Clipped to the modal'}</strong>
                    <div style={{ fontFamily: 'monospace', marginTop: '6px' }}>
                      overlay {overlay.w} × {overlay.h}<br />viewport {overlay.vw} × {overlay.vh}
                    </div>
                  </div>
                )}
                {log.length > 0 && (
                  <pre style={{
                    marginTop: '12px', padding: '10px', borderRadius: '8px',
                    background: '#1e1e1e', color: '#d4d4d4', fontSize: '11px',
                    maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap',
                  }}>{log.join('\n')}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment modal ─────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 1050,
            background: 'rgba(0,0,0,.5)',
            ...(backdropFilter ? { backdropFilter: 'blur(4px)' } : {}),
          }}
        >
          <div style={{
            position: 'relative', width: '600px', maxWidth: 'calc(100% - 32px)', margin: '30px auto',
            ...(useTransform ? { transform: 'matrix(1, 0, 0, 1, 0, 8.5725)' } : {}),
          }}>
            <div style={{
              position: 'relative', background: '#fff', borderRadius: '8px', padding: '24px',
              overflow: clipOverflow ? 'hidden' : 'visible',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
                <span style={{ fontSize: '20px', marginRight: '10px' }}>💳</span>
                <h2 style={{ fontSize: '19px', margin: 0, flex: 1, color: BRAND.text }}>Enter your payment details</h2>
                <button
                  onClick={() => { setOpen(false); addLog('payment modal closed'); }}
                  style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', lineHeight: 1, color: BRAND.muted }}
                >
                  ×
                </button>
              </div>

              {sessionToken && (
                <super-checkout
                  key={sessionToken}
                  amount="5800"
                  currency="GBP"
                  checkout-session-token={sessionToken}
                  support-express-wallets="true"
                  support-credit-popup={String(supportCreditPopup)}
                />
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 0 14px', marginTop: '14px', borderTop: `1px solid ${BRAND.border}`,
              }}>
                <span style={{ fontSize: '16px', color: BRAND.text }}>Total price</span>
                <span style={{ fontSize: '22px', color: BRAND.blue, fontWeight: 700 }}>£58.00</span>
              </div>

              {sdkReady && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '11px', color: BRAND.muted, flex: 1 }}>
                    By clicking Book Now, you agree with our Privacy Policy and Terms of Use.
                  </span>
                  <button
                    onClick={placeOrder}
                    disabled={loading}
                    style={{
                      padding: '14px 32px', border: 'none', borderRadius: '6px',
                      background: BRAND.pink, color: '#fff', fontWeight: 700, fontSize: '15px',
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Processing...' : 'Book Now'}
                  </button>
                </div>
              )}

              {errorMessage && (
                <p style={{ color: '#e74c3c', fontSize: '13px', marginTop: '10px' }}>{errorMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keep-mounted mode: component stays alive but hidden when closed */}
      {!open && !unmountOnClose && sessionToken && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden="true">
          <super-checkout
            key={sessionToken}
            amount="5800"
            currency="GBP"
            checkout-session-token={sessionToken}
            support-express-wallets="true"
            support-credit-popup={String(supportCreditPopup)}
          />
        </div>
      )}
    </div>
  );
};

export default ModalCheckout;
