from graph import build_graph, CANARY
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, Depends, HTTPException
from auth import require_registered_user
from guard import allow_message
from audit import log_security_event
from normalize import normalize
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
            kwargs={"autocommit": True,
                    "prepare_threshold": None, "sslmode": "require"},
        ) as pool:
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()      # idempotent: creates checkpoint tables on first run
            app.state.pool = pool
            app.state.graph = build_graph(checkpointer)
            yield
    else:
        # No Supabase configured → fall back to in-memory for local dev.
        # Without a pool we can't persist per-user usage, so rate limiting is skipped.
        app.state.pool = None
        app.state.graph = build_graph(MemorySaver())
        yield


server = FastAPI(lifespan=lifespan)

server.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        # Production domain. www is canonical; the apex 301s to it in Amplify,
        # but both are listed so a direct apex call is never blocked.
        "https://www.suburblensapp.com",
        "https://suburblensapp.com",
        # Amplify default domains — kept alive during the cutover.
        "https://main.d1yrvhzuhaioqy.amplifyapp.com",
        "https://dev.d1yrvhzuhaioqy.amplifyapp.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Each registered user may ask at most this many questions per day (Sydney time).
DAILY_LIMIT = int(os.environ.get("AI_DAILY_LIMIT", "50"))

# Reject oversized messages before any LLM cost. trim_messages only bounds the
# HISTORY sent to the model, not the current turn's input, so cap it here.
MAX_MESSAGE_CHARS = int(os.environ.get("AI_MAX_MESSAGE_CHARS", "2000"))


async def check_and_increment_quota(pool, user_id: str) -> int:
    """Atomically bump today's usage for a user and return the new count.

    The 'day' resets at Sydney midnight. Blocked (over-limit) requests still
    increment the counter, which is harmless since they're rejected anyway.
    """
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                insert into ai_usage (user_id, usage_date, count)
                values (%s, (now() at time zone 'Australia/Sydney')::date, 1)
                on conflict (user_id, usage_date)
                do update set count = ai_usage.count + 1
                returning count
                """,
                (user_id,),
            )
            row = await cur.fetchone()
            return row[0]


class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


@server.post("/chat")
async def chat(req: ChatRequest, request: Request, user: dict = Depends(require_registered_user)):
    # require_registered_user rejects missing/invalid tokens (401) and
    # anonymous guests (403) before we reach the graph.
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is empty.")
    if len(message) > MAX_MESSAGE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long (max {MAX_MESSAGE_CHARS} characters).",
        )

    # Fetched up front so the guard's reject/fail_open paths can audit-log too.
    pool = request.app.state.pool

    # Off-topic / prompt-injection gate (Layers 0-2). Runs before the quota
    # bump and the graph so obvious attacks and off-topic asks cost no LLM
    # reasoning; rejected turns get a streamed refusal instead.
    guard = await allow_message(message)
    if not guard.allowed:
        # Audit point 1: blocked by regex (L1) or classifier (L2).
        await log_security_event(
            pool, user_id=user["sub"], thread_id=req.thread_id,
            layer=guard.layer, snippet=normalize(message),
        )

        async def refuse():
            yield ("I'm the SuburbLens suburb analyst — I can only help with "
                   "Australian suburbs (Sydney & Melbourne) and their census/crime "
                   "data. Ask me about a suburb's tenure, rent, education, languages, "
                   "birth countries, crime, or nearby areas.")
        return StreamingResponse(refuse(), media_type="text/plain")

    # Audit point 2: classifier errored and we failed OPEN — request proceeds,
    # but record the security exposure so it's visible, not silent.
    if guard.layer == "fail_open":
        await log_security_event(
            pool, user_id=user["sub"], thread_id=req.thread_id,
            layer="fail_open", snippet=normalize(message),
        )

    if pool is not None:
        count = await check_and_increment_quota(pool, user["sub"])
        if count > DAILY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {DAILY_LIMIT} questions reached. Please try again tomorrow.",
            )

    graph = request.app.state.graph
    safe_thread = f'{user["sub"]}::{req.thread_id[:64]}'
    config = {"configurable": {"thread_id": safe_thread}}
    input_state = {"messages": [HumanMessage(content=message)]}

    async def generate():
        # Layer 4: scan the stream for the hidden canary (a system-prompt leak
        # signal). Hold back a `tail` of canary length so the tag can't slip
        # through split across chunk boundaries; emit only confirmed-clean text.
        buffer = ""
        tail = len(CANARY)
        async for event in graph.astream_events(input_state, config, version="v2"):
            if event["event"] == "on_chat_model_stream":
                # Only stream the answer node ("llm"). The "summarize" node is
                # internal history compression — its tokens (which intentionally
                # keep salCodes) must never reach the user.
                if event.get("metadata", {}).get("langgraph_node") != "llm":
                    continue
                chunk = event["data"]["chunk"]
                if not chunk.content:
                    continue
                buffer += chunk.content
                if CANARY in buffer:                 # prompt leak detected
                    # Audit point 3: canary hit — Layers 0-3 may have been
                    # bypassed. Highest-priority signal; should be rare/zero.
                    await log_security_event(
                        pool, user_id=user["sub"], thread_id=req.thread_id,
                        layer="canary", snippet=normalize(message),
                    )
                    yield "\n\n[Response withheld.]"
                    return
                if len(buffer) > tail:
                    yield buffer[:-tail]
                    buffer = buffer[-tail:]
        if CANARY not in buffer:
            yield buffer

    return StreamingResponse(generate(), media_type="text/plain")


@server.get("/health")
async def health():
    return {"ok": True}
