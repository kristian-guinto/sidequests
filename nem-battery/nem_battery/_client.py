"""
HTTP client for the AEMO NEMWeb file server.

All public NEM data is served as ZIP archives from:
  https://www.nemweb.com.au/Reports/Current/{ReportDir}/
  https://www.nemweb.com.au/Reports/Archive/{ReportDir}/

No authentication is required. The server returns HTML directory listings
with <a href="..."> links to each available ZIP file.
"""

from __future__ import annotations

import re
from datetime import date

import httpx

NEMWEB_BASE = "https://www.nemweb.com.au/Reports"
CURRENT = f"{NEMWEB_BASE}/Current"
ARCHIVE = f"{NEMWEB_BASE}/Archive"

# Directory URLs for each report type — trailing slash is required; NEMWeb
# returns a 301 redirect without it and httpx does not follow redirects by default.
DISPATCH_IS_DIR = f"{CURRENT}/DispatchIS_Reports/"
DISPATCH_SCADA_DIR = f"{CURRENT}/Dispatch_SCADA/"
TRADING_IS_DIR = f"{CURRENT}/TradingIS_Reports/"
NEXT_DAY_DISPATCH_DIR = f"{CURRENT}/Next_Day_Dispatch/"
ARCHIVE_DISPATCH_IS_DIR = f"{ARCHIVE}/DispatchIS_Reports/"

_ZIP_HREF_RE = re.compile(r'href="([^"]+\.zip)"', re.IGNORECASE)

_DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_CLIENT_DEFAULTS: dict[str, object] = {
    "timeout": _DEFAULT_TIMEOUT,
    "http2": True,
    "follow_redirects": True,
}


async def fetch_zip(url: str, client: httpx.AsyncClient | None = None) -> bytes:
    """Fetch a ZIP file from NEMWeb and return its raw bytes."""
    if client is not None:
        response = await client.get(url)
        response.raise_for_status()
        return response.content

    async with httpx.AsyncClient(**_CLIENT_DEFAULTS) as c:  # type: ignore[arg-type]
        response = await c.get(url)
        response.raise_for_status()
        return response.content


async def list_directory(
    directory_url: str,
    client: httpx.AsyncClient | None = None,
) -> list[str]:
    """Return all ZIP filenames listed in a NEMWeb HTML directory.

    The returned names are bare filenames (no path prefix), sorted
    lexicographically. Because AEMO encodes the timestamp in the filename,
    lexicographic order equals chronological order.
    """
    if client is not None:
        response = await client.get(directory_url)
        response.raise_for_status()
        html = response.text
    else:
        async with httpx.AsyncClient(**_CLIENT_DEFAULTS) as c:  # type: ignore[arg-type]
            response = await c.get(directory_url)
            response.raise_for_status()
            html = response.text

    filenames = [href.split("/")[-1] for href in _ZIP_HREF_RE.findall(html)]
    return sorted(set(filenames))


async def fetch_latest_zip(
    directory_url: str,
    client: httpx.AsyncClient | None = None,
) -> tuple[str, bytes]:
    """Fetch the most recently published ZIP from a NEMWeb directory.

    Returns:
        (filename, zip_bytes) tuple.
    """
    files = await list_directory(directory_url, client=client)
    if not files:
        raise ValueError(f"No ZIP files found in directory: {directory_url}")
    latest = files[-1]
    url = f"{directory_url.rstrip('/')}/{latest}"
    return latest, await fetch_zip(url, client=client)


def archive_dispatch_is_url(day: date) -> str:
    """Return the URL for the daily DispatchIS archive ZIP for a given date.

    Archive files consolidate all 5-minute DispatchIS ZIPs for one day into
    a single ZIP named PUBLIC_DISPATCHIS_YYYYMMDD.zip (~5–6 MB).
    """
    # ARCHIVE_DISPATCH_IS_DIR already has a trailing slash, so no extra slash here.
    return f"{ARCHIVE_DISPATCH_IS_DIR}PUBLIC_DISPATCHIS_{day.strftime('%Y%m%d')}.zip"
