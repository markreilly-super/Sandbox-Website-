import React from 'react';

const failure = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>❌ Payment Failed</h1>
      <p>Something went wrong. No money has been taken from your account.</p>
    </div>
  );
};

export default failure; // Make sure this line exists!