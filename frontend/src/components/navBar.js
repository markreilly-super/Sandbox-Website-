import React from 'react';
import { Link } from 'react-router-dom';

const NavBar = () => {
  const navStyle = {
    display: 'flex',
    gap: '20px',
    padding: '15px 30px',
    backgroundColor: '#1a1a1a',
    color: 'white',
    alignItems: 'center'
  };

  const linkStyle = {
    color: '#fafafaff',
    textDecoration: 'none',
    fontWeight: '500'
  };

  return (
    <nav style={navStyle}>
      <h3 style={{ margin: 0, marginRight: 'auto' }}>Super Integration</h3>
      <Link style={linkStyle} to="/">Home</Link>
      <Link style={linkStyle} to="/embedded">Embedded Payment</Link>
      <Link style={linkStyle} to="/marketing">Marketing Assets</Link>
    </nav>
  );
};

export default NavBar;