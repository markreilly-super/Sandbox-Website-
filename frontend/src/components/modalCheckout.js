import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Replicates the Bootstrap modal used by a live merchant (anyvan.com), whose
// computed styles were .modal-dialog { transform: matrix(1,0,0,1,0,8.5725) }
// and .modal-content { overflow: hidden }. Both break the SDK in ways that
// only show up on the BNPL / overlay paths, so they are toggleable here.
const ModalCheckout = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [open, setOpen] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [log, setLog] = useState([]);

  // Modal CSS knobs — these are the things that actually break the component
  const [useTransform, setUseTransform] = useState(true);
  const [clipOverflow, setClipOverflow] = useState(true);
  const [backdropFilter, setBackdropFilter] = useState(false);
  const [unmountOnClose, setUnmountOnClose] = useState(true);

  // Set on the Account Settings page (localStorage: super_credit_popup).
  // Read once on mount, so change it there and reload this page.
  const [supportCreditPopup] = useState(
    () => localStorage.getItem('super_credit_popup') !== 'false'
  );

  // super-single-checkout requires paymentToDisplay — without it the component
  // throws on validation and its methods never attach.
  const [paymentToDisplay, setPaymentToDisplay] = useState('CARD');

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

  // ── Readiness + handlers. Methods attach ~1s after the element exists, so
  //    poll for the method rather than trusting querySelector.
  useEffect(() => {
    if (!open || !sessionToken) return;
    setSdkReady(false);
    walletsRegistered.current = false;

    const interval = setInterval(() => {
      const el = document.getElementById('modal-single-checkout');
      if (!el || typeof el.submit !== 'function') return;
      clearInterval(interval);
      setSdkReady(true);
      addLog('component ready');

      if (typeof el.registerWalletsHandler === 'function' && !walletsRegistered.current) {
        walletsRegistered.current = true;
        el.registerWalletsHandler(async (event) => {
          addLog(`wallets handler fired (${event?.detail?.type ?? 'unknown'})`);
          await sendProceed(el);
        });
        addLog('wallets handler registered');
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (walletsRegistered.current) {
        walletsRegistered.current = false;
        // Without this, closing and reopening stacks a duplicate window
        // listener and each one fires its own /proceed.
        try {
          document.getElementById('modal-single-checkout')?.unregisterWalletHandler?.();
          addLog('wallets handler unregistered');
        } catch (err) {
          addLog(`unregister failed: ${err.message}`);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionToken]);

  // ── Measure the SDK's full-screen overlay against the viewport ───────────
  useEffect(() => {
    if (!open || !sdkReady) { setOverlay(null); return; }
    const tick = setInterval(() => {
      const el = document.getElementById('modal-single-checkout');
      if (!el?.shadowRoot) return;
      const walk = (root, out = []) => {
        root.querySelectorAll('*').forEach((n) => {
          out.push(n);
          if (n.shadowRoot) walk(n.shadowRoot, out);
        });
        return out;
      };
      const fixed = walk(el.shadowRoot).find(
        (n) => getComputedStyle(n).position === 'fixed'
      );
      if (!fixed) { setOverlay({ found: false }); return; }
      const r = fixed.getBoundingClientRect();
      setOverlay({
        found: true,
        w: Math.round(r.width),
        h: Math.round(r.height),
        vw: window.innerWidth,
        vh: window.innerHeight,
        ok: Math.round(r.width) >= window.innerWidth - 2 &&
            Math.round(r.height) >= window.innerHeight - 2,
      });
    }, 500);
    return () => clearInterval(tick);
  }, [open, sdkReady]);

  const sendProceed = async (el) => {
    const res = await fetch(`${API_BASE}/checkout-sessions/${checkoutSessionId}/proceed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 5800,
        email: 'customer@example.com',
        phone: '07700900000',
        externalReference: `MODAL_ORDER_${Date.now()}`,
        // Keeps 3DS inline instead of redirecting, so the challenge renders
        // as a fixed overlay inside the modal — the case under test.
        preferNativeActions: true,
      }),
    });
    const data = await res.json();
    addLog(`proceed → HTTP ${res.status}`);

    if (data.nativeNextAction) {
      addLog('nativeNextAction returned — resolving inline (watch the overlay)');
      const target = el || document.getElementById('modal-single-checkout');
      const result = await target.handleNextAction(data.nativeNextAction);
      addLog(`handleNextAction → ${result?.status}`);
      if (result?.status === 'SUCCESS') { window.location.href = result.redirectUrl; return; }
      setErrorMessage(result?.errorMessage || 'Payment failed during 3DS.');
      return;
    }
    if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
    setErrorMessage(data.detail || data.error || `Proceed failed (HTTP ${res.status})`);
  };

  const placeOrder = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const el = document.getElementById('modal-single-checkout');
      const result = await el.submit({ amount: 5800 });
      addLog(`submit() → ${result?.status}`);
      if (result?.status !== 'SUCCESS') {
        setErrorMessage(result?.errorMessage || 'Payment failed');
        return;
      }
      await sendProceed(el);
    } catch (err) {
      addLog(`error: ${err.message}`);
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const warnings = [];
  if (useTransform) warnings.push('transform on .modal-dialog creates a containing block — the SDK full-screen overlay will be clipped to the modal');
  if (clipOverflow) warnings.push('overflow: hidden on .modal-content clips BNPL content instead of scrolling');
  if (backdropFilter) warnings.push('backdrop-filter also creates a containing block — same effect as transform');
  if (unmountOnClose) warnings.push('unmounting on close relies on unregisterWalletHandler running, or wallet handlers stack');

  const toggle = (label, value, setter, note) => (
    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', marginBottom: '8px' }}>
      <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} style={{ marginTop: '3px' }} />
      <span><code>{label}</code><br /><span style={{ color: '#666', fontSize: '12px' }}>{note}</span></span>
    </label>
  );

  return (
    <div className="layout-page">
      <h1 style={{ fontSize: '1.8rem', marginBottom: '6px' }}>Checkout in a Modal</h1>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '22px', maxWidth: '760px' }}>
        Reproduces the Bootstrap modal used by a live merchant, using super-single-checkout with preferNativeActions so 3DS stays inline. Toggle each property
        and watch the overlay measurement — it shows whether the SDK's full-screen
        overlay still covers the viewport or has been trapped inside the modal.
      </p>

      <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 340px', minWidth: '300px' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '10px' }}>Modal CSS</h3>
          {toggle('.modal-dialog { transform }', useTransform, setUseTransform, 'as the merchant has it — Bootstrap .fade residue')}
          {toggle('.modal-content { overflow: hidden }', clipOverflow, setClipOverflow, 'as the merchant has it')}
          {toggle('.modal { backdrop-filter: blur() }', backdropFilter, setBackdropFilter, 'common styling choice, same breakage')}
          {toggle('unmount component on close', unmountOnClose, setUnmountOnClose, 'off = keep mounted and hide instead')}

          <label style={{ display: 'block', fontSize: '13px', marginTop: '10px' }}>
            <code>payment-to-display</code>{' '}
            <select
              value={paymentToDisplay}
              onChange={(e) => setPaymentToDisplay(e.target.value)}
              style={{ marginLeft: '6px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}
            >
              {['CARD', 'BNPL', 'EXPRESS_WALLETS', 'APPLE_PAY', 'GOOGLE_PAY', 'OPEN_BANKING'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <br />
            <span style={{ color: '#666', fontSize: '12px' }}>
              Required by this component. Use CARD with a 3DS test card to see the
              inline challenge render inside the modal.
            </span>
          </label>

          <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0' }}>
            <code>preferNativeActions: true</code> is sent on every proceed from this
            page, so 3DS stays inline instead of redirecting.
          </p>

          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
            <code>support-credit-popup</code> is <strong>{String(supportCreditPopup)}</strong>
            {' '}(from Account Settings).{' '}
            {supportCreditPopup
              ? 'BNPL opens in a window popup, so overflow clipping will not show.'
              : 'BNPL expands inline, so overflow clipping is testable.'}
          </p>

          <button
            onClick={() => { setOpen(true); setErrorMessage(''); addLog('modal opened'); }}
            disabled={!sessionToken}
            style={{
              marginTop: '12px', padding: '12px 20px', border: 'none', borderRadius: '8px',
              backgroundColor: '#1976d2', color: '#fff', fontWeight: '600',
              cursor: sessionToken ? 'pointer' : 'not-allowed', opacity: sessionToken ? 1 : 0.5,
            }}
          >
            Open payment modal
          </button>
          {sessionError && <p style={{ color: '#e74c3c', fontSize: '13px' }}>{sessionError}</p>}

          {warnings.length > 0 && (
            <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff8e1', border: '1px solid #ffc107', fontSize: '12px' }}>
              {warnings.map((w, i) => <div key={i} style={{ marginBottom: '4px' }}>⚠️ {w}</div>)}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 340px', minWidth: '300px' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '10px' }}>Overlay measurement</h3>
          {!open || !overlay ? (
            <p style={{ fontSize: '13px', color: '#999' }}>Open the modal to measure.</p>
          ) : !overlay.found ? (
            <p style={{ fontSize: '13px', color: '#999' }}>No fixed overlay rendered yet.</p>
          ) : (
            <div style={{
              padding: '12px', borderRadius: '8px', fontSize: '13px',
              border: '1px solid', borderColor: overlay.ok ? '#4CAF50' : '#e74c3c',
              backgroundColor: overlay.ok ? '#f1f8f2' : '#fdf3f2',
            }}>
              <div><strong>{overlay.ok ? '✅ Covers the viewport' : '❌ Clipped to the modal'}</strong></div>
              <div style={{ fontFamily: 'monospace', marginTop: '6px' }}>
                overlay {overlay.w} × {overlay.h}<br />
                viewport {overlay.vw} × {overlay.vh}
              </div>
            </div>
          )}

          {log.length > 0 && (
            <pre style={{
              marginTop: '14px', padding: '10px', borderRadius: '8px',
              backgroundColor: '#1e1e1e', color: '#d4d4d4', fontSize: '11px',
              maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap',
            }}>{log.join('\n')}</pre>
          )}
        </div>
      </div>

      {/* ── The modal ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 1050,
            backgroundColor: 'rgba(0,0,0,.5)',
            ...(backdropFilter ? { backdropFilter: 'blur(4px)' } : {}),
          }}
        >
          <div style={{
            position: 'relative', width: '600px', maxWidth: 'calc(100% - 32px)',
            margin: '30px auto',
            ...(useTransform ? { transform: 'matrix(1, 0, 0, 1, 0, 8.5725)' } : {}),
          }}>
            <div style={{
              position: 'relative', backgroundColor: '#fff', borderRadius: '8px', padding: '20px',
              overflow: clipOverflow ? 'hidden' : 'visible',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0, flex: 1 }}>Enter your payment details</h2>
                <button
                  onClick={() => { setOpen(false); addLog('modal closed'); }}
                  style={{ border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {sessionToken && (
                <super-single-checkout
                  id="modal-single-checkout"
                  key={`${sessionToken}-${paymentToDisplay}`}
                  amount="5800"
                  currency="GBP"
                  checkout-session-token={sessionToken}
                  payment-to-display={paymentToDisplay}
                  support-credit-popup={String(supportCreditPopup)}
                />
              )}

              {sdkReady && (
                <button
                  onClick={placeOrder}
                  disabled={loading}
                  style={{
                    width: '100%', marginTop: '18px', padding: '15px', border: 'none',
                    borderRadius: '8px', backgroundColor: '#000', color: '#fff',
                    fontWeight: 'bold', fontSize: '15px',
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Processing...' : 'Book Now — £58.00'}
                </button>
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
          <super-single-checkout
            id="modal-single-checkout"
            key={`${sessionToken}-${paymentToDisplay}`}
            amount="5800"
            currency="GBP"
            checkout-session-token={sessionToken}
            payment-to-display={paymentToDisplay}
            support-credit-popup={String(supportCreditPopup)}
          />
        </div>
      )}
    </div>
  );
};

export default ModalCheckout;
