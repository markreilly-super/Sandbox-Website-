# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + Flask sandbox application demonstrating Super Payments SDK integration. It showcases embedded checkout, marketing asset customization, and off-session (saved card) payment flows.

## Development Commands

### Frontend (React, Create React App)
```bash
cd frontend
npm install        # Install dependencies
npm start          # Dev server on http://localhost:3000
npm test           # Run tests (Jest + React Testing Library)
npm run build      # Production build
```

### Backend (Flask)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors requests
python app.py      # Runs on http://localhost:5000
```

Both servers must run simultaneously. Frontend on port 3000 makes API calls to Flask on port 5000.

## Architecture

### Frontend (`frontend/src/`)
- **App.js** — Root component. Loads Super Payments SDK scripts from CDN (`super.js` and `payment.js`), initializes the SDK with public key and integration ID, sets up React Router.
- **components/embedded.js** — Embedded checkout page. Manages checkout session lifecycle: creates session via backend, renders `<super-checkout>` web component, handles billing form, polls for SDK readiness, and calls proceed endpoint on submit. Uses custom event `superpayments:displaySignIn` for phone number injection into the SDK's shadow DOM.
- **components/marketing.js** — Marketing assets customizer. Renders `<super-banner>`, `<super-cart-callout>`, and `<super-product-callout>` web components. Provides controls to reinitialize the SDK with different page types, amounts, colors, and placements. Includes a debug log panel.
- **components/account.js** — Saved card / off-session payment page. Orchestrates a multi-step flow: create customer → create payment method → create setup intent → embed checkout for card authorization. Uses localStorage to persist SDK configuration.
- **components/Redirects/** — Simple success/failure landing pages for payment redirects.

### Backend (`backend/app.py`)
Single Flask file acting as a proxy between the frontend and the Super Payments API (`api.test.superpayments.com/2025-11-01`).

Key endpoints:
- `POST /checkout-sessions` — Creates a checkout session token
- `POST /checkout-sessions/<id>/proceed` — Submits order details and proceeds with payment
- `POST /customers` — Creates a customer for saved cards
- `POST /payment-methods` — Creates a payment method for a customer
- `POST /payment-methods/<id>/setup-intents` — Authorizes a card without charging
- `POST /create-off-session-payment` — Charges a saved card without user interaction

### SDK Integration Pattern
The Super Payments SDK is loaded as external scripts and exposes global objects (`window.superjs`, `window.superCheckout`). Components interact with SDK web components (`<super-checkout>`, `<super-banner>`, etc.) and use polling to detect SDK readiness. The SDK is initialized in App.js via `window.superjs.init()` with a public key and integration ID.

### Data Flow
Frontend components → `fetch()` to Flask (localhost:5000) → Flask forwards to Super Payments API with secret key → response returned to frontend → frontend passes tokens to SDK web components.

## Configuration
- API credentials (test keys) are hardcoded in `backend/app.py`
- Public key and integration ID for SDK init are in `frontend/src/App.js`
- SDK configuration preferences are persisted in localStorage (account page)
