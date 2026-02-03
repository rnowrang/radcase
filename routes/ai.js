const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getAIConfig() {
  const rows = db.prepare('SELECT key, value FROM ai_config').all();
  const config = {};
  rows.forEach(r => { config[r.key] = r.value; });
  return config;
}

function setAIConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO ai_config (key, value) VALUES (?, ?)').run(key, value);
}

// Generic AI call function supporting multiple providers
async function callAI(config, systemPrompt, messages, maxTokens = 1000) {
  const provider = config.provider.toLowerCase();

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  if (provider === 'openai' || provider === 'openai-compatible') {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const model = config.model || 'gpt-4o-mini';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        max_tokens: maxTokens,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }

    return data.choices[0].message.content;
  }

  if (provider === 'anthropic') {
    const model = config.model || 'claude-3-haiku-20240307';

    const anthropicMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: anthropicMessages
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }

    return data.content[0].text;
  }

  if (provider === 'ollama') {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const model = config.model || 'llama2';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: false
      })
    });

    const data = await response.json();
    return data.message.content;
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

// Check AI configuration status
router.get('/status', (req, res) => {
  const config = getAIConfig();
  res.json({
    configured: !!(config.provider && config.apiKey),
    provider: config.provider || null,
    model: config.model || null
  });
});

// Configure AI provider
router.post('/configure', requireAuth, (req, res) => {
  const { provider, apiKey, model, baseUrl } = req.body;

  if (provider) setAIConfig('provider', provider);
  if (apiKey) setAIConfig('apiKey', apiKey);
  if (model) setAIConfig('model', model);
  if (baseUrl) setAIConfig('baseUrl', baseUrl);

  res.json({ success: true });
});

// AI Chat endpoint
router.post('/chat', async (req, res, next) => {
  try {
    const config = getAIConfig();

    if (!config.provider || !config.apiKey) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    const { systemPrompt, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await callAI(config, systemPrompt, messages);
    res.json({ response });
  } catch (err) {
    res.status(502).json({ error: `AI service error: ${err.message}` });
  }
});

// AI Completion endpoint (single prompt)
router.post('/complete', async (req, res, next) => {
  try {
    const config = getAIConfig();

    if (!config.provider || !config.apiKey) {
      return res.status(503).json({ error: 'AI not configured' });
    }

    const { prompt, maxTokens } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await callAI(config, 'You are a helpful radiology education assistant.', [
      { role: 'user', content: prompt }
    ], maxTokens);
    res.json({ response });
  } catch (err) {
    res.status(502).json({ error: `AI service error: ${err.message}` });
  }
});

module.exports = router;
