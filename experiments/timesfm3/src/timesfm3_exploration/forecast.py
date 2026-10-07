"""TimesFM 3.0 local forecasting helper functions."""

from typing import Optional
import numpy as np
import pandas as pd
from timesfm import TimesFM3Forecaster
from timesfm3.torch.timesfm3_forecaster import ForecastOutput


def load_forecaster(
    model_name: str = "google/timesfm-3.0-pytorch",
    device: str = "cpu",
    per_core_batch_size: int = 1,
) -> TimesFM3Forecaster:
    """Load Google TimesFM 3.0 checkpoint on local device.

    Args:
        model_name: Hugging Face model repository ID.
        device: Device to load model on ('cpu' or 'cuda').
        per_core_batch_size: Batch size per core.

    Returns:
        Loaded TimesFM3Forecaster instance.
    """
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
    """Run zero-shot inference for a single time series context.

    Args:
        forecaster: Initialized TimesFM3Forecaster.
        context: 1D array of historical values.
        horizon: Forecast horizon (number of future steps to predict).
        past_only_covariates: Optional covariates available only for history.
        past_future_covariates: Optional covariates available for history and future.
        return_quantiles: Whether to return prediction intervals (10% to 90%).

    Returns:
        ForecastOutput containing `forecast` and `quantiles`.
    """
    return forecaster.predict(
        context=context,
        horizon=horizon,
        past_only_covariates=past_only_covariates,
        past_future_covariates=past_future_covariates,
        return_quantiles=return_quantiles,
    )


def to_dataframe(
    context: np.ndarray,
    forecast_output: ForecastOutput,
    start_date: Optional[pd.Timestamp] = None,
    freq: str = "h",
) -> pd.DataFrame:
    """Convert historical context and forecast output into a combined pandas DataFrame.

    Args:
        context: Historical 1D sequence.
        forecast_output: ForecastOutput from forecaster.predict.
        start_date: Timestamp for the start of history. Defaults to 2026-01-01.
        freq: Frequency string (e.g. 'h' for hourly, 'D' for daily).

    Returns:
        DataFrame with columns ['history', 'forecast', 'q10', 'q50', 'q90', ...].
    """
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
        # Quantiles shape is typically (horizon, 9) representing 10% to 90%
        num_quantiles = forecast_output.quantiles.shape[1]
        quantile_labels = [f"q{int((i + 1) * 10)}" for i in range(num_quantiles)]
        for i, q_label in enumerate(quantile_labels):
            df[q_label] = np.nan
            df.loc[forecast_index, q_label] = forecast_output.quantiles[:, i]

    return df
