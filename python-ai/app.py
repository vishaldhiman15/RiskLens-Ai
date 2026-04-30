"""
StockSage Python AI Service
Flask API that runs technical analysis + price forecasting.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from analysis_engine import compute_indicators, score_stock
from forecaster import forecast_prophet

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'StockSage AI Engine'})


@app.route('/analyze/<ticker>', methods=['GET'])
def analyze(ticker):
    """Full analysis: technical indicators + scoring + forecast."""
    try:
        ticker = ticker.upper()
        
        # Clean up SerpAPI Google Finance format to Yahoo Finance format
        if ':' in ticker:
            ticker = ticker.split(':')[0]
            
        # Common Index Mappings (SerpAPI to Yahoo Finance)
        if ticker == '.DJI': ticker = '^DJI'
        elif ticker == '.INX': ticker = '^GSPC'
        elif ticker == '.IXIC': ticker = '^IXIC'
        elif ticker == 'RUT': ticker = '^RUT'
        elif ticker == 'VIX': ticker = '^VIX'

        # Fetch 2 years of data for indicators, 5 years for forecasting
        stock = yf.Ticker(ticker)
        df = stock.history(period='2y')

        if df.empty or len(df) < 50:
            return jsonify({'error': f'Insufficient data for {ticker}'}), 404

        # Compute technical indicators
        indicators = compute_indicators(df)

        # Score and generate signal
        result = score_stock(indicators)

        # Run forecast (4-5 months)
        df_forecast = stock.history(period='5y')
        if len(df_forecast) < 100:
            df_forecast = df

        forecast = forecast_prophet(df_forecast, periods=120)

        # Combine forecast into indicators for response
        response = {
            'ticker': ticker,
            'score': result['score'],
            'signal': result['signal'],
            'confidence': result['confidence'],
            'summary': result['summary'],
            'reasons': result['reasons'],
            'indicators': {
                'rsi': indicators.get('rsi'),
                'sma50': indicators.get('sma50'),
                'sma200': indicators.get('sma200'),
                'ema20': indicators.get('ema20'),
                'macd': indicators.get('macd'),
                'macdSignal': indicators.get('macd_signal'),
                'macdHistogram': indicators.get('macd_histogram'),
                'bollingerUpper': indicators.get('bb_upper'),
                'bollingerLower': indicators.get('bb_lower'),
                'bollingerMiddle': indicators.get('bb_middle'),
                'atr': indicators.get('atr'),
                'stochasticK': indicators.get('stochastic_k'),
                'currentPrice': indicators.get('current_price'),
                'fiftyTwoWeekHigh': indicators.get('fifty_two_week_high'),
                'fiftyTwoWeekLow': indicators.get('fifty_two_week_low'),
                'volumeTrend': indicators.get('volume_trend'),
                'volumeAvg20d': indicators.get('volume_avg_20d'),
                'momentum3m': indicators.get('momentum_3m'),
                'momentum6m': indicators.get('momentum_6m'),
                'momentum1y': indicators.get('momentum_1y'),
            },
            'forecast': {
                'predictedPrice': forecast.get('predicted_price'),
                'priceRangeLow': forecast.get('price_range_low'),
                'priceRangeHigh': forecast.get('price_range_high'),
                'horizon': forecast.get('horizon', '4-5 months'),
                'trendDirection': forecast.get('trend_direction'),
                'trendPercentage': forecast.get('trend_percentage'),
                'method': forecast.get('method')
            }
        }

        return jsonify(response)

    except Exception as e:
        print(f"Analysis error for {ticker}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/indicators/<ticker>', methods=['GET'])
def get_indicators(ticker):
    """Return just technical indicators without full analysis."""
    try:
        ticker = ticker.upper()
        stock = yf.Ticker(ticker)
        df = stock.history(period='2y')

        if df.empty:
            return jsonify({'error': f'No data for {ticker}'}), 404

        indicators = compute_indicators(df)
        return jsonify({'ticker': ticker, 'indicators': indicators})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/forecast/<ticker>', methods=['GET'])
def get_forecast(ticker):
    """Return just price forecast."""
    try:
        ticker = ticker.upper()
        months = int(request.args.get('months', 5))
        periods = months * 22  # ~22 trading days per month

        stock = yf.Ticker(ticker)
        df = stock.history(period='5y')

        if df.empty:
            return jsonify({'error': f'No data for {ticker}'}), 404

        forecast = forecast_prophet(df, periods=periods)
        return jsonify({'ticker': ticker, 'forecast': forecast})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/quote/<ticker>', methods=['GET'])
def get_quote(ticker):
    """Return basic quote data (price, change, etc)."""
    try:
        ticker = ticker.upper()
        if ':' in ticker: ticker = ticker.split(':')[0]
        if ticker == '.DJI': ticker = '^DJI'
        elif ticker == '.INX': ticker = '^GSPC'
        elif ticker == '.IXIC': ticker = '^IXIC'

        stock = yf.Ticker(ticker)
        info = stock.info
        
        # yf.Ticker.info can be flaky, fallback to history for current price
        current_price = info.get('regularMarketPrice') or info.get('currentPrice')
        if not current_price:
            hist = stock.history(period='1d')
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])

        # Get previous close for change calculation
        prev_close = info.get('regularMarketPreviousClose') or info.get('previousClose')
        if not prev_close:
            hist_prev = stock.history(period='5d')
            if len(hist_prev) > 1:
                prev_close = float(hist_prev['Close'].iloc[-2])
        
        change = (current_price - prev_close) if current_price and prev_close else 0
        percent = (change / prev_close * 100) if prev_close and prev_close != 0 else 0

        return jsonify({
            'ticker': ticker,
            'shortName': info.get('shortName', ticker),
            'longName': info.get('longName', info.get('shortName', ticker)),
            'regularMarketPrice': current_price,
            'regularMarketChange': change,
            'regularMarketChangePercent': percent,
            'marketCap': info.get('marketCap'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow'),
            'regularMarketVolume': info.get('regularMarketVolume'),
            'averageDailyVolume3Month': info.get('averageDailyVolume3Month'),
            'trailingPE': info.get('trailingPE')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/history/<ticker>', methods=['GET'])
def get_history(ticker):
    """Return historical data for charting."""
    try:
        ticker = ticker.upper()
        if ':' in ticker: ticker = ticker.split(':')[0]
        if ticker == '.DJI': ticker = '^DJI'
        elif ticker == '.INX': ticker = '^GSPC'
        elif ticker == '.IXIC': ticker = '^IXIC'

        period = request.args.get('period', '1y')
        stock = yf.Ticker(ticker)
        df = stock.history(period=period)

        if df.empty:
            return jsonify({'error': f'No history for {ticker}'}), 404

        history = []
        for index, row in df.iterrows():
            history.append({
                'date': index.isoformat(),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume'])
            })

        return jsonify({
            'ticker': ticker,
            'period': period,
            'count': len(history),
            'data': history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/search', methods=['GET'])
def search_stocks():
    """Simple stock search using Yahoo Finance Search API."""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'quotes': []})

        import requests
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
        res = requests.get(f"https://query2.finance.yahoo.com/v1/finance/search?q={query}", headers=headers)
        data = res.json()
        
        return jsonify({'quotes': data.get('quotes', [])})
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({'quotes': []})


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass  # Python < 3.7 or already configured
    print("""
    ╔══════════════════════════════════════════╗
    ║    🧠 StockSage AI Engine Running        ║
    ║    Port: 5001                             ║
    ╚══════════════════════════════════════════╝
    """)
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
