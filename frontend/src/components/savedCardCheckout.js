import React, { useState } from 'react';
import { useNavigate, Link} from 'react-router-dom';


const ORDER = {
  name: 'Music Subscription',
  description: 'Monthly plan · Unlimited streaming',
  amount: 999, // pence
  display: '£9.99',
};

const SavedCardCheckout = () => {
  const navigate = useNavigate();

  const savedCards = (() => {
    const env = localStorage.getItem('super_environment') || 'test';
    const stored = localStorage.getItem(`saved_cards_${env}`);
    return stored ? JSON.parse(stored) : [];
  })();

  const [selectedCardId, setSelectedCardId] = useState(
    savedCards.length > 0 ? savedCards[0].id : null
  );
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(null); // { success: bool, message: string }

  const handlePay = async () => {
    if (!selectedCardId) return;
    setPaying(true);
    setResult(null);
    try {
      const res = await fetch('http://localhost:5000/create-off-session-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: ORDER.amount,
          paymentMethodId: selectedCardId,
        }),
      });
      const data = await res.json();
      console.log('Off-session payment response:', data);

      if (res.ok && (data.status === 'SUCCESS' || data.status === 'PENDING' || data.id)) {
        setResult({ success: true, message: `Payment of ${ORDER.display} was successful!` });
      } else {
        const msg = data.message || data.error || data.errorMessage || JSON.stringify(data);
        setResult({ success: false, message: msg });
      }
    } catch (e) {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setPaying(false);
    }
  };

  const getBrandMark = (brand = '') => {
    const b = brand.toUpperCase();
    if (b === 'VISA') return { label: 'VISA', color: '#1A1F71' };
    if (b === 'MASTERCARD') return { label: '●●', color: '#EB001B' };
    if (b === 'AMEX') return { label: 'AMEX', color: '#006FCF' };
    return { label: b || 'CARD', color: '#555' };
  };

  return (
    <div style={styles.page}>
      {/* ── Left: Order Summary ── */}
      <div style={styles.summary}>
        <div style={styles.summaryInner}>
          <p style={styles.merchantLabel}>Super Integration</p>
          <h1 style={styles.totalAmount}>{ORDER.display}</h1>
          <p style={styles.totalLabel}>due today</p>

          <div style={styles.divider} />

          <div style={styles.lineItem}>
            <div style={styles.itemIcon}>♪</div>
            <div style={{ flex: 1 }}>
              <p style={styles.itemName}>{ORDER.name}</p>
              <p style={styles.itemDesc}>{ORDER.description}</p>
            </div>
            <p style={styles.itemPrice}>{ORDER.display}</p>
          </div>

          <div style={styles.divider} />

          <div style={styles.lineItem}>
            <p style={{ ...styles.itemDesc, flex: 1 }}>Subtotal</p>
            <p style={styles.itemDesc}>{ORDER.display}</p>
          </div>
          <div style={{ ...styles.lineItem, marginTop: '8px' }}>
            <p style={{ ...styles.itemName, flex: 1 }}>Total due</p>
            <p style={styles.itemName}>{ORDER.display}</p>
          </div>
        </div>
      </div>

      {/* ── Right: Payment ── */}
      <div style={styles.payment}>
        <div style={styles.paymentInner}>

          {result ? (
            /* ── Result State ── */
            <div style={styles.resultBox(result.success)}>
              <div style={styles.resultIcon}>{result.success ? '✓' : '✕'}</div>
              <h2 style={styles.resultTitle}>
                {result.success ? 'Payment Complete' : 'Payment Failed'}
              </h2>
              <p style={styles.resultMsg}>{result.message}</p>
              <button
                style={styles.retryBtn}
                onClick={() => {
                  setResult(null);
                  if (result.success) navigate('/');
                }}
              >
                {result.success ? 'Back to Home' : 'Try Again'}
              </button>
            </div>
          ) : (
            <>
              <h2 style={styles.sectionTitle}>Pay with saved card</h2>
              <p style={styles.sectionSubtitle}>Select a payment method</p>

              {savedCards.length === 0 ? (
                <div style={styles.emptyState}>
                  <p style={{ color: '#888', fontSize: '14px' }}>No saved cards found.</p>
                  <p style={{ color: '#aaa', fontSize: '13px', marginTop: '6px' }}>
                    Go to<Link to="/account"> Account Settings</Link> to add a card first.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    {savedCards.map((card) => {
                      const brand = getBrandMark(card.brand);
                      const isSelected = card.id === selectedCardId;
                      return (
                        <div
                          key={card.id}
                          onClick={() => setSelectedCardId(card.id)}
                          style={styles.cardRow(isSelected)}
                        >
                          {/* Radio dot */}
                          <div style={styles.radioDot(isSelected)} />

                          {/* Card art */}
                          <div style={styles.cardArt}>
                            <span style={{ ...styles.brandLabel, color: brand.color }}>
                              {brand.label}
                            </span>
                          </div>

                          {/* Card info */}
                          <div style={{ flex: 1 }}>
                            <p style={styles.cardNumber}>
                              •••• •••• •••• {card.last4 && card.last4 !== '****' ? card.last4 : '––––'}
                            </p>
                            <p style={styles.cardMeta}>
                              {card.brand || 'Card'} · Saved card
                            </p>
                          </div>

                          {isSelected && (
                            <div style={styles.selectedBadge}>Selected</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handlePay}
                    disabled={paying || !selectedCardId}
                    style={styles.payBtn(paying || !selectedCardId)}
                  >
                    {paying ? (
                      <span>Processing…</span>
                    ) : (
                      <span>Pay {ORDER.display}</span>
                    )}
                  </button>

                  <p style={styles.secureNote}>
                    🔒 Secured by Super Payments
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Styles ─────────────────────────────────────────────── */
const styles = {
  page: {
    display: 'flex',
    minHeight: 'calc(100vh - 54px)',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },

  /* Left summary panel */
  summary: {
    width: '420px',
    minWidth: '320px',
    backgroundColor: '#f6f9fc',
    borderRight: '1px solid #e4e9f0',
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '60px 40px',
  },
  summaryInner: {
    width: '100%',
    maxWidth: '340px',
  },
  merchantLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 16px',
  },
  totalAmount: {
    fontSize: '40px',
    fontWeight: '700',
    margin: '0 0 4px',
    color: '#1a1a2e',
  },
  totalLabel: {
    fontSize: '13px',
    color: '#888',
    margin: '0 0 28px',
  },
  divider: {
    borderTop: '1px solid #e4e9f0',
    margin: '20px 0',
  },
  lineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  itemIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  itemName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: '0 0 3px',
  },
  itemDesc: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
  },
  itemPrice: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: 0,
    whiteSpace: 'nowrap',
  },

  /* Right payment panel */
  payment: {
    flex: 1,
    display: 'flex',
    justifyContent: 'flex-start',
    padding: '60px 60px',
    backgroundColor: '#fff',
  },
  paymentInner: {
    width: '100%',
    maxWidth: '400px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 4px',
  },
  sectionSubtitle: {
    fontSize: '13px',
    color: '#888',
    margin: '0 0 24px',
  },

  /* Card selection row */
  cardRow: (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    borderRadius: '12px',
    border: selected ? '2px solid #6366f1' : '2px solid #e4e9f0',
    backgroundColor: selected ? '#f5f3ff' : '#fff',
    cursor: 'pointer',
    marginBottom: '10px',
    transition: 'all 0.15s ease',
    boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
  }),
  radioDot: (selected) => ({
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: selected ? '5px solid #6366f1' : '2px solid #ccc',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  }),
  cardArt: {
    width: '52px',
    height: '34px',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandLabel: {
    fontSize: '10px',
    fontWeight: '900',
    letterSpacing: '0.5px',
  },
  cardNumber: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: '0 0 2px',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  cardMeta: {
    fontSize: '11px',
    color: '#888',
    margin: 0,
  },
  selectedBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6366f1',
    backgroundColor: '#ede9fe',
    padding: '3px 8px',
    borderRadius: '20px',
  },

  /* Pay button */
  payBtn: (disabled) => ({
    width: '100%',
    padding: '16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: disabled ? '#a5b4fc' : '#6366f1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s',
    marginBottom: '14px',
  }),
  secureNote: {
    fontSize: '12px',
    color: '#aaa',
    textAlign: 'center',
    margin: 0,
  },

  /* Empty state */
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    border: '2px dashed #e4e9f0',
    borderRadius: '12px',
  },

  /* Result */
  resultBox: (success) => ({
    textAlign: 'center',
    padding: '40px 20px',
    borderRadius: '16px',
    backgroundColor: success ? '#f0fdf4' : '#fef2f2',
    border: `2px solid ${success ? '#bbf7d0' : '#fecaca'}`,
  }),
  resultIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 auto 16px',
    backgroundColor: '#fff',
    color: '#1a1a2e',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  resultTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 8px',
  },
  resultMsg: {
    fontSize: '14px',
    color: '#555',
    margin: '0 0 24px',
  },
  retryBtn: {
    padding: '12px 28px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default SavedCardCheckout;
