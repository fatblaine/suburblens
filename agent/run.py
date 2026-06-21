"""Launch the SuburbLens agent server.

Use this instead of `uvicorn server:server` on Windows. psycopg's async mode
cannot run on the ProactorEventLoop, but uvicorn force-selects it on Windows.
So we build a SelectorEventLoop ourselves and drive uvicorn's Server.serve()
directly (bypassing uvicorn's own loop setup). Run with:  python run.py
"""
import sys
import asyncio

from uvicorn import Config, Server
from server import server

if __name__ == "__main__":
    config = Config(server, host="127.0.0.1", port=8001, loop="none")
    srv = Server(config)

    if sys.platform == "win32":
        import selectors
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
    else:
        loop = asyncio.new_event_loop()

    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(srv.serve())
    finally:
        loop.close()
