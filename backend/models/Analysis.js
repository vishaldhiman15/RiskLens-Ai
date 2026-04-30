const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  ticker: { type: String, required: true, uppercase: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  score: { type: Number, min: 0, max: 100 },
  signal: { type: String, enum: ['STRONG BUY', 'BUY', 'HOLD', 'WAIT', 'SELL'], required: true },
  confidence: { type: Number, min: 0, max: 100 },
  summary: { type: String },
  indicators: {
    rsi: Number,
    sma50: Number,
    sma200: Number,
    macd: Number,
    macdSignal: Number,
    bollingerUpper: Number,
    bollingerLower: Number,
    currentPrice: Number,
    fiftyTwoWeekHigh: Number,
    fiftyTwoWeekLow: Number,
    volumeTrend: String,
    momentum3m: Number,
    momentum6m: Number
  },
  forecast: {
    predictedPrice: Number,
    priceRangeLow: Number,
    priceRangeHigh: Number,
    horizon: { type: String, default: '4-5 months' },
    trendDirection: String
  },
  reasons: [String],
  createdAt: { type: Date, default: Date.now }
});

analysisSchema.index({ ticker: 1, createdAt: -1 });

module.exports = mongoose.model('Analysis', analysisSchema);
