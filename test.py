import yfinance as yf
stock = yf.Ticker('QQQ')
df = stock.history(period='2y')
print('LEN:', len(df))
