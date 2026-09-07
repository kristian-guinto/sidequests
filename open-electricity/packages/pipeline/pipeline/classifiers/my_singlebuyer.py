"""Malaysia Single Buyer / Grid System Operator (GSO) facility classifier."""

from pipeline.classifiers.base import BaseFacilityClassifier, ClassifiedUnit

REGION_MAP = {
    "PEN": "PENINSULAR",
    "PENINSULAR": "PENINSULAR",
    "SBH": "SABAH",
    "SABAH": "SABAH",
    "SWK": "SARAWAK",
    "SARAWAK": "SARAWAK",
}


class MalaysiaFacilityClassifier(BaseFacilityClassifier):
    """Classifies generator units for Malaysia Single Buyer across Peninsular, Sabah, and Sarawak."""

    def classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit:
        name = resource_id.upper().strip()
        region = REGION_MAP.get(raw_region.strip().upper(), "PENINSULAR")

        # Solar (Large Scale Solar / LSS)
        if any(s in name for s in ["SOLAR", "LSS", "MARANG", "KUALA_LANGAT", "PV"]):
            return ClassifiedUnit(
                fuel_tech="solar",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Hydro (Bakun, Murum, Kenyir, etc.)
        if any(h in name for h in ["BAKUN", "MURUM", "KENYIR", "HYDRO", "DAM"]):
            # Bakun & Murum are in Sarawak
            h_region = "SARAWAK" if ("BAKUN" in name or "MURUM" in name) else region
            return ClassifiedUnit(
                fuel_tech="hydro",
                region=h_region,
                facility_name=f"Facility {resource_id}",
            )

        # Coal (Jimah East, Manjung, Tanjung Bin)
        if any(c in name for c in ["COAL", "JIMAH", "MANJUNG", "TANJUNG_BIN"]):
            return ClassifiedUnit(
                fuel_tech="coal", region=region, facility_name=f"Facility {resource_id}"
            )

        # Gas (Edra Melaka CCGT, Sultan Ismail Paka, etc.)
        if any(
            g in name
            for g in ["GAS", "CCGT", "EDRA", "SULTAN_ISMAIL", "PAKA", "MELAKA"]
        ):
            return ClassifiedUnit(
                fuel_tech="gas", region=region, facility_name=f"Facility {resource_id}"
            )

        # Biomass
        if any(b in name for b in ["BIOMASS", "BIO", "PALM"]):
            return ClassifiedUnit(
                fuel_tech="biomass",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Distillate / Oil
        if any(o in name for o in ["DIESEL", "OIL", "DISTILLATE"]):
            return ClassifiedUnit(
                fuel_tech="oil", region=region, facility_name=f"Facility {resource_id}"
            )

        return ClassifiedUnit(
            fuel_tech="unclassified",
            region=region,
            facility_name=f"Facility {resource_id}",
        )
