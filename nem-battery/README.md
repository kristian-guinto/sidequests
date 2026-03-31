# NEM Battery Market Analyzer

> Built an end-to-end data pipeline and unsupervised ML engine (**Python, DuckDB, MotherDuck, UMAP, K-Means**) that processes high-volume AEMO market data to autonomously classify distinct revenue-stacking and operational strategies used by grid-scale batteries.

This project is an end-to-end machine learning and data engineering application designed to decode how utility-scale batteries (like the Hornsdale Power Reserve and Victorian Big Battery) trade and operate in Australia's National Electricity Market (AEMO). 

---

## 🏗️ Architecture & Tech Stack

- **Data Extraction (ETL):** Python (`asyncio`, `httpx`), concurrent ZIP archive processing, AEMO MMS string parsing.
- **Database & OLAP:** DuckDB (local) and MotherDuck (cloud), enabling sub-second analytics on millions of dispatch intervals. Idempotent ingestion pipeline.
- **Machine Learning Engine:** `scikit-learn`, `umap-learn`, `hdbscan`, `pandas`, `numpy`.
- **Frontend / Visualization:** Next.js 16 (App Router), React, Tailwind CSS, Three.js (for 3D UMAP cluster visualization), Recharts.

---

## ⚡ The Data Engineering Pipeline

AEMO publishes market data (dispatch targets, FCAS enablement, fast-start profiles, and 5-min/30-min settlement prices) publicly, but **provides no REST API**. Data is served solely as a rolling stream of nested ZIP files containing custom pipe-delimited CSVs known as the MMS format.

To solve this, the ingestion engine (`nem_battery/pipeline.py` and `nem_battery/_parser.py`):
1. **Asynchronously fetches** the rolling 5-minute `DispatchIS` and daily `Next_Day_Dispatch` endpoints, joining unit solutions with pricing data on the `SETTLEMENTDATE`.
2. **Parses the MMS format** efficiently entirely in memory, extracting only the sets required to calculate the exact revenue algorithms for bidirectional single-DUID batteries.
3. **Applies Idempotent Storage** via DuckDB `ON CONFLICT DO NOTHING`, allowing the pipeline to seamlessly backfill months of data or stream real-time updates directly into MotherDuck.

---

## 🧠 Machine Learning: Strategy Map

The core of this project is the **Strategy Map** (`nem_battery/strategy_map.py`)—an unsupervised machine learning pipeline designed to cut through raw interval noise and cluster batteries by their actual market behaviors.

### 1. Feature Engineering
Raw 5-minute data is aggregated into **trading days** (starting at 04:00 AEST). For each battery-day, the pipeline engineers **22 domain-specific features**, including:
* **Value Stacking Profiles:** The ratio of energy arbitrage revenue vs. FCAS (Frequency Control Ancillary Services) regulation/contingency revenue.
* **Operational Characteristics:** Daily capacity factors, discrete cycle counts, and charging efficiency during negative price periods.
* **Market Reactivity:** The correlation of a battery's dispatch targets to volatile price spikes (>$300/MWh) or negative price floors.
* **Temporal Patterns:** Peak vs. off-peak generation distributions.

### 2. Dimensionality Reduction & Clustering
Because battery trading strategies are highly multi-dimensional, the pipeline uses **UMAP (Uniform Manifold Approximation and Projection)** to compress the 22-dimensional feature space into both 2D and 3D dense semantic embeddings.

On top of the UMAP embeddings, we apply clustering algorithms (**K-Means** and **DBSCAN**) to autonomously group battery-days. This allows mapping an unseen operational day into established strategy clusters (e.g., "Aggressive FCAS Stacking", "Passive Energy Arbitrage", "Negative Price Charging").

---

## 💻 Full-Stack Visualization

To make the ML insights accessible, the project includes a **Next.js** frontend (`/frontend`) that queries the MotherDuck database directly via React Server Components using DuckDB's Node API. 

The dashboard features **Three.js** to render the 3D UMAP strategy embeddings interactively, allowing users to rotate, explore, and analyze how a specific battery's operational strategy evolves over time and seamlessly transitions between clusters depending on market conditions.

---

## 🚀 Running the Project

### Environment Setup
Install the Python package with all ML, pipeline, and dataframe dependencies:
```bash
uv pip install -e ".[dev,pipeline,ml,dataframe]"
```

### Run the ML Strategy Pipeline
Extracts local database intervals, generates the 22 features, runs UMAP + K-Means, and writes the embeddings back to DuckDB:
```bash
python -m nem_battery.strategy_map --target local
```

### Run the Data Ingestion (CLI)
You can manually fetch the latest dispatch or backfill full trading days:
```bash
uv run nem-battery latest --battery victorian_big_battery
uv run nem-battery daily 2026-03-15 --battery hornsdale
# Stream live SCADA data
uv run nem-battery stream --battery hornsdale --scada
```

### Run the Frontend
```bash
cd frontend
pnpm install
pnpm dev
```
