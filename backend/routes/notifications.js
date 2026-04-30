const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(20);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
});

// Post a new notification (founders only)
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'founder') {
      return res.status(403).json({ error: 'Only founders can post notifications' });
    }

    const notification = new Notification({
      founderId: user._id,
      startupName: user.startupName || 'Unknown Startup',
      message
    });

    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Server error posting notification' });
  }
});

module.exports = router;
