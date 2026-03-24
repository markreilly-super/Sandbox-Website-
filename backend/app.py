import requests
import uuid
import json
import threading
import queue
from collections import deque
from datetime import datetime
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

app = Flask(__name__)

# 1. Enable CORS so React (port 3000) can talk to Flask (port 5000)
CORS(app)

# Configuration - environment credentials
CREDENTIALS = {
    'test': {
        'api_key': "sk_test_U4F3nb-ob0DhbmZXPue0R1mc0-flivT9YJ90KZTm",
        'initiator_id': "db0d5525-0b17-4acf-b4f5-8c47405e7079",
        'brand_id': "f6883e2a-c76b-4ac6-840e-09891f72132e",
        'base_url': "https://api.test.superpayments.com/2025-11-01"
    },
    'staging': {
        'api_key': "sk_stag_MGxPoxlNNlKJ1OTzFvHnXKUv62SRMamHvZhmdFrG",
        'initiator_id': "39733f1a-8a06-47e2-9fdb-38c5c78662eb",
        'brand_id': "60202016-cada-4832-b792-ff3710b5c4ce",
        'base_url': "https://api.staging.superpayments.com/2025-11-01"
    }
}

current_env = 'test'

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
    Step 1: Create a Checkout Session
    """
    cfg = get_config()
    headers = {
        'Authorization': cfg['api_key'],
        'Content-Type': 'application/json'
    }
    payload = {
        "paymentInitiatorId": cfg['initiator_id']
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

    headers = {
        'Authorization': cfg['api_key'],
        'Content-Type': 'application/json'
    }

    frontend_data = request.json

    payload = {
        "amount": frontend_data.get("amount", 5000), # Default to 5000 (e.g. £50.00) if not sent
        "cancelUrl": "http://localhost:3000/cancel",
        "failureUrl": "http://localhost:3000/failure",
        "successUrl": "http://localhost:3000/success",
        "externalReference": frontend_data.get("externalReference", "TEST_ORDER_001_VIA_LOCALHOST"),
        "email": frontend_data.get("email", "customer@example.com"),
        "phone": frontend_data.get("phone", "07700900000"),
        "paymentInitiatorId": cfg['initiator_id'],
        "currency": "GBP",
        "metadata": {
            "firstName": "Mark",
            "lastName": "Reilly"
        }
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
    unique_ref = str(uuid.uuid4())[:12]
    payload = {
        "externalReference": f"Customer_{unique_ref}",
        "brandId": cfg['brand_id'],
        "metadata": {"Name": "SandboxUser"}
    }
    try:
        response = api_request('POST', f"{cfg['base_url']}/customers", headers, payload)
        return jsonify(response.json()), response.status_code
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
        "redirectUrl": "http://localhost:3000/success"
    }
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
        "paymentMethodId": frontend_data.get("paymentMethodId"),
        "offSession": True, # CRITICAL: Tells the API to skip 3DS/User interaction
        "paymentInitiatorId": cfg['initiator_id']
    }
    try:
        response = api_request('POST', f"{cfg['base_url']}/payments", headers, payload)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Flask runs on http://localhost:5000
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)