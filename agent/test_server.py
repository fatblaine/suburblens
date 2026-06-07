import httpx

with httpx.stream("POST", "http://localhost:8001/chat",
                  json={"message": "Glebe 的教育水平怎么样？", "thread_id": "test-1"},
                  timeout=60) as r:
    for chunk in r.iter_text():
        print(chunk, end="", flush=True)
print()
