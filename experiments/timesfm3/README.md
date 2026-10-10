# TimesFM 3.0 Exploration

Local exploration and benchmarking of Google Research's **TimesFM 3.0** (Time Series Foundation Model) running zero-shot inference locally on CPU.

## Overview

[TimesFM 3.0](https://huggingface.co/google/timesfm-3.0-pytorch) is a 330-million-parameter decoder-only transformer pre-trained on over 1 trillion time points across diverse domains.

### Key Capabilities
- **Native Multivariate Support**: Natively predicts multiple time series jointly.
- **Covariate Support**: Supports both past-only covariates and future-known covariates (calendar events, weather, holidays).
- **Probabilistic Forecasting**: Produces point forecasts as well as 10 quantile intervals (10th through 90th percentiles).
- **Zero-Shot Performance**: Delivers state-of-the-art forecasting without requiring fine-tuning on domain-specific datasets.

## Local Device Execution

Tested and verified on this device:
- **Processor**: AMD Ryzen AI 7 350 w/ Radeon 860M (x86_64, 16 threads, AVX-512)
- **Model Size**: ~1.3 GB weights (`model.safetensors`), loads in ~1.5s
- **Inference Speed**: ~0.16s for a 48-step horizon on CPU
- **Backend**: PyTorch CPU (`timesfm[torch]`)

> [!NOTE]
> The source code is licensed under Apache-2.0, while the pre-trained model weights are distributed under the Google TimesFM Non-Commercial License v1.0.

## Project Structure

```
experiments/timesfm3/
├── timesfm3_colab_exploration.ipynb  # Interactive Google Colab notebook for GPU testing
├── colab_runner.py                   # Standalone accelerator & Colab benchmark suite
├── explore.py                        # Local exploration script with synthetic time series
├── pyproject.toml                    # uv project configuration and dependencies
├── README.md                         # This document
├── src/
│   └── timesfm3_exploration/
│       ├── __init__.py               # Package exports (forecast_series, forecast_batch, etc.)
│       └── forecast.py               # Helper utilities for loading & forecasting (CUDA/CPU)
└── outputs/                          # Generated forecast & benchmark plots (git-ignored)
```

## Running on Google Colab (Google AI Pro Plan)

With your **Google AI Pro** plan, you receive monthly Colab compute credits to use on high-performance accelerators (NVIDIA T4, L4, or A100 GPUs).

### Option 1: Interactive Colab Notebook (`timesfm3_colab_exploration.ipynb`)
1. Open [Google Colab](https://colab.research.google.com/).
2. Select **Upload** and upload `experiments/timesfm3/timesfm3_colab_exploration.ipynb`.
3. In the top menu, go to **Runtime > Change runtime type**:
   - **Hardware accelerator**: Select **GPU**.
   - **GPU class**: Choose **Standard** (T4) or **Premium** (L4 / A100) to utilize your Pro compute credits.
4. Run all cells sequentially. The notebook includes:
   - GPU / VRAM status checks
   - Dependency installation (`timesfm[torch]>=3.0.2`)
   - **Scenario 1**: 48h zero-shot electricity demand forecast with p10–p90 quantiles
   - **Scenario 2**: Dynamic past-future covariates (heatwave / peak price spikes)
   - **Scenario 3**: Multi-batch GPU throughput benchmark (measuring series/second)
   - Visualizations plotted directly inline.

### Option 2: Headless GPU Execution via Colab CLI (`colab run` / `colab exec`)
We have installed the official Google Colab CLI (`google-colab-cli`). Once authenticated, you can rent a GPU VM, run the benchmarks, and automatically tear down the VM directly from your terminal:

```bash
# Ephemeral GPU run (provisions VM, executes benchmark, tears down VM)
colab run --gpu L4 experiments/timesfm3/colab_runner.py

# Or with high-RAM / A100 GPU
colab run --gpu A100 --high-mem experiments/timesfm3/colab_runner.py

# Or create a persistent session to run commands interactively
colab new -s timesfm-bench --gpu L4
colab exec -s timesfm-bench -f experiments/timesfm3/colab_runner.py
colab stop -s timesfm-bench
```

### Option 3: Local Script Benchmark (`colab_runner.py`)
To run the automated benchmark suite locally on CPU or local GPU:

```bash
cd experiments/timesfm3
uv run python colab_runner.py
```

## Local Quickstart

Run the exploration script using `uv`:

```bash
cd experiments/timesfm3
uv run python explore.py
```

This will:
1. Load the `google/timesfm-3.0-pytorch` weights into memory.
2. Generate a 168-hour (7-day) synthetic time-series context.
3. Compute a 48-hour zero-shot forecast with quantiles.
4. Export the resulting visualization to `outputs/electricity_forecast_sample.png`.

## API Usage Example

```python
import numpy as np
from timesfm3_exploration import load_forecaster, forecast_series, to_dataframe

# 1. Initialize forecaster on CPU
forecaster = load_forecaster(device="cpu")

# 2. Historical values (1D array)
context = np.array([...])

# 3. Forecast 24 steps ahead with quantiles
output = forecast_series(forecaster, context=context, horizon=24, return_quantiles=True)

# 4. Convert into a pandas DataFrame
df = to_dataframe(context, output, freq="h")
print(df[["forecast", "q10", "q50", "q90"]].dropna())
```

## Potential Next Steps

1. **Energy Market Data**: Plug in historical data from [`nem-battery`](../../nem-battery) or [`open-electricity`](../../open-electricity) to benchmark zero-shot load/price forecasting.
2. **Covariates**: Test multivariate forecasting with temperature, day-of-week, and solar generation covariates.
3. **Benchmarking**: Compare inference accuracy and latency against statistical baselines (SARIMA, ETS) and gradient-boosted trees (LightGBM).
