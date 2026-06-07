from dotenv import load_dotenv
load_dotenv()

import os
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search_suburb(name: str) -> str:
    """Search for a suburb by name and return its code."""
    return f"Found suburb: {name}, salCode=11703"

llm = ChatOpenAI(
    model="deepseek/deepseek-chat",
    openai_api_key=os.environ["OPENROUTER_API_KEY"],
    openai_api_base="https://openrouter.ai/api/v1",
    default_headers={"HTTP-Referer": "http://localhost:5000"},
).bind_tools([search_suburb])

response = llm.invoke("帮我查一下 Glebe 这个郊区")

print("LLM response type:", type(response))
print("是否有 tool_calls:", bool(response.tool_calls))
print("tool_calls 内容:", response.tool_calls)
