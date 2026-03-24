import React, { useState, useEffect, useRef } from 'react';

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

const methodColor = (m) => ({ POST: C.blue, GET: C.green, DELETE: C.red, PUT: C.orange }[m] || C.dim);

const statusColor = (s) => {
  if (!s) return C.yellow;
  if (s >= 200 && s < 300) return C.green;
  if (s >= 400) return C.red;
  return C.yellow;
};

const formatTime = (iso) => {
  const d = new Date(iso);
  return (
    d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
  );
};

const CollapsibleJSON = ({ label, data }) => {
  const [open, setOpen] = useState(false);
  if (data == null) return null;
  return (
    <div style={{ marginTop: '4px', marginLeft: '20px' }}>
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
          maxHeight: '280px',
          overflowY: 'auto',
          lineHeight: '1.5',
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

const LogEntry = ({ entry }) => (
  <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'monospace', fontSize: '12px', flexWrap: 'wrap' }}>
      <span style={{ color: C.dim, minWidth: '100px', flexShrink: 0 }}>{formatTime(entry.timestamp)}</span>
      <span style={{ color: C.dim }}>→</span>
      <span style={{ color: methodColor(entry.method), fontWeight: 'bold', minWidth: '44px' }}>{entry.method}</span>
      <span style={{ color: C.text, flex: 1, wordBreak: 'break-all' }}>{entry.endpoint}</span>
      <span style={{ color: statusColor(entry.status), fontWeight: 'bold', minWidth: '36px', textAlign: 'right', flexShrink: 0 }}>
        {entry.status || '···'}
      </span>
    </div>
    <CollapsibleJSON label="Request" data={entry.request_body} />
    <CollapsibleJSON label="Response" data={entry.response_body} />
  </div>
);

const RequestLog = () => {
  const [entries, setEntries] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch('http://localhost:5000/logs')
      .then(r => r.json())
      .then(data => setEntries(data))
      .catch(() => {});

    const es = new EventSource('http://localhost:5000/logs/stream');
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
    await fetch('http://localhost:5000/logs', { method: 'DELETE' });
    setEntries([]);
  };

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: 'calc(100vh - 54px)', padding: '32px 40px', boxSizing: 'border-box' }}>
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
      {/* Header bar */}
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
          <span style={{ color: C.green, fontSize: '10px' }}>●</span>
          <span style={{ color: C.text, fontWeight: 'bold', fontSize: '13px' }}>Request Log</span>
          <span style={{ color: C.dim, fontSize: '11px' }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
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

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div style={{ color: C.dim, textAlign: 'center', paddingTop: '80px', fontFamily: 'monospace', fontSize: '13px' }}>
            <p style={{ margin: 0 }}>No requests logged yet.</p>
            <p style={{ margin: '6px 0 0', fontSize: '11px' }}>Make an API call to see it appear here in real time.</p>
          </div>
        ) : (
          entries.map(entry => <LogEntry key={entry.id} entry={entry} />)
        )}
        <div ref={bottomRef} />
      </div>
      </div>
    </div>
  );
};

export default RequestLog;
