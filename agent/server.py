import os
import sys
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

# Windows: psycopg async cannot run on the default ProactorEventLoop.
# Switch to a selector-based loop before anything creates an event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.memory import MemorySaver

from graph import build_graph

DB_URI = os.environ.get("SUPABASE_DB_URL")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if DB_URI:
        # Supabase Session Pooler (5432) or Transaction Pooler (6543).
        # prepare_threshold=None disables prepared statements, which the
        # transaction pooler doesn't support; harmless on the session pooler.
        async with AsyncConnectionPool(
            conninfo=DB_URI,
            max_size=10,
            kwargs={"autocommit": True, "prepare_threshold": None, "sslmode": "require"},
        ) as pool:
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()      # idempotent: creates checkpoint tables on first run
            app.state.graph = build_graph(checkpointer)
            yield
    else:
        # No Supabase configured → fall back to in-memory for local dev.
        app.state.graph = build_graph(MemorySaver())
        yield


server = FastAPI(lifespan=lifespan)

server.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


@server.post("/chat")
async def chat(req: ChatRequest, request: Request):
    graph = request.app.state.graph
    config = {"configurable": {"thread_id": req.thread_id}}
    input_state = {"messages": [HumanMessage(content=req.message)]}

    async def generate():
        async for event in graph.astream_events(input_state, config, version="v2"):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield chunk.content

    return StreamingResponse(generate(), media_type="text/plain")


@server.get("/health")
async def health():
    return {"ok": True}
