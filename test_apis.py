import urllib.request
import json

BASE_URL = "http://localhost:5000/api"

def make_request(path, data=None, method="GET"):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode() if data else None,
        headers={"Content-Type": "application/json"} if data else {},
        method=method
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"Error calling {path}: {e}")
        return None

print("--- Test 1: Fetching Cities ---")
cities = make_request("/hotels/cities")
print("Top Cities sample:", cities[:5] if cities else "Failed")

print("\n--- Test 2: Fetching Hotels ---")
hotels = make_request("/hotels?page=1&per_page=3")
if hotels:
    print(f"Total Hotels found: {hotels['total']}")
    for h in hotels['hotels']:
        print(f"  Hotel #{h['id']}: {h['name']} in {h['city']} - Rating: {h['aggregate_rating']}")
else:
    print("Failed to fetch hotels.")

print("\n--- Test 3: Fetching Recommendations for Hotel #1 ---")
recs = make_request("/hotels/1/recommendations")
if recs:
    print(f"Similar Hotels recommended for Hotel #1:")
    for r in recs:
        print(f"  - {r['name']} in {r['city']} (Rating: {r['aggregate_rating']})")
else:
    print("Failed to fetch similar recommendations.")

print("\n--- Test 4: Running DecisionTree Rating Prediction ---")
pred_payload = {
    "city": "New Delhi",
    "cuisines": "North Indian",
    "average_cost": 800.0,
    "latitude": 28.63,
    "longitude": 77.22,
    "price_range": 3,
    "votes": 120
}
pred = make_request("/hotels/predict-rating", data=pred_payload, method="POST")
if pred:
    print(f"ML Model predicted rating: {pred['predicted_rating']} ({pred['rating_text']})")
else:
    print("Failed to predict rating using ML model.")

print("\n--- Test 5: Registering a Test User ---")
reg_payload = {
    "username": "testuser",
    "email": "test@test.com",
    "password": "password123"
}
reg = make_request("/api/auth/register" if BASE_URL.endswith('/api') else "/auth/register", data=reg_payload, method="POST")
# Wait, let's fix path if it needs base /api
reg = make_request("/auth/register", data=reg_payload, method="POST")
print("Register response:", reg)

print("\n--- Verification completed ---")
