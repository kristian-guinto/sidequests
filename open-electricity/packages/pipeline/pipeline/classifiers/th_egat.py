"""Thailand EGAT / SO Thailand facility classifier."""

from pipeline.classifiers.base import BaseFacilityClassifier, ClassifiedUnit

REGION_MAP = {
    "CENTRAL": "CENTRAL",
    "CEN": "CENTRAL",
    "BKK": "CENTRAL",
    "METRO": "CENTRAL",
    "NORTH": "NORTH",
    "NTH": "NORTH",
    "NORTHEAST": "NORTHEAST",
    "NE": "NORTHEAST",
    "ISAN": "NORTHEAST",
    "SOUTH": "SOUTH",
    "STH": "SOUTH",
    "ALL": "THAILAND",
    "THAILAND": "THAILAND",
}


class ThailandFacilityClassifier(BaseFacilityClassifier):
    """Classifies generator units for Thailand EGAT across Central, North, Northeast, and South grids."""

    def classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit:
        name = resource_id.upper().strip()
        region = REGION_MAP.get(raw_region.strip().upper(), "THAILAND")

        # Solar (Floating Solar, Ground-mounted PV, Rooftop)
        if any(
            s in name
            for s in [
                "SOLAR",
                "PV",
                "SUNNY",
                "SIRINDHORN_SOLAR",
                "UBONRATANA_SOLAR",
                "LOPBURI",
            ]
        ):
            reg = (
                "NORTHEAST"
                if any(k in name for k in ["KORAT", "SIRINDHORN", "UBONRATANA", "SPCG"])
                else region
            )
            return ClassifiedUnit(
                fuel_tech="solar",
                region=reg,
                facility_name=f"Facility {resource_id}",
            )

        # Wind
        if any(
            w in name for w in ["WIND", "HUAY_BONG", "KHAO_KHO", "THEPPHARAK", "WINDE"]
        ):
            reg = (
                "NORTH"
                if "KHAO_KHO" in name
                else "NORTHEAST"
                if "HUAY_BONG" in name
                else region
            )
            return ClassifiedUnit(
                fuel_tech="wind",
                region=reg,
                facility_name=f"Facility {resource_id}",
            )

        # Hydro (Dams & Pumped Storage)
        if any(
            h in name
            for h in [
                "HYDRO",
                "DAM",
                "BHUMIBOL",
                "SIRIKIT",
                "SRINAGARIND",
                "LAM_TAKHONG",
                "RAJJAPRABHA",
                "KWAE_NOI",
                "VAJIRALONGKORN",
                "XAYABURI",
                "NAM_THEUN",
            ]
        ):
            if "BHUMIBOL" in name or "SIRIKIT" in name:
                reg = "NORTH"
            elif "LAM_TAKHONG" in name:
                reg = "NORTHEAST"
            elif "RAJJAPRABHA" in name:
                reg = "SOUTH"
            elif "SRINAGARIND" in name or "VAJIRALONGKORN" in name:
                reg = "CENTRAL"
            else:
                reg = region
            return ClassifiedUnit(
                fuel_tech="hydro",
                region=reg,
                facility_name=f"Facility {resource_id}",
            )

        # Coal / Lignite (Mae Moh, BLCP, Gheco-One, Hongsa)
        if any(
            c in name for c in ["COAL", "LIGNITE", "MAE_MOH", "BLCP", "GHECO", "HONGSA"]
        ):
            reg = (
                "NORTH"
                if "MAE_MOH" in name
                else "CENTRAL"
                if ("BLCP" in name or "GHECO" in name)
                else region
            )
            return ClassifiedUnit(
                fuel_tech="coal",
                region=reg,
                facility_name=f"Facility {resource_id}",
            )

        # Gas (CCGT & Thermal)
        if any(
            g in name
            for g in [
                "GAS",
                "CCGT",
                "BANG_PAKONG",
                "WANG_NOI",
                "SOUTH_BANGKOK",
                "CHANA",
                "RATCHABURI",
                "GULF",
                "GLOW",
                "TRI_ENERGY",
                "HIN_KONG",
            ]
        ):
            reg = "SOUTH" if "CHANA" in name else "CENTRAL"
            return ClassifiedUnit(
                fuel_tech="gas",
                region=reg,
                facility_name=f"Facility {resource_id}",
            )

        # Biomass / Biogas
        if any(
            b in name for b in ["BIOMASS", "BIO", "BAGASSE", "DAN_CHANG", "DOUBLE_A"]
        ):
            return ClassifiedUnit(
                fuel_tech="biomass",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Peaking Oil / Diesel
        if any(o in name for o in ["DIESEL", "OIL", "DISTILLATE"]):
            return ClassifiedUnit(
                fuel_tech="oil",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # Battery Storage (BESS)
        if any(bt in name for bt in ["BESS", "BATTERY", "STORAGE"]):
            return ClassifiedUnit(
                fuel_tech="battery",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        return ClassifiedUnit(
            fuel_tech="unclassified",
            region=region,
            facility_name=f"Facility {resource_id}",
        )
