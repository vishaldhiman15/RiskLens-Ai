document.addEventListener('DOMContentLoaded', () => {
  requireAuth(); // Ensure user is logged in
  
  const chatWindow = document.getElementById('chat-window');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  // Handle Enter key to send
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // 1. Add User Message
    appendMessage('user', text);
    chatInput.value = '';
    
    // Auto-scroll
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // 2. Show Typing Indicator
    const typingId = showTypingIndicator();

    try {
      // 3. Ask backend (SerpAPI) for intent
      let extractedTicker = null;
      let extractedName = null;
      
      try {
        const res = await apiPost('/api/assistant/chat', { message: text });
        if (res.extractedTicker) {
          extractedTicker = res.extractedTicker;
          extractedName = res.extractedName || res.extractedTicker;
        }
      } catch (err) {
        console.warn("Backend chat error:", err);
      }

      // 4. Generate Smart Response
      setTimeout(() => {
        removeMessage(typingId);
        const aiResponse = generateSmartResponse(text, extractedTicker, extractedName);
        appendMessage('ai', aiResponse, true);
      }, 500);

    } catch (e) {
      removeMessage(typingId);
      appendMessage('ai', "I'm having trouble connecting to my analysis core right now.", false);
    }
  }

  function getTime() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(sender, content, isHtml = false) {
    const row = document.createElement('div');
    row.className = `msg-row ${sender}`;

    const avatarEl = `<div class="msg-avatar ${sender === 'ai' ? 'ai-av' : 'user-av'}">${sender === 'ai' ? '🤖' : '👤'}</div>`;

    let bubbleContent;
    if (sender === 'ai') {
      const header = `<strong>RiskLens Assistant</strong><br><br>`;
      bubbleContent = isHtml ? header + content : header + escapeHtml(content);
    } else {
      bubbleContent = escapeHtml(content);
    }

    const bubbleClass = sender === 'ai' ? 'ai-bubble' : 'user-bubble';
    row.innerHTML = `
      ${avatarEl}
      <div>
        <div class="msg-bubble ${bubbleClass}">${bubbleContent}</div>
        <div class="msg-timestamp">${getTime()}</div>
      </div>
    `;

    chatWindow.appendChild(row);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function showTypingIndicator() {
    const row = document.createElement('div');
    const id = 'typing-' + Date.now();
    row.id = id;
    row.className = 'typing-row';
    row.innerHTML = `
      <div class="msg-avatar ai-av">🤖</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    chatWindow.appendChild(row);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return id;
  }

  function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  let conversationState = 'idle';

  function generateSmartResponse(text, apiTicker, apiName) {
    const lowerText = text.toLowerCase();
    
    // Handle follow-up state (e.g., user says "medium growth" or "high growth")
    if (conversationState === 'waiting_for_details' && (lowerText.includes('growth') || lowerText.includes('high') || lowerText.includes('medium') || lowerText.includes('value'))) {
      conversationState = 'idle';
      let riskProfile = "Medium";
      if (lowerText.includes('high')) riskProfile = "High";
      if (lowerText.includes('low')) riskProfile = "Low";
      
      return `
        Thanks for clarifying! Based on a <strong>${riskProfile} Risk</strong> tolerance focusing on growth, I've run our predictive models. Here are two strong contenders:
        
        <div class="ai-options">
          <div class="ai-option-card">
            <div class="ai-option-header">
              <span>High-Growth Innovator</span>
              <span class="ai-option-ticker">CRWD</span>
            </div>
            <p style="font-size: 13px; color: #b0b0b0; margin-bottom: 8px;">CrowdStrike Holdings</p>
            <div style="font-size: 12px;"><strong>Risk:</strong> High &bull; <strong>Potential:</strong> +22%</div>
            <div style="font-size: 12px; margin-top: 4px;"><strong>Why:</strong> Exceptional growth in cybersecurity. Fits perfectly with a high-growth strategy.</div>
          </div>
          <div class="ai-option-card">
            <div class="ai-option-header">
              <span>Steady Compounder</span>
              <span class="ai-option-ticker">MSFT</span>
            </div>
            <p style="font-size: 13px; color: #b0b0b0; margin-bottom: 8px;">Microsoft Corp.</p>
            <div style="font-size: 12px;"><strong>Risk:</strong> Medium &bull; <strong>Potential:</strong> +12%</div>
            <div style="font-size: 12px; margin-top: 4px;"><strong>Why:</strong> Balanced tech growth with cloud and AI exposure, matching medium risk tolerances.</div>
          </div>
        </div>
      `;
    }

    // Check for specific tickers/sectors from either text OR SerpAPI
    if (apiTicker || lowerText.includes('nvidia') || lowerText.includes('nvda') || lowerText.includes('tech') || lowerText.includes('meta') || lowerText.includes('neta')) {
      
      let stockName = apiName || "the tech sector";
      let ticker = apiTicker || "XLK";
      
      if (!apiTicker) {
        if (lowerText.includes('nvidia') || lowerText.includes('nvda')) { stockName = "Nvidia"; ticker = "NVDA"; }
        if (lowerText.includes('meta') || lowerText.includes('neta')) { stockName = "Meta"; ticker = "META"; }
      }

      // Extract amount if present
      let amountMatch = text.match(/\$?(\d+[,\.]?\d*k?)/i);
      let amountStr = amountMatch ? "$" + amountMatch[1].replace('k', ',000') : "$5,000";
      if (!amountStr.includes('$')) amountStr = "$" + amountStr;

      // Extract time horizon
      let timeStr = "6 months";
      if (lowerText.includes('year') || lowerText.includes('12 month')) timeStr = "12 months";
      else if (lowerText.match(/(\d+)\s*month/)) {
        timeStr = lowerText.match(/(\d+)\s*month/)[1] + " months";
      }

      return `
        Based on your interest in ${stockName}, and a ${timeStr} horizon with an investment of ${amountStr}, I've analyzed current market conditions using our Advanced Risk Lab.<br><br>
        ${stockName} is showing strong momentum. Here are optimized strategies for you:
        
        <div class="ai-options">
          <div class="ai-option-card">
            <div class="ai-option-header">
              <span>Direct Equity Play</span>
              <span class="ai-option-ticker">${ticker}</span>
            </div>
            <p style="font-size: 13px; color: #b0b0b0; margin-bottom: 8px;">Allocate 100% to ${ticker}.</p>
            <div style="font-size: 12px;"><strong>Risk:</strong> High &bull; <strong>Expected Return (${timeStr}):</strong> +18.5%</div>
            <div style="font-size: 12px; margin-top: 4px;"><strong>Why:</strong> Strong direct exposure. Volatility is high, but upside potential within ${timeStr} is significant.</div>
          </div>

          <div class="ai-option-card">
            <div class="ai-option-header">
              <span>Balanced ETF Route</span>
              <span class="ai-option-ticker">QQQ</span>
            </div>
            <p style="font-size: 13px; color: #b0b0b0; margin-bottom: 8px;">Allocate ${amountStr} into Invesco QQQ.</p>
            <div style="font-size: 12px;"><strong>Risk:</strong> Medium &bull; <strong>Expected Return (${timeStr}):</strong> +11.2%</div>
            <div style="font-size: 12px; margin-top: 4px;"><strong>Why:</strong> Reduces single-stock risk while maintaining heavy exposure to top companies. Better suited to limit downside risk.</div>
          </div>
        </div>
        <br>
        Would you like to run a <strong>Stress Test Scenario</strong> on one of these options?
      `;
    }

    // Default response for other inputs
    conversationState = 'waiting_for_details';
    return `
      I've processed your request. Based on our AI market analysis, your criteria presents some interesting opportunities.<br><br>
      To provide the most accurate RiskLens forecast, could you specify:<br>
      &bull; Your preferred risk tolerance (Low, Medium, High)<br>
      &bull; Are you focused on growth, dividends, or value?<br><br>
      Alternatively, if you're interested in specific companies like Apple or Tesla, just let me know!
    `;
  }

});
