"""Colab and GPU benchmark runner for Google TimesFM 3.0.

Self-contained script ready for Google Colab CLI (`colab run` / `colab exec`)
or local accelerator execution.
"""

from pathlib import Path
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

# 1. Auto-install timesfm if running in a fresh remote Colab VM
try:
    import timesfm
except ImportError:
    print("[colab_runner] timesfm not found, installing timesfm[torch]...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "timesfm[torch]>=3.0.2"])
    import timesfm

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from timesfm import TimesFM3Forecaster
from timesfm3.torch.timesfm3_forecaster import ForecastOutput


def get_device_info() -> Dict[str, Any]:
    """Retrieve runtime accelerator information."""
    cuda_available = torch.cuda.is_available()
    info: Dict[str, Any] = {
        "cuda_available": cuda_available,
        "pytorch_version": torch.__version__,
        "device": "cuda" if cuda_available else "cpu",
    }
    if cuda_available:
        info["device_name"] = torch.cuda.get_device_name(0)
        info["device_count"] = torch.cuda.device_count()
        info["vram_total_gb"] = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
    return info


def load_forecaster(
    model_name: str = "google/timesfm-3.0-pytorch",
    device: Optional[str] = None,
    per_core_batch_size: int = 4,
) -> TimesFM3Forecaster:
    """Load Google TimesFM 3.0 checkpoint."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    return TimesFM3Forecaster.from_pretrained(
        pretrained_model_name_or_path=model_name,
        device=device,
        per_core_batch_size=per_core_batch_size,
    )


def forecast_series(
    forecaster: TimesFM3Forecaster,
    context: np.ndarray,
    horizon: int = 24,
    past_only_covariates: Optional[np.ndarray] = None,
    past_future_covariates: Optional[np.ndarray] = None,
    return_quantiles: bool = True,
) -> ForecastOutput:
    """Run zero-shot inference for a single time series context."""
    return forecaster.predict(
        context=context,
        horizon=horizon,
        past_only_covariates=past_only_covariates,
        past_future_covariates=past_future_covariates,
        return_quantiles=return_quantiles,
    )


def forecast_batch(
    forecaster: TimesFM3Forecaster,
    contexts: List[np.ndarray],
    horizon: int = 24,
    return_quantiles: bool = True,
) -> List[ForecastOutput]:
    """Run zero-shot inference for a batch of time series contexts."""
    return list(
        forecaster.predict_batch(
            contexts,
            horizon=horizon,
            return_quantiles=return_quantiles,
        )
    )


def to_dataframe(
    context: np.ndarray,
    forecast_output: ForecastOutput,
    start_date: Optional[pd.Timestamp] = None,
    freq: str = "h",
) -> pd.DataFrame:
    """Convert historical context and forecast output into a combined pandas DataFrame."""
    if start_date is None:
        start_date = pd.Timestamp.now().floor(freq) - pd.Timedelta(f"{len(context)}{freq}")

    history_index = pd.date_range(start=start_date, periods=len(context), freq=freq)
    forecast_index = pd.date_range(start=history_index[-1] + pd.Timedelta(f"1{freq}"), periods=len(forecast_output.forecast), freq=freq)

    combined_index = history_index.append(forecast_index)
    df = pd.DataFrame(index=combined_index)

    df["history"] = np.nan
    df.loc[history_index, "history"] = context

    df["forecast"] = np.nan
    df.loc[forecast_index, "forecast"] = forecast_output.forecast

    if forecast_output.quantiles is not None:
        num_quantiles = forecast_output.quantiles.shape[1]
        quantile_labels = [f"q{int((i + 1) * 10)}" for i in range(num_quantiles)]
        for i, q_label in enumerate(quantile_labels):
            df[q_label] = np.nan
            df.loc[forecast_index, q_label] = forecast_output.quantiles[:, i]

    return df


def generate_synthetic_load(
    hours: int = 168,
    base_mw: float = 1500.0,
    seed: int = 42,
) -> np.ndarray:
    """Generate realistic hourly electricity load (MW) pattern."""
    rng = np.random.default_rng(seed)
    t = np.arange(hours)

    daily_cycle = 300.0 * np.sin(2 * np.pi * t / 24 - 1.5) + 150.0 * np.cos(4 * np.pi * t / 24)
    weekend_factor = np.ones(hours)
    if hours >= 48:
        weekend_factor[-48:] = 0.90

    trend = 0.4 * t
    noise = rng.normal(loc=0.0, scale=25.0, size=hours)
    load = (base_mw + daily_cycle + trend) * weekend_factor + noise
    return load.astype(np.float32)


def run_electricity_experiment(forecaster, out_dir: Path) -> Dict[str, float]:
    """Test zero-shot point & quantile forecasting on electricity load."""
    print("\n" + "-" * 50)
    print("Scenario 1: Electricity Load Forecast (Probabilistic)")
    print("-" * 50)

    context_hours = 168  # 7 days context
    horizon = 48         # 2 days horizon
    context = generate_synthetic_load(hours=context_hours)

    t0 = time.perf_counter()
    output = forecast_series(forecaster, context=context, horizon=horizon, return_quantiles=True)
    latency = time.perf_counter() - t0
    print(f"-> 48h Forecast completed in {latency * 1000:.1f}ms")

    start_date = pd.Timestamp("2026-10-01 00:00:00")
    df = to_dataframe(context, output, start_date=start_date, freq="h")

    # Plot
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(df.index[:context_hours], df["history"].iloc[:context_hours], label="Context (7 Days)", color="#1f77b4", lw=1.5)
    ax.plot(df.index[context_hours:], df["forecast"].iloc[context_hours:], label="TimesFM 3.0 Forecast", color="#d62728", lw=2, linestyle="--")

    if "q10" in df.columns and "q90" in df.columns:
        ax.fill_between(
            df.index[context_hours:],
            df["q10"].iloc[context_hours:],
            df["q90"].iloc[context_hours:],
            color="#d62728",
            alpha=0.2,
            label="10% - 90% Prediction Interval",
        )

    ax.axvline(x=df.index[context_hours], color="gray", linestyle=":", label="Forecast Cutoff")
    ax.set_title(f"TimesFM 3.0 Electricity Forecast (Latency: {latency * 1000:.1f}ms)", fontsize=13, fontweight="bold")
    ax.set_xlabel("Timestamp")
    ax.set_ylabel("Demand (MW)")
    ax.legend(loc="upper left")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    plot_path = out_dir / "colab_benchmark_electricity.png"
    fig.savefig(plot_path, dpi=150)
    plt.close(fig)
    print(f"-> Plot saved to {plot_path}")

    return {"latency_ms": latency * 1000, "horizon": horizon}


def run_covariates_experiment(forecaster, out_dir: Path) -> Dict[str, float]:
    """Test dynamic past-future covariates (e.g. heatwave / extreme peak event)."""
    print("\n" + "-" * 50)
    print("Scenario 2: Dynamic Covariate Impact (Heatwave Shock)")
    print("-" * 50)

    context_len = 168
    horizon_len = 48
    total_len = context_len + horizon_len

    # Past-future covariate: binary heatwave warning indicator
    heatwave_covariate = np.zeros(total_len, dtype=np.float32)
    heatwave_covariate[48:72] = 1.0
    heatwave_covariate[180:204] = 1.0

    pfc = np.array([heatwave_covariate], dtype=np.float32)

    # Base load + 35% boost during heatwave
    base_load = generate_synthetic_load(hours=total_len, seed=123)
    boosted_load = (base_load * np.where(heatwave_covariate == 1.0, 1.35, 1.0)).astype(np.float32)

    context = boosted_load[:context_len]
    ground_truth = boosted_load[context_len:]

    # Predict WITH covariate
    t0 = time.perf_counter()
    out_with_cov = forecaster.predict(
        context=context,
        horizon=horizon_len,
        past_future_covariates=pfc,
        return_quantiles=True,
    )
    latency_with = (time.perf_counter() - t0) * 1000

    # Predict WITHOUT covariate (baseline)
    out_without_cov = forecaster.predict(
        context=context,
        horizon=horizon_len,
        return_quantiles=True,
    )

    mae_with = float(np.mean(np.abs(out_with_cov.forecast - ground_truth)))
    mae_without = float(np.mean(np.abs(out_without_cov.forecast - ground_truth)))
    print(f"-> Forecast with Covariate MAE:    {mae_with:.2f} MW (latency: {latency_with:.1f}ms)")
    print(f"-> Forecast without Covariate MAE: {mae_without:.2f} MW")

    fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
    t_ctx = np.arange(context_len)
    t_hor = np.arange(context_len, total_len)

    axes[0].plot(t_ctx, context, label="Historical Context", color="black", lw=1.2)
    axes[0].plot(t_hor, ground_truth, label="Ground Truth (Actual Heatwave)", color="gray", ls="--", lw=1.5)
    axes[0].plot(t_hor, out_with_cov.forecast, label=f"TimesFM 3.0 With Heatwave Covariate (MAE: {mae_with:.1f})", color="#2ca02c", lw=2)
    axes[0].plot(t_hor, out_without_cov.forecast, label=f"TimesFM 3.0 Without Covariate (MAE: {mae_without:.1f})", color="#d62728", lw=1.5, ls=":")
    axes[0].set_title("TimesFM 3.0: Zero-Shot Dynamic Covariate Conditioning", fontsize=13, fontweight="bold")
    axes[0].set_ylabel("Demand (MW)")
    axes[0].legend(loc="upper left")
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(np.arange(total_len), heatwave_covariate, label="Heatwave Event Covariate (0 or 1)", color="#ff7f0e", drawstyle="steps-mid", lw=1.5)
    axes[1].fill_between(np.arange(total_len), 0, heatwave_covariate, color="#ff7f0e", alpha=0.2)
    axes[1].axvline(x=context_len, color="gray", ls=":")
    axes[1].set_ylabel("Indicator")
    axes[1].set_xlabel("Time Step (Hours)")
    axes[1].set_yticks([0, 1])
    axes[1].legend(loc="upper left")
    axes[1].grid(True, alpha=0.3)

    fig.tight_layout()
    plot_path = out_dir / "colab_benchmark_covariates.png"
    fig.savefig(plot_path, dpi=150)
    plt.close(fig)
    print(f"-> Plot saved to {plot_path}")

    return {"mae_with": mae_with, "mae_without": mae_without, "latency_ms": latency_with}


def run_batch_benchmark(forecaster, out_dir: Path) -> List[Dict[str, float]]:
    """Benchmark GPU batch throughput across different batch sizes."""
    print("\n" + "-" * 50)
    print("Scenario 3: Batch Scaling & GPU Throughput Benchmark")
    print("-" * 50)

    batch_sizes = [1, 5, 20, 50]
    horizon = 24
    results = []

    for bs in batch_sizes:
        contexts = [generate_synthetic_load(hours=168, base_mw=1000 + i * 50, seed=i) for i in range(bs)]

        # Warm-up (1 run)
        _ = forecast_batch(forecaster, contexts[:1], horizon=horizon)

        # Timed run
        t0 = time.perf_counter()
        _ = forecast_batch(forecaster, contexts, horizon=horizon)
        duration = time.perf_counter() - t0

        per_series_ms = (duration / bs) * 1000
        throughput = bs / duration

        results.append({
            "batch_size": bs,
            "total_time_s": duration,
            "per_series_ms": per_series_ms,
            "throughput_fps": throughput,
        })
        print(f"-> Batch Size: {bs:2d} | Total: {duration:.3f}s | Per Series: {per_series_ms:6.1f}ms | Throughput: {throughput:6.1f} series/s")

    fig, ax1 = plt.subplots(figsize=(10, 5))
    bs_vals = [r["batch_size"] for r in results]
    per_series = [r["per_series_ms"] for r in results]
    th_vals = [r["throughput_fps"] for r in results]

    color = "#1f77b4"
    ax1.set_xlabel("Batch Size")
    ax1.set_ylabel("Latency per Series (ms)", color=color)
    ax1.plot(bs_vals, per_series, marker="o", color=color, lw=2)
    ax1.tick_params(axis="y", labelcolor=color)
    ax1.grid(True, alpha=0.3)

    ax2 = ax1.twinx()
    color = "#2ca02c"
    ax2.set_ylabel("Throughput (series/sec)", color=color)
    ax2.plot(bs_vals, th_vals, marker="s", color=color, lw=2, linestyle="--")
    ax2.tick_params(axis="y", labelcolor=color)

    plt.title("TimesFM 3.0 Inference Throughput & Latency vs. Batch Size", fontsize=13, fontweight="bold")
    fig.tight_layout()
    plot_path = out_dir / "colab_benchmark_batch_scaling.png"
    fig.savefig(plot_path, dpi=150)
    plt.close(fig)
    print(f"-> Plot saved to {plot_path}")

    return results


def main() -> None:
    print("=" * 65)
    print("Google TimesFM 3.0 - Colab / Accelerator Benchmark Suite")
    print("=" * 65)

    device_info = get_device_info()
    print("\n[Hardware / Device Info]")
    for k, v in device_info.items():
        print(f"  {k:20s}: {v}")

    out_dir = Path("outputs")
    out_dir.mkdir(parents=True, exist_ok=True)

    print("\n[Loading TimesFM 3.0 Checkpoint]...")
    t_load_start = time.perf_counter()
    forecaster = load_forecaster(per_core_batch_size=4)
    t_load = time.perf_counter() - t_load_start
    print(f"-> Model loaded in {t_load:.2f}s onto device: {forecaster.device}")

    # Run experiments
    res_elec = run_electricity_experiment(forecaster, out_dir)
    res_cov = run_covariates_experiment(forecaster, out_dir)
    res_batch = run_batch_benchmark(forecaster, out_dir)

    print("\n" + "=" * 65)
    print("Summary of Benchmark Results:")
    print("=" * 65)
    print(f"Device:             {device_info.get('device_name', device_info['device'])}")
    print(f"Electricity 48h:    {res_elec['latency_ms']:.1f}ms")
    print(f"Covariate Gain:     MAE {res_cov['mae_without']:.1f} -> {res_cov['mae_with']:.1f} MW")
    peak_throughput = max(r['throughput_fps'] for r in res_batch)
    print(f"Peak Throughput:    {peak_throughput:.1f} series/second (Batch={res_batch[-1]['batch_size']})")
    print("=" * 65)


if __name__ == "__main__":
    main()
