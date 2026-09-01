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
        name = resource_id.upper()

        # Solar patterns
        if "SOL" in name or "PV" in name or "SUN" in name or "CURIMAO" in name:
            return "solar"

        # Wind patterns
        if (
            "WIND" in name
            or "WND" in name
            or "BURGOS" in name
            or "CAPAR" in name
            or "PILA" in name
        ):
            return "wind"

        # Battery storage
        if "BESS" in name or "BAT" in name or "STOR" in name:
            return "battery"

        # Geothermal
        if any(
            geo in name
            for geo in [
                "GEO",
                "TIWI",
                "MAKBN",
                "BACMAN",
                "PALPIN",
                "TONGO",
                "MTAPO",
                "MAHAN",
                "NASULO",
            ]
        ):
            return "geothermal"

        # Hydro
        if any(
            h in name
            for h in [
                "HYD",
                "HEP",
                "AMBUK",
                "BINGA",
                "ANGAT",
                "MAGAT",
                "CASECN",
                "PANTAB",
                "PULANG",
                "AGUS",
                "BAKUN",
                "CALIR",
            ]
        ):
            return "hydro"

        # Biomass
        if any(
            b in name
            for b in ["BIO", "SANCRS", "VICTOR", "ROXAS", "CASA", "SCBI", "HPCO"]
        ):
            return "biomass"

        # Natural gas CCGT
        if any(
            g in name
            for g in ["GAS", "CCGT", "STARITA", "SANLOR", "ILIJAN", "SANGAB", "AVION"]
        ):
            return "gas"

        # Coal
        if any(
            c in name
            for c in [
                "COAL",
                "CFPP",
                "TPP",
                "SUAL",
                "PAGBIL",
                "CALACA",
                "GNPDING",
                "GNPK",
                "MARIVE",
                "KLEP",
                "TOLEDO",
                "CEDC",
                "PEDC",
                "SMCPC",
                "ANDA",
            ]
        ):
            return "coal"

        # Oil / Diesel / Bunker
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
            ]
        ):
            return "oil"

        # Default fallback to other thermal (oil)
        return "oil"

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
