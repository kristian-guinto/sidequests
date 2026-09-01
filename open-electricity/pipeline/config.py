import os
from pathlib import Path

# Load environment variables from .env if present
BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

MOTHERDUCK_TOKEN = os.getenv("MOTHERDUCK_TOKEN", "")
MOTHERDUCK_DATABASE = os.getenv("MOTHERDUCK_DATABASE", "open_electricity_db")
DB_MODE = os.getenv("DB_MODE", "auto")  # "motherduck", "duckdb", or "auto"
DUCKDB_PATH = BASE_DIR / "open_nem_ph.duckdb"

# Southeast Asia Countries Configuration
COUNTRIES_CONFIG = {
    "PH": {
        "name": "Philippines",
        "currency": "PHP",
        "currency_symbol": "₱",
        "timezone": "Asia/Manila",
        "default_region": "ALL",
        "regions": ["ALL", "LUZON", "VISAYAS", "MINDANAO"],
    },
    "SG": {
        "name": "Singapore",
        "currency": "SGD",
        "currency_symbol": "S$",
        "timezone": "Asia/Singapore",
        "default_region": "SINGAPORE",
        "regions": ["SINGAPORE"],
    },
    "MY": {
        "name": "Malaysia",
        "currency": "MYR",
        "currency_symbol": "RM",
        "timezone": "Asia/Kuala_Lumpur",
        "default_region": "PENINSULAR",
        "regions": ["PENINSULAR", "SABAH", "SARAWAK"],
    },
    "TH": {
        "name": "Thailand",
        "currency": "THB",
        "currency_symbol": "฿",
        "timezone": "Asia/Bangkok",
        "default_region": "THAILAND",
        "regions": ["THAILAND", "CENTRAL", "NORTH", "NORTHEAST", "SOUTH"],
    },
    "VN": {
        "name": "Vietnam",
        "currency": "VND",
        "currency_symbol": "₫",
        "timezone": "Asia/Ho_Chi_Minh",
        "default_region": "VIETNAM",
        "regions": ["VIETNAM", "NORTH", "CENTRAL", "SOUTH"],
    },
}

# IEMOP Constants (Philippines)
IEMOP_AJAX_URL = "https://www.iemop.ph/wp-admin/admin-ajax.php"
POST_ID_RTD_PRICES_SCHEDULES = 5777
POST_ID_RTD_REGIONAL_SUMMARIES = 5760
POST_ID_REGISTERED_CAPACITY = 302634

# Standard Fuel Types matching OpenNEM categories
FUEL_TECH_CATEGORIES = [
    "solar",
    "wind",
    "hydro",
    "geothermal",
    "biomass",
    "gas",
    "coal",
    "oil",
    "battery",
]

RENEWABLE_FUELS = {"solar", "wind", "hydro", "geothermal", "biomass"}

DEFAULT_EMISSIONS_FACTOR = {
    "solar": 0.0,
    "wind": 0.0,
    "hydro": 0.0,
    "geothermal": 0.05,
    "biomass": 0.02,
    "gas": 0.38,
    "coal": 0.90,
    "oil": 0.75,
    "battery": 0.0,
}

TIMEZONE = "Asia/Manila"
