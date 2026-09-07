"""Foreign Exchange (FX) rate management for USD price normalization."""

from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional, Union, List
import httpx
from pipeline.models import ExchangeRateRecord

COUNTRY_TO_CURRENCY: Dict[str, str] = {
    "PH": "PHP",
    "SG": "SGD",
    "MY": "MYR",
    "TH": "THB",
    "VN": "VND",
}


class ExchangeRateNotFoundError(Exception):
    """Raised when an exchange rate is not available in the database for a given date and currency."""

    pass


class ExchangeRateSyncError(Exception):
    """Raised when fetching exchange rates from an external API fails."""

    pass


def get_fx_rate(
    date_val: Union[date, str],
    currency: str,
    conn: Optional[Any] = None,
) -> float:
    """
    Gets the exchange rate (units per 1 USD) for a given date and currency from the database.
    Strict Domain Safety: Does not use default fallbacks. Fails explicitly if rate is missing.

    Raises:
        ValueError: If conn is None.
        ExchangeRateNotFoundError: If the exchange rate is missing in the database.
    """
    curr = currency.upper()
    if curr == "USD":
        return 1.0

    if conn is None:
        raise ValueError("A database connection is required to look up exchange rates.")

    d_str = str(date_val)[:10]
    row = conn.execute(
        "SELECT rate_to_usd FROM exchange_rates WHERE date = ?::DATE AND currency = ?",
        [d_str, curr],
    ).fetchone()

    if row and row[0] is not None and row[0] > 0:
        return float(row[0])

    raise ExchangeRateNotFoundError(
        f"Exchange rate to USD not found for currency '{curr}' on date '{d_str}'. "
        "No default fallback rates are configured to prevent silent errors. "
        "Please ensure exchange rates are populated for this date."
    )


def sync_exchange_rates(
    db: Any,
    start_date: Optional[Union[date, str]] = None,
    end_date: Optional[Union[date, str]] = None,
) -> int:
    """
    Syncs daily exchange rates from Frankfurter API into the exchange_rates table.
    Fails explicitly if the external API request fails or returns no data.

    Raises:
        ExchangeRateSyncError: If fetching exchange rates from the API fails.
    """
    start = (
        datetime.strptime(str(start_date)[:10], "%Y-%m-%d").date()
        if start_date
        else date.today() - timedelta(days=30)
    )
    end = (
        datetime.strptime(str(end_date)[:10], "%Y-%m-%d").date()
        if end_date
        else date.today()
    )

    url = f"https://api.frankfurter.dev/v1/{start.isoformat()}..{end.isoformat()}?from=USD&to=PHP,SGD,MYR,THB"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                raise ExchangeRateSyncError(
                    f"Failed to fetch exchange rates from {url}: HTTP {resp.status_code} - {resp.text}"
                )
            data = resp.json().get("rates", {})
    except Exception as e:
        if isinstance(e, ExchangeRateSyncError):
            raise
        raise ExchangeRateSyncError(
            f"Network error fetching exchange rates from {url}: {e}"
        ) from e

    if not data:
        raise ExchangeRateSyncError(
            f"No exchange rate data returned from {url} for range {start}..{end}"
        )

    records: List[ExchangeRateRecord] = []
    for d_str, r_map in data.items():
        d_parsed = datetime.strptime(d_str, "%Y-%m-%d").date()
        for curr, rate in r_map.items():
            records.append(
                ExchangeRateRecord(
                    date=d_parsed,
                    currency=curr.upper(),
                    rate_to_usd=float(rate),
                )
            )

    return db.upsert_exchange_rates(records)
