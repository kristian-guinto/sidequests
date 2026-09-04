import json
import re
from pathlib import Path
from typing import Dict, Optional, Any, List
from pipeline.config import DEFAULT_EMISSIONS_FACTOR, RENEWABLE_FUELS

REGION_MAP = {
    "CLUZ": "LUZON",
    "CVIS": "VISAYAS",
    "CMIN": "MINDANAO",
    "LUZON": "LUZON",
    "VISAYAS": "VISAYAS",
    "MINDANAO": "MINDANAO",
}


class GeneratorRegistry:
    def __init__(self, master_file: Optional[Path] = None):
        if master_file is None:
            master_file = (
                Path(__file__).resolve().parent / "data" / "generators_master.json"
            )

        self.registry: Dict[str, Dict[str, Any]] = {}
        self.unclassified: Dict[str, Dict[str, Any]] = {}

        if master_file.exists():
            with open(master_file, "r", encoding="utf-8") as f:
                records = json.load(f)
                for rec in records:
                    self.registry[rec["resource_id"].upper()] = rec

    def classify_heuristic(self, resource_id: str) -> str:
        """Classify fuel technology based on Philippine WESM unit naming patterns."""
        # Strip common prefixes like '01', '02', '03', '11', '12', '13', '14'
        clean_name = re.sub(r"^\d{2}", "", resource_id.upper())
        name = clean_name.upper()

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
            return "solar"

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
            return "wind"

        # 3. Battery Storage
        if any(b in name for b in ["BESS", "BAT", "STOR", "LIMAYBESS", "KABESS"]):
            return "battery"

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
            return "geothermal"

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
            return "hydro"

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
            return "biomass"

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
            return "gas"

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
            return "coal"

        # 9. Oil / Diesel / Distillate / Power Barges
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
            return "oil"

        # Fallback to gas or coal based on size
        return "coal"

    def resolve_generator(
        self, resource_id: str, region_raw: str = ""
    ) -> Dict[str, Any]:
        """Resolves generator details, falling back to heuristics and tracking new plants."""
        res_id = resource_id.strip().upper()
        region = REGION_MAP.get(region_raw.strip().upper(), "LUZON")

        if res_id in self.registry:
            return self.registry[res_id]

        # Apply heuristic
        fuel_tech = self.classify_heuristic(res_id)
        emissions = DEFAULT_EMISSIONS_FACTOR.get(fuel_tech, 0.0)

        info = {
            "resource_id": res_id,
            "facility_name": f"Facility {res_id}",
            "region": region,
            "fuel_tech": fuel_tech,
            "capacity_mw": 0.0,
            "emissions_factor": emissions,
            "is_renewable": fuel_tech in RENEWABLE_FUELS,
            "is_inferred": True,
        }

        # Cache and mark for unclassified tracking
        self.registry[res_id] = info
        self.unclassified[res_id] = info
        return info

    def get_all_facilities(self) -> List[Dict[str, Any]]:
        return list(self.registry.values())
