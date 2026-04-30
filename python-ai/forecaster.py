"""
StockSage Price Forecaster
Uses Facebook Prophet + sklearn for 4-5 month price prediction.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
import warnings
warnings.filterwarnings('ignore')

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("⚠️ Prophet not installed. Using sklearn fallback for forecasting.")


def forecast_prophet(df, periods=120):
    """Use Facebook Prophet for time series forecasting (4-5 months ≈ 120 trading days)."""
    if not PROPHET_AVAILABLE:
        return forecast_sklearn(df, periods)

    try:
        # Prepare data for Prophet
        prophet_df = df[['Close']].copy()
        prophet_df = prophet_df.reset_index()
        prophet_df.columns = ['ds', 'y']
        prophet_df['ds'] = pd.to_datetime(prophet_df['ds'])

        # Remove timezone info if present
        if prophet_df['ds'].dt.tz is not None:
            prophet_df['ds'] = prophet_df['ds'].dt.tz_localize(None)

        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=True,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            interval_width=0.80
        )
        model.fit(prophet_df)

        future = model.make_future_dataframe(periods=periods, freq='B')  # Business days
        forecast = model.predict(future)

        # Get the forecast at the end of the horizon
        last_forecast = forecast.tail(1).iloc[0]

        predicted_price = round(float(last_forecast['yhat']), 2)
        price_low = round(float(last_forecast['yhat_lower']), 2)
        price_high = round(float(last_forecast['yhat_upper']), 2)

        # Determine trend from forecast slope
        forecast_start = forecast[forecast['ds'] > prophet_df['ds'].max()].head(1)['yhat'].values[0]
        trend_pct = ((predicted_price - forecast_start) / forecast_start) * 100

        if trend_pct > 5:
            trend = 'BULLISH'
        elif trend_pct < -5:
            trend = 'BEARISH'
        else:
            trend = 'NEUTRAL'

        return {
            'predicted_price': predicted_price,
            'price_range_low': price_low,
            'price_range_high': price_high,
            'horizon': '4-5 months',
            'trend_direction': trend,
            'trend_percentage': round(trend_pct, 2),
            'method': 'prophet'
        }
    except Exception as e:
        print(f"Prophet forecast error: {e}. Falling back to sklearn.")
        return forecast_sklearn(df, periods)


def forecast_sklearn(df, periods=120):
    """Fallback forecaster using polynomial regression."""
    try:
        close = df['Close'].values
        n = len(close)

        # Use last 252 days for training (1 year)
        train_size = min(n, 252)
        train_data = close[-train_size:]

        X = np.arange(train_size).reshape(-1, 1)
        y = train_data

        # Polynomial regression (degree 3)
        poly = PolynomialFeatures(degree=3)
        X_poly = poly.fit_transform(X)

        model = LinearRegression()
        model.fit(X_poly, y)

        # Predict future
        future_X = np.arange(train_size, train_size + periods).reshape(-1, 1)
        future_X_poly = poly.transform(future_X)
        predictions = model.predict(future_X_poly)

        predicted_price = round(float(predictions[-1]), 2)

        # Estimate prediction interval using residual standard error
        y_pred_train = model.predict(X_poly)
        residuals = y - y_pred_train
        std_err = np.std(residuals)

        price_low = round(predicted_price - 2 * std_err, 2)
        price_high = round(predicted_price + 2 * std_err, 2)

        # Ensure prices aren't negative
        price_low = max(0.01, price_low)

        current_price = close[-1]
        trend_pct = ((predicted_price - current_price) / current_price) * 100

        if trend_pct > 5:
            trend = 'BULLISH'
        elif trend_pct < -5:
            trend = 'BEARISH'
        else:
            trend = 'NEUTRAL'

        return {
            'predicted_price': predicted_price,
            'price_range_low': price_low,
            'price_range_high': price_high,
            'horizon': '4-5 months',
            'trend_direction': trend,
            'trend_percentage': round(trend_pct, 2),
            'method': 'sklearn_polynomial'
        }
    except Exception as e:
        print(f"Sklearn forecast error: {e}")
        current_price = float(df['Close'].iloc[-1])
        return {
            'predicted_price': current_price,
            'price_range_low': round(current_price * 0.85, 2),
            'price_range_high': round(current_price * 1.15, 2),
            'horizon': '4-5 months',
            'trend_direction': 'NEUTRAL',
            'trend_percentage': 0,
            'method': 'fallback'
        }
