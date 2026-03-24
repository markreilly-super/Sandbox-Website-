import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const NAV_CARDS = [
  {
    to: '/embedded',
    icon: '💳',
    title: 'Embedded Payment',
    description: 'Preview and test the checkout SDK with live payment methods including BNPL, card, and open banking.',
    color: '#6366f1',
    bg: '#f5f3ff',
  },
  {
    to: '/marketing',
    icon: '🎨',
    title: 'Marketing Assets',
    description: 'Customise and preview banners, cart callouts, and product callout widgets with live SDK controls.',
    color: '#0891b2',
    bg: '#ecfeff',
  },
  {
    to: '/account',
    icon: '⚙️',
    title: 'Account Settings',
    description: 'Manage SDK configuration, payment method order, and saved cards for off-session flows.',
    color: '#059669',
    bg: '#ecfdf5',
  },
  {
    to: '/saved-card',
    icon: '🔁',
    title: 'Scenarios',
    description: 'Run specific test flows: Saved Card Pay and Deposit Flow for instalment-based payment journeys.',
    color: '#d97706',
    bg: '#fffbeb',
  },
];

const QUICK_LINKS = [
  { label: 'Documentation', url: 'https://docs.superpayments.com/docs/introduction', desc: 'Super Guide' },
  { label: 'Test Card Numbers', url: 'https://docs.stripe.com/testing', desc: 'Stripe test cards' },
  { label: 'API Reference', url: 'https://docs.superpayments.com/reference/authentication', desc: 'API Explorer' },
];

const DEFAULT_CONFIG = {
  paymentMethodsOrder: 'BNPL,CARD,OPEN_BANKING',
  preSelectedPaymentMethod: 'CARD',
  title: 'Secure Checkout',
};

const HomePage = () => {
  const [sdkConfig, setSdkConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    const stored = localStorage.getItem('sdk_config');
    if (stored) {
      try { setSdkConfig(JSON.parse(stored)); } catch (_) {}
    }
  }, []);

  const methods = sdkConfig.paymentMethodsOrder.split(',').map(m => m.trim());

  return (
    <div style={s.page}>

      {/* ── Hero ── */}
      <div style={s.hero}>
        <div style={s.heroInner}>
          <p style={s.eyebrow}>Super Payments · Integration Portal</p>
          <p style={s.heroSubtitle}>
            Preview the checkout SDK, customise marketing assets, manage saved cards, and run end-to-end payment scenarios.
          </p>
        </div>
      </div>

      <div style={s.content}>

        {/* ── Nav cards ── */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Tools</h2>
          <div style={s.cardGrid}>
            {NAV_CARDS.map(card => (
              <Link key={card.to} to={card.to} style={s.navCard(card.color, card.bg)}>
                <span style={s.cardIcon}>{card.icon}</span>
                <h3 style={{ ...s.cardTitle, color: card.color }}>{card.title}</h3>
                <p style={s.cardDesc}>{card.description}</p>
                <span style={{ ...s.cardArrow, color: card.color }}>Go →</span>
              </Link>
            ))}
          </div>
        </section>

        <div style={s.bottomRow}>

          {/* ── SDK config snapshot ── */}
          <section style={{ ...s.section, flex: 1 }}>
            <h2 style={s.sectionTitle}>Active SDK Config</h2>
            <div style={s.configCard}>
              <div style={s.configRow}>
                <span style={s.configLabel}>Payment methods order</span>
                <div style={s.pillRow}>
                  {methods.map((m, i) => (
                    <span key={m} style={s.pill}>
                      <span style={s.pillIndex}>{i + 1}</span>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div style={s.configDivider} />
              <div style={s.configRow}>
                <span style={s.configLabel}>Pre-selected method</span>
                <span style={s.configValue}>{sdkConfig.preSelectedPaymentMethod}</span>
              </div>
              <div style={s.configDivider} />
              <div style={s.configRow}>
                <span style={s.configLabel}>Checkout title</span>
                <span style={s.configValue}>{sdkConfig.title || '—'}</span>
              </div>
              <Link to="/account" style={s.configEditLink}>Edit in Account Settings →</Link>
            </div>
          </section>

          {/* ── Quick links ── */}
          <section style={{ ...s.section, width: '280px', flexShrink: 0 }}>
            <h2 style={s.sectionTitle}>Resources</h2>
            <div style={s.linksList}>
              {QUICK_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={s.quickLink}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f3ff'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <div>
                    <p style={s.quickLinkLabel}>{link.label}</p>
                    <p style={s.quickLinkDesc}>{link.desc}</p>
                  </div>
                  <span style={s.quickLinkArrow}>↗</span>
                </a>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

/* ─── Styles ────────────────────────────────────────────────────────────────── */
const s = {
  page: {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    backgroundColor: '#f8f9fb',
    minHeight: 'calc(100vh - 54px)',
  },

  // Hero
  hero: {
    backgroundColor: '#1a1a2e',
    padding: '60px 40px',
  },
  heroInner: {
    maxWidth: '860px',
    margin: '0 auto',
  },
  eyebrow: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#8b8fb5',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    margin: '0 0 14px',
  },
  heroTitle: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 14px',
    lineHeight: '1.2',
  },
  heroSubtitle: {
    fontSize: '16px',
    color: '#a0a4c4',
    margin: 0,
    lineHeight: '1.6',
    maxWidth: '600px',
  },

  // Layout
  content: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '48px 40px',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 16px',
  },
  bottomRow: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
  },

  // Nav cards
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  navCard: (color, bg) => ({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff',
    border: `1px solid #e8e8f0`,
    borderRadius: '14px',
    padding: '24px 20px',
    textDecoration: 'none',
    transition: 'box-shadow 0.15s, transform 0.15s',
    cursor: 'pointer',
    ':hover': { transform: 'translateY(-2px)' },
  }),
  cardIcon: {
    fontSize: '28px',
    marginBottom: '12px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    margin: '0 0 8px',
  },
  cardDesc: {
    fontSize: '13px',
    color: '#666',
    margin: '0 0 16px',
    lineHeight: '1.5',
    flex: 1,
  },
  cardArrow: {
    fontSize: '13px',
    fontWeight: '700',
    marginTop: 'auto',
  },

  // SDK config card
  configCard: {
    backgroundColor: '#fff',
    border: '1px solid #e8e8f0',
    borderRadius: '14px',
    padding: '20px 24px',
  },
  configRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  configLabel: {
    fontSize: '13px',
    color: '#666',
    flexShrink: 0,
  },
  configValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a2e',
    backgroundColor: '#f6f9fc',
    padding: '4px 10px',
    borderRadius: '6px',
    fontFamily: 'monospace',
  },
  configDivider: {
    borderTop: '1px solid #f0f0f6',
    margin: '14px 0',
  },
  pillRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#f5f3ff',
    color: '#6366f1',
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '99px',
    fontFamily: 'monospace',
  },
  pillIndex: {
    backgroundColor: '#6366f1',
    color: '#fff',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '700',
    flexShrink: 0,
  },
  configEditLink: {
    display: 'block',
    marginTop: '16px',
    fontSize: '13px',
    color: '#6366f1',
    fontWeight: '600',
    textDecoration: 'none',
  },

  // Quick links
  linksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  quickLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    border: '1px solid #e8e8f0',
    borderRadius: '10px',
    padding: '14px 16px',
    textDecoration: 'none',
    transition: 'background-color 0.15s',
    cursor: 'pointer',
  },
  quickLinkLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: '0 0 3px',
  },
  quickLinkDesc: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
  },
  quickLinkArrow: {
    fontSize: '16px',
    color: '#aaa',
    flexShrink: 0,
  },
};

export default HomePage;
