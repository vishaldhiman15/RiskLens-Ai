const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const topic = req.query.q || 'Indian stock market';
    const apiKey = "4bfb335317b54469880db563de8ed153"; // Using the user's provided key
    
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=en&sortBy=publishedAt&apiKey=${apiKey}`;
    
    // Fetch from NewsAPI on the backend side, bypassing browser CORS
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.status === 'error') {
      return res.status(400).json(data);
    }
    
    res.json(data);
  } catch (error) {
    console.error("News Proxy Error:", error);
    res.status(500).json({ status: 'error', message: 'Server error while fetching news' });
  }
});

module.exports = router;
