// Application State
let localKeys = [];
let localConfig = {};
let logStreamSource = null;
let localLogs = [];
let loadedHistoricalLogs = [];
let myChart = null;
let healthChart = null;
let localPingHistory = [];

// DOM Elements
const clientAccessKeyInput = document.getElementById('client-access-key-input');
const toggleClientKeyBtn = document.getElementById('toggle-client-key-btn');
const saveClientKeyBtn = document.getElementById('save-client-key-btn');
const keysListContainer = document.getElementById('keys-list');
const addKeyBtn = document.getElementById('add-key-btn');
const saveKeysBtn = document.getElementById('save-keys-btn');
const modelSelector = document.getElementById('model-selector');
const customModelInput = document.getElementById('custom-model-input');
const streamCheckbox = document.getElementById('stream-checkbox');
const promptInput = document.getElementById('prompt-input');
const sendPromptBtn = document.getElementById('send-prompt-btn');
const routingVisualizer = document.getElementById('routing-visualizer');
const routingStepsContainer = document.getElementById('routing-steps');
const responseOutputBox = document.getElementById('response-output-box');
const responseStatusSpan = document.getElementById('response-status');
const logsConsole = document.getElementById('logs-console');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const clearPingLogsBtn = document.getElementById('clear-ping-logs-btn');
const proxyStatusBadge = document.getElementById('proxy-status-badge');
const proxyStatusText = document.getElementById('proxy-status-text');
const routingStrategySelect = document.getElementById('routing-strategy-select');
const saveRoutingStrategyBtn = document.getElementById('save-routing-strategy-btn');
const batchTestBtn = document.getElementById('batch-test-btn');
const autoPingSwitch = document.getElementById('auto-ping-switch');
const autoPingIntervalSelect = document.getElementById('auto-ping-interval-select');
const saveAutoPingBtn = document.getElementById('save-auto-ping-btn');
const homeKeysStatusList = document.getElementById('home-keys-status-list');
const overviewKeysRatio = document.getElementById('overview-keys-ratio');
const overviewSuccessRate = document.getElementById('overview-success-rate');

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuth();
});

// Event Listeners
function setupEventListeners() {
  // Tab Routing listeners
  const tabHomeBtn = document.getElementById('tab-home-btn');
  const tabPlaygroundBtn = document.getElementById('tab-playground-btn');
  const tabAnalyticsBtn = document.getElementById('tab-analytics-btn');
  const tabSettingsBtn = document.getElementById('tab-settings-btn');
  const homeView = document.getElementById('home-view');
  const playgroundView = document.getElementById('playground-view');
  const analyticsView = document.getElementById('analytics-view');
  const settingsView = document.getElementById('settings-view');
  
  if (tabHomeBtn && tabPlaygroundBtn && tabAnalyticsBtn && tabSettingsBtn) {
    tabHomeBtn.addEventListener('click', () => {
      tabHomeBtn.classList.add('active');
      tabPlaygroundBtn.classList.remove('active');
      tabAnalyticsBtn.classList.remove('active');
      tabSettingsBtn.classList.remove('active');
      
      homeView.style.display = 'grid';
      playgroundView.style.display = 'none';
      analyticsView.style.display = 'none';
      settingsView.style.display = 'none';
    });
    
    tabPlaygroundBtn.addEventListener('click', () => {
      tabPlaygroundBtn.classList.add('active');
      tabHomeBtn.classList.remove('active');
      tabAnalyticsBtn.classList.remove('active');
      tabSettingsBtn.classList.remove('active');
      
      homeView.style.display = 'none';
      playgroundView.style.display = 'flex';
      analyticsView.style.display = 'none';
      settingsView.style.display = 'none';
    });
    
    tabAnalyticsBtn.addEventListener('click', async () => {
      tabAnalyticsBtn.classList.add('active');
      tabHomeBtn.classList.remove('active');
      tabPlaygroundBtn.classList.remove('active');
      tabSettingsBtn.classList.remove('active');
      
      homeView.style.display = 'none';
      playgroundView.style.display = 'none';
      analyticsView.style.display = 'flex';
      settingsView.style.display = 'none';
      
      const timeframeSelector = document.getElementById('analytics-timeframe');
      if (timeframeSelector && timeframeSelector.value !== '10m') {
        await loadHistoricalAnalytics(timeframeSelector.value);
      }
      updateAnalyticsChart();
      updateHealthChart(localPingHistory);
      renderHealthSheet(localPingHistory);
    });
    
    tabSettingsBtn.addEventListener('click', () => {
      tabSettingsBtn.classList.add('active');
      tabHomeBtn.classList.remove('active');
      tabPlaygroundBtn.classList.remove('active');
      tabAnalyticsBtn.classList.remove('active');
      
      homeView.style.display = 'none';
      playgroundView.style.display = 'none';
      analyticsView.style.display = 'none';
      settingsView.style.display = 'grid';
    });
  }

  // Analytics dropdown listeners
  const analyticsKeySelector = document.getElementById('analytics-key-selector');
  if (analyticsKeySelector) {
    analyticsKeySelector.addEventListener('change', () => {
      updateAnalyticsChart();
    });
  }

  const timeframeSelector = document.getElementById('analytics-timeframe');
  if (timeframeSelector) {
    timeframeSelector.addEventListener('change', async () => {
      const timeframe = timeframeSelector.value;
      if (timeframe !== '10m') {
        await loadHistoricalAnalytics(timeframe);
      }
      updateAnalyticsChart();
    });
  }

  // Toggle login password visibility
  const toggleLoginPasswordBtn = document.getElementById('toggle-login-password-btn');
  toggleLoginPasswordBtn.addEventListener('click', () => {
    const loginPasswordInput = document.getElementById('login-password-input');
    const isPassword = loginPasswordInput.type === 'password';
    loginPasswordInput.type = isPassword ? 'text' : 'password';
    toggleLoginPasswordBtn.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  // Login form submit
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById('login-password-input');
    const password = passwordInput.value;
    const errorMsg = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('login-submit-btn');
    
    submitBtn.disabled = true;
    errorMsg.style.display = 'none';
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      
      const data = await res.json();
      localStorage.setItem('dashboardSessionToken', data.token);
      passwordInput.value = '';
      checkAuth();
    } catch (err) {
      console.error(err);
      errorMsg.querySelector('span').innerText = err.message || 'Invalid Password';
      errorMsg.style.display = 'flex';
      
      // Shake animation
      const card = document.querySelector('.login-card');
      card.classList.remove('shake-animation');
      void card.offsetWidth; // trigger reflow
      card.classList.add('shake-animation');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('dashboardSessionToken');
    if (token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Logout error on server:', err);
      }
    }
    handleUnauthorized();
  });

  // Toggle dashboard password visibility
  const toggleDashboardKeyBtn = document.getElementById('toggle-dashboard-key-btn');
  const dashboardPasswordInput = document.getElementById('dashboard-password-input');
  toggleDashboardKeyBtn.addEventListener('click', () => {
    const isPassword = dashboardPasswordInput.type === 'password';
    dashboardPasswordInput.type = isPassword ? 'text' : 'password';
    toggleDashboardKeyBtn.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  // Save new dashboard password
  const saveDashboardKeyBtn = document.getElementById('save-dashboard-key-btn');
  saveDashboardKeyBtn.addEventListener('click', async () => {
    const newPassword = dashboardPasswordInput.value.trim();
    if (!newPassword) {
      alert('Dashboard Password cannot be empty');
      return;
    }
    await saveConfiguration({ dashboardPassword: newPassword });
    dashboardPasswordInput.value = '';
    showToast('Dashboard password updated successfully! Redirecting to login...', 'success');
    // Force logout since password changed
    setTimeout(handleUnauthorized, 1500);
  });

  // Toggle client key visibility
  toggleClientKeyBtn.addEventListener('click', () => {
    const isPassword = clientAccessKeyInput.type === 'password';
    clientAccessKeyInput.type = isPassword ? 'text' : 'password';
    toggleClientKeyBtn.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  // Save client access key
  saveClientKeyBtn.addEventListener('click', async () => {
    const newKey = clientAccessKeyInput.value.trim();
    if (!newKey) {
      alert('Client Access Key cannot be empty');
      return;
    }
    await saveConfiguration({ clientAccessKey: newKey });
  });

  // Add backend API key
  addKeyBtn.addEventListener('click', () => {
    const newKey = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Gemini Key ${localKeys.length + 1}`,
      apiKey: '',
      status: 'Idle',
      successCount: 0,
      errorCount: 0,
      lastError: null,
      enabled: true
    };
    localKeys.push(newKey);
    renderKeysList();
  });

  // Save keys configuration
  saveKeysBtn.addEventListener('click', async () => {
    // Validate keys
    const validKeys = localKeys.map(k => {
      const nameInput = document.getElementById(`name-${k.id}`);
      const keyInput = document.getElementById(`key-${k.id}`);
      return {
        id: k.id,
        name: nameInput ? nameInput.value.trim() : k.name,
        apiKey: keyInput ? keyInput.value.trim() : k.apiKey,
        enabled: k.enabled !== false
      };
    });

    if (validKeys.some(k => !k.apiKey)) {
      if (!confirm('Some keys are empty. Saving will remove them or save empty keys. Continue?')) {
        return;
      }
    }

    await saveConfiguration({ keys: validKeys.filter(k => k.apiKey.trim() !== '') });
  });

  // Clear log console display
  clearLogsBtn.addEventListener('click', () => {
    logsConsole.innerHTML = `
      <div class="log-line system-line">
        <span class="log-time">[System UI]</span> Console display cleared.
      </div>
    `;
  });

  // Clear ping health check logs
  if (clearPingLogsBtn) {
    clearPingLogsBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all health check history?')) return;
      try {
        const token = localStorage.getItem('dashboardSessionToken') || '';
        const res = await fetch('/api/logs/ping/clear', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.status === 401) {
          handleUnauthorized();
        }
      } catch (err) {
        console.error('Error clearing ping logs:', err);
      }
    });
  }

  // Handle model selection (custom option)
  modelSelector.addEventListener('change', () => {
    if (modelSelector.value === 'custom') {
      customModelInput.style.display = 'block';
      customModelInput.focus();
    } else {
      customModelInput.style.display = 'none';
    }
  });

  // Send Playground Prompt
  sendPromptBtn.addEventListener('click', sendPlaygroundPrompt);

  // Copy proxy URL
  document.getElementById('copy-endpoint-btn').addEventListener('click', () => {
    const urlText = document.getElementById('proxy-endpoint-url').innerText;
    navigator.clipboard.writeText(urlText).then(() => {
      const copyIcon = document.getElementById('copy-endpoint-btn').querySelector('i');
      copyIcon.className = 'fa-solid fa-check text-accent';
      setTimeout(() => {
        copyIcon.className = 'fa-regular fa-copy';
      }, 2000);
    });
  });
  
  // Save routing strategy
  if (saveRoutingStrategyBtn) {
    saveRoutingStrategyBtn.addEventListener('click', async () => {
      const newStrategy = routingStrategySelect.value;
      await saveConfiguration({ routingStrategy: newStrategy });
    });
  }

  // Save Auto-Ping settings
  if (saveAutoPingBtn) {
    saveAutoPingBtn.addEventListener('click', async () => {
      const enabled = autoPingSwitch.checked;
      const interval = parseInt(autoPingIntervalSelect.value, 10) || 15;
      await saveConfiguration({
        autoPingEnabled: enabled,
        autoPingInterval: interval
      });
    });
  }

  // Auto-Ping toggle switch change listener to save immediately
  if (autoPingSwitch) {
    autoPingSwitch.addEventListener('change', async () => {
      const enabled = autoPingSwitch.checked;
      const interval = parseInt(autoPingIntervalSelect.value, 10) || 15;
      await saveConfiguration({
        autoPingEnabled: enabled,
        autoPingInterval: interval
      });
    });
  }

  // Batch Test Keys
  if (batchTestBtn) {
    batchTestBtn.addEventListener('click', runBatchKeysTest);
  }
}

// API Functions
async function loadConfiguration(skipRenderKeys = false) {
  try {
    const token = localStorage.getItem('dashboardSessionToken') || '';
    const res = await fetch('/api/config', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch config');
    
    localConfig = await res.json();
    
    // Set UI values
    clientAccessKeyInput.value = localConfig.clientAccessKey || 'apikey';
    if (routingStrategySelect) {
      routingStrategySelect.value = localConfig.routingStrategy || 'priority';
    }
    if (autoPingSwitch) {
      autoPingSwitch.checked = localConfig.autoPingEnabled === true;
    }
    if (autoPingIntervalSelect) {
      autoPingIntervalSelect.value = localConfig.autoPingInterval || 15;
    }
    
    // Render models selector
    renderModelsSelector(localConfig.models);
    
    if (!skipRenderKeys) {
      localKeys = localConfig.keys || [];
      // Render keys list
      renderKeysList();
    }
    
    // Render read-only status board on Home tab
    renderKeyStatusBoard();
    
    // Populate dropdown selectors
    renderSelectorDropdowns();
    
    // Fetch and render ping history
    try {
      const pingRes = await fetch('/api/logs/ping', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pingRes.ok) {
        localPingHistory = await pingRes.json();
        // If the Analytics tab is active, update the health chart & table
        const analyticsView = document.getElementById('analytics-view');
        if (analyticsView && analyticsView.style.display !== 'none') {
          updateHealthChart(localPingHistory);
          renderHealthSheet(localPingHistory);
        }
      }
    } catch (pingErr) {
      console.error('Error loading ping logs:', pingErr);
    }
  } catch (err) {
    console.error('Error loading config:', err);
    updateServerStatus('failing', 'Server: Disconnected');
  }
}

async function saveConfiguration(updatedFields) {
  try {
    const token = localStorage.getItem('dashboardSessionToken') || '';
    
    // Build partial update payload based only on modified fields
    const payload = {};
    if (updatedFields.clientAccessKey !== undefined) payload.clientAccessKey = updatedFields.clientAccessKey;
    if (updatedFields.routingStrategy !== undefined) payload.routingStrategy = updatedFields.routingStrategy;
    if (updatedFields.keys !== undefined) payload.keys = updatedFields.keys;
    if (updatedFields.dashboardPassword !== undefined) payload.dashboardPassword = updatedFields.dashboardPassword;
    if (updatedFields.autoPingEnabled !== undefined) payload.autoPingEnabled = updatedFields.autoPingEnabled;
    if (updatedFields.autoPingInterval !== undefined) payload.autoPingInterval = updatedFields.autoPingInterval;

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('Failed to save config');
    
    const result = await res.json();
    showToast('Configuration saved successfully!', 'success');
    
    // If we didn't save keys, skip re-rendering them to preserve unsaved UI input changes
    const skipRenderKeys = updatedFields.keys === undefined;
    await loadConfiguration(skipRenderKeys); // reload fresh state
  } catch (err) {
    console.error('Error saving config:', err);
    showToast('Failed to save configuration', 'error');
  }
}

async function resetKeyMetrics(id) {
  try {
    const token = localStorage.getItem('dashboardSessionToken') || '';
    const res = await fetch(`/api/keys/${id}/reset`, { 
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('Failed to reset key metrics');
    showToast('Key metrics reset', 'success');
    await loadConfiguration();
  } catch (err) {
    console.error(err);
    showToast('Failed to reset key metrics', 'error');
  }
}

// Rendering Helpers
function renderModelsSelector(models) {
  modelSelector.innerHTML = '';
  
  if (!models || models.length === 0) return;

  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    if (model.isDefault) {
      option.selected = true;
    }
    modelSelector.appendChild(option);
  });

  // Add custom option
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Custom Model...';
  modelSelector.appendChild(customOption);
}

function renderKeysList() {
  keysListContainer.innerHTML = '';

  if (localKeys.length === 0) {
    keysListContainer.innerHTML = `
      <div class="no-keys-fallback">
        <i class="fa-solid fa-key"></i>
        <p>No keys added yet. Add at least one Gemini API key to start proxying requests.</p>
      </div>
    `;
    return;
  }

  localKeys.forEach((key, index) => {
    const isFirst = index === 0;
    const isLast = index === localKeys.length - 1;
    
    const keyItem = document.createElement('div');
    keyItem.className = `key-item${key.enabled === false ? ' disabled-key' : ''}`;
    keyItem.dataset.id = key.id;

    // Build the status message snippet
    let errorHelp = '';
    if (key.status === 'Failing' && key.lastError) {
      errorHelp = `title="Click to view error: ${key.lastError.replace(/"/g, '&quot;')}"`;
    }

    keyItem.innerHTML = `
      <div class="key-item-header">
        <span class="priority-tag">${isFirst ? 'Primary (Priority 1)' : 'Priority ' + (index + 1)}</span>
        <div class="key-actions-row">
          <label class="switch-container" title="Enable/Disable Key">
            <input type="checkbox" class="key-toggle" data-id="${key.id}" ${key.enabled !== false ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
          <button class="btn-arrow btn-up" data-index="${index}" ${isFirst ? 'disabled' : ''} title="Move Up">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <button class="btn-arrow btn-down" data-index="${index}" ${isLast ? 'disabled' : ''} title="Move Down">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <button class="btn-delete-key" data-id="${key.id}" title="Remove Key">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      
      <div class="key-fields">
        <div class="input-group" style="margin-bottom:0;">
          <input type="text" id="name-${key.id}" value="${key.name}" placeholder="Key Label (e.g. My Free Key)">
        </div>
        <div class="input-group" style="margin-bottom:0;">
          <input type="password" id="key-${key.id}" value="${key.apiKey}" placeholder="AIzaSy... (Gemini API Key)">
        </div>
      </div>

      <div class="key-stats">
        <span class="health-badge ${key.status || 'Idle'}" ${errorHelp}>
          Status: ${key.status || 'Idle'}
        </span>
        <div class="stats-numbers">
          <span>Success: <span class="stat-val stat-success">${key.successCount || 0}</span></span>
          <span>Failed: <span class="stat-val stat-error">${key.errorCount || 0}</span></span>
          <span>Latency: <span class="stat-val stat-latency">${key.latency ? key.latency + 'ms' : '--'}</span></span>
          <button class="btn-test-latency" data-id="${key.id}" title="Test API Connection Latency">Test</button>
          <button class="btn-reset-stats" data-id="${key.id}">Reset</button>
        </div>
      </div>
    `;

    // Add list item
    keysListContainer.appendChild(keyItem);
  });

  // Re-hook key list button events
  keysListContainer.querySelectorAll('.btn-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      swapKeys(idx, idx - 1);
    });
  });

  keysListContainer.querySelectorAll('.btn-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      swapKeys(idx, idx + 1);
    });
  });

  keysListContainer.querySelectorAll('.btn-delete-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      localKeys = localKeys.filter(k => k.id !== id);
      renderKeysList();
    });
  });

  keysListContainer.querySelectorAll('.btn-reset-stats').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      resetKeyMetrics(id);
    });
  });

  keysListContainer.querySelectorAll('.btn-test-latency').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      runManualLatencyTest(id, e.currentTarget);
    });
  });

  // Failing badge click triggers alert
  keysListContainer.querySelectorAll('.health-badge.Failing').forEach(badge => {
    badge.addEventListener('click', (e) => {
      alert(e.currentTarget.title || 'Unknown API failure');
    });
  });

  // Key enabled checkbox toggle
  keysListContainer.querySelectorAll('.key-toggle').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = e.currentTarget.dataset.id;
      const keyItem = keysListContainer.querySelector(`.key-item[data-id="${id}"]`);
      
      // Sync current inputs before toggling to prevent losing user edits
      localKeys.forEach(k => {
        const nameInput = document.getElementById(`name-${k.id}`);
        const keyInput = document.getElementById(`key-${k.id}`);
        if (nameInput) k.name = nameInput.value.trim();
        if (keyInput) k.apiKey = keyInput.value.trim();
      });

      const key = localKeys.find(k => k.id === id);
      if (key) {
        key.enabled = e.currentTarget.checked;
        if (key.enabled) {
          keyItem.classList.remove('disabled-key');
        } else {
          keyItem.classList.add('disabled-key');
        }
      }
    });
  });
}

function swapKeys(idxA, idxB) {
  // Sync current inputs before swapping
  localKeys.forEach(k => {
    const nameInput = document.getElementById(`name-${k.id}`);
    const keyInput = document.getElementById(`key-${k.id}`);
    if (nameInput) k.name = nameInput.value.trim();
    if (keyInput) k.apiKey = keyInput.value.trim();
  });

  const temp = localKeys[idxA];
  localKeys[idxA] = localKeys[idxB];
  localKeys[idxB] = temp;
  renderKeysList();
}

// SSE Logging Console
function initLogStream() {
  const token = localStorage.getItem('dashboardSessionToken') || '';
  if (logStreamSource) {
    logStreamSource.close();
  }
  
  logStreamSource = new EventSource(`/api/logs/stream?token=${encodeURIComponent(token)}`);

  logStreamSource.addEventListener('open', () => {
    updateServerStatus('idle', 'Server: Connected');
  });

  logStreamSource.addEventListener('error', (e) => {
    console.error('SSE Error:', e);
    updateServerStatus('failing', 'Server: Disconnected');
  });

  logStreamSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'history') {
      localLogs = []; // reset local buffer
      logsConsole.innerHTML = '';
      if (data.logs && data.logs.length > 0) {
        // Reverse array to print oldest first in console logs
        const sortedLogs = [...data.logs].reverse();
        sortedLogs.forEach(log => appendLogToConsole(log));
      } else {
        logsConsole.innerHTML = `
          <div class="log-line system-line">
            <span class="log-time">[System Init]</span> Connected. Logs will print here.
          </div>
        `;
      }
    } else if (data.type === 'auto-ping-history') {
      localPingHistory = data.history;
      renderPingLogs(data.history);
      renderHealthSheet(data.history);
      const analyticsView = document.getElementById('analytics-view');
      if (analyticsView && analyticsView.style.display !== 'none') {
        updateHealthChart(data.history);
      }
    } else if (data.type === 'config') {
      localConfig = data.config;
      localKeys = localConfig.keys || [];
      renderKeyStatusBoard();
      
      // Sync switch and selectors without re-rendering focus in Settings tab
      if (autoPingSwitch) {
        autoPingSwitch.checked = localConfig.autoPingEnabled === true;
      }
      if (autoPingIntervalSelect) {
        autoPingIntervalSelect.value = localConfig.autoPingInterval || 15;
      }
      if (routingStrategySelect) {
        routingStrategySelect.value = localConfig.routingStrategy || 'priority';
      }
    } else {
      appendLogToConsole(data);
    }
  };
}

function appendLogToConsole(log) {
  // Store in client array buffer if request is complete
  if (log.finalStatus === 'success' || log.finalStatus === 'failed') {
    if (!localLogs.some(l => l.id === log.id)) {
      localLogs.unshift(log);
      if (localLogs.length > 100) {
        localLogs.pop();
      }
      
      // Update chart dynamically if timeframe is 10m
      const timeframeSelector = document.getElementById('analytics-timeframe');
      if (timeframeSelector && timeframeSelector.value === '10m') {
        updateAnalyticsChart();
      }
    }
  }

  const line = document.createElement('div');
  line.className = 'log-line';
  
  const time = new Date(log.timestamp).toLocaleTimeString();
  const timeSpan = `<span class="log-time">[${time}]</span>`;
  const routeString = `${log.model} - "${log.prompt}"`;

  if (log.finalStatus === 'processing') {
    line.className += ' warning-line';
    const attemptIndex = log.routingChain.length;
    const lastAttempt = log.routingChain[attemptIndex - 1];
    const attemptText = attemptIndex > 1 ? ` (Attempt ${attemptIndex})` : '';
    line.innerHTML = `${timeSpan} Routing to key: <strong style="color:var(--accent-cyan);">${lastAttempt.keyName}</strong>${attemptText}... | model: ${routeString}`;
  } else if (log.finalStatus === 'success') {
    line.className += ' success-line';
    const chainLength = log.routingChain.length;
    const fallbackText = chainLength > 1 ? ` (Fell back ${chainLength - 1} times)` : '';
    line.innerHTML = `${timeSpan} <i class="fa-solid fa-circle-check"></i> Routed successfully to <strong>${log.selectedKeyName}</strong>${fallbackText} | model: ${routeString}`;
    
    // Refresh configuration stats after successful request
    setTimeout(loadConfiguration, 800);
  } else if (log.finalStatus === 'failed') {
    line.className += ' error-line';
    line.innerHTML = `${timeSpan} <i class="fa-solid fa-circle-xmark"></i> FAILED all keys | model: ${routeString}`;
    
    // Refresh configuration stats after failed request
    setTimeout(loadConfiguration, 800);
  }

  // Check if we need to remove the placeholder
  const placeholder = logsConsole.querySelector('.system-line');
  if (placeholder && logsConsole.children.length === 1 && placeholder.innerText.includes('initialized')) {
    logsConsole.innerHTML = '';
  }

  logsConsole.appendChild(line);
  logsConsole.scrollTop = logsConsole.scrollHeight;
}

function updateServerStatus(status, text) {
  proxyStatusBadge.className = `status-badge ${status}`;
  proxyStatusText.innerText = text;
}

// Toast Notifications
function showToast(message, type = 'success') {
  // Simple toast using overlay style
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.padding = '0.75rem 1.25rem';
  toast.style.borderRadius = '6px';
  toast.style.fontFamily = 'var(--font-sans)';
  toast.style.fontSize = '0.85rem';
  toast.style.fontWeight = '500';
  toast.style.zIndex = '9999';
  toast.style.transition = 'all 0.3s ease';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '0.5rem';
  toast.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.5)';

  if (type === 'success') {
    toast.style.background = 'rgba(16, 185, 129, 0.9)';
    toast.style.color = '#fff';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
  } else {
    toast.style.background = 'rgba(239, 110, 110, 0.9)';
    toast.style.color = '#fff';
    toast.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${message}`;
  }

  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 50);

  // Remove toast
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Playground Prompt Execution
async function sendPlaygroundPrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    alert('Please enter a prompt');
    return;
  }

  // Determine model
  let modelId = modelSelector.value;
  if (modelId === 'custom') {
    modelId = customModelInput.value.trim();
    if (!modelId) {
      alert('Please enter a custom model ID');
      return;
    }
  }

  const stream = streamCheckbox.checked;
  const clientKey = clientAccessKeyInput.value.trim();

  // Reset visualizer and output
  routingVisualizer.style.display = 'block';
  routingStepsContainer.innerHTML = `
    <div class="routing-step">
      <span class="routing-step-status status-pending">INIT</span>
      <span class="routing-step-name">Client Authorization</span>
      <span class="routing-step-desc">Verifying access key...</span>
    </div>
  `;
  responseStatusSpan.className = '';
  responseStatusSpan.textContent = 'Processing...';
  responseOutputBox.innerHTML = '';

  // Disable UI during run
  sendPromptBtn.disabled = true;
  promptInput.disabled = true;
  
  // Build routing steps UI
  const addStep = (statusClass, statusText, name, desc) => {
    const step = document.createElement('div');
    step.className = 'routing-step';
    step.innerHTML = `
      <span class="routing-step-status ${statusClass}">${statusText}</span>
      <span class="routing-step-name">${name}</span>
      <span class="routing-step-desc">${desc}</span>
    `;
    routingStepsContainer.appendChild(step);
  };

  try {
    const routeTargetSelector = document.getElementById('route-target-selector');
    const routeTarget = routeTargetSelector ? routeTargetSelector.value : 'all';

    let endpoint = `/v1beta/models/${modelId}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${clientKey}`;
    if (routeTarget !== 'all') {
      endpoint += `&force_key=${encodeURIComponent(routeTarget)}`;
    }
    
    // Prepare request payload matching Gemini structure
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Read custom routing headers if available
    const routingChainHeader = res.headers.get('X-Proxy-Routing-Chain');
    if (routingChainHeader) {
      try {
        const chain = JSON.parse(routingChainHeader);
        // Clear previous step
        routingStepsContainer.innerHTML = '';
        chain.forEach((attempt, index) => {
          const isSuccess = attempt.status === 200;
          const statusText = attempt.status || 'FAIL';
          const statusClass = isSuccess ? 'status-200' : 'status-error';
          const desc = isSuccess 
            ? `Successfully generated content.` 
            : `Failed: ${attempt.error || 'Unknown Error'}`;
          
          addStep(statusClass, statusText, attempt.keyName, desc);
        });
      } catch (e) {
        console.error('Error parsing routing header:', e);
      }
    }

    if (!res.ok) {
      const errData = await res.json();
      const message = errData.error?.message || `HTTP ${res.status} Error`;
      
      responseStatusSpan.className = 'error';
      responseStatusSpan.textContent = `Error (${res.status})`;
      responseOutputBox.innerHTML = `<span style="color:var(--accent-red);">${escapeHtml(message)}</span>`;
      
      addStep('status-error', res.status, 'Failover Exhausted', 'All configured keys returned errors.');
      return;
    }

    responseStatusSpan.className = 'success';
    responseStatusSpan.textContent = stream ? 'Streaming Complete' : 'Success';

    if (stream) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });
        buffer += textChunk;

        // Process buffer chunks
        // In SSE streaming mode, Gemini sends data as JSON chunks.
        // If alt=sse is not used, it is sent as a JSON array or newline delimited.
        // To be robust, let's look for text content within the raw chunks or try to parse
        // it if it matches JSON chunks.
        // Usually, the response returned is either raw JSON text strings or array components.
        // Let's implement a parser to extract parts[].text from the stream buffer.
        
        // Let's attempt to clean up and print the text chunks.
        // If the chunk contains JSON text, let's extract the "text" contents:
        // We can do a regex match or simple parsing since Gemini streams look like:
        // {"candidates": [{"content": {"parts": [{"text": "..."}]}}]}
        // Or if it is a JSON array chunk:
        // [ {"candidates": [{"content": {"parts": [{"text": "..."}]}}]} ]
        
        parseStreamBuffer(buffer);
      }
    } else {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data, null, 2);
      responseOutputBox.innerText = text;
    }
  } catch (err) {
    console.error('Playground Request Error:', err);
    responseStatusSpan.className = 'error';
    responseStatusSpan.textContent = 'Request Failed';
    responseOutputBox.innerHTML = `<span style="color:var(--accent-red);">Network Error: ${escapeHtml(err.message)}</span>`;
    addStep('status-error', 'ERR', 'Network Failure', `Unable to contact local proxy server: ${err.message}`);
  } finally {
    sendPromptBtn.disabled = false;
    promptInput.disabled = false;
  }
}

// Robust streaming parser to parse raw chunks into text content
function parseStreamBuffer(buffer) {
  // Let's try to extract text dynamically from the buffer
  // In standard Gemini streams:
  // - Responses can come as a single continuous JSON array structure where items are comma separated,
  //   e.g. `[\n{\n  "candidates": ...\n},\n{\n  "candidates": ...\n}\n]`
  // Or they can come in Server-Sent Events formats:
  //   `data: {...}\n\n`
  // Let's match all `"text": "..."` keys in the JSON buffer.
  // Wait, matching via regex `/"text":\s*"((?:[^"\\]|\\.)*)"/g` is highly robust and performs extremely well
  // for streaming displays because it finds every text token incrementally without needing complete JSON arrays to compile!
  // Let's do this and decode JSON escape sequences!
  
  let matches;
  const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
  let textOut = '';
  
  while ((matches = regex.exec(buffer)) !== null) {
    // Decode the escaped JSON string
    try {
      const decodedVal = JSON.parse(`"${matches[1]}"`);
      textOut += decodedVal;
    } catch (_) {
      // fallback to raw match
      textOut += matches[1];
    }
  }

  if (textOut) {
    responseOutputBox.innerText = textOut;
  } else {
    // Fallback: if we can't extract text but have some response, just display the raw text
    responseOutputBox.innerText = buffer;
  }
}

// Helpers
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Auth Check and Handler Helpers
function checkAuth() {
  const token = localStorage.getItem('dashboardSessionToken');
  const loginOverlay = document.getElementById('login-overlay');
  const navTabs = document.getElementById('nav-tabs');
  
  if (!token) {
    loginOverlay.style.display = 'flex';
    if (navTabs) navTabs.style.display = 'none';
    document.getElementById('login-password-input').focus();
  } else {
    loginOverlay.style.display = 'none';
    if (navTabs) navTabs.style.display = 'flex';
    loadConfiguration();
    initLogStream();
  }
}

function handleUnauthorized() {
  localStorage.removeItem('dashboardSessionToken');
  if (logStreamSource) {
    logStreamSource.close();
    logStreamSource = null;
  }
  checkAuth();
}

// Latency Ping testing (Manual trigger)
async function runManualLatencyTest(id, btnElement) {
  btnElement.disabled = true;
  const originalHtml = btnElement.innerHTML;
  btnElement.innerText = 'Testing...';
  
  try {
    const token = localStorage.getItem('dashboardSessionToken') || '';
    const res = await fetch(`/api/keys/${id}/test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    const data = await res.json();
    if (data.success) {
      showToast(`Connection successful! Latency: ${data.latency}ms`, 'success');
    } else {
      showToast(`Connection failed: ${data.error || 'Unknown error'}`, 'error');
    }
    await loadConfiguration(); // reload configurations to update latency stats
  } catch (err) {
    console.error('Latency test error:', err);
    showToast(`Test request failed: ${err.message}`, 'error');
  } finally {
    btnElement.disabled = false;
    btnElement.innerHTML = originalHtml;
  }
}

// Update selectors
function renderSelectorDropdowns() {
  const routeTargetSelector = document.getElementById('route-target-selector');
  const analyticsKeySelector = document.getElementById('analytics-key-selector');
  
  if (routeTargetSelector) {
    const currentRouteVal = routeTargetSelector.value;
    routeTargetSelector.innerHTML = '<option value="all">Load Balancer (Proxy Loop)</option>';
    localKeys.forEach(key => {
      if (key.apiKey && key.apiKey.trim() !== '') {
        const option = document.createElement('option');
        option.value = key.id;
        option.textContent = `${key.name} (${key.status || 'Idle'})`;
        routeTargetSelector.appendChild(option);
      }
    });
    if (routeTargetSelector.querySelector(`option[value="${currentRouteVal}"]`)) {
      routeTargetSelector.value = currentRouteVal;
    }
  }

  if (analyticsKeySelector) {
    const currentAnalyticsVal = analyticsKeySelector.value;
    analyticsKeySelector.innerHTML = '<option value="all">All Keys Combined</option>';
    localKeys.forEach(key => {
      if (key.apiKey && key.apiKey.trim() !== '') {
        const option = document.createElement('option');
        option.value = key.name;
        option.textContent = key.name;
        analyticsKeySelector.appendChild(option);
      }
    });
    if (analyticsKeySelector.querySelector(`option[value="${currentAnalyticsVal}"]`)) {
      analyticsKeySelector.value = currentAnalyticsVal;
    }
  }
}

// Timeframe load helper
async function loadHistoricalAnalytics(timeframe) {
  try {
    const token = localStorage.getItem('dashboardSessionToken') || '';
    const res = await fetch(`/api/logs?timeframe=${timeframe}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch historical logs');
    loadedHistoricalLogs = await res.json();
  } catch (err) {
    console.error('Error fetching logs:', err);
    showToast('Failed to load historical data', 'error');
  }
}

// Line Chart Renderer and Metrics Calculator
function updateAnalyticsChart() {
  const timeframeSelector = document.getElementById('analytics-timeframe');
  const timeframe = timeframeSelector ? timeframeSelector.value : '10m';
  
  const keySelector = document.getElementById('analytics-key-selector');
  const selectedKey = keySelector ? keySelector.value : 'all';
  
  const now = Date.now();
  const buckets = [];
  const labels = [];
  
  let numBuckets = 6;
  let intervalMs = 60 * 1000; // 1 minute default
  let formatOption = { minute: '2-digit', second: '2-digit' };
  
  if (timeframe === '10m') {
    numBuckets = 10;
    intervalMs = 60 * 1000; // 1 minute
    formatOption = { hour: '2-digit', minute: '2-digit' };
  } else if (timeframe === '1h') {
    numBuckets = 6;
    intervalMs = 10 * 60 * 1000; // 10 minutes
    formatOption = { hour: '2-digit', minute: '2-digit' };
  } else if (timeframe === '24h') {
    numBuckets = 12;
    intervalMs = 2 * 60 * 60 * 1000; // 2 hours
    formatOption = { month: 'short', day: '2-digit', hour: '2-digit' };
  } else if (timeframe === '7d') {
    numBuckets = 7;
    intervalMs = 24 * 60 * 60 * 1000; // 1 day
    formatOption = { month: 'short', day: '2-digit' };
  }
  
  for (let i = numBuckets - 1; i >= 0; i--) {
    const start = now - (i + 1) * intervalMs;
    const end = now - i * intervalMs;
    buckets.push({ start, end, activity: 0, success: 0, fail: 0 });
    
    let timeLabel = '';
    if (timeframe === '7d') {
      timeLabel = new Date(end).toLocaleDateString([], formatOption);
    } else {
      timeLabel = new Date(end).toLocaleTimeString([], formatOption);
    }
    labels.push(timeLabel);
  }
  
  const logsToProcess = (timeframe === '10m') ? localLogs : loadedHistoricalLogs;
  
  buckets.forEach(bucket => {
    logsToProcess.forEach(log => {
      const logTime = new Date(log.timestamp).getTime();
      if (logTime >= bucket.start && logTime < bucket.end) {
        if (selectedKey === 'all') {
          bucket.activity++;
          if (log.finalStatus === 'success') bucket.success++;
          else if (log.finalStatus === 'failed') bucket.fail++;
        } else {
          const attempt = log.routingChain?.find(a => a.keyName === selectedKey);
          if (attempt) {
            bucket.activity++;
            if (attempt.status === 200) bucket.success++;
            else bucket.fail++;
          }
        }
      }
    });
  });
  
  const activityData = [];
  const successRateData = [];
  const failRateData = [];
  
  buckets.forEach(b => {
    activityData.push(b.activity);
    const successRate = b.activity > 0 ? Math.round((b.success / b.activity) * 100) : 0;
    const failRate = b.activity > 0 ? Math.round((b.fail / b.activity) * 100) : 0;
    successRateData.push(successRate);
    failRateData.push(failRate);
  });
  
  // Calculate summary metrics
  let totalRequests = 0;
  let totalSuccess = 0;
  let totalFail = 0;
  let latencySum = 0;
  let latencyCount = 0;
  
  logsToProcess.forEach(log => {
    if (selectedKey === 'all') {
      totalRequests++;
      if (log.finalStatus === 'success') totalSuccess++;
      if (log.finalStatus === 'failed') totalFail++;
      
      // Calculate average latency based on attempts that returned success
      log.routingChain?.forEach(attempt => {
        if (attempt.status === 200) {
          // find key to fetch latency, or if not possible, use historical logs metadata if we store it
          // Wait, logEntry has no latency property on the root. We can read latency from the keys if loaded,
          // or we can read it from the attempt. Wait! We didn't save latency to the log attempt.
          // Wait, let's see: we can calculate average latency based on keys currently in configuration,
          // or we can add latency to logEntry. Since we didn't add latency to logEntry, let's calculate average latency
          // using config key latencies! Or we can sum key latencies.
          // Wait, the best way to calculate real-time latency average is:
          // Check key latencies in configuration!
        }
      });
    } else {
      const attempt = log.routingChain?.find(a => a.keyName === selectedKey);
      if (attempt) {
        totalRequests++;
        if (attempt.status === 200) totalSuccess++;
        else totalFail++;
      }
    }
  });

  // Calculate average latency of keys
  let avgLatency = 0;
  if (selectedKey === 'all') {
    localKeys.forEach(k => {
      if (k.latency) {
        latencySum += k.latency;
        latencyCount++;
      }
    });
  } else {
    const key = localKeys.find(k => k.name === selectedKey);
    if (key && key.latency) {
      latencySum = key.latency;
      latencyCount = 1;
    }
  }
  avgLatency = latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0;
  
  document.getElementById('stat-total-requests').innerText = totalRequests;
  document.getElementById('stat-success-rate').innerText = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) + '%' : '0%';
  document.getElementById('stat-fail-rate').innerText = totalRequests > 0 ? Math.round((totalFail / totalRequests) * 100) + '%' : '0%';
  document.getElementById('stat-avg-latency').innerText = avgLatency > 0 ? avgLatency + 'ms' : '--';

  const chartCanvas = document.getElementById('analyticsChart');
  if (!chartCanvas || !window.Chart) return;
  
  const ctx = chartCanvas.getContext('2d');
  
  if (myChart) {
    myChart.data.labels = labels;
    myChart.data.datasets[0].data = activityData;
    myChart.data.datasets[1].data = successRateData;
    myChart.data.datasets[2].data = failRateData;
    myChart.update('none');
  } else {
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Activity (Requests)',
            data: activityData,
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0, 240, 255, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Success Rate (%)',
            data: successRateData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderWidth: 2,
            tension: 0.3,
            yAxisID: 'y1'
          },
          {
            label: 'Fail Rate (%)',
            data: failRateData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderWidth: 2,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Inter' } }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#00f0ff' },
            title: { display: true, text: 'Requests Count', color: '#00f0ff' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#cbd5e1' },
            title: { display: true, text: 'Percentage (%)', color: '#cbd5e1' },
            min: 0,
            max: 100
          }
        },
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Inter' } }
          }
        }
      }
    });
  }
}

// Dynamic Health & Latency status board rendering for Home tab
function renderKeyStatusBoard() {
  if (!homeKeysStatusList) return;

  homeKeysStatusList.innerHTML = '';
  
  // Filter keys that have API keys set
  const configuredKeys = localKeys.filter(k => k.apiKey && k.apiKey.trim() !== '');
  
  if (configuredKeys.length === 0) {
    homeKeysStatusList.innerHTML = `
      <div class="no-keys-fallback" style="padding: 1.5rem 1rem;">
        <i class="fa-solid fa-key" style="font-size: 1.5rem;"></i>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">No keys configured yet. Go to Settings tab to add keys.</p>
      </div>
    `;
    if (overviewKeysRatio) overviewKeysRatio.innerText = '0 / 0';
    if (overviewSuccessRate) overviewSuccessRate.innerText = '0%';
    return;
  }

  let healthyCount = 0;
  let totalSuccess = 0;
  let totalError = 0;

  configuredKeys.forEach(key => {
    if (key.enabled !== false && key.status === 'Healthy') {
      healthyCount++;
    }
    
    totalSuccess += key.successCount || 0;
    totalError += key.errorCount || 0;
    
    const item = document.createElement('div');
    item.className = 'key-status-board-item';
    
    let statusClass = 'idle';
    let statusLabel = key.status || 'Idle';
    if (key.enabled === false) {
      statusClass = 'disabled';
      statusLabel = 'Disabled';
    } else if (key.status === 'Healthy') {
      statusClass = 'healthy';
    } else if (key.status === 'Failing') {
      statusClass = 'failing';
    }

    item.innerHTML = `
      <div class="key-status-name">${key.name}</div>
      <div class="key-status-meta">
        <span class="latency-pill">${key.latency ? key.latency + 'ms' : '--'}</span>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>
    `;
    homeKeysStatusList.appendChild(item);
  });

  const activeEnabledKeysCount = configuredKeys.filter(k => k.enabled !== false).length;
  if (overviewKeysRatio) {
    overviewKeysRatio.innerText = `${healthyCount} / ${activeEnabledKeysCount}`;
  }

  const totalRequests = totalSuccess + totalError;
  const globalSuccessPercentage = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 0;
  if (overviewSuccessRate) {
    overviewSuccessRate.innerText = `${globalSuccessPercentage}%`;
  }
}

// Perform concurrent latency ping checks on all active keys
async function runBatchKeysTest() {
  const enabledKeys = localKeys.filter(k => k.apiKey && k.apiKey.trim() !== '' && k.enabled !== false);
  if (enabledKeys.length === 0) {
    showToast('No active or enabled keys to test.', 'error');
    return;
  }

  // Disable button and show spinner
  batchTestBtn.disabled = true;
  const originalText = batchTestBtn.innerHTML;
  batchTestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
  showToast('Starting concurrent key latency batch test...', 'info');

  try {
    const token = localStorage.getItem('dashboardSessionToken') || '';
    
    // Test concurrently using Promise.allSettled
    const testPromises = enabledKeys.map(async (key) => {
      // Find key items in Settings UI to show a pulsing indicator
      const keyCard = document.querySelector(`.key-item[data-id="${key.id}"]`);
      if (keyCard) {
        keyCard.classList.add('key-testing-animation');
      }
      
      try {
        const res = await fetch(`/api/keys/${key.id}/test`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (keyCard) {
          keyCard.classList.remove('key-testing-animation');
        }
        
        if (res.status === 401) {
          handleUnauthorized();
          throw new Error('Unauthorized');
        }
        
        return await res.json();
      } catch (err) {
        if (keyCard) {
          keyCard.classList.remove('key-testing-animation');
        }
        throw err;
      }
    });

    const results = await Promise.allSettled(testPromises);
    
    let healthyCount = 0;
    let failedCount = 0;
    
    results.forEach(res => {
      if (res.status === 'fulfilled' && res.value && res.value.success) {
        healthyCount++;
      } else {
        failedCount++;
      }
    });

    showToast(`Batch test complete: ${healthyCount} healthy, ${failedCount} failed`, healthyCount > 0 ? 'success' : 'error');
    
    // Reload configurations (and thus re-render keys and health status board)
    await loadConfiguration();
  } catch (err) {
    console.error('Error during batch testing:', err);
    showToast('Batch testing encountered an error', 'error');
  } finally {
    batchTestBtn.disabled = false;
    batchTestBtn.innerHTML = originalText;
  }
}

// Render Health Check Logs console on Home page
function renderPingLogs(history) {
  const pingLogsConsole = document.getElementById('ping-logs-console');
  if (!pingLogsConsole) return;
  
  if (!history || history.length === 0) {
    pingLogsConsole.innerHTML = `
      <div class="log-line system-line">
        No health checks recorded yet.
      </div>
    `;
    return;
  }
  
  pingLogsConsole.innerHTML = '';
  history.forEach(entry => {
    const line = document.createElement('div');
    line.className = 'log-line';
    
    // Format timestamp
    const date = new Date(entry.timestamp);
    const timeStr = date.toTimeString().split(' ')[0]; // HH:MM:SS
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.innerText = `[${timeStr}]`;
    line.appendChild(timeSpan);
    
    // Manual/Auto badge
    const badgeSpan = document.createElement('span');
    badgeSpan.style.color = entry.isManual ? 'var(--accent-cyan)' : 'var(--text-muted)';
    badgeSpan.style.fontWeight = '600';
    badgeSpan.style.marginRight = '0.5rem';
    badgeSpan.innerText = entry.isManual ? '[Manual]' : '[Auto]';
    line.appendChild(badgeSpan);
    
    // Key Name
    const keySpan = document.createElement('span');
    keySpan.style.fontWeight = '500';
    keySpan.innerText = `${entry.keyName}: `;
    line.appendChild(keySpan);
    
    // Status and Details
    const statusSpan = document.createElement('span');
    if (entry.status === 'Healthy') {
      statusSpan.className = 'success-line';
      statusSpan.innerText = `Healthy (${entry.latency}ms)`;
    } else {
      statusSpan.className = 'error-line';
      statusSpan.innerText = `Failing (${entry.error || 'Unknown Error'})`;
    }
    line.appendChild(statusSpan);
    
    pingLogsConsole.appendChild(line);
  });
}

// Render Health Chart (Chart.js Line Graph) on Analytics tab
function updateHealthChart(history) {
  const ctx = document.getElementById('healthChart')?.getContext('2d');
  if (!ctx) return;
  
  if (!history || history.length === 0) {
    if (healthChart) {
      healthChart.destroy();
      healthChart = null;
    }
    return;
  }
  
  // Group by timestamp to extract unique times
  const timestampsMap = {};
  history.forEach(entry => {
    timestampsMap[entry.timestamp] = true;
  });
  
  // Sort timestamps oldest to newest
  const sortedTimestamps = Object.keys(timestampsMap).sort((a, b) => new Date(a) - new Date(b));
  
  // Cap chart labels at last 20 unique timestamp runs
  const activeTimestamps = sortedTimestamps.slice(-20);
  
  // Get all unique key names and IDs
  const keysMap = {};
  history.forEach(entry => {
    keysMap[entry.keyId] = entry.keyName;
  });
  const keyIds = Object.keys(keysMap);
  
  // Pre-selected colors for keys to make it aesthetic
  const colors = [
    'rgba(0, 240, 255, 1)',   // cyan
    'rgba(16, 185, 129, 1)',  // green
    'rgba(245, 158, 11, 1)',  // yellow
    'rgba(239, 68, 68, 1)',   // red
    'rgba(168, 85, 247, 1)',  // purple
    'rgba(59, 130, 246, 1)'   // blue
  ];
  
  // Create dataset for each key
  const datasets = keyIds.map((keyId, index) => {
    const keyName = keysMap[keyId];
    const dataPoints = activeTimestamps.map(t => {
      // Find the entry for this key and timestamp
      const match = history.find(entry => entry.timestamp === t && entry.keyId === keyId);
      return match && match.status === 'Healthy' ? match.latency : null;
    });
    
    const color = colors[index % colors.length];
    return {
      label: keyName,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color.replace('1)', '0.1)'),
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      spanGaps: true
    };
  });
  
  // Format timestamps for display (e.g. HH:MM:SS)
  const labels = activeTimestamps.map(t => {
    const date = new Date(t);
    return date.toTimeString().split(' ')[0];
  });
  
  if (healthChart) {
    healthChart.data.labels = labels;
    healthChart.data.datasets = datasets;
    healthChart.update();
  } else {
    healthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter' }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' },
            title: {
              display: true,
              text: 'Latency (ms)',
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }
}

// Render Health Sheet Table on Analytics tab
function renderHealthSheet(history) {
  const tbody = document.getElementById('health-sheet-body');
  if (!tbody) return;
  
  if (!history || history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted);">No health checks recorded yet.</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = '';
  // Show up to 50 rows in the table
  const displayHistory = history.slice(0, 50);
  
  displayHistory.forEach(entry => {
    const tr = document.createElement('tr');
    
    // Time
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const tdTime = document.createElement('td');
    tdTime.innerHTML = `<span style="color: var(--text-muted); font-size: 0.75rem;">${dateStr}</span> ${timeStr}`;
    tr.appendChild(tdTime);
    
    // Key Name
    const tdKey = document.createElement('td');
    tdKey.innerText = entry.keyName;
    tr.appendChild(tdKey);
    
    // Status (Auto / Manual badge + Status)
    const tdStatus = document.createElement('td');
    const badgeType = entry.isManual ? 'Manual' : 'Auto';
    const badgeColor = entry.isManual ? 'var(--accent-cyan)' : 'var(--text-muted)';
    
    const isSuccess = entry.status === 'Healthy';
    const statusText = isSuccess ? 'Healthy' : 'Failing';
    const statusClass = isSuccess ? 'text-success' : 'text-error';
    
    tdStatus.innerHTML = `
      <span style="font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor}; margin-right: 0.5rem; font-weight: 500;">${badgeType}</span>
      <span class="${statusClass}" style="font-weight: 500;">${statusText}</span>
    `;
    tr.appendChild(tdStatus);
    
    // Latency
    const tdLatency = document.createElement('td');
    if (isSuccess) {
      tdLatency.innerHTML = `<span class="text-latency" style="color: var(--accent-yellow); font-weight: 500;">${entry.latency}ms</span>`;
    } else {
      tdLatency.innerHTML = `<span class="text-error" style="color: var(--accent-red); font-size: 0.75rem;" title="${entry.error || 'Unknown error'}">Error</span>`;
    }
    tr.appendChild(tdLatency);
    
    tbody.appendChild(tr);
  });
}
