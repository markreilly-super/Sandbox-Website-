import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// The exact schema the SDK validates against (valibot), read from
// payment.webcomponents.script.js. Every value is a string except
// hideSuperApp, which is a boolean.
const SCHEMA = {
  hideSuperApp: 'boolean',
  tabStyles: ['backgroundColor', 'selectedBackgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'color'],
  container: ['backgroundColor', 'borderRadius'],
  title: ['fontFamily', 'fontSize', 'color'],
};

const STARTER_THEME = {
  hideSuperApp: false,
  tabStyles: {
    backgroundColor: '#ffffff',
    selectedBackgroundColor: '#f1f1f1',
    borderColor: '#dddddd',
    borderWidth: '1px',
    borderRadius: '12px',
    color: '#333333',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
  },
  title: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '20px',
    color: '#111111',
  },
};

// Colour-ish fields get a picker alongside the text input.
const isColourField = (k) => /color$/i.test(k);

const CustomisationPage = () => {
  const [themeText, setThemeText] = useState(() => JSON.stringify(STARTER_THEME, null, 2));
  const [title, setTitle] = useState('Secure Checkout');
  const [subtitle, setSubtitle] = useState('Pay with Super and earn cash rewards');
  const [amount, setAmount] = useState(158500);

  const [sessionToken, setSessionToken] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const mounted = useRef(false);

  let theme = null;
  let parseError = null;
  try { theme = JSON.parse(themeText); } catch (err) { parseError = err.message; }

  // ── Validation: both failure modes the docs don't mention ────────────────
  const silentlyIgnored = [];   // unknown keys — pass validation, do nothing
  const willError = [];         // wrong types — logs "Invalid theme values"
  if (theme && typeof theme === 'object') {
    Object.keys(theme).forEach(k => {
      if (!(k in SCHEMA)) {
        silentlyIgnored.push(k);
        return;
      }
      if (k === 'hideSuperApp') {
        if (typeof theme[k] !== 'boolean') willError.push('hideSuperApp must be a boolean');
        return;
      }
      const group = theme[k];
      if (group === null || typeof group !== 'object') {
        willError.push(`${k} must be an object`);
        return;
      }
      Object.keys(group).forEach(sub => {
        if (!SCHEMA[k].includes(sub)) silentlyIgnored.push(`${k}.${sub}`);
        else if (typeof group[sub] !== 'string') willError.push(`${k}.${sub} must be a string (e.g. "20px")`);
      });
    });
  }
  const fontFamilyWithoutTitle = !!(theme && theme.title && theme.title.fontFamily && !title);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/checkout-sessions`, { method: 'POST' });
        const data = await res.json();
        if (data.checkoutSessionToken) setSessionToken(data.checkoutSessionToken);
        else setSessionError(data.detail || data.error || 'Failed to create session');
      } catch (err) {
        setSessionError(err.message);
      }
    })();
  }, []);

  // Patch a single field, keeping the JSON as the single source of truth.
  const patch = (group, key, value) => {
    if (!theme) return;
    const next = { ...theme };
    if (group === null) next[key] = value;
    else next[group] = { ...(next[group] || {}), [key]: value };
    setThemeText(JSON.stringify(next, null, 2));
  };

  const label = { display: 'block', fontSize: '11px', color: '#666', marginBottom: '3px' };
  const input = {
    width: '100%', boxSizing: 'border-box', padding: '6px 8px',
    borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', fontFamily: 'monospace',
  };

  const renderGroup = (groupName) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
        <code>{groupName}</code>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {SCHEMA[groupName].map(key => {
          const val = (theme && theme[groupName] && theme[groupName][key]) || '';
          return (
            <div key={key}>
              <label style={label}>{key}</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  style={input}
                  value={val}
                  placeholder={isColourField(key) ? '#000000' : '12px'}
                  onChange={e => patch(groupName, key, e.target.value)}
                />
                {isColourField(key) && (
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'}
                    onChange={e => patch(groupName, key, e.target.value)}
                    style={{ width: '32px', height: '30px', padding: 0, border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="layout-two-col">
      {/* LEFT: the theme */}
      <div>
        <h2 style={{ fontSize: '1.4rem', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
          Checkout Customisation
        </h2>

        <div style={{
          margin: '12px 0 16px', padding: '12px', borderRadius: '8px',
          backgroundColor: '#fff8e1', border: '1px solid #ffc107', fontSize: '12px', lineHeight: '1.5',
        }}>
          <strong>Theming is feature-flagged per brand.</strong> The SDK checks an
          <code> embedded_theme</code> Statsig config against your brand ID and, when it is
          off, discards the theme without any error. If nothing changes below and the console
          is clean, the flag is the reason — not the theme.
        </div>

        {renderGroup('tabStyles')}
        {renderGroup('container')}
        {renderGroup('title')}

        <div style={{ marginBottom: '14px' }}>
          <label style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={!!(theme && theme.hideSuperApp)}
              onChange={e => patch(null, 'hideSuperApp', e.target.checked)}
            />
            <code>hideSuperApp</code> — hide "Pay with the Super app"
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <div>
            <label style={label}>title attribute</label>
            <input style={input} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={label}>subtitle attribute</label>
            <input style={input} value={subtitle} onChange={e => setSubtitle(e.target.value)} />
          </div>
          <div>
            <label style={label}>amount (minor units)</label>
            <input style={input} type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          </div>
        </div>

        <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
          theme attribute (sent stringified)
        </div>
        <textarea
          value={themeText}
          onChange={e => setThemeText(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%', minHeight: '240px', boxSizing: 'border-box',
            fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', padding: '12px',
            borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fafafa', resize: 'vertical',
          }}
        />

        {parseError && (
          <p style={{ color: '#e74c3c', fontSize: '12px', marginTop: '8px' }}>Invalid JSON: {parseError}</p>
        )}

        {willError.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fdf3f2', border: '1px solid #e74c3c', fontSize: '12px' }}>
            <strong>Will be rejected</strong> — the SDK logs
            <code> Invalid theme values provided to ThemeProvider</code> and drops the whole theme:
            {willError.map((w, i) => <div key={i}>• {w}</div>)}
          </div>
        )}

        {silentlyIgnored.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff8e1', border: '1px solid #ffc107', fontSize: '12px' }}>
            <strong>Silently ignored</strong> — unknown keys pass validation with no error and
            have no effect. This is the easiest mistake to miss (e.g. <code>tabs</code> instead
            of <code>tabStyles</code>):
            {silentlyIgnored.map((k, i) => <div key={i}>• <code>{k}</code></div>)}
          </div>
        )}

        {fontFamilyWithoutTitle && (
          <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fff8e1', border: '1px solid #ffc107', fontSize: '12px' }}>
            <code>title.fontFamily</code> only applies when the <code>title</code> attribute is set.
          </div>
        )}

        <div style={{ marginTop: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', lineHeight: '1.6' }}>
          <strong>Not themeable.</strong> Group headings such as
          “Pay £1,585.00 now (full amount)” and “Pay Later with Super” are rendered inside the
          component's shadow DOM. There are no CSS variables and no <code>::part</code> hooks,
          so their text, font, size and colour cannot be changed from outside.
        </div>
      </div>

      {/* RIGHT: live preview */}
      <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.4rem', marginTop: 0, marginBottom: '20px' }}>Preview</h2>
        {sessionError && <p style={{ color: '#e74c3c', fontSize: '13px' }}>{sessionError}</p>}
        {sessionToken && theme ? (
          <super-checkout
            key={`${sessionToken}-${themeText}-${title}-${subtitle}-${amount}`}
            amount={String(amount)}
            currency="GBP"
            checkout-session-token={sessionToken}
            title={title}
            subtitle={subtitle}
            theme={JSON.stringify(theme)}
          />
        ) : !sessionError ? (
          <div style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
            Creating session...
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CustomisationPage;
