"""
Ducklembic — Lightweight migrations, sync, and connection management for DuckDB + MotherDuck.
"""

from ducklembic.connection import DuckDB
from ducklembic.migrator import (
    Migrator,
    MigrationRecord,
    MigrationFile,
    MigrationStatus,
    compute_checksum,
)
from ducklembic.sync import (
    Sync,
    SyncReport,
    TableSyncResult,
)

__version__ = "0.1.0"
__all__ = [
    "DuckDB",
    "Migrator",
    "MigrationRecord",
    "MigrationFile",
    "MigrationStatus",
    "compute_checksum",
    "Sync",
    "SyncReport",
    "TableSyncResult",
]
