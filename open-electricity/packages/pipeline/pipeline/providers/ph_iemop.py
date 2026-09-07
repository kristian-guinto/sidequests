"""Philippines Wholesale Electricity Spot Market (WESM) / IEMOP provider."""

from typing import List, Optional, Any
from datetime import date, timedelta
from pipeline.providers.base import BaseProvider
from pipeline.generator_registry import GeneratorRegistry
from pipeline.iemop_client import IEMOPClient
from pipeline.parsers.iemop import IEMOPParser
from pipeline.models import FacilityRecord, EnergyIntervalRecord


class PhilippinesIEMOPProvider(BaseProvider):
    """Data provider for Philippines IEMOP / WESM."""

    def __init__(self, conn: Optional[Any] = None):
        super().__init__("PH")
        self.client = IEMOPClient()
        self.registry = GeneratorRegistry(conn=conn, country_code="PH")
        self.parser = IEMOPParser(self.registry)

    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """Fetches registered power plant catalog from database or current registry cache."""
        if conn is not None:
            self.registry.load_from_database(conn)
        return self.registry.get_all_facilities()

    def fetch_energy_intervals(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        days: int = 2,
        conn: Optional[Any] = None,
        max_files: Optional[int] = None,
    ) -> List[EnergyIntervalRecord]:
        """Downloads RTD dispatch archives from IEMOP and parses into EnergyIntervalRecord objects."""
        if conn is not None:
            self.registry.load_from_database(conn)

        s_date = start_date or (date.today() - timedelta(days=days))
        e_date = end_date or date.today()

        disp_files = self.client.get_rtd_dispatch_files(s_date, e_date)
        if max_files:
            disp_files = disp_files[:max_files]

        all_records: List[EnergyIntervalRecord] = []
        for f_info in disp_files:
            try:
                csv_lines = self.client.download_rtd_dispatch_csv(f_info["file_id"])
                records = self.parser.parse_rtd_dispatch(csv_lines)
                all_records.extend(records)
            except Exception as e:
                print(f"    ⚠️ Failed to process {f_info.get('filename', '')}: {e}")

        return all_records
