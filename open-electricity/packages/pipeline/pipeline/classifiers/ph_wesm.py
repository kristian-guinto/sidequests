"""Philippines Wholesale Electricity Spot Market (WESM) facility classifier."""

import re
from pipeline.classifiers.base import BaseFacilityClassifier, ClassifiedUnit

REGION_MAP = {
    "CLUZ": "LUZON",
    "CVIS": "VISAYAS",
    "CMIN": "MINDANAO",
    "LUZON": "LUZON",
    "VISAYAS": "VISAYAS",
    "MINDANAO": "MINDANAO",
}


class PhilippinesFacilityClassifier(BaseFacilityClassifier):
    """Classifies generator units based on Philippine WESM / IEMOP naming conventions."""

    def classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit:
        clean_name = re.sub(r"^\d{2}", "", resource_id.upper()).strip()
        name = clean_name.upper()
        region = REGION_MAP.get(raw_region.strip().upper(), "LUZON")

        # 1. Solar patterns
        if any(
            s in name
            for s in [
                "SOL",
                "PV",
                "SUN",
                "CURIMAO",
                "AGROSOL",
                "ARAYSOL",
                "ARESOL",
                "ARMSOL",
                "BALSOL",
                "BARBASOL",
                "BETASOL",
                "CAPRIS",
                "CLBYBNK",
                "GIFT",
                "IASMOD",
                "LIAN",
                "PALAK",
                "TIBAG",
                "UPLAB",
                "BT2020",
                "SUPKOR",
                "NACSUR",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="solar",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # 2. Wind patterns
        if any(
            w in name
            for w in [
                "WIND",
                "WND",
                "BURGOS",
                "CAPAR",
                "PILA",
                "BALWIND",
                "AMPHAW",
                "NABAS",
                "SUWECO",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="wind", region=region, facility_name=f"Facility {resource_id}"
            )

        # 3. Battery Storage
        if any(b in name for b in ["BESS", "BAT", "STOR", "LIMAYBESS", "KABESS"]):
            return ClassifiedUnit(
                fuel_tech="battery",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # 4. Geothermal
        if any(
            geo in name
            for geo in [
                "MKBN",
                "TIWI",
                "BACMAN",
                "PAL1A",
                "PAL2A",
                "PALPIN",
                "TONGO",
                "MTAPO",
                "MAHAN",
                "NASULO",
                "TANAWON",
                "MGI",
                "MGPP",
                "GEO",
                "APEC",
                "ORMAT",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="geothermal",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # 5. Hydro
        if any(
            h in name
            for h in [
                "AMBUK",
                "BINGA",
                "ANGAT",
                "MAGAT",
                "CASECN",
                "PANTAB",
                "PULANG",
                "PULA4",
                "AGUS",
                "BAKUN",
                "BAKSIP",
                "CALIR",
                "BINENG",
                "SIBULAN",
                "ASIGA",
                "TUDAY",
                "MATIBNK",
                "NMHC",
                "IBULAO",
                "NIABAL",
                "MARIS",
                "SEVILL",
                "LOBOC",
                "INARI",
                "TAFT",
                "AGUA",
                "UTH",
                "BALUG",
                "LWERLAB",
                "EUROH",
                "FGBPC",
                "AMLA",
                "MARBEL",
                "MALADU",
                "MANGIMA",
                "MNCBLG",
                "MANFOR",
                "KEGMAR",
                "KEGTAN",
                "SLANGN",
                "MAJAY",
                "TALOM",
                "LASUER",
                "SABANG",
                "BOTOCA",
                "HYD",
                "HEP",
                "HPP",
                "WATER",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="hydro",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # 6. Biomass / Bioenergy
        if any(
            b in name
            for b in [
                "LAMSAN",
                "PKPSOC",
                "PETRON",
                "BBEC",
                "MNRGY",
                "PKSFRA",
                "SANCRS",
                "VICTOR",
                "ROXAS",
                "CASA",
                "SCBI",
                "HPCO",
                "IBEC",
                "BIO",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="biomass",
                region=region,
                facility_name=f"Facility {resource_id}",
            )

        # 7. Natural Gas CCGT / OCGT
        if any(
            g in name
            for g in [
                "STARITA",
                "SANLOR",
                "ILIJAN",
                "SANGAB",
                "AVION",
                "FGEN",
                "FIRSTGEN",
                "GAS",
                "CCGT",
                "LNG",
                "BATANGAS",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="gas", region=region, facility_name=f"Facility {resource_id}"
            )

        # 8. Coal (Black Coal)
        if any(
            c in name
            for c in [
                "GNPD",
                "GMEC",
                "QPPL",
                "SBPL",
                "MASIN",
                "KPS",
                "SLTEC",
                "SMC",
                "SMCPC",
                "FDC",
                "SARANG",
                "MPGC",
                "KSPC",
                "STEAG",
                "MINBAL",
                "TPC",
                "CEDC",
                "PEDC",
                "CALACA",
                "PAGBIL",
                "SUAL",
                "MARIVE",
                "CFPP",
                "TPP",
                "COAL",
                "ANDA",
                "PCIR",
                "LGPP",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="coal", region=region, facility_name=f"Facility {resource_id}"
            )

        # 9. Oil / Diesel / Distillate (True peakers & power barges only)
        if any(
            o in name
            for o in [
                "DIESEL",
                "DPP",
                "OIL",
                "MALAYA",
                "PB10",
                "BACOLOD",
                "BOHOL",
                "PANAY",
                "SIRA",
                "BAUANG",
                "TM1",
                "TM2",
                "BIDPP",
                "BDPP",
                "CARMENDPP",
                "WMPC",
                "PDPP",
                "CPPC",
                "EAUC",
                "TPLPB4",
                "CENPRI",
                "IDP1",
                "IDP2",
                "NABASDPP",
                "THVI",
                "SPGI",
                "PACERM",
                "MEGC",
                "TIMBA",
                "LKMAINIT",
            ]
        ):
            return ClassifiedUnit(
                fuel_tech="oil", region=region, facility_name=f"Facility {resource_id}"
            )

        # Strict Domain Safety: Return 'unclassified' instead of guessing
        return ClassifiedUnit(
            fuel_tech="unclassified",
            region=region,
            facility_name=f"Facility {resource_id}",
        )
