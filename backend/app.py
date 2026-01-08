import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# 1. Enable CORS so React (port 3000) can talk to Flask (port 5000)
CORS(app)

# Configuration - Using your provided Test Credentials
API_KEY = "sk_test_MRX-NlE8dd3AWxan6laIY-Jr3sZmFi6zXLtCCqZ-"
INITIATOR_ID = "eb143504-9d73-4ae9-b467-b71e005b3198"
# Note: Using the test subdomain for all calls
BASE_URL = "https://api.test.superpayments.com/2025-06-01/checkout-sessions"

@app.route('/checkout-sessions', methods=['POST'])
def create_checkout():
    """
    Step 1: Create a Checkout Session
    """
    headers = {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
    }
    payload = {
        "paymentInitiatorId": INITIATOR_ID
    }

    try:
        print(f"--- Step 1: Requesting session from {BASE_URL} ---")
        response = requests.post(BASE_URL, headers=headers, json=payload)
        response_data = response.json()
        
        # Log to terminal to see the 'token' and 'checkoutSessionId'
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
    # Constructing the URL: https://api.test.superpayments.com/2025-06-01/checkout-sessions/{id}/proceed
    proceed_url = f"{BASE_URL}/{session_id}/proceed"
    
    headers = {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
    }
    
    frontend_data = request.json
    
    payload = {
        "amount": frontend_data.get("amount", 1000), # Default to 1000 (e.g. £10.00) if not sent
        "cancelUrl": "http://localhost:3000/cancel",
        "failureUrl": "http://localhost:3000/failure",
        "successUrl": "http://localhost:3000/success",
        "externalReference": frontend_data.get("externalReference", "TEST_ORDER_001_VIA_LOCALHOST"),
        "email": frontend_data.get("email", "customer@example.com"),
        "phone": frontend_data.get("phone", "07700900000"),
        "paymentInitiatorId": INITIATOR_ID,
        "currency": "GBP"
    }

    try:
        print(f"--- Step 4: Proceeding for Session {session_id} ---")
        response = requests.post(proceed_url, headers=headers, json=payload)
        response_data = response.json()
        
        print("Proceed API Response:", response_data)
        return jsonify(response_data), response.status_code

    except Exception as e:
        print(f"Error in Step 4: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Flask runs on http://localhost:5000
    app.run(host='0.0.0.0', port=5000, debug=True)