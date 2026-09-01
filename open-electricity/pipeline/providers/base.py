from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime


class BaseProvider(ABC):
    """
    Abstract base provider for national electricity market data ingestion in Southeast Asia.
    """

    def __init__(self, country_code: str):
        self.country_code = country_code.upper()

    @abstractmethod
    def fetch_facilities(self) -> List[Dict[str, Any]]:
        """Fetches national power plant and generator capacity catalog."""
        pass

    @abstractmethod
    def fetch_dispatch(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: int = 2,
    ) -> List[Dict[str, Any]]:
        """Fetches interval electricity generation by fuel technology and market spot prices."""
        pass

    @abstractmethod
    def fetch_regional_summaries(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: int = 2,
    ) -> List[Dict[str, Any]]:
        """Fetches regional demand, interconnector flows, transmission losses, and net energy balance."""
        pass
