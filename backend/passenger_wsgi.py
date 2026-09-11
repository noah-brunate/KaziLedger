"""WSGI entry point for cPanel Phusion Passenger.

Passenger invokes a synchronous WSGI callable. The application itself remains
FastAPI/ASGI; a2wsgi runs it on one dedicated event loop and exposes the WSGI
callable Passenger expects as ``application``.
"""

from __future__ import annotations

import asyncio
import sys
import threading
from pathlib import Path

from a2wsgi import ASGIMiddleware


APP_ROOT = Path(__file__).resolve().parent
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from app.bootstrap import initialize_database  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app as asgi_app  # noqa: E402


_loop = asyncio.new_event_loop()


def _run_event_loop() -> None:
    asyncio.set_event_loop(_loop)
    _loop.run_forever()


_loop_thread = threading.Thread(
    target=_run_event_loop,
    name="kaziledger-asgi-loop",
    daemon=True,
)
_loop_thread.start()

# FastAPI lifespan events are not emitted by a WSGI server. Run the existing
# schema/demo bootstrap on the same loop that will serve requests.
asyncio.run_coroutine_threadsafe(
    initialize_database(get_settings()),
    _loop,
).result()

application = ASGIMiddleware(asgi_app, loop=_loop)
