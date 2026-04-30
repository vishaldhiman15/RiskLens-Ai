const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  profileImage: { type: String, default: '' },
  watchlist: [{ type: String }],
  portfolio: [{
    ticker: String,
    shares: Number,
    buyPrice: Number,
    buyDate: Date
  }],
  role: { type: String, enum: ['user', 'admin', 'founder', 'investor'], default: 'user' },
  startupName: { type: String, trim: true },
  investmentBudget: { type: String, trim: true },
  industry: { type: String, trim: true },
  stage: { type: String, trim: true },
  companyInvestments: [{
    companyName: String,
    amount: Number,
    date: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
