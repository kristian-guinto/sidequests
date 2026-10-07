"""Local exploration script for Google TimesFM 3.0 on CPU."""

from pathlib import Path
import time
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from timesfm3_exploration import forecast_series, load_forecaster, to_dataframe


def generate_synthetic_load(hours: int = 168) -> np.ndarray:
    """Generate 7 days of realistic hourly electricity load (MW) pattern.

    Includes:
    - Base baseline load
    - Diurnal pattern (dual daily peaks: morning and evening)
    - Slight trend
    - Random Gaussian noise
    """
    t = np.arange(hours)
    base = 1500.0

    # Diurnal variation: 24h cycle with morning and evening peaks
    daily_cycle = 300.0 * np.sin(2 * np.pi * t / 24 - 1.5) + 150.0 * np.cos(4 * np.pi * t / 24)

    # Weekly pattern: slight dip on weekends (assume last 48h are weekend)
    weekend_factor = np.ones(hours)
    weekend_factor[-48:] = 0.9

    # Upward gradual trend
    trend = 0.5 * t

    # Gaussian noise
    noise = np.random.normal(loc=0.0, scale=30.0, size=hours)

    load = (base + daily_cycle + trend) * weekend_factor + noise
    return load.astype(np.float32)


def main() -> None:
    print("=" * 60)
    print("Google TimesFM 3.0 Local CPU Exploration")
    print("=" * 60)

    # 1. Load model
    print("\n[1/4] Loading TimesFM 3.0 checkpoint (device: CPU)...")
    start_load = time.perf_counter()
    forecaster = load_forecaster(device="cpu")
    print(f"      Model loaded in {time.perf_counter() - start_load:.2f}s")

    # 2. Prepare synthetic context
    context_hours = 168  # 7 days of hourly history
    horizon = 48         # 2 days ahead forecast
    print(f"\n[2/4] Generating {context_hours} hours of synthetic time series context...")
    context = generate_synthetic_load(hours=context_hours)

    # 3. Forecast
    print(f"\n[3/4] Running zero-shot forecast for horizon={horizon} hours...")
    start_infer = time.perf_counter()
    output = forecast_series(forecaster, context=context, horizon=horizon, return_quantiles=True)
    infer_duration = time.perf_counter() - start_infer
    print(f"      Inference completed in {infer_duration:.2f}s")

    # 4. Process and visualize
    print("\n[4/4] Formatting results and generating forecast plot...")
    start_date = pd.Timestamp("2026-10-01 00:00:00")
    df = to_dataframe(context, output, start_date=start_date, freq="h")

    out_dir = Path("outputs")
    out_dir.mkdir(parents=True, exist_ok=True)
    plot_file = out_dir / "electricity_forecast_sample.png"

    plt.figure(figsize=(12, 6))
    plt.plot(df.index[:context_hours], df["history"].iloc[:context_hours], label="History (Context)", color="#1f77b4", lw=1.5)
    plt.plot(df.index[context_hours:], df["forecast"].iloc[context_hours:], label="TimesFM 3.0 Forecast", color="#d62728", lw=2, linestyle="--")

    if "q10" in df.columns and "q90" in df.columns:
        plt.fill_between(
            df.index[context_hours:],
            df["q10"].iloc[context_hours:],
            df["q90"].iloc[context_hours:],
            color="#d62728",
            alpha=0.2,
            label="Prediction Interval (10th - 90th percentile)",
        )

    plt.axvline(x=df.index[context_hours], color="gray", linestyle=":", label="Forecast Cutoff")
    plt.title("Google TimesFM 3.0 Zero-Shot Forecast (Local CPU Execution)", fontsize=14, fontweight="bold")
    plt.xlabel("Timestamp", fontsize=11)
    plt.ylabel("Value (e.g. Demand MW)", fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig(plot_file, dpi=150)
    plt.close()

    print(f"      Plot saved to: {plot_file}")
    print("\nSample Forecasted Steps (first 5 hours):")
    sample_forecast = df.loc[df["forecast"].notna(), ["forecast", "q10", "q50", "q90"]].head()
    print(sample_forecast.to_string())

    print("\n" + "=" * 60)
    print("Success! TimesFM 3.0 runs smoothly on this local device.")
    print("=" * 60)


if __name__ == "__main__":
    main()
