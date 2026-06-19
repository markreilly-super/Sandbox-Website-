import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const NavBar = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownOpenLog, setDropdownOpenLog] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const logDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (logDropdownRef.current && !logDropdownRef.current.contains(e.target)) {
        setDropdownOpenLog(false);
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
    <nav style={{ ...navStyle, position: 'relative' }}>
      <h3 style={{ margin: 0, marginRight: 'auto' }}>Super Integration</h3>
      <button className="navbar-hamburger" onClick={() => setMenuOpen(m => !m)}>&#9776;</button>
      <div className={'navbar-links' + (menuOpen ? ' open' : '')}>
        <Link style={linkStyle} to="/" onClick={() => { setMenuOpen(false); setDropdownOpen(false); setDropdownOpenLog(false); }}>Home</Link>
        <Link style={linkStyle} to="/embedded" onClick={() => { setMenuOpen(false); setDropdownOpen(false); setDropdownOpenLog(false); }}>Embedded Payment</Link>
        <Link style={linkStyle} to="/marketing" onClick={() => { setMenuOpen(false); setDropdownOpen(false); setDropdownOpenLog(false); }}>Marketing Assets</Link>
        <Link style={linkStyle} to="/account" onClick={() => { setMenuOpen(false); setDropdownOpen(false); setDropdownOpenLog(false); }}>Account Settings</Link>
        {/* Logs Dropdown */}
        <div ref={logDropdownRef} style={{ position: 'relative' }}>
          <span
            style={{ ...linkStyle, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setDropdownOpenLog(open => !open)}
          >
            Logs &#9662;
          </span>
          {dropdownOpenLog && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 12px)', right: 0,
              backgroundColor: '#2a2a2a', borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 100
            }}>
              <Link
                style={dropdownItemStyle}
                to="/logs"
                onClick={() => { setDropdownOpenLog(false); setMenuOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Request Log
              </Link>
              <Link
                style={dropdownItemStyle}
                to="/webhooks"
                onClick={() => { setDropdownOpenLog(false); setMenuOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Webhook Logs
              </Link>
            </div>
          )}
        </div>

        {/* Scenarios Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <span
            style={{ ...linkStyle, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setDropdownOpen(open => !open)}
          >
            Scenarios &#9662;
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
                onClick={() => { setDropdownOpen(false); setMenuOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Saved Card Pay
              </Link>
              <Link
                style={dropdownItemStyle}
                to="/deposit"
                onClick={() => { setDropdownOpen(false); setMenuOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Deposit Flow
              </Link>
              <Link
                style={dropdownItemStyle}
                to="/initial-pay"
                onClick={() => { setDropdownOpen(false); setMenuOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Initial Pay Off Session
              </Link>
              <Link
                style={dropdownItemStyle}
                to="/token-checkout"
                onClick={() => { setDropdownOpen(false); setMenuOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Token Checkout
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;