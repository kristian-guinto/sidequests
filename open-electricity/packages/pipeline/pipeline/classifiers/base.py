"""Base abstraction for country-specific facility and fuel technology classifiers."""

from abc import ABC, abstractmethod
from typing import NamedTuple


class ClassifiedUnit(NamedTuple):
    """Result of classifying a generator resource identifier."""

    fuel_tech: str
    region: str
    facility_name: str


class BaseFacilityClassifier(ABC):
    """
    Abstract classifier for determining plant fuel technology, region, and display name
    from raw market resource identifiers.
    """

    @abstractmethod
    def classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit:
        """
        Classifies a resource identifier using market-specific naming patterns.
        Strict Domain Safety: Must return 'unclassified' if fuel technology cannot be confirmed.
        """
        pass
