"""Country-specific facility and fuel technology classifiers."""

from typing import Dict, Type
from pipeline.classifiers.base import BaseFacilityClassifier, ClassifiedUnit
from pipeline.classifiers.ph_wesm import PhilippinesFacilityClassifier
from pipeline.classifiers.sg_emc import SingaporeFacilityClassifier
from pipeline.classifiers.my_singlebuyer import MalaysiaFacilityClassifier

CLASSIFIERS_MAP: Dict[str, Type[BaseFacilityClassifier]] = {
    "PH": PhilippinesFacilityClassifier,
    "SG": SingaporeFacilityClassifier,
    "MY": MalaysiaFacilityClassifier,
}


def get_classifier_for_country(country_code: str) -> BaseFacilityClassifier:
    """Factory to instantiate the appropriate classifier for a given country code."""
    c = country_code.upper()
    cls_type = CLASSIFIERS_MAP.get(c, PhilippinesFacilityClassifier)
    return cls_type()


__all__ = [
    "BaseFacilityClassifier",
    "ClassifiedUnit",
    "PhilippinesFacilityClassifier",
    "SingaporeFacilityClassifier",
    "MalaysiaFacilityClassifier",
    "get_classifier_for_country",
    "CLASSIFIERS_MAP",
]
