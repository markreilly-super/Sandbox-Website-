import os
import requests
import uuid
import json
import stripe
import threading
import queue
from collections import deque
from datetime import datetime
from flask import Flask, jsonify, request, Response, send_from_directory
from flask_cors import CORS

# Load .env file if present (keeps secrets out of source control)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — set env vars manually

# Path to the React production build (relative to this file)
STATIC_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')

app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='')

# CORS for local development; in production the React build is served by Flask directly
CORS(app)

# Base URL of the frontend — used for redirect URLs sent to the Super Payments API
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Configuration - environment credentials
CREDENTIALS = {
    'test': {
        'api_key': "sk_test_n8Wy6QkSyLpANd-CdDZsIiBubwpJsvOlaG5LWCVD",
        'initiator_id': "e31e45fe-76c9-4ba2-ad41-c206481f3398",
        'brand_id': "0714ece1-629a-47ef-a01a-c79ae8dc2bab",
        'base_url': "https://api.test.superpayments.com/2026-04-01"
    },
    'staging': {
        'api_key': "sk_stag_06evkW7XDJ89eWEqMxbSWRo6nZftFOUt-QeTLmNa",
        'initiator_id': "39733f1a-8a06-47e2-9fdb-38c5c78662eb",
        'brand_id': "60202016-cada-4832-b792-ff3710b5c4ce",
        'base_url': "https://api.staging.superpayments.com/2026-04-01"
    }
}

current_env = 'test'

# ── Stripe config ─────────────────────────────────────────────────────────────
# Set STRIPE_SECRET_KEY in backend/.env (gitignored) or your shell environment
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
stripe.api_key = STRIPE_SECRET_KEY

def get_config():
    return CREDENTIALS[current_env]

# ── Request logging ───────────────────────────────────────────────────────────
log_history = deque(maxlen=100)
log_lock = threading.Lock()
sse_clients = set()
sse_lock = threading.Lock()

def _add_log(entry):
    with log_lock:
        log_history.append(entry)
    with sse_lock:
        dead = set()
        for q in sse_clients:
            try:
                q.put_nowait(entry)
            except Exception:
                dead.add(q)
        sse_clients.difference_update(dead)

def api_request(method, url, headers, json_body=None):
    """Make a request to Super Payments API, log it, and return the response."""
    cfg = get_config()
    path = url[len(cfg['base_url']):] or '/'

    entry = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.') + f"{datetime.utcnow().microsecond // 1000:03d}Z",
        'method': method.upper(),
        'endpoint': path,
        'request_body': json_body,
        'status': None,
        'response_body': None,
    }
    try:
        resp = requests.request(method.upper(), url, headers=headers, json=json_body)
        entry['status'] = resp.status_code
        try:
            entry['response_body'] = resp.json()
        except Exception:
            entry['response_body'] = resp.text
    except Exception as e:
        entry['status'] = 0
        entry['response_body'] = str(e)
        _add_log(entry)
        raise
    _add_log(entry)
    return resp

# Webhook endpoint to receive payment status updates from Super Payments
@app.route('/payment', methods=['POST'])
def webhooks():
    payload = request.get_json()
    print('[Webhook received]', json.dumps(payload, indent=2))
    return 'ok', 200

@app.route('/set-environment', methods=['POST', 'GET'])
def set_environment():
    global current_env
    if request.method == 'GET':
        return jsonify({'environment': current_env})
    data = request.get_json() or {}
    env = data.get('environment', 'test')
    if env in CREDENTIALS:
        current_env = env
        print(f"[Environment] Switched to: {current_env}")
        return jsonify({'environment': current_env})
    return jsonify({'error': 'Invalid environment. Use "test" or "staging".'}), 400

@app.route('/logs', methods=['GET'])
def get_logs():
    with log_lock:
        return jsonify(list(log_history))

@app.route('/logs', methods=['DELETE'])
def clear_logs():
    with log_lock:
        log_history.clear()
    return jsonify({'cleared': True})

@app.route('/logs/stream')
def logs_stream():
    def generate():
        client_q = queue.Queue()
        with sse_lock:
            sse_clients.add(client_q)
        try:
            yield ': connected\n\n'
            while True:
                try:
                    entry = client_q.get(timeout=15)
                    yield f'data: {json.dumps(entry)}\n\n'
                except queue.Empty:
                    yield ': keepalive\n\n'
        except GeneratorExit:
            pass
        finally:
            with sse_lock:
                sse_clients.discard(client_q)
    return Response(generate(), content_type='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

@app.route('/refund', methods=['POST'])
def refundWebhooks():
    payload = request.get_json()
    print('[Refund Webhook received]', json.dumps(payload, indent=2))
    return 'ok', 200

@app.route('/checkout-sessions', methods=['POST'])
def create_checkout():
    """
    Step 1: Create a Checkout Session.
    Optionally accepts { customerId } in the request body to link a saved-card customer.
    """
    cfg = get_config()
    headers = {
        'Authorization': cfg['api_key'],
        'Content-Type': 'application/json'
    }
    payload = {
        "paymentInitiatorId": cfg['initiator_id']
    }

    frontend_data = request.get_json(silent=True) or {}
    customer_id = frontend_data.get("customerId")

    if customer_id:
        payload["customer"] = {
            "id": customer_id,
            "savePaymentMethod": True,
            "paymentMethodMetadata": {
                "Card": "4242"
            }
        }

    try:
        print(f"--- Step 1: Requesting session from {cfg['base_url']} ---")
        response = api_request('POST', f"{cfg['base_url']}/checkout-sessions", headers, payload)
        response_data = response.json()
        print("Super Payments Response:", response_data)

        return jsonify(response_data), response.status_code

    except Exception as e:
        print(f"Error in Step 1: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/checkout-sessions/<session_id>/proceed', methods=['POST'])
def proceed_checkout(session_id):
    """
    Step 4: Proceed with Checkout
    """
    cfg = get_config()
    proceed_url = f"{cfg['base_url']}/checkout-sessions/{session_id}/proceed"

    print(f"Proceed URL: {proceed_url}")
    print(f"[Environment] Proceed {current_env}")

    headers = {
        'Authorization': cfg['api_key'],
        'Content-Type': 'application/json'
    }

    frontend_data = request.json

    payload = {
        "amount": frontend_data.get("amount", 5000), # Default to 5000 (e.g. £50.00) if not sent
        "cancelUrl": f"{FRONTEND_URL}/cancel",
        "failureUrl": f"{FRONTEND_URL}/failure",
        "successUrl": f"{FRONTEND_URL}/success",
        "externalReference": frontend_data.get("externalReference", "TEST_ORDER_001_VIA_LOCALHOST"),
        "email": frontend_data.get("email", "customer@example.com"),
        "phone": frontend_data.get("phone", "07700900000"),
        "paymentInitiatorId": cfg['initiator_id'],
        "currency": "GBP",
        "metadata": {
            "firstName": "Mark",
            "lastName": "Reilly"
        },
        "shippingAddress": {
    "addressLine1": "123 Test Street",
    "city": "London",
    "country": "GB"
  },
  "billingAddress": {
   "addressLine1": "123 Test Street",
    "city": "London",
    "country": "GB"
  },
  "lineItems": [
    {
      "type": "AIRLINE",
      "data": {
        "flightNumber": "FR1234",
        "flightDate": "2026-03-15T10:30:00+00:00",
        "travellers": [
          {
            "name": "Test Name"
          }
        ],
        "totalPrice": 3000,
        "currency": "GBP"
      }
    }
  ],
    }

    try:
        print(f"--- Step 4: Proceeding for Session {session_id} ---")
        response = api_request('POST', proceed_url, headers, payload)
        response_data = response.json()
        print("Proceed API Response:", response_data)
        return jsonify(response_data), response.status_code

    except Exception as e:
        print(f"Error in Step 4: {str(e)}")
        return jsonify({"error": str(e)}), 500
    

# new endpoints for Off-Session Payments

@app.route('/customers', methods=['POST'])
def create_customer():
    cfg = get_config()
    headers = {'Authorization': cfg['api_key'], 'Content-Type': 'application/json'}
    frontend_data = request.get_json(silent=True) or {}
    unique_ref = str(uuid.uuid4())[:12]
    payload = {
        "externalReference": frontend_data.get("externalReference", f"Customer_{unique_ref}"),
        "brandId": cfg['brand_id'],
        "metadata": {"Name": "SandboxUser"},
    }
    for field in ("firstName", "lastName", "emailAddress", "phoneNumber"):
        if frontend_data.get(field):
            payload[field] = frontend_data[field]
    try:
        print(f"--- Creating customer via {cfg['base_url']} ---")
        print(f"[Environment] Customers: {current_env}")
        response = api_request('POST', f"{cfg['base_url']}/customers", headers, payload)
        try:
            return jsonify(response.json()), response.status_code
        except ValueError:
            # API returned an empty or non-JSON body — surface status + raw text
            return jsonify({
                "error": f"API returned HTTP {response.status_code} with non-JSON body",
                "detail": response.text or "(empty body)"
            }), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/payment-methods', methods=['POST'])
def create_payment_method():
    """Received the customerId from the frontend request body"""
    cfg = get_config()
    headers = {'Authorization': cfg['api_key'], 'Content-Type': 'application/json'}

    # Extract the ID sent by the frontend
    customer_id = request.json.get("customerId")

    payload = {
        "customerId": customer_id,
        "type": "CARD",
        "usage": "OFF_SESSION",
        "metadata": {"Name": "Test transaction"}
    }
    try:
        print(f"[Environment] Payment Methods: {current_env}")
        response = api_request('POST', f"{cfg['base_url']}/payment-methods", headers, payload)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/payment-methods/<pm_id>/setup-intents', methods=['POST'])
def create_setup_intent(pm_id):
    """Step 3: Create a Setup Intent to authorize the card."""
    cfg = get_config()
    headers = {'Authorization': cfg['api_key'], 'Content-Type': 'application/json'}
    payload = {
        "redirectUrl": f"{FRONTEND_URL}/success"
    }
    print(f"[Environment] Setup Intents: {current_env}")
    print(f"Creating Setup Intent for Payment Method ID: {pm_id}")
    try:
        url = f"{cfg['base_url']}/payment-methods/{pm_id}/setup-intents"
        response = api_request('POST', url, headers, payload)
        print(f"Setup Intent Response: {response.status_code} - {response.text}")
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/payment-methods/<pm_id>', methods=['GET'])
def get_payment_method(pm_id):
    """Fetch payment method details including card info (last4, brand)."""
    cfg = get_config()
    headers = {'Authorization': cfg['api_key'], 'accept': 'application/json'}
    try:
        url = f"{cfg['base_url']}/payment-methods/{pm_id}"
        print(f"[Environment] GET Payment Method: {current_env}")
        response = api_request('GET', url, headers)
        data = response.json()
        print(f"GET Payment Method Response: {data}")
        return jsonify(data), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/create-off-session-payment', methods=['POST'])
def off_session_payment():
    """Step 6: Charge the saved card when the user is NOT present."""
    cfg = get_config()
    headers = {'Authorization': cfg['api_key'], 'Content-Type': 'application/json'}
    frontend_data = request.json

    payload = {
        "amount": frontend_data.get("amount"),
        "currency": "GBP",
        "externalReference": "Off Session",
        "paymentMethodId": frontend_data.get("paymentMethodId"),
        "offSession": True, # CRITICAL: Tells the API to skip 3DS/User interaction
        "paymentInitiatorId": cfg['initiator_id']
    }
    try:
        print(f"[Environment] Off Session Payment: {current_env}")
        response = api_request('POST', f"{cfg['base_url']}/payments", headers, payload)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Stripe endpoints ──────────────────────────────────────────────────────────

@app.route('/stripe/create-payment-intent', methods=['POST'])
def create_payment_intent():
    """Create a Stripe PaymentIntent and return the client_secret to the frontend."""
    data = request.get_json() or {}
    amount = data.get('amount', 1000)  # amount in pence, default £10.00

    request_body = {
        'amount': amount,
        'currency': 'gbp',
        'automatic_payment_methods': {'enabled': True},
        'setup_future_usage': 'off_session',
    }

    entry = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.') + f"{datetime.utcnow().microsecond // 1000:03d}Z",
        'method': 'POST',
        'endpoint': '/v1/payment_intents  [Stripe]',
        'request_body': request_body,
        'status': None,
        'response_body': None,
    }

    try:
        intent = stripe.PaymentIntent.create(**request_body)

        response_body = {
            'id': intent.id,
            'amount': intent.amount,
            'currency': intent.currency,
            'status': intent.status,
            'client_secret': intent.client_secret,
        }

        entry['status'] = 200
        entry['response_body'] = response_body
        _add_log(entry)

        print(f"[Stripe] PaymentIntent created: {intent.id} — amount: {amount}p — status: {intent.status}")

        return jsonify({
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id,
            'amount': amount,
        })

    except stripe.error.StripeError as e:
        entry['status'] = 400
        entry['response_body'] = {'error': e.user_message}
        _add_log(entry)
        print(f"[Stripe] Error: {e.user_message}")
        return jsonify({'error': e.user_message}), 400

    except Exception as e:
        entry['status'] = 500
        entry['response_body'] = {'error': str(e)}
        _add_log(entry)
        return jsonify({'error': str(e)}), 500


@app.route('/stripe/create-setup-intent', methods=['POST'])
def create_setup_intent_stripe():
    """Create a Stripe Customer + SetupIntent to save a card without charging it."""

    entry = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.') + f"{datetime.utcnow().microsecond // 1000:03d}Z",
        'method': 'POST',
        'endpoint': '/v1/setup_intents  [Stripe]',
        'request_body': {'automatic_payment_methods': {'enabled': True}},
        'status': None,
        'response_body': None,
    }

    try:
        # Step 1: Create a Stripe Customer to attach the saved card to
        customer = stripe.Customer.create()
        print(f"[Stripe] Customer created: {customer.id}")

        # Step 2: Create a SetupIntent attached to that customer
        setup_intent = stripe.SetupIntent.create(
            customer=customer.id,
            automatic_payment_methods={'enabled': True},
        )

        response_body = {
            'id': setup_intent.id,
            'status': setup_intent.status,
            'customer': customer.id,
            'client_secret': setup_intent.client_secret,
        }

        entry['status'] = 200
        entry['response_body'] = response_body
        _add_log(entry)

        print(f"[Stripe] SetupIntent created: {setup_intent.id} — customer: {customer.id} — status: {setup_intent.status}")

        return jsonify({
            'client_secret': setup_intent.client_secret,
            'setup_intent_id': setup_intent.id,
            'customer_id': customer.id,
        })

    except stripe.error.StripeError as e:
        entry['status'] = 400
        entry['response_body'] = {'error': e.user_message}
        _add_log(entry)
        print(f"[Stripe] Error: {e.user_message}")
        return jsonify({'error': e.user_message}), 400

    except Exception as e:
        entry['status'] = 500
        entry['response_body'] = {'error': str(e)}
        _add_log(entry)
        return jsonify({'error': str(e)}), 500


# ── Apple Pay domain verification ────────────────────────────────────────────
@app.route('/.well-known/apple-developer-merchantid-domain-association')
def apple_pay_domain_verification():
    """
    Serve the Apple Pay domain association file.
    Download this file from your payment processor (Super Payments / Stripe)
    and place it at backend/apple-developer-merchantid-domain-association
    """
    well_known_dir = os.path.join(os.path.dirname(__file__), '.well-known')
    return send_from_directory(well_known_dir, 'apple-developer-merchantid-domain-association')


# ── Serve React build (production) ───────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve the React production build for all non-API routes."""
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)