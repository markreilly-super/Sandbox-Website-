import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/navBar';
import EmbeddedPage from './components/embedded';
import MarketingPage from './components/marketing';
import Success from './components/Redirects/success';
import Failure from './components/Redirects/failure';
import AccountPage from './components/account';
import DepositFlow from './components/depositFlow';
import SavedCardCheckout from './components/savedCardCheckout';
import HomePage from './components/home';
import RequestLog from './components/requestLog';

// ─────────────────────────────────────────────────────────────────────────────
// Global card-data interceptor – runs at module load time, before any SDK
// scripts are injected, so it wraps fetch/XHR from the very first request.
// Stripe's card iframe makes calls from its own origin so those won't be
// visible here, BUT the super-card SDK typically makes at least one call from
// the main-window context (to its own API) that carries the Stripe token and
// card fingerprint. We deep-scan every JSON response from *.stripe.com or
// *.superpayments.com for last4 / brand and store it in window.__stripeCardData.
// ─────────────────────────────────────────────────────────────────────────────
(function installCardInterceptor() {
  if (window.__superInterceptorSet) return;
  window.__superInterceptorSet = true;
  window.__stripeCardData = null;

  const TARGET = /stripe\.com|superpayments\.com/;

  // Recursively hunt for { last4, brand } inside any JSON object
  const findCard = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 8) return null;
    const l4 = obj.last4 ?? obj.Last4 ?? obj.last_four;
    if (l4 && String(l4).replace(/\D/g, '').length === 4) {
      return {
        last4: String(l4).replace(/\D/g, ''),
        brand: (obj.brand || obj.display_brand || obj.network || '').toUpperCase()
      };
    }
    if (obj.card?.last4) {
      return {
        last4: String(obj.card.last4),
        brand: (obj.card.brand || obj.card.display_brand || '').toUpperCase()
      };
    }
    for (const key of Object.keys(obj)) {
      const hit = findCard(obj[key], depth + 1);
      if (hit) return hit;
    }
    return null;
  };

  const store = (data, source) => {
    const card = findCard(data);
    if (card?.last4) {
      window.__stripeCardData = card;
      console.log(`[CardInterceptor][${source}] captured:`, card);
    }
  };

  // ── Patch fetch ────────────────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
      if (TARGET.test(url)) {
        res.clone().json().then(d => store(d, 'fetch')).catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  // ── Patch XHR ─────────────────────────────────────────────────────────────
  const _XHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function PatchedXHR() {
    const xhr = new _XHR();
    let _url = '';
    const _open = xhr.open.bind(xhr);
    xhr.open = (method, url, ...rest) => { _url = url || ''; return _open(method, url, ...rest); };
    xhr.addEventListener('load', () => {
      if (!TARGET.test(_url)) return;
      try { store(JSON.parse(xhr.responseText), 'XHR'); } catch (_) {}
    });
    return xhr; // returning a non-primitive from `new` yields that object
  };
  window.XMLHttpRequest.prototype = _XHR.prototype;
})();

const App = () => {
  const sdkEnv = localStorage.getItem('super_environment') || 'test';

  useEffect(() => {
    // 1. Load Marketing Assets Script (super.js)
    if (!document.getElementById('super-js-sdk')) {
      const marketingScript = document.createElement('script');
      marketingScript.id = 'super-js-sdk';
      marketingScript.src = `https://cdn.superpayments.com/js/${sdkEnv}/super.js`;
      marketingScript.async = true;
      marketingScript.onload = () => {
        if (window.superjs) {
          window.superjs.init('pk_test_rJymaAd15u632MMGpkW1tQziKDWCXQcc0dWDOjGl', {
            integrationId: 'db0d5525-0b17-4acf-b4f5-8c47405e7079',
            platform: 'custom',
            page: 'cart'
          });
        }
      };
      document.body.appendChild(marketingScript);
    }

    // 2. Load Embedded Checkout Script (payment.js)
    if (!document.getElementById('super-payment-sdk')) {
      const paymentScript = document.createElement('script');
      paymentScript.id = 'super-payment-sdk';
      paymentScript.src = `https://cdn.superpayments.com/js/${sdkEnv}/payment.js`;
      paymentScript.async = true;
      document.body.appendChild(paymentScript);
    }
  }, []);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/embedded" element={<EmbeddedPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/saved-card" element={<SavedCardCheckout />} />
        <Route path="/deposit" element={<DepositFlow />} />
        <Route path="/logs" element={<RequestLog />} />
        <Route path="/success" element={<Success />} />
        <Route path="/failure" element={<Failure />} />
      </Routes>
    </Router>
  );
};

export default App;