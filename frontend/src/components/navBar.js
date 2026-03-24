import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const NavBar = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking anywhere outside the dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const dropdownItemStyle = {
    display: 'block',
    padding: '10px 16px',
    color: '#fafafaff',
    textDecoration: 'none',
    fontWeight: '500',
    whiteSpace: 'nowrap'
  };

  return (
    <nav style={navStyle}>
      <h3 style={{ margin: 0, marginRight: 'auto' }}>Super Integration</h3>
      <Link style={linkStyle} to="/">Home</Link>
      <Link style={linkStyle} to="/embedded">Embedded Payment</Link>
      <Link style={linkStyle} to="/marketing">Marketing Assets</Link>
      <Link style={linkStyle} to="/account">Account Settings</Link>
      <Link style={linkStyle} to="/logs">Request Log</Link>

      {/* Scenarios Dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <span
          style={{ ...linkStyle, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setDropdownOpen(open => !open)}
        >
          Scenarios ▾
        </span>
        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 12px)', right: 0,
            backgroundColor: '#2a2a2a', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 100
          }}>
            <Link
              style={dropdownItemStyle}
              to="/saved-card"
              onClick={() => setDropdownOpen(false)}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Saved Card Pay
            </Link>
            <Link
              style={dropdownItemStyle}
              to="/deposit"
              onClick={() => setDropdownOpen(false)}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Deposit Flow
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;