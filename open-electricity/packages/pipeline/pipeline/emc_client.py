"""HTTP client for Singapore Energy Market Company (EMC) and NEMS public market data."""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Dict, Any
import requests

logger = logging.getLogger(__name__)

SGT = timezone(timedelta(hours=8))
NEMS_DOWNLOAD_URL = "https://www.nems.emcsg.com/api/sitecore/DataSync/DataDownload"
NEMS_SNAPSHOT_URL = "https://nems.sn.sg/api/status.json"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,text/csv,*/*;q=0.8"
    ),
    "Referer": "https://www.nems.emcsg.com/nems-prices",
}


class EMCClient:
    """Client for retrieving Singapore NEMS market data from EMC portals."""

    def __init__(self, timeout: int = 30):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.timeout = timeout

    def download_csv(
        self,
        value: int,
        from_date: date,
        to_date: date,
        tpc_value: int = 1,
    ) -> str:
        """
        Downloads CSV data from the EMC NEMS DataDownload endpoint.
        Values:
            1  = Uniform Singapore Energy Price (USEP) and Demand Forecast (final)
            8  = Registered Facilities Capacity Catalog
            10 = Real-time Energy Prices and Demand (today / latest 48 periods)
            16 = Metered Generation by Facility Type
        """
        params = {
            "value": str(value),
            "fromDate": from_date.strftime("%Y-%m-%d"),
            "toDate": to_date.strftime("%Y-%m-%d"),
            "tpcValue": str(tpc_value),
        }
        resp = self.session.get(NEMS_DOWNLOAD_URL, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.text

    def download_facilities_csv(self, target_date: Optional[date] = None) -> str:
        """Downloads registered facilities catalog CSV (value=8)."""
        d = target_date or datetime.now(SGT).date()
        return self.download_csv(value=8, from_date=d, to_date=d)

    def download_usep_demand_csv(self, start_date: date, end_date: date) -> str:
        """Downloads final USEP & Demand forecast CSV (value=1)."""
        return self.download_csv(value=1, from_date=start_date, to_date=end_date)

    def download_metered_generation_csv(self, start_date: date, end_date: date) -> str:
        """Downloads half-hourly metered generation by facility type CSV (value=16)."""
        return self.download_csv(value=16, from_date=start_date, to_date=end_date)

    def download_realtime_csv(self, target_date: Optional[date] = None) -> str:
        """Downloads current-day provisional 48-period real-time USEP & Demand CSV (value=10)."""
        d = target_date or datetime.now(SGT).date()
        return self.download_csv(value=10, from_date=d, to_date=d)

    def get_live_snapshot(self) -> Optional[Dict[str, Any]]:
        """Fast fallback endpoint returning live USEP, demand, and VCP from nems.sn.sg."""
        try:
            resp = self.session.get(NEMS_SNAPSHOT_URL, timeout=10)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.debug("Failed to fetch NEMS live snapshot: %s", e)
        return None
