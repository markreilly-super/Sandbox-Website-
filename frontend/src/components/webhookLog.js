import React, { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const C = {
  bg:      '#0d1117',
  surface: '#161b22',
  border:  '#30363d',
  text:    '#e6edf3',
  dim:     '#8b949e',
  green:   '#3fb950',
  red:     '#f85149',
  yellow:  '#d29922',
  blue:    '#58a6ff',
  purple:  '#bc8cff',
  orange:  '#ffa657',
};

const typeColor = (t) => ({ payment: C.green, refund: C.orange }[t] || C.blue);

const formatTime = (iso) => {
  const d = new Date(iso);
  return (
    d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
  );
};

const CollapsibleJSON = ({ label, data }) => {
  const [open, setOpen] = useState(true);
  if (data == null) return null;
  return (
    <div style={{ marginTop: '6px', marginLeft: '20px' }}>
      <span
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', fontSize: '11px', userSelect: 'none', color: C.dim }}
      >
        {open ? '▼' : '▶'} <span style={{ color: C.purple }}>{label}</span>
      </span>
      {open && (
        <pre style={{
          margin: '5px 0 0 14px',
          padding: '8px 12px',
          backgroundColor: '#0a0f14',
          borderRadius: '6px',
          border: `1px solid ${C.border}`,
          fontSize: '11px',
          color: C.text,
          overflowX: 'auto',
          maxHeight: '320px',
          overflowY: 'auto',
          lineHeight: '1.5',
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

const WebhookEntry = ({ entry }) => (
  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'monospace', fontSize: '12px', flexWrap: 'wrap' }}>
      <span style={{ color: C.dim, minWidth: '100px', flexShrink: 0 }}>{formatTime(entry.timestamp)}</span>
      <span style={{ color: C.dim }}>→</span>
      <span style={{
        color: typeColor(entry.type),
        fontWeight: 'bold',
        textTransform: 'uppercase',
        minWidth: '60px',
      }}>
        {entry.type}
      </span>
      <span style={{ color: C.dim, fontSize: '11px' }}>{entry.endpoint}</span>
      {entry.payload?.type && (
        <span style={{
          marginLeft: 'auto',
          color: C.purple,
          fontSize: '11px',
          background: '#1e1e2e',
          padding: '2px 8px',
          borderRadius: '4px',
          border: `1px solid ${C.border}`,
        }}>
          {entry.payload.type}
        </span>
      )}
    </div>
    <CollapsibleJSON label="Payload" data={entry.payload} />
  </div>
);

const WebhookLog = () => {
  const [entries, setEntries] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/webhooks`)
      .then(r => r.json())
      .then(data => setEntries(data))
      .catch(() => {});

    const sseUrl = API_BASE ? `${API_BASE}/webhooks/stream` : `${window.location.origin}/webhooks/stream`;
    const es = new EventSource(sseUrl);
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        setEntries(prev => [...prev.slice(-99), entry]);
      } catch (_) {}
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleClear = async () => {
    await fetch(`${API_BASE}/webhooks`, { method: 'DELETE' });
    setEntries([]);
  };

  return (
    <div className="layout-page" style={{ backgroundColor: '#f0f2f5', minHeight: 'calc(100vh - 54px)', boxSizing: 'border-box' }}>
      <div style={{
        backgroundColor: C.bg,
        borderRadius: '12px',
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 54px - 64px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          fontFamily: 'monospace',
          borderRadius: '12px 12px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: C.orange, fontSize: '10px' }}>●</span>
            <span style={{ color: C.text, fontWeight: 'bold', fontSize: '13px' }}>Webhook Log</span>
            <span style={{ color: C.dim, fontSize: '11px' }}>
              {entries.length} {entries.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: C.dim, fontSize: '11px', fontFamily: 'monospace' }}>
              POST /payment &nbsp;·&nbsp; POST /refund
            </span>
            <button
              onClick={handleClear}
              style={{
                backgroundColor: 'transparent', border: `1px solid ${C.border}`,
                color: C.dim, padding: '4px 14px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Webhook URL hint */}
        <div style={{
          padding: '8px 20px',
          backgroundColor: '#0d1117',
          borderBottom: `1px solid ${C.border}`,
          fontFamily: 'monospace',
          fontSize: '11px',
          color: C.dim,
        }}>
          Webhook URL: <span style={{ color: C.blue }}>{window.location.origin.replace('superintegration', 'backend-sandbox-website-1')}/payment</span>
        </div>

        {/* Entries */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <div style={{ color: C.dim, textAlign: 'center', paddingTop: '80px', fontFamily: 'monospace', fontSize: '13px' }}>
              <p style={{ margin: 0 }}>No webhooks received yet.</p>
              <p style={{ margin: '6px 0 0', fontSize: '11px' }}>
                Register your backend URL in the Super Payments dashboard to start receiving events.
              </p>
            </div>
          ) : (
            entries.map(entry => <WebhookEntry key={entry.id} entry={entry} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default WebhookLog;
