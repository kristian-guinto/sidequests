"""Facility Classifier Template for Country Onboarding.

Replace <CountryName> and <CC> with the target country details (e.g. Vietnam / VN).
Subclass BaseFacilityClassifier to map raw unit identifiers and plant names to
canonical fuel technology and geographic region.
"""

from typing import Dict
from pipeline.classifiers.base import BaseFacilityClassifier, ClassifiedUnit

# 1. Map raw telemetry region strings to canonical dashboard region IDs
REGION_MAP: Dict[str, str] = {
    "NORTH": "NORTH",
    "CENTRAL": "CENTRAL",
    "SOUTH": "SOUTH",
    "ALL": "ALL",
}


class CountryFacilityClassifier(BaseFacilityClassifier):
    """
    Classifies generator units for <CountryName> across national regions.

    IMPORTANT INVARIANTS:
    1. No Blanket Peaker Fallback: Do NOT map unrecognized units to 'oil' or 'distillate'.
       Distillate is strictly for verified peaking diesel units and power barges.
       Unrecognized thermal units must return 'unclassified' so they are flagged for inspection.
    2. Canonical fuel_tech values must be one of:
       'solar', 'wind', 'hydro', 'geothermal', 'biomass', 'gas', 'coal', 'oil', 'battery', 'unclassified'
    """

    def classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit:
        name = resource_id.upper().strip()
        region = REGION_MAP.get(raw_region.strip().upper(), "ALL")

        # Solar PV (ground, rooftop, floating)
        if any(s in name for s in ["SOLAR", "PV", "SUN"]):
            return ClassifiedUnit(
                fuel_tech="solar",
                region=region,
                facility_name=f"Solar Farm {resource_id}",
            )

        # Wind (onshore, offshore)
        if any(w in name for w in ["WIND", "WTG"]):
            return ClassifiedUnit(
                fuel_tech="wind",
                region=region,
                facility_name=f"Wind Farm {resource_id}",
            )

        # Hydro (conventional dams, run-of-river, pumped storage)
        if any(h in name for h in ["HYDRO", "DAM", "WATER"]):
            return ClassifiedUnit(
                fuel_tech="hydro",
                region=region,
                facility_name=f"Hydro Station {resource_id}",
            )

        # Geothermal
        if any(geo in name for geo in ["GEO", "GEOTHERMAL"]):
            return ClassifiedUnit(
                fuel_tech="geothermal",
                region=region,
                facility_name=f"Geothermal Plant {resource_id}",
            )

        # Biomass / Biogas / Waste-to-Energy
        if any(b in name for b in ["BIOMASS", "BIO", "BAGASSE", "WASTE"]):
            return ClassifiedUnit(
                fuel_tech="biomass",
                region=region,
                facility_name=f"Biomass Plant {resource_id}",
            )

        # Natural Gas (CCGT, OCGT, LNG)
        if any(g in name for g in ["GAS", "CCGT", "LNG"]):
            return ClassifiedUnit(
                fuel_tech="gas",
                region=region,
                facility_name=f"Gas Plant {resource_id}",
            )

        # Coal / Lignite
        if any(c in name for c in ["COAL", "LIGNITE", "CFB"]):
            return ClassifiedUnit(
                fuel_tech="coal",
                region=region,
                facility_name=f"Coal Station {resource_id}",
            )

        # Peaking Oil / Diesel (ONLY verified peaking units)
        if any(o in name for o in ["DIESEL", "PEAKER", "BARGE"]):
            return ClassifiedUnit(
                fuel_tech="oil",
                region=region,
                facility_name=f"Diesel Peaker {resource_id}",
            )

        # Battery Storage (BESS)
        if any(bess in name for bess in ["BESS", "BATTERY", "STORAGE"]):
            return ClassifiedUnit(
                fuel_tech="battery",
                region=region,
                facility_name=f"Battery Storage {resource_id}",
            )

        # Fallback to unclassified - DO NOT fallback to 'oil' or 'distillate'
        return ClassifiedUnit(
            fuel_tech="unclassified",
            region=region,
            facility_name=f"Facility {resource_id}",
        )
