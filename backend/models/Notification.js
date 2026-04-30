const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  founderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startupName: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
