"""
Real-time streaming of AEMO dispatch intervals.

NEMWeb publishes a new DispatchIS ZIP every 5 minutes. This module polls
the directory listing (a ~2 KB HTML page) every few seconds and downloads
the ZIP (~20 KB) only when a new file appears — roughly 240 KB/min total.

Two interfaces are provided:

  1. Async generator:
       async for interval in stream_dispatch():
           ...

  2. Callback (fires once per interval):
       await stream_dispatch_to(on_interval)

Both handle transient HTTP errors with exponential backoff (capped at 120 s)
and resume automatically when connectivity returns.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Any

import httpx

from nem_battery import _client
from nem_battery.reports import dispatch as _dispatch
from nem_battery.reports import scada as _scada
from nem_battery.types import DispatchInterval

_log = logging.getLogger(__name__)

_MIN_POLL_SECONDS = 2.0
_MAX_BACKOFF_SECONDS = 120.0


async def stream_dispatch(
    poll_seconds: float = 5.0,
    include_scada: bool = False,
) -> AsyncGenerator[DispatchInterval]:
    """Yield each new 5-minute DispatchIS interval as it is published.

    Args:
        poll_seconds:  How often to check for a new file. The default of 5 s
                       gives a good balance between latency and server load.
                       AEMO publishes new files every ~300 s; setting this
                       lower than 5 s is unlikely to help.
        include_scada: If True, fetch the corresponding Dispatch SCADA reading
                       and attach it to the interval (.scada field). This adds
                       one extra HTTP request per interval (~4 KB).

    Yields:
        DispatchInterval for each new 5-minute settlement period, in order.
    """
    poll_seconds = max(poll_seconds, _MIN_POLL_SECONDS)

    async with httpx.AsyncClient(**_client._CLIENT_DEFAULTS) as client:  # type: ignore[arg-type]
        last_filename: str | None = None
        backoff = poll_seconds

        while True:
            try:
                files = await _client.list_directory(_client.DISPATCH_IS_DIR, client=client)
                if not files:
                    _log.warning("DispatchIS directory returned no files")
                    await asyncio.sleep(backoff)
                    continue

                latest = files[-1]

                if latest != last_filename:
                    _log.debug("New DispatchIS file: %s", latest)
                    url = f"{_client.DISPATCH_IS_DIR}/{latest}"
                    zip_bytes = await _client.fetch_zip(url, client=client)
                    interval = _dispatch.parse_zip(zip_bytes)

                    if include_scada:
                        try:
                            readings = await _scada.fetch_scada(client=client)
                            interval.scada = _scada.to_dict(readings)
                        except Exception as exc:  # noqa: BLE001
                            _log.warning("SCADA fetch failed: %s", exc)

                    last_filename = latest
                    backoff = poll_seconds
                    yield interval

            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                backoff = min(backoff * 2, _MAX_BACKOFF_SECONDS)
                _log.warning(
                    "HTTP error fetching DispatchIS (backing off %.0fs): %s",
                    backoff,
                    exc,
                )
            except asyncio.CancelledError:
                return
            except Exception:
                _log.exception("Unexpected error in stream_dispatch")
                backoff = min(backoff * 2, _MAX_BACKOFF_SECONDS)

            await asyncio.sleep(backoff)


async def stream_dispatch_to(
    callback: Callable[[DispatchInterval], Any],
    poll_seconds: float = 5.0,
    include_scada: bool = False,
) -> None:
    """Stream dispatch intervals and fire a callback for each new interval.

    The callback may be a plain function or an async function. If it is a
    coroutine function it will be awaited; otherwise it is called directly.

    Args:
        callback:      Function (sync or async) receiving each DispatchInterval.
        poll_seconds:  Polling cadence passed through to stream_dispatch().
        include_scada: Passed through to stream_dispatch().

    This coroutine runs forever unless cancelled.
    """
    async for interval in stream_dispatch(
        poll_seconds=poll_seconds,
        include_scada=include_scada,
    ):
        result = callback(interval)
        if isinstance(result, Awaitable):
            await result
