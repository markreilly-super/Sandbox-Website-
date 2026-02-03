import React, { useState } from 'react';

const MarketingPage = () => {
  const [selections, setSelections] = useState({
    page: 'product-listing',
    cartID: 'examplecart',
    cartAmount: '5000',
    colourScheme: 'Black and Orange', // Updated to match your script
    placement: 'top',
    position: 'left',
    width: '100%',
    productAmount: '10000',
    productQuantity: '1'
  });

  const [activeConfig, setActiveConfig] = useState({ ...selections });
  const [logs, setLogs] = useState([]);

  const addLog = (msg, data) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}: ${JSON.stringify(data)}`, ...prev].slice(0, 5));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelections(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdate = () => {
    if (window.superjs) {
      const initPayload = {
        integrationId: 'db0d5525-0b17-4acf-b4f5-8c47405e7079',
        platform: 'custom',
        page: selections.page,
        cartAmount: parseInt(selections.cartAmount),
        cartID: selections.cartID,
        colourScheme: selections.colourScheme
      };

      window.superjs.init('pk_test_rJymaAd15u632MMGpkW1tQziKDWCXQcc0dWDOjGl', initPayload);
      setActiveConfig({ ...selections });
      addLog("SDK Initialized", initPayload);
    } else {
      addLog("ERROR", "window.superjs not found!");
    }
  };

  // refreshKey ensures DOM nodes are recreated when the user clicks 'Update'
  const refreshKey = `${activeConfig.page}-${activeConfig.colourScheme}-${activeConfig.cartAmount}-${activeConfig.width}`;

  const assetStyle = { padding: '20px', border: '1px solid #eee', borderRadius: '8px', marginTop: '30px' };
  const subControlStyle = { display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', backgroundColor: '#fafafa', padding: '10px', borderRadius: '4px', alignItems: 'end' };
  const labelStyle = { fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ padding: '40px' }}>
      <h1>Marketing Assets Customizer</h1>

      {/* DEBUG LOG PANEL */}
      <div style={{ backgroundColor: '#1e1e1e', color: '#00ff00', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', marginBottom: '20px' }}>
        <strong>SDK Log:</strong>
        {logs.length === 0 ? <div>No updates yet.</div> : logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>

      {/* GLOBAL CONTROLS */}
      <div style={{ ...subControlStyle, backgroundColor: '#eef2ff', padding: '20px' }}>
        <div>
          <label style={labelStyle}>Global Page Type</label>
          <select name="page" value={selections.page} onChange={handleChange}>
            <option value="home">home</option>
            <option value="cart">cart</option>
            <option value="checkout">checkout</option>
            <option value="product-listing">product-listing</option>
            <option value="product-detail">product-detail</option>
          </select>
        </div>
        <button onClick={handleUpdate} style={{ padding: '10px 20px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          UPDATE ALL ASSETS
        </button>
      </div>

      {/* 1. BANNER */}
      <div style={assetStyle}>
        <h3>Banner Asset</h3>
        <div style={subControlStyle}>
          <div>
            <label style={labelStyle}>Colour Scheme (Script Values)</label>
            <select name="colourScheme" value={selections.colourScheme} onChange={handleChange}>
              <option value="Black and Orange">Black and Orange</option>
              <option value="Monochrome">Monochrome</option>
              <option value="Orange and White">Orange and White</option>
              <option value="White and Orange">White and Orange</option>
              <option value="Yellow and Black">Yellow and Black</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cart Amount</label>
            <input type="number" name="cartAmount" value={selections.cartAmount} onChange={handleChange} />
          </div>
        </div>
        <div style={{ background: '#f9f9f9', padding: '40px', textAlign: 'center' }}>
          <super-banner 
            key={`banner-${refreshKey}`}
            cartamount={activeConfig.cartAmount} 
            page={activeConfig.page} 
            cartid={activeConfig.cartID}
            colorscheme={activeConfig.colourScheme}
          ></super-banner>
        </div>
      </div>

      {/* 2. CART CALLOUT */}
      <div style={assetStyle}>
        <h3>Cart Callout Asset</h3>
        <div style={subControlStyle}>
          <select name="placement" value={selections.placement} onChange={handleChange}>
            <option value="top">top</option>
            <option value="bottom">bottom</option>
          </select>
          <select name="position" value={selections.position} onChange={handleChange}>
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>
        <div style={{ background: '#f9f9f9', padding: '40px', textAlign: 'center' }}>
          <super-cart-callout 
            key={`cart-${refreshKey}`}
            cartamount={activeConfig.cartAmount} 
            page={activeConfig.page} 
            placement={activeConfig.placement}
            position={activeConfig.position}
            width={activeConfig.width}
          ></super-cart-callout>
        </div>
      </div>

      {/* 3. PRODUCT CALLOUT */}
      <div style={assetStyle}>
        <h3>Product Callout Asset</h3>
        <div style={subControlStyle}>
          <select name="productQuantity" value={selections.productQuantity} onChange={handleChange}>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="number" name="productAmount" value={selections.productAmount} onChange={handleChange} />
        </div>
        <div style={{ background: '#f9f9f9', padding: '40px', textAlign: 'center' }}>
          <super-product-callout 
            key={`prod-${refreshKey}`}
            productamount={activeConfig.productAmount} 
            productquantity={activeConfig.productQuantity}
            page={activeConfig.page}
            width={activeConfig.width}
          ></super-product-callout>
        </div>
      </div>
    </div>
  );
};

export default MarketingPage;