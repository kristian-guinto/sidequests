"""Foreign Exchange (FX) rate management for USD price normalization."""
from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional, Union
import httpx

# Baseline reference rates (units per 1 USD) used as fallbacks
DEFAULT_FX_RATES: Dict[str, float] = {
    "PHP": 57.0,
    "SGD": 1.34,
    "MYR": 4.45,
    "THB": 35.0,
    "VND": 24500.0,
    "USD": 1.0,
}

COUNTRY_TO_CURRENCY: Dict[str, str] = {
    "PH": "PHP",
    "SG": "SGD",
    "MY": "MYR",
    "TH": "THB",
    "VN": "VND",
}


def get_fx_rate(
    date_val: Union[date, str],
    currency: str,
    conn: Optional[Any] = None,
) -> float:
    """Gets the exchange rate (units per 1 USD) for a given date and currency."""
    curr = currency.upper()
    if curr == "USD":
        return 1.0

    if conn is not None:
        try:
            d_str = str(date_val)[:10]
            row = conn.execute(
                "SELECT rate_to_usd FROM exchange_rates WHERE date = ?::DATE AND currency = ?",
                [d_str, curr],
            ).fetchone()
            if row and row[0] and row[0] > 0:
                return float(row[0])
        except Exception:
            pass

    return DEFAULT_FX_RATES.get(curr, 1.0)


def sync_exchange_rates(
    db: Any,
    start_date: Optional[Union[date, str]] = None,
    end_date: Optional[Union[date, str]] = None,
) -> int:
    """Syncs daily exchange rates into the exchange_rates table."""
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

    rates_to_insert = []
    curr_d = start
    while curr_d <= end:
        d_str = curr_d.strftime("%Y-%m-%d")
        for curr, default_rate in DEFAULT_FX_RATES.items():
            if curr == "USD":
                continue
            rates_to_insert.append((d_str, curr, default_rate))
        curr_d += timedelta(days=1)

    # Try fetching online if network allows
    try:
        url = f"https://api.frankfurter.dev/v1/{start.isoformat()}..{end.isoformat()}?from=USD&to=PHP,SGD,MYR,THB"
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("rates", {})
                updated_rates = []
                for d_str, r_map in data.items():
                    for curr, rate in r_map.items():
                        updated_rates.append((d_str, curr.upper(), float(rate)))
                if updated_rates:
                    rates_to_insert = updated_rates
    except Exception:
        pass

    db.conn.executemany(
        """
        INSERT INTO exchange_rates (date, currency, rate_to_usd)
        VALUES (?::DATE, ?, ?)
        ON CONFLICT (date, currency) DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd;
        """,
        rates_to_insert,
    )
    return len(rates_to_insert)
