"""
StockSage AI Analysis Engine
Uses technical indicators (RSI, SMA, MACD, Bollinger Bands) and
ML-based scoring to generate BUY/HOLD/WAIT signals.
"""

import numpy as np
import pandas as pd
import ta
from ta.trend import SMAIndicator, MACD, EMAIndicator
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.volatility import BollingerBands, AverageTrueRange


def compute_indicators(df):
    """Compute all technical indicators on OHLCV DataFrame."""
    close = df['Close']
    high = df['High']
    low = df['Low']
    volume = df['Volume']

    indicators = {}

    # RSI (14-period)
    rsi = RSIIndicator(close=close, window=14)
    indicators['rsi'] = round(rsi.rsi().iloc[-1], 2) if not rsi.rsi().empty else 50

    # SMA 50 & 200
    sma50 = SMAIndicator(close=close, window=50)
    sma200 = SMAIndicator(close=close, window=200)
    indicators['sma50'] = round(sma50.sma_indicator().iloc[-1], 2) if len(close) >= 50 else None
    indicators['sma200'] = round(sma200.sma_indicator().iloc[-1], 2) if len(close) >= 200 else None

    # EMA 20
    ema20 = EMAIndicator(close=close, window=20)
    indicators['ema20'] = round(ema20.ema_indicator().iloc[-1], 2) if len(close) >= 20 else None

    # MACD
    macd = MACD(close=close)
    indicators['macd'] = round(macd.macd().iloc[-1], 2) if not macd.macd().empty else 0
    indicators['macd_signal'] = round(macd.macd_signal().iloc[-1], 2) if not macd.macd_signal().empty else 0
    indicators['macd_histogram'] = round(macd.macd_diff().iloc[-1], 2) if not macd.macd_diff().empty else 0

    # Bollinger Bands
    bb = BollingerBands(close=close, window=20)
    indicators['bb_upper'] = round(bb.bollinger_hband().iloc[-1], 2)
    indicators['bb_lower'] = round(bb.bollinger_lband().iloc[-1], 2)
    indicators['bb_middle'] = round(bb.bollinger_mavg().iloc[-1], 2)

    # ATR
    atr = AverageTrueRange(high=high, low=low, close=close, window=14)
    indicators['atr'] = round(atr.average_true_range().iloc[-1], 2)

    # Stochastic
    stoch = StochasticOscillator(high=high, low=low, close=close, window=14)
    indicators['stochastic_k'] = round(stoch.stoch().iloc[-1], 2) if not stoch.stoch().empty else 50

    # Current price
    indicators['current_price'] = round(close.iloc[-1], 2)

    # 52-week high/low
    last_252 = close.tail(252) if len(close) >= 252 else close
    indicators['fifty_two_week_high'] = round(last_252.max(), 2)
    indicators['fifty_two_week_low'] = round(last_252.min(), 2)

    # Volume trend (20-day avg vs current)
    vol_avg = volume.tail(20).mean()
    indicators['volume_avg_20d'] = round(vol_avg, 0)
    indicators['volume_current'] = round(volume.iloc[-1], 0)
    indicators['volume_trend'] = 'HIGH' if volume.iloc[-1] > vol_avg * 1.5 else ('LOW' if volume.iloc[-1] < vol_avg * 0.5 else 'NORMAL')

    # Momentum (returns)
    if len(close) >= 63:  # ~3 months
        indicators['momentum_3m'] = round(((close.iloc[-1] / close.iloc[-63]) - 1) * 100, 2)
    else:
        indicators['momentum_3m'] = 0

    if len(close) >= 126:  # ~6 months
        indicators['momentum_6m'] = round(((close.iloc[-1] / close.iloc[-126]) - 1) * 100, 2)
    else:
        indicators['momentum_6m'] = 0

    if len(close) >= 252:  # ~1 year
        indicators['momentum_1y'] = round(((close.iloc[-1] / close.iloc[-252]) - 1) * 100, 2)
    else:
        indicators['momentum_1y'] = 0

    return indicators


def score_stock(indicators):
    """
    Score a stock 0-100 based on technical indicators.
    Returns score, signal, confidence, and reasoning.
    """
    score = 50  # Start neutral
    reasons = []

    # --- RSI Analysis (max ±15 points) ---
    rsi = indicators.get('rsi', 50)
    if rsi < 30:
        score += 15
        reasons.append(f"📈 RSI at {rsi} — oversold territory, potential bounce ahead")
    elif rsi < 40:
        score += 8
        reasons.append(f"📈 RSI at {rsi} — approaching oversold, possible entry point")
    elif rsi > 70:
        score -= 15
        reasons.append(f"📉 RSI at {rsi} — overbought, could see pullback")
    elif rsi > 60:
        score -= 5
        reasons.append(f"⚠️ RSI at {rsi} — elevated but not extreme")
    else:
        reasons.append(f"➡️ RSI at {rsi} — neutral momentum")

    # --- SMA Crossover (max ±15 points) ---
    sma50 = indicators.get('sma50')
    sma200 = indicators.get('sma200')
    price = indicators.get('current_price', 0)

    if sma50 and sma200:
        if sma50 > sma200:
            score += 10
            reasons.append("📈 Golden Cross — SMA50 above SMA200, bullish long-term trend")
            if price > sma50:
                score += 5
                reasons.append("📈 Price above both SMAs — strong uptrend confirmed")
        else:
            score -= 10
            reasons.append("📉 Death Cross — SMA50 below SMA200, bearish long-term trend")
            if price < sma50:
                score -= 5
                reasons.append("📉 Price below both SMAs — downtrend confirmed")

    # --- MACD Analysis (max ±10 points) ---
    macd = indicators.get('macd', 0)
    macd_signal = indicators.get('macd_signal', 0)
    macd_hist = indicators.get('macd_histogram', 0)

    if macd > macd_signal and macd_hist > 0:
        score += 10
        reasons.append("📈 MACD bullish crossover — momentum shifting upward")
    elif macd < macd_signal and macd_hist < 0:
        score -= 10
        reasons.append("📉 MACD bearish crossover — momentum shifting downward")

    # --- Bollinger Band Position (max ±10 points) ---
    bb_upper = indicators.get('bb_upper', 0)
    bb_lower = indicators.get('bb_lower', 0)

    if bb_lower and price:
        if price <= bb_lower:
            score += 10
            reasons.append("📈 Price at lower Bollinger Band — potential reversal zone")
        elif price >= bb_upper:
            score -= 10
            reasons.append("📉 Price at upper Bollinger Band — possible resistance")

    # --- 52-Week Position (max ±10 points) ---
    high_52 = indicators.get('fifty_two_week_high', 0)
    low_52 = indicators.get('fifty_two_week_low', 0)

    if high_52 and low_52 and high_52 != low_52:
        position = (price - low_52) / (high_52 - low_52)
        if position < 0.2:
            score += 10
            reasons.append(f"📈 Near 52-week low ({round(position*100)}% of range) — deep value territory")
        elif position < 0.4:
            score += 5
            reasons.append(f"📈 In lower half of 52-week range ({round(position*100)}%)")
        elif position > 0.9:
            score -= 8
            reasons.append(f"📉 Near 52-week high ({round(position*100)}% of range) — limited upside")
        elif position > 0.7:
            score -= 3
            reasons.append(f"⚠️ In upper range ({round(position*100)}% of 52-week)")

    # --- Momentum Analysis (max ±10 points) ---
    mom_3m = indicators.get('momentum_3m', 0)
    mom_6m = indicators.get('momentum_6m', 0)

    if mom_3m > 10:
        score += 5
        reasons.append(f"📈 Strong 3-month momentum: +{mom_3m}%")
    elif mom_3m < -10:
        score -= 3
        reasons.append(f"📉 Weak 3-month momentum: {mom_3m}%")

    if mom_6m > 15 and mom_3m > 0:
        score += 5
        reasons.append(f"📈 Sustained upward trend over 6 months: +{mom_6m}%")
    elif mom_6m < -15:
        score -= 5
        reasons.append(f"📉 Sustained decline over 6 months: {mom_6m}%")

    # --- Volume Analysis (max ±5 points) ---
    vol_trend = indicators.get('volume_trend', 'NORMAL')
    if vol_trend == 'HIGH' and mom_3m > 0:
        score += 5
        reasons.append("📈 Above-average volume with positive momentum — accumulation likely")
    elif vol_trend == 'HIGH' and mom_3m < 0:
        score -= 5
        reasons.append("📉 Above-average volume with negative momentum — distribution likely")

    # --- Stochastic (max ±5 points) ---
    stoch = indicators.get('stochastic_k', 50)
    if stoch < 20:
        score += 5
        reasons.append(f"📈 Stochastic at {stoch} — deeply oversold")
    elif stoch > 80:
        score -= 5
        reasons.append(f"📉 Stochastic at {stoch} — deeply overbought")

    # Clamp score
    score = max(0, min(100, score))

    # Determine signal
    if score >= 75:
        signal = 'STRONG BUY'
    elif score >= 60:
        signal = 'BUY'
    elif score >= 45:
        signal = 'HOLD'
    elif score >= 30:
        signal = 'WAIT'
    else:
        signal = 'SELL'

    # Confidence based on number of strong signals
    strong_signals = sum(1 for r in reasons if '📈' in r or '📉' in r)
    confidence = min(95, 40 + strong_signals * 8)

    # Summary
    summary = generate_summary(signal, score, indicators, reasons)

    return {
        'score': score,
        'signal': signal,
        'confidence': confidence,
        'reasons': reasons,
        'summary': summary
    }


def generate_summary(signal, score, indicators, reasons):
    """Generate human-readable analysis summary."""
    price = indicators.get('current_price', 0)
    rsi = indicators.get('rsi', 50)
    mom_3m = indicators.get('momentum_3m', 0)

    bull_count = sum(1 for r in reasons if '📈' in r)
    bear_count = sum(1 for r in reasons if '📉' in r)

    if signal in ['STRONG BUY', 'BUY']:
        tone = f"The stock shows {bull_count} bullish signals against {bear_count} bearish signals. "
        tone += f"At ${price}, the technical setup suggests a favorable entry point for a 4-5 month position. "
        tone += f"RSI at {rsi} and {mom_3m:+.1f}% 3-month momentum support the bullish case."
    elif signal == 'HOLD':
        tone = f"Mixed signals with {bull_count} bullish and {bear_count} bearish indicators. "
        tone += f"At ${price}, the stock shows no clear directional bias. "
        tone += "Consider waiting for stronger confirmation before entering a new position."
    else:
        tone = f"The stock shows {bear_count} bearish signals against {bull_count} bullish signals. "
        tone += f"At ${price}, technical indicators suggest waiting for a better entry. "
        tone += f"RSI at {rsi} and {mom_3m:+.1f}% 3-month momentum indicate caution."

    return tone
