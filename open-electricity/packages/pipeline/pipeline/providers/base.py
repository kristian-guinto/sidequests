"""Abstract base provider for national electricity market data ingestion."""

from abc import ABC, abstractmethod
from typing import List, Optional, Any
from datetime import date
from pipeline.models import FacilityRecord, EnergyIntervalRecord


class BaseProvider(ABC):
    """
    Abstract base provider for national electricity market data ingestion.
    Each market provider implements extraction and transformation to canonical dataclass DTOs.
    """

    def __init__(self, country_code: str):
        self.country_code = country_code.upper()

    @abstractmethod
    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """Fetches national power plant and generator capacity catalog."""
        pass

    @abstractmethod
    def fetch_energy_intervals(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        days: int = 2,
        conn: Optional[Any] = None,
        max_files: Optional[int] = None,
    ) -> List[EnergyIntervalRecord]:
        """Fetches interval electricity generation by fuel technology and market spot prices."""
        pass
