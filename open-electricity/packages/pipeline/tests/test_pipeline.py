from pipeline.generator_registry import GeneratorRegistry
from pipeline.config import BASE_DIR, DUCKDB_PATH, COUNTRIES_CONFIG


def test_generator_registry_loads():
    registry = GeneratorRegistry()
    facilities = registry.get_all_facilities()
    assert len(facilities) > 0


def test_config_defaults():
    assert BASE_DIR.exists()
    assert "PH" in COUNTRIES_CONFIG
    assert "SG" in COUNTRIES_CONFIG
    assert "MY" in COUNTRIES_CONFIG
