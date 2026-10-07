"""Facility registry and entity resolution for power generation facilities across countries."""

from typing import Dict, Optional, Any, List
from pipeline.config import DEFAULT_EMISSIONS_FACTOR, RENEWABLE_FUELS
from pipeline.models import FacilityRecord
from pipeline.classifiers import BaseFacilityClassifier, get_classifier_for_country


class FacilityRegistry:
    """
    Resolves power generation units from the database facilities table
    and delegates unrecognized units to country-specific classifiers with strict 'unclassified' tagging.
    """

    def __init__(
        self,
        country_code: str = "PH",
        conn: Optional[Any] = None,
        classifier: Optional[BaseFacilityClassifier] = None,
    ):
        self.country_code = country_code.upper()
        self.classifier = classifier or get_classifier_for_country(self.country_code)
        self.registry: Dict[str, Dict[str, Any]] = {}
        self.unclassified: Dict[str, Dict[str, Any]] = {}

        if conn is not None:
            self.load_from_database(conn)

    def load_from_database(self, conn: Any) -> None:
        """Loads registered facilities from the facilities table in DuckDB."""
        try:
            rows = conn.execute(
                """
                SELECT country_code, resource_id, facility_name, region,
                       fuel_tech, capacity_mw, is_renewable, emissions_factor, status
                FROM facilities
                WHERE country_code = ?
                """,
                [self.country_code],
            ).fetchall()

            for r in rows:
                self.registry[r[1].upper()] = {
                    "country_code": r[0],
                    "resource_id": r[1].upper(),
                    "facility_name": r[2],
                    "region": r[3],
                    "fuel_tech": r[4],
                    "capacity_mw": float(r[5] or 0.0),
                    "is_renewable": bool(r[6]),
                    "emissions_factor": float(r[7] or 0.0),
                    "status": r[8],
                }
        except Exception as e:
            print(f"[FacilityRegistry] Note: Could not query facilities table: {e}")

    def register_facility(self, facility: FacilityRecord) -> None:
        """Adds or updates a facility record in the in-memory registry cache."""
        self.registry[facility.resource_id.upper()] = {
            "country_code": facility.country_code,
            "resource_id": facility.resource_id.upper(),
            "facility_name": facility.facility_name,
            "region": facility.region,
            "fuel_tech": facility.fuel_tech,
            "capacity_mw": facility.capacity_mw,
            "is_renewable": facility.is_renewable,
            "emissions_factor": facility.emissions_factor,
            "status": facility.status,
        }

    def resolve(self, resource_id: str, raw_region: str = "") -> FacilityRecord:
        """Resolves generator details, returning a FacilityRecord dataclass."""
        info = self.resolve_generator(resource_id, raw_region)
        return FacilityRecord(
            country_code=info.get("country_code", self.country_code),
            resource_id=info["resource_id"],
            facility_name=info["facility_name"],
            region=info["region"],
            fuel_tech=info["fuel_tech"],
            capacity_mw=float(info.get("capacity_mw", 0.0) or 0.0),
            is_renewable=bool(info.get("is_renewable", False)),
            emissions_factor=float(info.get("emissions_factor", 0.0) or 0.0),
            status=info.get("status", "ACTIVE"),
        )

    def resolve_generator(
        self, resource_id: str, region_raw: str = ""
    ) -> Dict[str, Any]:
        """Resolves generator details as a dict, delegating to the country-specific classifier if missing."""
        res_id = resource_id.strip().upper()

        if res_id in self.registry:
            return self.registry[res_id]

        # Delegate to country-specific classifier
        unit = self.classifier.classify(res_id, region_raw)
        fuel_tech = unit.fuel_tech
        region = unit.region
        emissions = DEFAULT_EMISSIONS_FACTOR.get(fuel_tech, 0.0)

        info = {
            "country_code": self.country_code,
            "resource_id": res_id,
            "facility_name": unit.facility_name,
            "region": region,
            "fuel_tech": fuel_tech,
            "capacity_mw": 0.0,
            "emissions_factor": emissions,
            "is_renewable": fuel_tech in RENEWABLE_FUELS,
            "status": "ACTIVE" if fuel_tech != "unclassified" else "UNCLASSIFIED",
            "is_inferred": True,
        }

        self.registry[res_id] = info
        if fuel_tech == "unclassified":
            self.unclassified[res_id] = info

        return info

    def get_all_facilities(self) -> List[FacilityRecord]:
        """Returns all registered facilities as FacilityRecord dataclasses."""
        records = []
        for r in self.registry.values():
            records.append(
                FacilityRecord(
                    country_code=r.get("country_code", self.country_code),
                    resource_id=r["resource_id"],
                    facility_name=r["facility_name"],
                    region=r["region"],
                    fuel_tech=r["fuel_tech"],
                    capacity_mw=float(r.get("capacity_mw", 0.0) or 0.0),
                    is_renewable=bool(r.get("is_renewable", False)),
                    emissions_factor=float(r.get("emissions_factor", 0.0) or 0.0),
                    status=r.get("status", "ACTIVE"),
                )
            )
        return records
