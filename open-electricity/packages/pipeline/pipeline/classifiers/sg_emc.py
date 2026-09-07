"""Singapore Energy Market Company (EMC) facility classifier."""

from pipeline.classifiers.base import BaseFacilityClassifier, ClassifiedUnit


class SingaporeFacilityClassifier(BaseFacilityClassifier):
    """Classifies generator units and generation assets for Singapore EMC / EMA."""

    def classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit:
        name = resource_id.upper().strip()
        region = "SINGAPORE"

        # Solar assets
        if any(s in name for s in ["SOLAR", "TENGEH", "SOLARNOVA", "PV"]):
            return ClassifiedUnit(
                fuel_tech="solar",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Gas Combined Cycle (CCGT) & Co-generation
        if any(
            g in name
            for g in [
                "TUAS",
                "SENOKO",
                "SERAYA",
                "KEPPEL",
                "SEMBCORP_COGEN",
                "CCGT",
                "GAS",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="gas", region=region, facility_name=f"Facility {resource_id}"
            )

        # Waste to Energy / Biomass
        if any(b in name for b in ["WTE", "TUAS_WTE", "BIOMASS", "WASTE"]):
            return ClassifiedUnit(
                fuel_tech="biomass",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Battery Storage (BESS)
        if any(ess in name for ess in ["ESS", "BATTERY", "BESS", "SEMBCORP_ESS"]):
            return ClassifiedUnit(
                fuel_tech="battery",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Hydro Interconnector Import (LTMS)
        if any(h in name for h in ["LTMS", "HYDRO", "IMPORT"]):
            return ClassifiedUnit(
                fuel_tech="hydro",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        return ClassifiedUnit(
            fuel_tech="unclassified",
            region=region,
            facility_name=f"Facility {resource_id}",
        )
