from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from pipeline.providers.base import BaseProvider
from pipeline.generator_registry import GeneratorRegistry
from pipeline.iemop_client import IEMOPClient
from pipeline.data_processor import DataProcessor


class PhilippinesIEMOPProvider(BaseProvider):
    def __init__(self):
        super().__init__("PH")
        self.registry = GeneratorRegistry()
        self.client = IEMOPClient()
        self.processor = DataProcessor(self.registry)

    def fetch_facilities(self) -> List[Dict[str, Any]]:
        facilities = self.registry.get_all_facilities()
        for f in facilities:
            f["country_code"] = "PH"
        return facilities

    def fetch_dispatch(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: int = 2,
    ) -> List[Dict[str, Any]]:
        s_date = (
            datetime.strptime(start_date, "%Y-%m-%d").date()
            if start_date
            else date.today() - timedelta(days=days)
        )
        e_date = (
            datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else date.today()
        )

        disp_files = self.client.get_rtd_dispatch_files(s_date, e_date)
        all_records = []
        for f_info in disp_files:
            try:
                csv_lines = self.client.download_rtd_dispatch_csv(f_info["file_id"])
                records = self.processor.process_rtd_dispatch(csv_lines)
                for r in records:
                    r["country_code"] = "PH"
                all_records.extend(records)
            except Exception as e:
                print(f"    ⚠️ Failed to process {f_info['filename']}: {e}")
        return all_records

    def fetch_regional_summaries(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: int = 2,
    ) -> List[Dict[str, Any]]:
        s_date = (
            datetime.strptime(start_date, "%Y-%m-%d").date()
            if start_date
            else date.today() - timedelta(days=days)
        )
        e_date = (
            datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else date.today()
        )

        reg_files = self.client.get_rtd_regional_summary_files(s_date, e_date)
        all_records = []
        for f_info in reg_files:
            try:
                csv_lines = self.client.download_regional_summary_csv(f_info["file_id"])
                records = self.processor.process_regional_summary(csv_lines)
                for r in records:
                    r["country_code"] = "PH"
                all_records.extend(records)
            except Exception as e:
                print(f"    ⚠️ Failed to process {f_info['filename']}: {e}")
        return all_records
