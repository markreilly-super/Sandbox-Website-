import React, { useState, useEffect } from 'react';

const AccountPage = () => {
  // Load initial values from localStorage or defaults
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('sdk_config');
    return saved ? JSON.parse(saved) : {
      paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
      preSelectedPaymentMethod: 'CARD',
      title: 'Secure Checkout',
      subtitle: 'Pay with Super and earn cash rewards'
    };
  });

  const [message, setMessage] = useState('');

  const handleSave = () => {
    localStorage.setItem('sdk_config', JSON.stringify(config));
    setMessage('Configuration saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const inputStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    width: '100%',
    marginBottom: '15px'
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h1>Account Settings</h1>
      <p style={{ color: '#666' }}>Customize how the Super Payments SDK behaves across the portal.</p>

      <div style={{ marginTop: '30px', backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px' }}>
        <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Default Payment Order</label>
        <input 
          style={inputStyle} 
          value={config.paymentMethodsOrder} 
          onChange={e => setConfig({...config, paymentMethodsOrder: e.target.value})} 
        />

        <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Pre-selected Method</label>
        <select 
          style={inputStyle} 
          value={config.preSelectedPaymentMethod} 
          onChange={e => setConfig({...config, preSelectedPaymentMethod: e.target.value})}
        >
          <option value="CARD">CARD</option>
          <option value="BNPL">BNPL</option>
          <option value="OPEN_BANKING">OPEN_BANKING</option>
        </select>

        <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Checkout Title</label>
        <input 
          style={inputStyle} 
          value={config.title} 
          onChange={e => setConfig({...config, title: e.target.value})} 
        />

        <button 
          onClick={handleSave}
          style={{ width: '100%', padding: '15px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Save Global Config
        </button>
        {message && <p style={{ color: 'green', marginTop: '10px', textAlign: 'center' }}>{message}</p>}
      </div>
    </div>
  );
};

export default AccountPage;