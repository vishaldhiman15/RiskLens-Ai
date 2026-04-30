const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getJson } = require('serpapi');
require('dotenv').config({ path: __dirname + '/../.env' });

const SERPAPI_KEY = process.env.SERPAPI_KEY;

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Ensure we have a SerpAPI key
    if (!SERPAPI_KEY) {
      console.log("No SERPAPI_KEY, using basic fallback");
      return res.json({ fallback: true });
    }

    // Formulate a query for SerpAPI
    // We add "stock ticker" to nudge Google to give us a stock/finance box
    const query = `${message} stock ticker`;

    const searchResult = await getJson({
      engine: "google",
      q: query,
      api_key: SERPAPI_KEY
    });

    let extractedTicker = null;
    let extractedName = null;
    let context = [];

    // 1. Check for spelling corrections (neta -> meta)
    if (searchResult.search_information?.spelling_fix) {
      context.push(`Google corrected spelling to: ${searchResult.search_information.spelling_fix}`);
    }

    // 2. Check the Knowledge Graph for a stock ticker (e.g. Meta Platforms META)
    if (searchResult.knowledge_graph) {
      extractedName = searchResult.knowledge_graph.title;
      // Sometimes it's in a specific field, or we can just parse the title/description
      if (searchResult.knowledge_graph.type) {
        context.push(`Found Knowledge Graph: ${searchResult.knowledge_graph.title} (${searchResult.knowledge_graph.type})`);
      }
    }

    // 3. Look at the top organic results for ticker symbols (usually in format NASDAQ: AAPL or NYSE: CRM)
    for (const result of searchResult.organic_results || []) {
      const snippet = result.snippet || '';
      const title = result.title || '';
      
      // Look for (NASDAQ: XXX) or (NYSE: XXX)
      const tickerMatch = (snippet + ' ' + title).match(/(NASDAQ|NYSE|AMEX):\s*([A-Z]{1,5})/i);
      if (tickerMatch) {
        extractedTicker = tickerMatch[2].toUpperCase();
        if (!extractedName) extractedName = title.split(' ')[0]; // rough guess
        break;
      }
    }

    res.json({
      success: true,
      extractedTicker,
      extractedName,
      context,
      raw_query: query
    });

  } catch (error) {
    console.error("Assistant Chat Error:", error);
    res.status(500).json({ error: 'Assistant processing failed' });
  }
});

module.exports = router;
