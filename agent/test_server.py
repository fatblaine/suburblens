import os
import httpx

# /chat now requires a registered-user Supabase JWT. Paste a token from a
# logged-in (non-guest) session into TEST_JWT to smoke-test, e.g.:
#   in the browser console after logging in:
#   (await window.supabase?.auth.getSession())  — or copy from devtools network tab.
TOKEN = os.environ.get("TEST_JWT", "")
headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}

with httpx.stream("POST", "http://localhost:8001/chat",
                  headers=headers,
                  json={"message": "Glebe 的教育水平怎么样？", "thread_id": "test-1"},
                  timeout=60) as r:
    if r.status_code != 200:
        print(f"HTTP {r.status_code}: {r.read().decode()}")
    else:
        for chunk in r.iter_text():
            print(chunk, end="", flush=True)
print()
