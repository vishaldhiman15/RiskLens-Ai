const mongoose = require('mongoose');

const startupSchema = new mongoose.Schema({
  founderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  industry: { type: String, trim: true },
  stage: { type: String, trim: true },
  description: { type: String, trim: true },
  
  // Publicly visible metrics
  publicMetrics: {
    fundingGoal: { type: Number, default: 0 },
    valuation: { type: Number, default: 0 }
  },

  // Confidential metrics - only visible to the founder
  confidentialMetrics: {
    monthlyRecurringRevenue: { type: Number, default: 0 },
    burnRate: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    customerAcquisitionCost: { type: Number, default: 0 }
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Startup', startupSchema);
