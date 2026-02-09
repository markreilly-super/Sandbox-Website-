import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# 1. Enable CORS so React (port 3000) can talk to Flask (port 5000)
CORS(app)

# Configuration - Using your provided Test Credentials
# Nutmeg account API Key and Payment Initiator ID
# Secret API Key - sk_test_MRX-NlE8dd3AWxan6laIY-Jr3sZmFi6zXLtCCqZ-
# Payment Initiator ID - eb143504-9d73-4ae9-b467-b71e005b3198
API_KEY = "sk_test_slW4ny3ac-I-X-73htZ8gShcYM6o4fBZpv5y5xSn"
INITIATOR_ID = "db0d5525-0b17-4acf-b4f5-8c47405e7079"
BRAND_ID = "f6883e2a-c76b-4ac6-840e-09891f72132e"

#Staging account Mark Reilly Limited 
#API_KEY = "sk_stag_MGxPoxlNNlKJ1OTzFvHnXKUv62SRMamHvZhmdFrG"
#INITIATOR_ID = "39733f1a-8a06-47e2-9fdb-38c5c78662eb"
#Secret - sk_stag_MGxPoxlNNlKJ1OTzFvHnXKUv62SRMamHvZhmdFrG
#Payment Init - 39733f1a-8a06-47e2-9fdb-38c5c78662eb
#Brand - 60202016-cada-4832-b792-ff3710b5c4ce
#Public - pk_stag_KGQ2yHCbOPDg8YMi_22SYfis4gSay7aPXzWe5UzH


# Note: Using the test subdomain for all calls
BASE_URL = "https://api.test.superpayments.com/2025-11-01"

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
        response = requests.post(f"{BASE_URL}/checkout-sessions", headers=headers, json=payload)
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
    proceed_url = f"{BASE_URL}/checkout-sessions/{session_id}/proceed"

    print(f"Proceed URL: {proceed_url}")
    
    headers = {
        'Authorization': API_KEY,
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
    

# new endpoints for Off-Session Payments

@app.route('/customers', methods=['POST'])
def create_customer():
    headers = {'Authorization': API_KEY, 'Content-Type': 'application/json'}
    payload = {
        "externalReference": "Customer_002",
        "brandId": BRAND_ID,
        "metadata": {"Name": "John SmithViaOffSession"}
    }
    try:
        # Step 1: Request from Super Payments
        response = requests.post(f"{BASE_URL}/customers", headers=headers, json=payload)
        # Step 2: Return the JSON (containing the 'id') to your React frontend
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/payment-methods', methods=['POST'])
def create_payment_method():
    """Received the customerId from the frontend request body"""
    headers = {'Authorization': API_KEY, 'Content-Type': 'application/json'}
    
    # Extract the ID sent by the frontend
    customer_id = request.json.get("customerId") 
    
    payload = {
        "customerId": customer_id,
        "type": "CARD",
        "usage": "OFF_SESSION",
        "metadata": {"Name": "Test transaction"}
    }
    try:
        response = requests.post(f"{BASE_URL}/payment-methods", headers=headers, json=payload)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/payment-methods/<pm_id>/setup-intents', methods=['POST'])
def create_setup_intent(pm_id):
    """Step 3: Create a Setup Intent to authorize the card."""
    headers = {'Authorization': API_KEY, 'Content-Type': 'application/json'}
    payload = {
        "redirectUrl": "http://localhost:3000/success"
    }
    print(f"Creating Setup Intent for Payment Method ID: {pm_id}")
    try:
        url = f"{BASE_URL}/payment-methods/{pm_id}/setup-intents"
        response = requests.post(url, headers=headers, json=payload)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/create-off-session-payment', methods=['POST'])
def off_session_payment():
    """Step 6: Charge the saved card when the user is NOT present."""
    headers = {'Authorization': API_KEY, 'Content-Type': 'application/json'}
    frontend_data = request.json
    
    payload = {
        "amount": frontend_data.get("amount"),
        "currency": "GBP",
        "paymentMethodId": frontend_data.get("paymentMethodId"),
        "offSession": True, # CRITICAL: Tells the API to skip 3DS/User interaction
        "paymentInitiatorId": INITIATOR_ID
    }
    try:
        response = requests.post(f"{BASE_URL}/payments", headers=headers, json=payload)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Flask runs on http://localhost:5000
    app.run(host='0.0.0.0', port=5000, debug=True)