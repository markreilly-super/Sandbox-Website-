import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Success from './components/Redirects/success';
import Failure from './components/Redirects/failure';

// --- 1. THE LOGIC COMPONENT ---
const CheckoutPage = () => {
  const [sessionToken, setSessionToken] = useState(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState(null);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [proceedResult, setProceedResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (document.getElementById('super-payments-v2-script')) {
      setIsScriptReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'super-payments-v2-script';
    script.src = "https://cdn.superpayments.com/js/v2/test/payment.webcomponents.js";
    script.async = true;
    script.onload = () => setIsScriptReady(true);
    document.head.appendChild(script);
  }, []);

  const handleStartCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/checkout-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.checkoutSessionToken && data.checkoutSessionId) {
        setSessionToken(data.checkoutSessionToken);
        setCheckoutSessionId(data.checkoutSessionId);
      }
    } catch (err) {
      console.error("❌ Failed to start checkout:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrderClicked = async () => {
    try {
      const result = await window.superCheckout.submit();
      if (result.status === "FAILURE") {
        alert(result.errorMessage || "Payment Validation Failed");
        return;
      }

      const response = await fetch(`http://localhost:5000/checkout-sessions/${checkoutSessionId}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1000, 
          email: "customer@example.com",
          externalReference: "ORDER_12345"
        })
      });

      const proceedData = await response.json();
      setProceedResult(proceedData);

      // AUTOMATIC REDIRECT: Once you confirm it works, uncomment the line below:
      // if (proceedData.redirectUrl) window.location.href = proceedData.redirectUrl;

    } catch (error) {
      console.error("❌ Checkout Error:", error);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>Super Payments Test Integration</h2>
      <hr />
      {!sessionToken && (
        <button onClick={handleStartCheckout} disabled={loading}>
          {loading ? "Initializing..." : "Start Checkout Session"}
        </button>
      )}
      {sessionToken && isScriptReady && (
        <div style={{ marginTop: '20px', border: '1px solid green', padding: '15px' }}>
          <h3>Step 2: Embedded UI</h3>
          <super-checkout 
            key={sessionToken}
            amount="1000" 
            checkout-session-token={sessionToken}
          ></super-checkout>
          <button onClick={handlePlaceOrderClicked} style={{ marginTop: '20px', width: '100%', padding: '12px', backgroundColor: '#000', color: '#fff' }}>
            Place Order
          </button>
        </div>
      )}
      {proceedResult && (
        <div style={{ marginTop: '20px', backgroundColor: '#f4f4f4', padding: '15px' }}>
          <h4>Proceed API Response:</h4>
          <pre>{JSON.stringify(proceedResult, null, 2)}</pre>
          {proceedResult.redirectUrl && (
            <a href={proceedResult.redirectUrl} style={{ color: 'blue' }}>Complete Payment via Redirect →</a>
          )}
        </div>
      )}
    </div>
  );
};

// --- 2. THE ROUTING CONTAINER ---
const App = () => {
  return (
    <Router>
      <Routes>
        {/* The main page displays the CheckoutPage component */}
        <Route path="/" element={<CheckoutPage />} />
        
        {/* These match the URLs you set in your Flask proceed route */}
        <Route path="/success" element={<Success />} />
        <Route path="/failure" element={<Failure />} />
      </Routes>
    </Router>
  );
};

export default App;