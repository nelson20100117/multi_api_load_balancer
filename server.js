import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const CONFIG_TEMPLATE = path.join(__dirname, 'config.example.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Global state
let config = { clientAccessKey: 'apikey', dashboardPassword: 'admin', keys: [], models: [] };
let logClients = [];
let requestLogs = [];
const activeSessions = new Set();

const LOGS_FILE = path.join(__dirname, 'logs.json');
let persistedLogs = [];

// Helper: load config from file
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(data);
      // Ensure structure is correct
      if (!config.keys) config.keys = [];
      if (!config.clientAccessKey) config.clientAccessKey = 'apikey';
      if (!config.dashboardPassword) config.dashboardPassword = 'admin';
    } else {
      saveConfig();
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

// Helper: save config to file
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Ping a single API key using Gemini 3.1 Flash Lite
async function pingKey(key) {
  const start = Date.now();
  try {
    const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key.apiKey}`;
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }]
      })
    });
    
    const elapsed = Date.now() - start;
    
    if (response.ok) {
      key.status = 'Healthy';
      key.lastError = null;
      key.latency = elapsed;
      key.successCount = (key.successCount || 0) + 1;
      return { success: true, latency: elapsed };
    } else {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error?.message || errorText;
      } catch (_) {}
      
      key.status = 'Failing';
      key.lastError = `${response.status} - ${errorMessage}`;
      key.errorCount = (key.errorCount || 0) + 1;
      return { success: false, error: errorMessage };
    }
  } catch (err) {
    key.status = 'Failing';
    key.lastError = `Network Error: ${err.message}`;
    key.errorCount = (key.errorCount || 0) + 1;
    return { success: false, error: err.message };
  }
}

// Broadcast updated configuration to all connected SSE log clients
function broadcastConfigUpdate() {
  const safeConfig = {
    clientAccessKey: config.clientAccessKey,
    routingStrategy: config.routingStrategy || 'priority',
    autoPingEnabled: config.autoPingEnabled === true,
    autoPingInterval: config.autoPingInterval || 15,
    keys: config.keys.map(k => ({
      id: k.id,
      name: k.name,
      apiKey: k.apiKey,
      enabled: k.enabled !== false,
      status: k.status || 'Idle',
      lastError: k.lastError || null,
      successCount: k.successCount || 0,
      errorCount: k.errorCount || 0,
      latency: k.latency || null
    })),
    models: config.models
  };
  const data = JSON.stringify({ type: 'config', config: safeConfig });
  logClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

// Auto-ping timer and run logic
let autoPingTimer = null;

async function runAutoPing() {
  console.log(`[Auto-Ping] Starting background latency test of all active keys...`);
  const activeKeys = config.keys.filter(k => k.apiKey && k.apiKey.trim() !== '' && k.enabled !== false);
  if (activeKeys.length === 0) {
    console.log(`[Auto-Ping] No enabled keys to test.`);
    return;
  }
  
  await Promise.allSettled(activeKeys.map(key => pingKey(key)));
  saveConfig();
  broadcastConfigUpdate();
  console.log(`[Auto-Ping] Background latency test complete.`);
}

function startAutoPingScheduler() {
  stopAutoPingScheduler();
  if (config.autoPingEnabled) {
    const minutes = Number(config.autoPingInterval) || 15;
    const intervalMs = minutes * 60 * 1000;
    console.log(`[Auto-Ping] Scheduler started. Auto-pinging keys every ${minutes} minute(s).`);
    autoPingTimer = setInterval(runAutoPing, intervalMs);
  }
}

function stopAutoPingScheduler() {
  if (autoPingTimer) {
    clearInterval(autoPingTimer);
    autoPingTimer = null;
    console.log(`[Auto-Ping] Scheduler stopped.`);
  }
}

// Helper: load logs from file
function loadLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const data = fs.readFileSync(LOGS_FILE, 'utf8');
      persistedLogs = JSON.parse(data);
      pruneLogs();
    }
  } catch (err) {
    console.error('Error loading logs:', err);
  }
}

// Helper: save logs to file
function saveLogs() {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(persistedLogs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving logs:', err);
  }
}

// Helper: prune logs older than 7 days
function pruneLogs() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const initialLength = persistedLogs.length;
  persistedLogs = persistedLogs.filter(l => new Date(l.timestamp).getTime() > cutoff);
  if (persistedLogs.length !== initialLength || !fs.existsSync(LOGS_FILE)) {
    saveLogs();
  }
}

// Helper: Broadcast log message to SSE clients
function broadcastLog(logEntry) {
  requestLogs.unshift(logEntry);
  if (requestLogs.length > 100) {
    requestLogs.pop();
  }
  
  // Persist final states to history
  if (logEntry.finalStatus === 'success' || logEntry.finalStatus === 'failed') {
    persistedLogs.unshift(logEntry);
    pruneLogs();
  }
  
  const data = JSON.stringify(logEntry);
  logClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

// Helper: Extract prompt snippet for logging
function getPromptSnippet(reqBody) {
  try {
    if (reqBody && reqBody.contents) {
      const contents = reqBody.contents;
      const lastMessage = contents[contents.length - 1];
      if (lastMessage && lastMessage.parts && lastMessage.parts.length > 0) {
        const text = lastMessage.parts[0].text || '';
        return text.length > 60 ? text.slice(0, 57) + '...' : text;
      }
    }
  } catch (e) {
    // ignore
  }
  return 'Unknown prompt';
}

// Load state initially
loadConfig();
loadLogs();
startAutoPingScheduler();

// Authentication Middleware for admin dashboard
function authMiddleware(req, res, next) {
  let token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    token = req.query.token;
  }
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired dashboard session token.' });
  }
  next();
}

// Admin Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const expectedPassword = config.dashboardPassword || 'admin';
  
  if (password === expectedPassword) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid password.' });
  }
});

// Admin Logout
app.post('/api/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// SSE Logs Stream (Secured)
app.get('/api/logs/stream', authMiddleware, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Send current history on connect
  res.write(`data: ${JSON.stringify({ type: 'history', logs: requestLogs })}\n\n`);
 
  logClients.push(res);
 
  req.on('close', () => {
    logClients = logClients.filter(client => client !== res);
  });
});

// GET historical logs for a given timeframe (Secured)
app.get('/api/logs', authMiddleware, (req, res) => {
  const timeframe = req.query.timeframe || '10m';
  const now = Date.now();
  let cutoff = now - 10 * 60 * 1000; // default 10 minutes
  
  if (timeframe === '1h') cutoff = now - 60 * 60 * 1000;
  else if (timeframe === '24h') cutoff = now - 24 * 60 * 60 * 1000;
  else if (timeframe === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
  
  const filtered = persistedLogs.filter(l => new Date(l.timestamp).getTime() > cutoff);
  res.json(filtered);
});

app.get('/api/config', authMiddleware, (req, res) => {
  res.json({
    clientAccessKey: config.clientAccessKey,
    routingStrategy: config.routingStrategy || 'priority',
    autoPingEnabled: config.autoPingEnabled === true,
    autoPingInterval: config.autoPingInterval || 15,
    keys: config.keys.map(k => ({
      id: k.id,
      name: k.name,
      apiKey: k.apiKey, // return full key since it's local administration dashboard
      enabled: k.enabled !== false,
      status: k.status || 'Idle',
      lastError: k.lastError || null,
      successCount: k.successCount || 0,
      errorCount: k.errorCount || 0,
      latency: k.latency || null
    })),
    models: config.models
  });
});

app.post('/api/config', authMiddleware, (req, res) => {
  const { clientAccessKey, keys, dashboardPassword, routingStrategy, autoPingEnabled, autoPingInterval } = req.body;
  
  if (clientAccessKey !== undefined) {
    config.clientAccessKey = clientAccessKey;
  }
  
  if (routingStrategy !== undefined) {
    config.routingStrategy = routingStrategy;
  }

  if (autoPingEnabled !== undefined) {
    config.autoPingEnabled = !!autoPingEnabled;
  }

  if (autoPingInterval !== undefined) {
    config.autoPingInterval = Number(autoPingInterval) || 15;
  }
  
  if (dashboardPassword !== undefined && dashboardPassword.trim() !== '') {
    config.dashboardPassword = dashboardPassword.trim();
  }
  
  if (Array.isArray(keys)) {
    // Keep count statistics if key is already there
    config.keys = keys.map(newKey => {
      const existingKey = config.keys.find(k => k.id === newKey.id || k.apiKey === newKey.apiKey);
      return {
        id: newKey.id || Math.random().toString(36).substring(2, 9),
        name: newKey.name || 'API Key',
        apiKey: newKey.apiKey,
        enabled: newKey.enabled !== false,
        status: newKey.status !== undefined ? newKey.status : (existingKey ? existingKey.status : 'Idle'),
        lastError: newKey.lastError !== undefined ? newKey.lastError : (existingKey ? existingKey.lastError : null),
        successCount: newKey.successCount !== undefined ? newKey.successCount : (existingKey ? existingKey.successCount : 0),
        errorCount: newKey.errorCount !== undefined ? newKey.errorCount : (existingKey ? existingKey.errorCount : 0),
        latency: newKey.latency !== undefined ? newKey.latency : (existingKey ? existingKey.latency : null)
      };
    });
  }

  saveConfig();
  
  // Restart auto-ping background scheduler to apply new settings
  startAutoPingScheduler();
  broadcastConfigUpdate();
  
  // Return safe config representation without dashboardPassword
  res.json({
    success: true,
    config: {
      clientAccessKey: config.clientAccessKey,
      routingStrategy: config.routingStrategy || 'priority',
      autoPingEnabled: config.autoPingEnabled === true,
      autoPingInterval: config.autoPingInterval || 15,
      keys: config.keys.map(k => ({
        id: k.id,
        name: k.name,
        apiKey: k.apiKey,
        enabled: k.enabled !== false,
        status: k.status || 'Idle',
        lastError: k.lastError || null,
        successCount: k.successCount || 0,
        errorCount: k.errorCount || 0,
        latency: k.latency || null
      })),
      models: config.models
    }
  });
});

// Reset key metrics (Secured)
app.post('/api/keys/:id/reset', authMiddleware, (req, res) => {
  const key = config.keys.find(k => k.id === req.params.id);
  if (key) {
    key.status = 'Idle';
    key.lastError = null;
    key.successCount = 0;
    key.errorCount = 0;
    key.latency = null;
    saveConfig();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Key not found' });
  }
});

// Test key connection and measure latency (Secured)
app.post('/api/keys/:id/test', authMiddleware, async (req, res) => {
  const key = config.keys.find(k => k.id === req.params.id);
  if (!key) {
    return res.status(404).json({ error: 'Key not found' });
  }
  
  const result = await pingKey(key);
  saveConfig();
  broadcastConfigUpdate();
  res.json(result);
});

// Intercept all Gemini generateContent/streamGenerateContent requests
app.post('/v1beta/models/:modelWithAction', async (req, res) => {
  const modelWithAction = req.params.modelWithAction;
  
  // 1. Authenticate Request
  // Check parameter 'key' in URL query or header 'x-goog-api-key'
  const providedKey = req.query.key || req.headers['x-goog-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!providedKey || providedKey !== config.clientAccessKey) {
    return res.status(401).json({
      error: {
        code: 401,
        message: 'Unauthorized Client Access Key. Provide a valid key in the query parameter `?key=YOUR_KEY` or the `x-goog-api-key` header.',
        status: 'UNAUTHENTICATED'
      }
    });
  }

  const forceKeyId = req.query.force_key || req.headers['x-proxy-force-key'];
  let activeKeys = config.keys.filter(k => k.apiKey && k.apiKey.trim() !== '' && k.enabled !== false);
  
  if (forceKeyId) {
    const forced = config.keys.find(k => k.id === forceKeyId);
    if (forced && forced.apiKey) {
      activeKeys = [forced];
    } else {
      return res.status(400).json({
        error: {
          code: 400,
          message: `Forced API Key '${forceKeyId}' not found or is missing its apiKey value.`,
          status: 'INVALID_ARGUMENT'
        }
      });
    }
  }

  if (!forceKeyId && config.routingStrategy === 'latency') {
    activeKeys = [...activeKeys].sort((a, b) => {
      const latA = a.latency === null || a.latency === undefined ? Infinity : a.latency;
      const latB = b.latency === null || b.latency === undefined ? Infinity : b.latency;
      return latA - latB;
    });
  }

  if (activeKeys.length === 0) {
    return res.status(503).json({
      error: {
        code: 503,
        message: 'No backend Gemini API keys configured in the load balancer. Add keys in the dashboard.',
        status: 'UNAVAILABLE'
      }
    });
  }

  const promptSnippet = getPromptSnippet(req.body);
  const logEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    model: modelWithAction,
    prompt: promptSnippet,
    routingChain: [],
    finalStatus: 'pending',
    selectedKeyName: null
  };

  // 2. Routing Fallback Engine
  let lastErrorObject = null;
  let success = false;

  for (let i = 0; i < activeKeys.length; i++) {
    const key = activeKeys[i];
    const attempt = {
      keyName: key.name,
      status: null,
      error: null
    };
    logEntry.routingChain.push(attempt);
    broadcastLog({ ...logEntry, finalStatus: 'processing' });

    try {
      // Build the upstream URL
      const upstreamUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${modelWithAction}`);
      upstreamUrl.searchParams.append('key', key.apiKey);
      for (const [qKey, qVal] of Object.entries(req.query)) {
        if (qKey !== 'key' && qKey !== 'force_key') {
          upstreamUrl.searchParams.append(qKey, qVal);
        }
      }

      // Forward request to Gemini API
      const requestStart = Date.now();
      const response = await fetch(upstreamUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optionally add user-agent or other headers
        },
        body: JSON.stringify(req.body)
      });

      attempt.status = response.status;

      if (response.ok) {
        const elapsed = Date.now() - requestStart;
        // SUCCESS!
        key.status = 'Healthy';
        key.lastError = null;
        key.latency = elapsed;
        key.successCount = (key.successCount || 0) + 1;
        saveConfig();

        logEntry.finalStatus = 'success';
        logEntry.selectedKeyName = key.name;
        broadcastLog(logEntry);

        // Forward the response headers
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json');
        res.setHeader('X-Proxy-Routing-Chain', JSON.stringify(logEntry.routingChain));
        
        // Check if response is streamable (chunked or event-stream)
        const isStreaming = response.headers.get('Transfer-Encoding') === 'chunked' || 
                            response.headers.get('Content-Type')?.includes('text/event-stream');

        if (isStreaming) {
          // Stream the response back to client
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } else {
          // Send JSON back
          const responseJson = await response.json();
          res.status(response.status).json(responseJson);
        }

        success = true;
        break; // Stop fallbacks!
      } else {
        // Error from Gemini API
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error?.message || errorText;
        } catch (_) {}

        attempt.error = errorMessage;
        key.status = 'Failing';
        key.lastError = `${response.status} - ${errorMessage}`;
        key.errorCount = (key.errorCount || 0) + 1;
        saveConfig();

        lastErrorObject = {
          status: response.status,
          body: errorText
        };
      }
    } catch (fetchError) {
      attempt.status = 'Network Error';
      attempt.error = fetchError.message;
      key.status = 'Failing';
      key.lastError = `Network Error: ${fetchError.message}`;
      key.errorCount = (key.errorCount || 0) + 1;
      saveConfig();

      lastErrorObject = {
        status: 502,
        body: JSON.stringify({
          error: {
            code: 502,
            message: `Network/connection error calling upstream Gemini API: ${fetchError.message}`,
            status: 'BAD_GATEWAY'
          }
        })
      };
    }
  }

  if (!success) {
    logEntry.finalStatus = 'failed';
    broadcastLog(logEntry);

    // Return the last error details to the client
    if (lastErrorObject) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Proxy-Routing-Chain', JSON.stringify(logEntry.routingChain));
      try {
        const parsed = JSON.parse(lastErrorObject.body);
        res.status(lastErrorObject.status).json(parsed);
      } catch (_) {
        res.status(lastErrorObject.status).send(lastErrorObject.body);
      }
    } else {
      res.setHeader('X-Proxy-Routing-Chain', JSON.stringify(logEntry.routingChain));
      res.status(500).json({
        error: {
          code: 500,
          message: 'All API keys failed to return a successful response.',
          status: 'INTERNAL'
        }
      });
    }
  }
});

// API Status Endpoint
app.get('/v1beta', (req, res) => {
  res.json({
    status: 'active',
    message: 'Gemini Multi-API Load Balancer Proxy is running.',
    docs: 'Configure backend keys in the dashboard at http://localhost:' + PORT,
    endpoints: {
      generateContent: '/v1beta/models/{model}:generateContent',
      streamGenerateContent: '/v1beta/models/{model}:streamGenerateContent'
    }
  });
});

// Fallback for SPA routing/index
app.get('*', (req, res) => {
  if (req.path.startsWith('/v1beta') || req.path.startsWith('/api')) {
    return res.status(404).json({
      error: {
        code: 404,
        message: `Resource not found: GET ${req.path}`,
        status: 'NOT_FOUND'
      }
    });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` Gemini Multi-API Load Balancer listening on port ${PORT}`);
  console.log(` Local Dashboard: http://localhost:${PORT}`);
  console.log(` Client API Endpoint: http://localhost:${PORT}/v1beta`);
  console.log(`======================================================\n`);
});
