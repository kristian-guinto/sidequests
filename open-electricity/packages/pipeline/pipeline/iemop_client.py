import urllib.request
import urllib.parse
import json
import base64
import zipfile
import io
from typing import List, Dict, Any, Optional
from datetime import date
from pipeline.config import (
    IEMOP_AJAX_URL,
    POST_ID_RTD_PRICES_SCHEDULES,
    POST_ID_RTD_REGIONAL_SUMMARIES,
)


class IEMOPClient:
    def __init__(
        self,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenNEM-PH/1.0",
    ):
        self.headers = {"User-Agent": user_agent}

    def _post(self, data: Dict[str, Any]) -> Dict[str, Any]:
        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(
            IEMOP_AJAX_URL, data=encoded_data, headers=self.headers
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content)

    def _download_file(self, page_path: str, file_id: str) -> bytes:
        url = f"https://www.iemop.ph/market-data/{page_path}/?md_file={file_id}"
        req = urllib.request.Request(url, headers=self.headers)
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.read()

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
                    "raw_path": base64.b64decode(file_id).decode(
                        "utf-8", errors="ignore"
                    )
                    if file_id
                    else "",
                }
            )
        return files

    def get_rtd_dispatch_files(
        self, start_date: Optional[date] = None, end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """List RTD Prices & Schedules files (hourly zip with 5m intervals)."""
        return self.fetch_file_list(POST_ID_RTD_PRICES_SCHEDULES, start_date, end_date)

    def download_rtd_dispatch_csv(self, file_id: str) -> List[str]:
        """Downloads RTD dispatch zip and extracts CSV content lines."""
        raw_bytes = self._download_file("rtd-prices-and-schedules", file_id)
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
            # Sometimes file is raw CSV instead of zip
            text = raw_bytes.decode("utf-8", errors="replace")
            csv_lines = text.splitlines()
        return csv_lines

    def get_rtd_regional_summary_files(
        self, start_date: Optional[date] = None, end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """List RTD Regional Summary files (daily CSV with 5m intervals)."""
        return self.fetch_file_list(
            POST_ID_RTD_REGIONAL_SUMMARIES, start_date, end_date
        )

    def download_regional_summary_csv(self, file_id: str) -> List[str]:
        """Downloads RTD regional summary daily CSV."""
        raw_bytes = self._download_file("rtd-regional-summaries", file_id)
        return raw_bytes.decode("utf-8", errors="replace").splitlines()
