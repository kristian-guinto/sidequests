"""Backward-compatibility alias module for FacilityRegistry."""

from pipeline.facility_registry import FacilityRegistry
from pipeline.classifiers.ph_wesm import REGION_MAP

GeneratorRegistry = FacilityRegistry

__all__ = ["GeneratorRegistry", "FacilityRegistry", "REGION_MAP"]
