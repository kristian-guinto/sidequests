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
├── explore.py                 # Runnable demo script with synthetic time series & plotting
├── pyproject.toml             # uv project configuration and dependencies
├── README.md                  # This document
├── src/
│   └── timesfm3_exploration/
│       ├── __init__.py        # Package exports
│       └── forecast.py        # Helper utilities for loading & forecasting
└── outputs/                   # Generated forecast plots (git-ignored)
```

## Quickstart

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
