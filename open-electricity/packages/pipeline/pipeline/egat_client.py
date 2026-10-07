"""HTTP client for Thailand Electricity Generating Authority of Thailand (EGAT) and SO Thailand market data."""

import logging
from datetime import date
from typing import Dict, Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

SYSGEN_BASE_URL = "https://www.sothailand.com/sysgen/api"
HIST_ACTUAL_URL = f"{SYSGEN_BASE_URL}/hist/actual"
CONTROL_PLAN_URL = f"{SYSGEN_BASE_URL}/control/plan"
CONTROL_PEAK_URL = f"{SYSGEN_BASE_URL}/control/peak"
CONTROL_PEAK_LIST_URL = f"{SYSGEN_BASE_URL}/control/peak/list"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.sothailand.com/sysgen/",
}


class EGATClient:
    """Client for retrieving Thailand power system SCADA and dispatch data from SO Thailand."""

    def __init__(self, timeout: int = 30):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.timeout = timeout

        retry = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],
        )
        adapter = HTTPAdapter(
            pool_connections=10,
            pool_maxsize=10,
            max_retries=retry,
        )
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def get_actual_generation(self, target_date: date) -> Dict[str, Any]:
        """
        Fetches 1-minute interval actual system generation and temperature for target date.
        Date parameter formatted as DD-MM-YYYY.
        Returns dict containing 'list': [[seconds_from_midnight, generation_mw, temp], ...].
        """
        date_str = target_date.strftime("%d-%m-%Y")
        params = {"timestamp": date_str}
        resp = self.session.get(HIST_ACTUAL_URL, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_generation_plan(self, target_date: date) -> Dict[str, Any]:
        """
        Fetches 1-minute interval day-ahead scheduled generation plan for target date.
        Date parameter formatted as DD-MM-YYYY.
        Returns dict containing 'list': [[seconds_from_midnight, scheduled_mw], ...].
        """
        date_str = target_date.strftime("%d-%m-%Y")
        params = {"day": date_str}
        resp = self.session.get(CONTROL_PLAN_URL, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_peak_statistics(self) -> Dict[str, Any]:
        """
        Fetches system peak demand records, timestamps, and temperatures for current year, last year, and all-time.
        """
        resp = self.session.get(CONTROL_PEAK_URL, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def get_peak_list(self, target_date: date) -> Dict[str, Any]:
        """
        Fetches peak profile time-series for a specific day.
        Date parameter formatted as DD-MM-YYYY.
        """
        date_str = target_date.strftime("%d-%m-%Y")
        params = {"day": date_str}
        resp = self.session.get(
            CONTROL_PEAK_LIST_URL, params=params, timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()
