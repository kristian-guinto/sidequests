from __future__ import annotations

from datetime import date, datetime, timedelta

import httpx
import pytest

from nem_battery.reports import nextday


def _dt_str(dt: datetime) -> str:
    return dt.strftime("%Y/%m/%d %H:%M:%S")


@pytest.mark.asyncio
async def test_fetch_prices_merges_day_and_next_day(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2026, 3, 1)

    async def fake_fetch_zip(url: str, client: httpx.AsyncClient | None = None) -> bytes:
        if "PUBLIC_DISPATCHIS_20260301.zip" in url:
            return b"day"
        if "PUBLIC_DISPATCHIS_20260302.zip" in url:
            return b"next"
        raise AssertionError(f"unexpected url: {url}")

    def fake_parse_archive_prices(zip_bytes: bytes) -> dict[str, dict]:
        if zip_bytes == b"day":
            return {"2026/03/01 23:55:00": {"SA1": object()}}
        if zip_bytes == b"next":
            return {"2026/03/02 00:05:00": {"SA1": object()}}
        raise AssertionError("unexpected bytes")

    monkeypatch.setattr(nextday._client, "fetch_zip", fake_fetch_zip)
    monkeypatch.setattr(nextday, "_parse_archive_prices", fake_parse_archive_prices)

    prices = await nextday._fetch_prices(day, client=None)

    assert set(prices) == {"2026/03/01 23:55:00", "2026/03/02 00:05:00"}


@pytest.mark.asyncio
async def test_fetch_prices_ignores_missing_next_day_archive(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    day = date(2026, 3, 1)

    async def fake_fetch_zip(url: str, client: httpx.AsyncClient | None = None) -> bytes:
        if "PUBLIC_DISPATCHIS_20260301.zip" in url:
            return b"day"
        if "PUBLIC_DISPATCHIS_20260302.zip" in url:
            request = httpx.Request("GET", url)
            response = httpx.Response(status_code=404, request=request)
            raise httpx.HTTPStatusError("not found", request=request, response=response)
        raise AssertionError(f"unexpected url: {url}")

    def fake_parse_archive_prices(zip_bytes: bytes) -> dict[str, dict]:
        assert zip_bytes == b"day"
        return {"2026/03/01 23:55:00": {"SA1": object()}}

    monkeypatch.setattr(nextday._client, "fetch_zip", fake_fetch_zip)
    monkeypatch.setattr(nextday, "_parse_archive_prices", fake_parse_archive_prices)

    prices = await nextday._fetch_prices(day, client=None)

    assert set(prices) == {"2026/03/01 23:55:00"}


@pytest.mark.asyncio
async def test_fetch_next_day_dispatch_warns_on_partial_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    day = date(2026, 3, 1)
    start = datetime(2026, 3, 1, 4, 5)

    unit = {}
    for i in range(288):
        unit[_dt_str(start + timedelta(minutes=5 * i))] = {"DUID": object()}

    prices = {}
    for i in range(240):
        prices[_dt_str(start + timedelta(minutes=5 * i))] = {"SA1": object()}

    async def fake_fetch_unit_solutions(
        _day: date,
        _client: httpx.AsyncClient | None,
    ) -> dict[str, dict]:
        return unit

    async def fake_fetch_prices(
        _day: date,
        _client: httpx.AsyncClient | None,
    ) -> dict[str, dict]:
        return prices

    monkeypatch.setattr(nextday, "_fetch_unit_solutions", fake_fetch_unit_solutions)
    monkeypatch.setattr(nextday, "_fetch_prices", fake_fetch_prices)

    with pytest.warns(UserWarning, match="Partial trading day assembled"):
        dispatch_day = await nextday.fetch_next_day_dispatch(day)

    assert len(dispatch_day.intervals) == 240
    assert dispatch_day.intervals[0].settlement_date == datetime(2026, 3, 1, 4, 5)
    assert dispatch_day.intervals[-1].settlement_date == datetime(2026, 3, 2, 0, 0)
