from __future__ import annotations

import argparse
import os
import shutil
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import plotly.express as px
import umap
from plotly.graph_objects import Figure
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler

from nem_battery.battery import KNOWN_BATTERIES
from nem_battery.pipeline import _BUILTIN_TARGETS, load_targets

EPSILON = 1e-3
INTERVAL_HOURS = 5.0 / 60.0
INTERVALS_PER_TRADING_DAY = 288

FCAS_COLUMNS = [
    "raise6sec",
    "raise60sec",
    "raise5min",
    "raisereg",
    "lower6sec",
    "lower60sec",
    "lower5min",
    "lowerreg",
]

PRICE_COLUMNS = ["rrp"]
MW_COLUMNS = ["discharge_mw", "charge_mw"]
FEATURE_COLUMNS = [
    "fcas_revenue_share",
    "reg_vs_contingency_ratio",
    "raise_vs_lower_bias",
    "revenue_diversity_index",
    "co_optimization_frequency",
    "revenue_per_mw",
    "daily_cycle_count",
    "utilization_factor",
    "charge_discharge_ratio",
    "discharge_peak_intensity",
    "resting_time_avg",
    "energy_price_correlation",
    "negative_price_capture",
    "discharge_strike_price",
    "charge_strike_price",
    "discharge_price_premium",
    "volatility_capture_rate",
    "evening_peak_weight",
    "morning_peak_weight",
    "solar_soak_charge_weight",
    "overnight_charge_weight",
    "price_response_speed",
]


@dataclass(slots=True)
class StrategyArtifacts:
    features: pd.DataFrame
    embedding_2d: pd.DataFrame
    embedding_3d: pd.DataFrame
    cluster_summary: pd.DataFrame


def _cluster_points(
    embedding_2d: np.ndarray,
    clusterer: str,
    n_clusters: int,
    dbscan_eps: float,
    dbscan_min_samples: int,
    random_state: int,
) -> np.ndarray:
    if clusterer == "kmeans":
        model = KMeans(n_clusters=n_clusters, random_state=random_state, n_init="auto")
        return model.fit_predict(embedding_2d)
    if clusterer == "dbscan":
        model = DBSCAN(eps=dbscan_eps, min_samples=dbscan_min_samples)
        return model.fit_predict(embedding_2d)
    raise ValueError(f"Unsupported clusterer '{clusterer}'.")


def trading_day_for_timestamp(timestamp: pd.Timestamp) -> pd.Timestamp:
    return (timestamp - pd.Timedelta(hours=4)).normalize()


def _safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    if abs(denominator) <= EPSILON:
        return default
    return float(numerator / denominator)


def _shannon_entropy(values: Sequence[float]) -> float:
    arr = np.asarray(values, dtype=float)
    arr = np.clip(arr, a_min=0.0, a_max=None)
    total = float(arr.sum())
    if total <= 0.0:
        return 0.0
    probs = arr[arr > 0.0] / total
    return float(-(probs * np.log(probs)).sum())


def _weighted_average(values: np.ndarray, weights: np.ndarray) -> float:
    total_weight = float(weights.sum())
    if total_weight <= 0.0:
        return 0.0
    return float(np.average(values, weights=weights))


def _resting_time_avg(states: np.ndarray) -> float:
    waits: list[float] = []
    index = 0
    while index < len(states):
        if states[index] != 1:
            index += 1
            continue
        while index < len(states) and states[index] == 1:
            index += 1
        rest_intervals = 0
        while index < len(states) and states[index] == 0:
            rest_intervals += 1
            index += 1
        if index < len(states) and states[index] == -1:
            waits.append(float(rest_intervals))
            while index < len(states) and states[index] == -1:
                index += 1
    if not waits:
        return 0.0
    return float(np.mean(waits))


def _time_window_mask(times: pd.Series, start_hour: int, end_hour: int) -> pd.Series:
    hours = times.dt.hour + (times.dt.minute / 60.0)
    return (hours >= start_hour) & (hours < end_hour)


def _resolve_target_url(target: str) -> str:
    targets = load_targets()
    if target in targets:
        url = targets[target]
    elif target in _BUILTIN_TARGETS:
        url = _BUILTIN_TARGETS[target]
    else:
        known = sorted(set(targets) | set(_BUILTIN_TARGETS))
        known_targets = ", ".join(f"'{name}'" for name in known) or "none configured"
        raise ValueError(f"Unknown target '{target}'. Targets in pyproject.toml: {known_targets}")

    if url.startswith("md:") and "motherduck_token" not in url:
        token = os.environ.get("MOTHERDUCK_TOKEN")
        if token:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}motherduck_token={token}"
    return url


def load_interval_data(
    target: str = "local",
    battery_keys: Sequence[str] | None = None,
) -> pd.DataFrame:
    query = """
        SELECT
            settlement_date,
            battery_key,
            battery_name,
            region,
            discharge_mw,
            charge_mw,
            rrp,
            energy_revenue,
            energy_cost,
            total_fcas,
            net,
            raise6sec,
            raise60sec,
            raise5min,
            raisereg,
            lower6sec,
            lower60sec,
            lower5min,
            lowerreg
        FROM battery_revenue_interval
    """
    params: list[str] = []
    if battery_keys:
        placeholders = ", ".join(["?"] * len(battery_keys))
        query += f" WHERE battery_key IN ({placeholders})"
        params.extend(battery_keys)
    query += " ORDER BY settlement_date, battery_key"

    url = _resolve_target_url(target)
    if url.startswith("md:"):
        connection = duckdb.connect(url)
        try:
            return connection.execute(query, params).fetch_df()
        finally:
            connection.close()

    try:
        connection = duckdb.connect(url, read_only=True)
        try:
            return connection.execute(query, params).fetch_df()
        finally:
            connection.close()
    except duckdb.IOException:
        source = Path(url)
        if not source.exists():
            raise
        with tempfile.TemporaryDirectory(prefix="nem-battery-strategy-") as temp_dir:
            snapshot = Path(temp_dir) / source.name
            shutil.copy2(source, snapshot)
            connection = duckdb.connect(str(snapshot), read_only=True)
            try:
                return connection.execute(query, params).fetch_df()
            finally:
                connection.close()


def prepare_interval_data(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()
    prepared["settlement_date"] = pd.to_datetime(prepared["settlement_date"])

    for column in PRICE_COLUMNS:
        prepared[column] = prepared[column].fillna(
            prepared.groupby(["settlement_date", "region"])[column].transform("mean")
        )
        prepared[column] = prepared[column].fillna(
            prepared.groupby("region")[column].transform("mean")
        )
        prepared[column] = prepared[column].fillna(float(prepared[column].mean()))

    for column in MW_COLUMNS + FCAS_COLUMNS + ["energy_revenue", "energy_cost"]:
        prepared[column] = prepared[column].fillna(0.0)

    prepared["total_fcas"] = prepared[FCAS_COLUMNS].sum(axis=1)
    prepared["net"] = prepared["energy_revenue"] - prepared["energy_cost"] + prepared["total_fcas"]
    prepared["energy_mw"] = prepared["discharge_mw"] - prepared["charge_mw"]
    prepared["trading_day"] = prepared["settlement_date"].map(trading_day_for_timestamp)

    counts = prepared.groupby(["battery_key", "trading_day"]).size()
    keep_days = counts[counts == INTERVALS_PER_TRADING_DAY].index
    prepared = prepared.set_index(["battery_key", "trading_day"]).loc[keep_days].reset_index()
    return prepared.sort_values(["battery_key", "trading_day", "settlement_date"]).reset_index(
        drop=True
    )


def _opportunity_capture(
    rrp: np.ndarray,
    discharge: np.ndarray,
    charge: np.ndarray,
    actual_energy_revenue: float,
    actual_energy_cost: float,
) -> float:
    """Fraction of theoretical maximum energy net actually captured.

    Computes the best possible energy net if the actual dispatch volumes were
    re-timed to optimal price moments: highest discharge MWs paired with
    highest RRPs, highest charge MWs paired with lowest (most negative) RRPs.
    Result is clamped to [0, 1].
    """
    dis_mws = np.sort(discharge[discharge > 0.0])[::-1]
    chg_mws = np.sort(charge[charge > 0.0])[::-1]
    n_dis = len(dis_mws)
    n_chg = len(chg_mws)
    if n_dis == 0 and n_chg == 0:
        return 0.0
    top_rrp = np.sort(rrp)[::-1]
    bot_rrp = np.sort(rrp)
    opt_dis = float(np.dot(dis_mws, top_rrp[:n_dis])) * INTERVAL_HOURS if n_dis > 0 else 0.0
    opt_chg = float(np.dot(chg_mws, bot_rrp[:n_chg])) * INTERVAL_HOURS if n_chg > 0 else 0.0
    theoretical_max = opt_dis - opt_chg
    if theoretical_max <= EPSILON:
        return 0.0
    actual_energy_net = actual_energy_revenue - actual_energy_cost
    return float(np.clip(actual_energy_net / theoretical_max, 0.0, 1.0))


def _price_response_speed(
    rrp: np.ndarray,
    discharge: np.ndarray,
    charge: np.ndarray,
    max_lag: int = 3,
) -> float:
    """Magnitude-weighted speed of battery response to significant price moves.

    For each interval in the top-quartile of |Δrrp|, find the lag (0..max_lag)
    to the battery's first matching dispatch: discharge after an upward spike,
    charge after a downward crash. Unmatched events score lag = max_lag + 1.

    Returns a value in (0, 1]: 1.0 = always instant, ~0.2 = always misses.
    """
    delta_rrp = np.abs(np.diff(rrp, prepend=rrp[0] if len(rrp) else 0.0))
    if len(delta_rrp) == 0 or delta_rrp.max() <= 0.0:
        return 0.0

    threshold = np.percentile(delta_rrp, 75)
    spike_indices = np.where(delta_rrp >= threshold)[0]
    if len(spike_indices) == 0:
        return 0.0

    # For positive Δrrp expect discharge; for negative Δrrp expect charge.
    rrp_diff = np.diff(rrp, prepend=rrp[0] if len(rrp) else 0.0)
    weights: list[float] = []
    scores: list[float] = []
    for t in spike_indices:
        mag = float(delta_rrp[t])
        expect_discharge = rrp_diff[t] > 0.0
        found_lag = max_lag + 1
        for lag in range(max_lag + 1):
            idx = t + lag
            if idx >= len(rrp):
                break
            if expect_discharge and discharge[idx] > 0.0:
                found_lag = lag
                break
            if not expect_discharge and charge[idx] > 0.0:
                found_lag = lag
                break
        weights.append(mag)
        scores.append(1.0 / (1.0 + found_lag))

    return float(np.average(scores, weights=weights)) if weights else 0.0


def _day_feature_row(
    battery_key: str,
    trading_day: pd.Timestamp,
    group: pd.DataFrame,
) -> dict[str, float | str | pd.Timestamp]:
    day = group.sort_values("settlement_date").reset_index(drop=True)
    battery_name = str(day["battery_name"].iat[0])
    region = str(day["region"].iat[0])

    discharge = day["discharge_mw"].to_numpy(dtype=float)
    charge = day["charge_mw"].to_numpy(dtype=float)
    energy_mw = day["energy_mw"].to_numpy(dtype=float)
    rrp = day["rrp"].to_numpy(dtype=float)
    total_fcas_interval = day["total_fcas"].to_numpy(dtype=float)
    interval_net = day["net"].to_numpy(dtype=float)
    times = day["settlement_date"]

    actual_energy_revenue = float(day["energy_revenue"].sum())
    actual_energy_cost = float(day["energy_cost"].sum())
    energy_value = abs(actual_energy_revenue - actual_energy_cost)
    total_fcas = float(day["total_fcas"].sum())
    day_net = float(day["net"].sum())
    raise_contingency = float(day[["raise6sec", "raise60sec", "raise5min"]].sum().sum())
    lower_contingency = float(day[["lower6sec", "lower60sec", "lower5min"]].sum().sum())
    raise_reg = float(day["raisereg"].sum())
    lower_reg = float(day["lowerreg"].sum())
    total_discharge = float(discharge.sum())
    total_charge = float(charge.sum())
    max_discharge = float(discharge.max())

    battery = KNOWN_BATTERIES.get(battery_key)
    capacity_mwh = battery.mwh_capacity if battery and battery.mwh_capacity else None
    cycle_denominator = capacity_mwh if capacity_mwh else max(max_discharge, 1.0)

    positive_discharge = discharge[discharge > 0.0]
    discharge_rrp = rrp[discharge > 0.0]
    charge_rrp = rrp[charge > 0.0]
    day_mean_rrp = float(np.mean(rrp)) if len(rrp) else 0.0

    state = np.where(charge > 0.0, 1, np.where(discharge > 0.0, -1, 0))
    volatility = np.abs(np.diff(rrp, prepend=rrp[0] if len(rrp) else 0.0))
    top_count = max(1, int(np.ceil(len(volatility) * 0.05))) if len(volatility) else 0
    top_indices = np.argsort(volatility)[-top_count:] if top_count else np.array([], dtype=int)
    positive_interval_net = np.clip(interval_net, a_min=0.0, a_max=None)

    evening_mask = _time_window_mask(times, 17, 21)
    morning_mask = _time_window_mask(times, 6, 9)
    solar_mask = _time_window_mask(times, 10, 15)
    overnight_mask = _time_window_mask(times, 0, 4)

    streams = [
        energy_value,
        abs(raise_reg),
        abs(lower_reg),
        abs(raise_contingency),
        abs(lower_contingency),
    ]

    discharge_weighted_rrp = _weighted_average(discharge_rrp, positive_discharge)
    correlation = 0.0
    if np.std(discharge) > 0.0 and np.std(rrp) > 0.0:
        correlation = float(np.corrcoef(discharge, rrp)[0, 1])

    negative_price_mask = rrp < 0.0
    negative_price_capture = (
        float(charge[negative_price_mask].mean()) if negative_price_mask.any() else 0.0
    )

    return {
        "battery_key": battery_key,
        "battery_name": battery_name,
        "region": region,
        "trading_day": trading_day,
        "fcas_revenue_share": _safe_divide(total_fcas, energy_value + total_fcas),
        "reg_vs_contingency_ratio": _safe_divide(
            raise_reg + lower_reg,
            total_fcas,
        ),
        "raise_vs_lower_bias": _safe_divide(
            raise_contingency + raise_reg,
            total_fcas,
        ),
        "revenue_diversity_index": _shannon_entropy(streams),
        "co_optimization_frequency": float(
            np.mean((np.abs(energy_mw) > 0.0) & (total_fcas_interval > 0.0))
        ),
        "revenue_per_mw": _safe_divide(day_net, max_discharge),
        "daily_cycle_count": _safe_divide(total_discharge * INTERVAL_HOURS, cycle_denominator),
        "utilization_factor": float(np.mean((discharge > 0.0) | (charge > 0.0))),
        "charge_discharge_ratio": _safe_divide(total_discharge, total_charge + EPSILON),
        "discharge_peak_intensity": _safe_divide(
            max_discharge,
            float(positive_discharge.mean()) if len(positive_discharge) else 0.0,
        ),
        "resting_time_avg": _resting_time_avg(state),
        "energy_price_correlation": correlation,
        "negative_price_capture": negative_price_capture,
        "discharge_strike_price": (
            float(np.percentile(discharge_rrp, 10)) if len(discharge_rrp) else 0.0
        ),
        "charge_strike_price": float(np.percentile(charge_rrp, 90)) if len(charge_rrp) else 0.0,
        "discharge_price_premium": _safe_divide(discharge_weighted_rrp, day_mean_rrp),
        "volatility_capture_rate": _safe_divide(
            float(positive_interval_net[top_indices].sum()) if len(top_indices) else 0.0,
            float(positive_interval_net.sum()),
        ),
        "evening_peak_weight": _safe_divide(
            float(day.loc[evening_mask, "discharge_mw"].sum()),
            total_discharge,
        ),
        "morning_peak_weight": _safe_divide(
            float(day.loc[morning_mask, "discharge_mw"].sum()),
            total_discharge,
        ),
        "solar_soak_charge_weight": _safe_divide(
            float(day.loc[solar_mask, "charge_mw"].sum()),
            total_charge,
        ),
        "overnight_charge_weight": _safe_divide(
            float(day.loc[overnight_mask, "charge_mw"].sum()),
            total_charge,
        ),
        "price_response_speed": _price_response_speed(rrp, discharge, charge),
        "net": day_net,
        "opportunity_capture": _opportunity_capture(
            rrp, discharge, charge, actual_energy_revenue, actual_energy_cost
        ),
    }


def build_feature_frame(df: pd.DataFrame) -> pd.DataFrame:
    rows = [
        _day_feature_row(battery_key, trading_day, group)
        for (battery_key, trading_day), group in df.groupby(
            ["battery_key", "trading_day"],
            sort=True,
        )
    ]
    features = pd.DataFrame(rows)
    for column in FEATURE_COLUMNS:
        features[column] = features[column].astype(float)
    return features


def train_strategy_model(
    features: pd.DataFrame,
    n_neighbors_2d: int = 30,
    n_neighbors_3d: int = 50,
    clusterer: str = "dbscan",
    n_clusters: int = 6,
    dbscan_eps: float = 0.6,
    dbscan_min_samples: int = 10,
    random_state: int = 42,
) -> StrategyArtifacts:
    scaler = StandardScaler()
    matrix = scaler.fit_transform(features[FEATURE_COLUMNS])

    embedding_2d = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors_2d,
        min_dist=0.05,
        metric="euclidean",
        random_state=random_state,
    ).fit_transform(matrix)
    labels = _cluster_points(
        embedding_2d=embedding_2d,
        clusterer=clusterer,
        n_clusters=n_clusters,
        dbscan_eps=dbscan_eps,
        dbscan_min_samples=dbscan_min_samples,
        random_state=random_state,
    )

    embedding_3d = umap.UMAP(
        n_components=3,
        n_neighbors=n_neighbors_3d,
        min_dist=0.05,
        metric="euclidean",
        random_state=random_state,
    ).fit_transform(matrix)

    meta_columns = ["battery_key", "battery_name", "region", "trading_day"]
    viz2 = features[meta_columns].copy()
    viz2["x"] = embedding_2d[:, 0]
    viz2["y"] = embedding_2d[:, 1]
    viz2["cluster"] = labels.astype(str)
    viz2["net_revenue"] = features["net"]
    viz2["opportunity_capture"] = features["opportunity_capture"]

    viz3 = features[meta_columns].copy()
    viz3["x"] = embedding_3d[:, 0]
    viz3["y"] = embedding_3d[:, 1]
    viz3["z"] = embedding_3d[:, 2]
    viz3["cluster"] = labels.astype(str)
    viz3["net_revenue"] = features["net"]
    viz3["opportunity_capture"] = features["opportunity_capture"]

    cluster_summary = (
        features.assign(cluster=labels.astype(str))
        .groupby("cluster")[FEATURE_COLUMNS]
        .mean()
        .reset_index()
        .sort_values("cluster")
    )

    return StrategyArtifacts(
        features=features.assign(cluster=labels.astype(str)),
        embedding_2d=viz2,
        embedding_3d=viz3,
        cluster_summary=cluster_summary,
    )


def build_visualisations(artifacts: StrategyArtifacts) -> tuple[Figure, Figure]:
    figure_2d = px.scatter(
        artifacts.embedding_2d,
        x="x",
        y="y",
        color="cluster",
        symbol="battery_key",
        hover_data=["battery_name", "region", "trading_day"],
        title="Battery-day strategy map (2D UMAP + HDBSCAN)",
    )
    figure_3d = px.scatter_3d(
        artifacts.embedding_3d,
        x="x",
        y="y",
        z="z",
        color="cluster",
        symbol="battery_key",
        hover_data=["battery_name", "region", "trading_day"],
        title="Battery-day strategy map (3D UMAP)",
    )
    return figure_2d, figure_3d


_CREATE_EMBEDDING_TABLE = """
    CREATE TABLE IF NOT EXISTS battery_strategy_embedding (
        trading_day   DATE    NOT NULL,
        battery_key   VARCHAR NOT NULL,
        battery_name  VARCHAR,
        region        VARCHAR,
        x             DOUBLE,
        y             DOUBLE,
        z             DOUBLE,
        cluster_id    INTEGER,
        daily_revenue DOUBLE,
        PRIMARY KEY (trading_day, battery_key)
    )
"""

_UPSERT_EMBEDDING = """
    INSERT INTO battery_strategy_embedding
        (trading_day, battery_key, battery_name, region, x, y, z, cluster_id, daily_revenue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (trading_day, battery_key) DO UPDATE SET
        battery_name  = EXCLUDED.battery_name,
        region        = EXCLUDED.region,
        x             = EXCLUDED.x,
        y             = EXCLUDED.y,
        z             = EXCLUDED.z,
        cluster_id    = EXCLUDED.cluster_id,
        daily_revenue = EXCLUDED.daily_revenue
"""


def write_embeddings_to_db(artifacts: StrategyArtifacts, target: str = "local") -> int:
    """Upsert 3D embeddings joined with daily revenue into battery_strategy_embedding."""
    viz3 = artifacts.embedding_3d.copy()
    viz3["cluster_id"] = pd.to_numeric(viz3["cluster"], errors="coerce").fillna(-1).astype(int)
    viz3["trading_day_str"] = viz3["trading_day"].dt.strftime("%Y-%m-%d")

    url = _resolve_target_url(target)
    conn = duckdb.connect(url)
    try:
        conn.execute(_CREATE_EMBEDDING_TABLE)

        # Build a lookup of (date_str, battery_key) -> daily net revenue
        rev_rows = conn.execute(
            "SELECT date::VARCHAR AS d, battery_key, net FROM battery_revenue_daily"
        ).fetchall()
        rev_lookup: dict[tuple[str, str], float] = {(r[0], r[1]): r[2] for r in rev_rows}

        rows = list(
            zip(
                viz3["trading_day_str"],
                viz3["battery_key"],
                viz3["battery_name"],
                viz3["region"],
                viz3["x"].astype(float),
                viz3["y"].astype(float),
                viz3["z"].astype(float),
                viz3["cluster_id"].astype(int),
                viz3.apply(
                    lambda r: rev_lookup.get((r["trading_day_str"], r["battery_key"])),  # type: ignore[return-value]
                    axis=1,
                ),
            )
        )
        conn.executemany(_UPSERT_EMBEDDING, rows)
        return len(rows)
    finally:
        conn.close()


def save_outputs(artifacts: StrategyArtifacts, output_dir: str | Path) -> None:
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)

    artifacts.features.to_csv(destination / "strategy_features.csv", index=False)
    artifacts.embedding_2d.to_csv(destination / "strategy_embedding_2d.csv", index=False)
    artifacts.embedding_3d.to_csv(destination / "strategy_embedding_3d.csv", index=False)
    artifacts.cluster_summary.to_csv(destination / "strategy_cluster_summary.csv", index=False)

    figure_2d, figure_3d = build_visualisations(artifacts)
    figure_2d.write_html(destination / "strategy_map_2d.html")
    figure_3d.write_html(destination / "strategy_map_3d.html")


def plot_cluster_battery_count(artifacts: StrategyArtifacts, pct: bool = True) -> None:
    embedding_df = artifacts.embedding_3d

    cluster_battery_counts = embedding_df.pivot_table(
        index="battery_name",
        columns="cluster",
        values="trading_day",
        aggfunc="count",
        fill_value=0,
    ).astype(int)

    if pct:
        cluster_battery_counts = (
            cluster_battery_counts.div(cluster_battery_counts.sum(axis=1), axis=0) * 100
        ).round(2)

    fig = px.imshow(
        cluster_battery_counts,
        text_auto=True,
        labels={"x": "Cluster ID", "y": "Battery", "color": "Day count"},
        color_continuous_scale="Blues",
        aspect="auto",
    )

    title = (
        "Battery Participation by Cluster (Percentage)"
        if pct
        else "Battery Participation by Cluster (Count)"
    )

    fig.update_layout(
        title=title,
        xaxis_tickangle=0,
    )

    fig.show()


def plot_cluster_feature_means(artifacts: StrategyArtifacts) -> None:
    cluster_summary = artifacts.cluster_summary.sort_values("cluster")
    feature_cols = [col for col in FEATURE_COLUMNS if col in cluster_summary.columns]

    cluster_feature_means = cluster_summary.set_index("cluster")[feature_cols]
    relative_values = (cluster_feature_means / (cluster_feature_means.sum(axis=0) + EPSILON)).T
    absolute_values = cluster_feature_means.T

    fig = px.imshow(
        relative_values,
        x=relative_values.columns.astype(str),
        y=relative_values.index,
        labels={"x": "Cluster", "y": "Feature", "color": "Relative Value"},
        color_continuous_scale="Blues",
        aspect="auto",
    )

    fig.update_traces(
        customdata=absolute_values.to_numpy(dtype=float).reshape(*absolute_values.shape, 1),
        hovertemplate=(
            "Feature: %{y}<br>"
            "Cluster: %{x}<br>"
            "Relative Value: %{z:.4f}<br>"
            "Mean Value: %{customdata[0]:.4f}<extra></extra>"
        ),
    )

    fig.update_layout(
        title="Cluster Feature Means (Relative)",
        xaxis_tickangle=0,
    )

    fig.show()


def plot_cluster_revenue(artifacts: StrategyArtifacts) -> None:
    embedding_df = artifacts.embedding_3d
    mwh_capacity_map = {v.name: v.mwh_capacity for k, v in KNOWN_BATTERIES.items()}

    embedding_df["net_revenue_per_mwh"] = embedding_df.apply(
        lambda row: row["net_revenue"] / mwh_capacity_map.get(row["battery_name"], 1), axis=1
    )
    cluster_revenue = embedding_df.groupby("cluster")[["net_revenue", "net_revenue_per_mwh"]].agg(
        ["min", "mean", "max"]
    )

    fig = px.bar(
        cluster_revenue,
        x="cluster",
        y="net_revenue",
        labels={"cluster": "Cluster", "net_revenue": "Average Daily Revenue"},
        title="Average Daily Revenue by Cluster",
        color="net_revenue",
        color_continuous_scale="Blues",
    )

    fig.update_layout(
        xaxis_tickangle=0,
    )

    fig.show()


def plot_opportunity_capture(artifacts: StrategyArtifacts) -> None:
    """2D strategy map coloured by opportunity capture rate.

    Opportunity capture is the fraction of theoretical maximum energy net
    actually achieved (0 = no value captured, 1 = perfect timing).  Unlike
    cluster or net_revenue, this is a normalised efficiency metric that
    compares batteries of different sizes on an equal footing.
    """
    embedding_df = artifacts.embedding_2d.copy()
    fig = px.scatter(
        embedding_df,
        x="x",
        y="y",
        color="opportunity_capture",
        symbol="battery_key",
        hover_data=["battery_name", "region", "trading_day", "net_revenue", "opportunity_capture"],
        color_continuous_scale="RdYlGn",
        range_color=[0.0, 1.0],
        labels={
            "opportunity_capture": "Opportunity Capture",
            "x": "UMAP-1",
            "y": "UMAP-2",
        },
        title="Strategy Map: Opportunity Capture Rate",
    )
    fig.update_layout(coloraxis_colorbar_tickformat=".0%")
    fig.show()


def run_pipeline(
    target: str,
    output_dir: str | Path,
    battery_keys: Sequence[str] | None = None,
    clusterer: str = "dbscan",
    n_clusters: int = 6,
    dbscan_eps: float = 0.6,
    dbscan_min_samples: int = 10,
    write_db: bool = False,
) -> StrategyArtifacts:
    raw = load_interval_data(target=target, battery_keys=battery_keys)
    prepared = prepare_interval_data(raw)
    if prepared.empty:
        raise ValueError(
            "No complete 288-interval trading days were found in battery_revenue_interval."
        )
    features = build_feature_frame(prepared)
    artifacts = train_strategy_model(
        features,
        clusterer=clusterer,
        n_clusters=n_clusters,
        dbscan_eps=dbscan_eps,
        dbscan_min_samples=dbscan_min_samples,
    )
    save_outputs(artifacts, output_dir)
    if write_db:
        write_embeddings_to_db(artifacts, target=target)
    return artifacts


def _build_parser() -> argparse.ArgumentParser:
    known_targets = ", ".join(sorted(set(load_targets()) | set(_BUILTIN_TARGETS)))
    parser = argparse.ArgumentParser(
        description="Engineer battery-day features and build UMAP strategy visualisations."
    )
    parser.add_argument(
        "--target",
        default="local",
        help=(
            "Named database target from pyproject.toml under [tool.nem-battery.targets.*]. "
            f"Known configured targets: {known_targets}."
        ),
    )
    parser.add_argument(
        "--out-dir",
        default="nbs/strategy-map-output",
        help="Directory for engineered features, embeddings, and HTML visualisations.",
    )
    parser.add_argument(
        "--battery",
        dest="battery_keys",
        action="append",
        help="Battery key to include. Repeat the flag to filter to multiple batteries.",
    )
    parser.add_argument(
        "--clusterer",
        choices=["kmeans", "dbscan"],
        default="dbscan",
        help="Clustering algorithm to apply to the 2D UMAP embedding.",
    )
    parser.add_argument(
        "--n-clusters",
        type=int,
        default=6,
        help="Number of clusters for KMeans. Ignored for DBSCAN.",
    )
    parser.add_argument(
        "--dbscan-eps",
        type=float,
        default=0.6,
        help="DBSCAN epsilon radius on the 2D UMAP embedding. Ignored for KMeans.",
    )
    parser.add_argument(
        "--dbscan-min-samples",
        type=int,
        default=10,
        help="DBSCAN min_samples on the 2D UMAP embedding. Ignored for KMeans.",
    )
    parser.add_argument(
        "--write-db",
        action="store_true",
        default=False,
        help=(
            "After computing embeddings, write them to the battery_strategy_embedding "
            "table in the --target database so the web UI can display live results."
        ),
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    artifacts = run_pipeline(
        target=args.target,
        output_dir=args.out_dir,
        battery_keys=args.battery_keys,
        clusterer=args.clusterer,
        n_clusters=args.n_clusters,
        dbscan_eps=args.dbscan_eps,
        dbscan_min_samples=args.dbscan_min_samples,
        write_db=args.write_db,
    )
    print(
        "Built strategy map for "
        f"{len(artifacts.features)} battery-days across "
        f"{artifacts.features['battery_key'].nunique()} batteries."
    )
    print(f"Wrote outputs to {Path(args.out_dir).resolve()}")
    if args.write_db:
        print(f"Wrote embeddings to battery_strategy_embedding (target: {args.target}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
