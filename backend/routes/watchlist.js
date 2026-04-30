const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ watchlist: user.watchlist || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const user = await User.findById(req.user.id);
    const upperTicker = ticker.toUpperCase();

    if (user.watchlist.includes(upperTicker)) {
      return res.status(400).json({ error: 'Already in watchlist' });
    }

    user.watchlist.push(upperTicker);
    await user.save();
    res.json({ watchlist: user.watchlist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

router.delete('/:ticker', auth, async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const user = await User.findById(req.user.id);

    user.watchlist = user.watchlist.filter(t => t !== ticker);
    await user.save();
    res.json({ watchlist: user.watchlist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

router.post('/portfolio', auth, async (req, res) => {
  try {
    const { ticker, shares, buyPrice } = req.body;
    if (!ticker || !shares || !buyPrice) {
      return res.status(400).json({ error: 'ticker, shares, buyPrice required' });
    }

    const user = await User.findById(req.user.id);
    user.portfolio.push({
      ticker: ticker.toUpperCase(),
      shares: Number(shares),
      buyPrice: Number(buyPrice),
      buyDate: new Date()
    });
    await user.save();
    res.json({ portfolio: user.portfolio });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to portfolio' });
  }
});

router.get('/portfolio', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ portfolio: user.portfolio || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

router.delete('/portfolio/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.portfolio = user.portfolio.filter(p => p._id.toString() !== req.params.id);
    await user.save();
    res.json({ portfolio: user.portfolio });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from portfolio' });
  }
});

module.exports = router;
