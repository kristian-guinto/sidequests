"""HTTP client for Malaysia Single Buyer and Grid System Operator (GSO) market data."""

import json
import logging
from datetime import date
from typing import List, Dict, Any
import requests

logger = logging.getLogger(__name__)

GSO_POWER_STATION_URL = (
    "https://www.gso.org.my/SystemData/PowerStation.aspx/GetDataSource"
)
GSO_CURRENT_GEN_URL = (
    "https://www.gso.org.my/SystemData/CurrentGen.aspx/GetChartDataSource"
)
SB_DAY_GEN_MIX_URL = (
    "https://www.singlebuyer.com.my/api/v1/charts/op-scheduling/day-generation-mix"
)
SB_SMP_URL = "https://www.singlebuyer.com.my/api/v1/smp/actual-forecast"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}


class SingleBuyerClient:
    """Client for Malaysia Single Buyer and GSO electricity data endpoints."""

    def __init__(self, timeout: int = 30):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.timeout = timeout

    def get_power_stations(self) -> List[Dict[str, Any]]:
        """
        Fetches power station inventory and registered capacity from GSO.
        Returns parsed list of power plant dicts.
        """
        headers = {
            "Content-Type": "application/json; charset=utf-8",
        }
        resp = self.session.post(
            GSO_POWER_STATION_URL,
            data=b"{}",
            headers=headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        raw = resp.json()
        payload = raw.get("d", "[]")
        return json.loads(payload) if isinstance(payload, str) else payload

    def get_day_generation_mix(self, target_date: date) -> Dict[str, Any]:
        """
        Fetches 30-minute day generation mix by fuel from Single Buyer.
        Date formatted as YYYYMMDD.
        """
        d_str = target_date.strftime("%Y%m%d")
        params = {"startDate": d_str}
        resp = self.session.get(SB_DAY_GEN_MIX_URL, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_smp_prices(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Fetches half-hourly System Marginal Price (SMP) data from Single Buyer.
        Dates formatted as YYYY-MM-DD.
        """
        params = {
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d"),
        }
        resp = self.session.get(SB_SMP_URL, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_gso_current_gen(
        self, start_date: date, end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Fetches 10-minute dispatch intervals from GSO CurrentGen endpoint.
        Dates formatted as DD/MM/YYYY.
        """
        headers = {
            "Content-Type": "application/json; charset=utf-8",
        }
        payload = json.dumps(
            {
                "Fromdate": start_date.strftime("%d/%m/%Y"),
                "Todate": end_date.strftime("%d/%m/%Y"),
            }
        )
        resp = self.session.post(
            GSO_CURRENT_GEN_URL,
            data=payload.encode("utf-8"),
            headers=headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        raw = resp.json()
        data_str = raw.get("d", "[]")
        return json.loads(data_str) if isinstance(data_str, str) else data_str
