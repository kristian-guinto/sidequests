import os
from pathlib import Path

# Load environment variables from .env if present
BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
DB_MODE = os.getenv("DB_MODE", "auto")  # "supabase", "sqlite", or "auto"
SQLITE_DB_PATH = BASE_DIR / "open_nem_ph.db"

# IEMOP Constants
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
