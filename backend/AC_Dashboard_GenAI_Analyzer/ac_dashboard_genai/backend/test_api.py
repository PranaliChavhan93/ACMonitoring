import json
import requests

with open("../sample/dashboard_payload.json", "r", encoding="utf-8") as f:
    payload = json.load(f)

response = requests.post(
    "http://127.0.0.1:9000/api/analyze-dashboard",
    json=payload,
    timeout=120
)

print("HTTP:", response.status_code)
print(json.dumps(response.json(), indent=2, ensure_ascii=False))
