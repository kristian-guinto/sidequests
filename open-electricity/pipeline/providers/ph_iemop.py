from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pipeline.providers.base import BaseProvider
from pipeline.iemop_client import IEMOPClient
from pipeline.generator_registry import GeneratorRegistry
from pipeline.data_processor import DataProcessor


class PhilippinesIEMOPProvider(BaseProvider):
    def __init__(self):
        super().__init__("PH")
        self.client = IEMOPClient()
        self.registry = GeneratorRegistry()
        self.processor = DataProcessor(self.registry)

    def fetch_facilities(self) -> List[Dict[str, Any]]:
        facilities = self.client.fetch_facilities_catalog()
        for f in facilities:
            f["country_code"] = "PH"
        return facilities

    def fetch_dispatch(
        self, start_date: Optional[str] = None, end_date: Optional[str] = None, days: int = 2
    ) -> List[Dict[str, Any]]:
        # Ingestion logic is coordinated via the batch stream processor in pipeline/ingest.py
        return []

    def fetch_regional_summaries(
        self, start_date: Optional[str] = None, end_date: Optional[str] = None, days: int = 2
    ) -> List[Dict[str, Any]]:
        return []
