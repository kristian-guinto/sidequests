"""Unit and Integration Tests for pollmph FastAPI API"""

import pytest
from fastapi.testclient import TestClient

from pollmph.api.app import app
from pollmph.api.schemas import (
    SentimentRecord,
    MovingAveragePoint,
)
from pollmph.api.deps import calculate_server_moving_averages

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "pollmph API"
    assert data["api_v1"] == "/api/v1"
    assert "docs_url" in data


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "environment" in data


def test_virtual_poll_topics():
    response = client.get("/api/v1/virtual-poll/topics")
    assert response.status_code == 200
    topics = response.json()
    assert isinstance(topics, list)
    assert len(topics) >= 3
    assert any(t["topic_id"] == "vp-2028-presidential" for t in topics)


def test_virtual_poll_results_demographics():
    response = client.get(
        "/api/v1/virtual-poll/vp-2028-presidential?simulated_panel_size=1500"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["topic_id"] == "vp-2028-presidential"
    assert data["simulated_respondents"] == 1500
    assert "demographic_breakdowns" in data
    breakdowns = data["demographic_breakdowns"]
    assert len(breakdowns) >= 10

    # Ensure regional dimensions exist
    regions = [b["segment"] for b in breakdowns if b["dimension"] == "region"]
    assert "National Capital Region (NCR)" in regions
    assert "Mindanao" in regions
    assert "Balance Luzon" in regions
    assert "Visayas" in regions

    # Ensure socioeconomic classes exist
    classes = [
        b["segment"] for b in breakdowns if b["dimension"] == "socioeconomic_class"
    ]
    assert any("Class D" in c for c in classes)
    assert any("Class E" in c for c in classes)


def test_server_moving_average_calculation():
    # 8 days of dummy sentiments
    records = [
        SentimentRecord(
            proposition_id="test-prop",
            date_generated=f"2026-03-{i:02d}",
            consensus_value=0.50 + (i * 0.02),
            attention_value=0.40,
            rationale_consensus="Rationale",
            rationale_attention="Rationale",
        )
        for i in range(1, 9)
    ]

    ma_points = calculate_server_moving_averages(records, window_size=7)
    assert len(ma_points) == 8

    # Day 7 (index 6): average of first 7 points
    day7_expected = sum(records[j].consensus_value for j in range(7)) / 7.0
    assert abs(ma_points[6].ma_consensus - round(day7_expected, 3)) < 0.001

    # Day 8 (index 7): average of points 1..7 (window of 7)
    day8_expected = sum(records[j].consensus_value for j in range(1, 8)) / 7.0
    assert abs(ma_points[7].ma_consensus - round(day8_expected, 3)) < 0.001
