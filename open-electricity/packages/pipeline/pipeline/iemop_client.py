import base64
import io
import zipfile
from datetime import date
from typing import Any, Dict, List, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from pipeline.config import (
    IEMOP_AJAX_URL,
    POST_ID_RTD_PRICES_SCHEDULES,
    POST_ID_RTD_REGIONAL_SUMMARIES,
)


class IEMOPClient:
    def __init__(
        self,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenNEM-PH/1.0",
        timeout: int = 30,
    ):
        self.headers = {"User-Agent": user_agent}
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(self.headers)

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

    def _post(self, data: Dict[str, Any]) -> Dict[str, Any]:
        resp = self.session.post(IEMOP_AJAX_URL, data=data, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def _download_file(self, page_path: str, file_id: str) -> bytes:
        url = f"https://www.iemop.ph/market-data/{page_path}/?md_file={file_id}"
        resp = self.session.get(url, timeout=self.timeout)
        resp.raise_for_status()
        return resp.content

    def fetch_file_list(
        self,
        post_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sort: str = "desc",
    ) -> List[Dict[str, Any]]:
        """Fetch list of available files for a given post ID."""
        data: Dict[str, Any] = {
            "action": "display_filtered_market_data_files",
            "sort": sort,
            "page": 1,
            "post_id": post_id,
            "datefilter": "",
        }

        if start_date and end_date:
            data.pop("datefilter", None)
            data["datefilter[start]"] = start_date.strftime("%Y-%m-%d 00:00")
            data["datefilter[end]"] = end_date.strftime("%Y-%m-%d 23:59")

        resp = self._post(data)
        source = resp.get("source", [])
        data_map = resp.get("data", {})

        files = []
        for file_id in source:
            item = data_map.get(file_id, {})
            filename = item.get("filename", "")
            date_str = item.get("date", "")
            files.append(
                {
                    "file_id": file_id,
                    "filename": filename,
                    "date_str": date_str,
                    "raw_path": (
                        base64.b64decode(file_id).decode("utf-8", errors="ignore")
                        if file_id
                        else ""
                    ),
                }
            )
        return files

    def get_rtd_dispatch_files(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sort: str = "desc",
    ) -> List[Dict[str, Any]]:
        """List RTD Prices & Schedules files (hourly zip with 5m intervals)."""
        return self.fetch_file_list(
            POST_ID_RTD_PRICES_SCHEDULES, start_date, end_date, sort=sort
        )

    @staticmethod
    def extract_csv_from_bytes(raw_bytes: bytes) -> List[str]:
        """Extracts CSV content lines from zip or raw CSV bytes."""
        csv_lines = []
        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
                for name in z.namelist():
                    if name.endswith(".csv"):
                        with z.open(name) as f:
                            text = io.TextIOWrapper(
                                f, encoding="utf-8", errors="replace"
                            ).read()
                            csv_lines.extend(text.splitlines())
        except zipfile.BadZipFile:
            text = raw_bytes.decode("utf-8", errors="replace")
            csv_lines = text.splitlines()
        return csv_lines

    def download_rtd_dispatch_csv(self, file_id: str) -> List[str]:
        """Downloads RTD dispatch zip and extracts CSV content lines."""
        raw_bytes = self._download_file("rtd-prices-and-schedules", file_id)
        return self.extract_csv_from_bytes(raw_bytes)

    def get_rtd_regional_summary_files(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        sort: str = "desc",
    ) -> List[Dict[str, Any]]:
        """List RTD Regional Summary files (daily CSV with 5m intervals)."""
        return self.fetch_file_list(
            POST_ID_RTD_REGIONAL_SUMMARIES, start_date, end_date, sort=sort
        )

    def download_regional_summary_csv(self, file_id: str) -> List[str]:
        """Downloads RTD regional summary daily CSV."""
        raw_bytes = self._download_file("rtd-regional-summaries", file_id)
        return raw_bytes.decode("utf-8", errors="replace").splitlines()
