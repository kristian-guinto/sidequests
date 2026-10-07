# Experiments & Ad-Hoc Projects

This directory contains standalone exploratory projects, spikes, and ad-hoc experiments.

## Guidelines

- **Self-contained**: Each experiment lives in its own subdirectory with its own `pyproject.toml`, virtual environment, dependencies, and `README.md`.
- **Isolation**: Experiments do not share dependencies to avoid conflicts (especially with ML libraries like PyTorch, JAX, Hugging Face, etc.).
- **Graduation**: When an experiment matures into an ongoing or production-bound project, it can be promoted to a dedicated top-level directory in the monorepo.

## Active Experiments

| Directory | Topic | Description |
| --- | --- | --- |
| [`timesfm3/`](timesfm3) | Google TimesFM 3.0 | Local exploration of TimesFM 3.0 foundation model for time series forecasting on CPU |
