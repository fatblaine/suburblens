import os
from dotenv import load_dotenv
load_dotenv()

from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from tools import tools

# --- State ---


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


# --- LLM ---
llm = ChatOpenAI(
    model="deepseek/deepseek-chat",
    openai_api_key=os.environ["OPENROUTER_API_KEY"],
    openai_api_base="https://openrouter.ai/api/v1",
    default_headers={"HTTP-Referer": "http://localhost:5000"},
).bind_tools(tools)

SYSTEM_PROMPT = """You are a suburb intelligence analyst for SuburbLens,
helping migrants and students evaluate Australian suburbs (Sydney and Melbourne only).

When answering:
- Always call search_suburb first to get the salCode before fetching any data
- Quote specific numbers from the data (e.g. "46% rented in 2021")
- Highlight trends across 2011→2016→2021
- Be concise — 3-5 sentences unless asked for detail
- If a suburb is not in Sydney or Melbourne, say so clearly
"""

# --- Nodes ---


def llm_node(state: AgentState):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

# --- Routing ---


def should_continue(state: AgentState):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "end"

# --- Build Graph ---


builder = StateGraph(AgentState)

builder.add_node("llm", llm_node)
builder.add_node("tools", ToolNode(tools))

builder.set_entry_point("llm")

builder.add_conditional_edges(
    "llm",
    should_continue,
    {"tools": "tools", "end": END},
)
builder.add_edge("tools", "llm")

graph = builder.compile(checkpointer=MemorySaver())
