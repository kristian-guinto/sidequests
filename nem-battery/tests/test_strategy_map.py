from __future__ import annotations

from datetime import datetime
from math import isclose

import numpy as np
import pandas as pd

from nem_battery import strategy_map


def test_trading_day_alignment_uses_4am_boundary() -> None:
    before_boundary = pd.Timestamp("2026-03-02 03:55:00")
    after_boundary = pd.Timestamp("2026-03-02 04:05:00")
    # 04:00 on day T+1 is the last interval of trading day T, not the first of T+1.
    last_interval_of_prev_day = pd.Timestamp("2026-03-02 04:00:00")

    assert strategy_map.trading_day_for_timestamp(before_boundary) == pd.Timestamp("2026-03-01")
    assert strategy_map.trading_day_for_timestamp(after_boundary) == pd.Timestamp("2026-03-02")
    assert strategy_map.trading_day_for_timestamp(last_interval_of_prev_day) == pd.Timestamp(
        "2026-03-01"
    )


def test_resting_time_average_counts_idle_intervals_between_charge_and_discharge() -> None:
    states = np.array([1, 1, 0, 0, -1, -1, 0, 1, 0, -1], dtype=int)

    result = strategy_map._resting_time_avg(states)

    assert isclose(result, 1.5)


def test_day_feature_row_computes_temporal_weights_and_cycles() -> None:
    group = pd.DataFrame(
        {
            "settlement_date": pd.to_datetime(
                [
                    datetime(2026, 3, 2, 0, 0),
                    datetime(2026, 3, 2, 6, 0),
                    datetime(2026, 3, 2, 11, 0),
                    datetime(2026, 3, 2, 18, 0),
                ]
            ),
            "battery_name": ["Hornsdale Power Reserve"] * 4,
            "region": ["SA1"] * 4,
            "discharge_mw": [0.0, 30.0, 0.0, 40.0],
            "charge_mw": [10.0, 0.0, 20.0, 0.0],
            "energy_mw": [-10.0, 30.0, -20.0, 40.0],
            "rrp": [-50.0, 100.0, -10.0, 200.0],
            "energy_revenue": [0.0, 250.0, 0.0, 600.0],
            "energy_cost": [-41.6666666667, 0.0, -16.6666666667, 0.0],
            "total_fcas": [5.0, 0.0, 5.0, 10.0],
            "net": [46.6666666667, 250.0, 21.6666666667, 610.0],
            "raise6sec": [1.0, 0.0, 0.0, 2.0],
            "raise60sec": [0.0, 0.0, 0.0, 1.0],
            "raise5min": [0.0, 0.0, 0.0, 1.0],
            "raisereg": [2.0, 0.0, 3.0, 3.0],
            "lower6sec": [0.0, 0.0, 0.0, 1.0],
            "lower60sec": [0.0, 0.0, 0.0, 1.0],
            "lower5min": [0.0, 0.0, 0.0, 0.0],
            "lowerreg": [2.0, 0.0, 2.0, 2.0],
        }
    )

    features = strategy_map._day_feature_row(
        battery_key="hornsdale",
        trading_day=pd.Timestamp("2026-03-02"),
        group=group,
    )

    assert isclose(float(features["morning_peak_weight"]), 30.0 / 70.0)
    assert isclose(float(features["evening_peak_weight"]), 40.0 / 70.0)
    assert isclose(float(features["solar_soak_charge_weight"]), 20.0 / 30.0)
    assert isclose(float(features["overnight_charge_weight"]), 10.0 / 30.0)
    assert isclose(float(features["co_optimization_frequency"]), 0.75)
    assert isclose(
        float(features["daily_cycle_count"]),
        (70.0 * strategy_map.INTERVAL_HOURS) / 193.5,
    )


def test_cluster_points_supports_kmeans() -> None:
    embedding = np.array(
        [
            [0.0, 0.0],
            [0.1, 0.0],
            [10.0, 10.0],
            [10.1, 10.0],
        ]
    )

    labels = strategy_map._cluster_points(
        embedding_2d=embedding,
        clusterer="kmeans",
        n_clusters=2,
        dbscan_eps=0.5,
        dbscan_min_samples=2,
        random_state=42,
    )

    assert len(np.unique(labels)) == 2


def test_cluster_points_supports_dbscan_noise_labelling() -> None:
    embedding = np.array(
        [
            [0.0, 0.0],
            [0.05, 0.0],
            [10.0, 10.0],
        ]
    )

    labels = strategy_map._cluster_points(
        embedding_2d=embedding,
        clusterer="dbscan",
        n_clusters=2,
        dbscan_eps=0.1,
        dbscan_min_samples=2,
        random_state=42,
    )

    assert set(labels) == {-1, 0}
