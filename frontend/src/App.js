import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/navBar';
import EmbeddedPage from './components/embedded';
import MarketingPage from './components/marketing';
import Success from './components/Redirects/success';
import Failure from './components/Redirects/failure';
import AccountPage from './components/account';

const App = () => {
  useEffect(() => {
    // 1. Load Marketing Assets Script (super.js)
    if (!document.getElementById('super-js-sdk')) {
      const marketingScript = document.createElement('script');
      marketingScript.id = 'super-js-sdk';
      marketingScript.src = "https://cdn.superpayments.com/js/test/super.js";
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
      paymentScript.src = "https://cdn.superpayments.com/js/test/payment.js";
      paymentScript.async = true;
      document.body.appendChild(paymentScript);
    }
  }, []);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<div style={{ padding: '40px' }}><h1>Portal Home</h1></div>} />
        <Route path="/embedded" element={<EmbeddedPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/success" element={<Success />} />
        <Route path="/failure" element={<Failure />} />
      </Routes>
    </Router>
  );
};

export default App;