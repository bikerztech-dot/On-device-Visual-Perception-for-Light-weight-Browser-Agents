// Popup UI controller for the Privacy-Preserving Vision Agent extension

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logContainer = document.getElementById('logContainer');
const metricsPanel = document.getElementById('metricsPanel');

let isAnalyzing = false;
let currentTabId = null;

// Initialize popup
async function init() {
  try {
    // Get current tab first
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab.id;
    
    // Check if background service worker is ready
    const response = await chrome.runtime.sendMessage({ type: 'STATUS_CHECK' });
    updateStatus(response.ready);
    addLog('Extension initialized successfully');
    
    // Also check content script in current tab
    try {
      const csResponse = await chrome.tabs.sendMessage(currentTabId, { type: 'STATUS_CHECK' });
      if (csResponse && csResponse.ready) {
        addLog('Content script ready in current tab');
      } else {
        addLog('Note: Refresh page to activate content script');
      }
    } catch (e) {
      addLog('Note: Refresh page to activate content script');
    }
  } catch (error) {
    console.error('Init error:', error);
    updateStatus(false);
    addLog('Warning: Background service not ready');
  }
}

function updateStatus(ready) {
  if (ready) {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = 'Agent Ready';
    analyzeBtn.disabled = false;
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusText.textContent = 'Initializing...';
    analyzeBtn.disabled = true;
  }
}

function addLog(message) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateMetrics(metrics) {
  metricsPanel.style.display = 'block';
  document.getElementById('inferenceTime').textContent = metrics.inferenceTime || '-';
  document.getElementById('piiCount').textContent = metrics.piiCount || '-';
  document.getElementById('redactionQuality').textContent = metrics.redactionQuality || '-';
  document.getElementById('serverLatency').textContent = metrics.serverLatency || '-';
}

analyzeBtn.addEventListener('click', async () => {
  if (isAnalyzing) return;
  
  isAnalyzing = true;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '⏳ Analyzing...';
  addLog('Starting screen analysis...');
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // First check if content script is ready in this tab
    try {
      const csCheck = await chrome.tabs.sendMessage(tab.id, { type: 'STATUS_CHECK' });
      if (!csCheck || !csCheck.ready) {
        throw new Error('Content script not ready. Please refresh the page.');
      }
    } catch (e) {
      throw new Error('Content script not responding. Please refresh the page and try again.');
    }
    
    // Send analyze command to background script
    const result = await chrome.runtime.sendMessage({
      type: 'ANALYZE_PAGE',
      tabId: tab.id
    });
    
    if (result.success) {
      addLog(`✓ Analysis complete. Found ${result.piiDetected} PII elements`);
      addLog(`✓ Redacted and sent to server`);
      addLog(`✓ Server response received: ${result.action}`);
      
      updateMetrics({
        inferenceTime: `${result.metrics.inferenceTime}ms`,
        piiCount: result.piiDetected,
        redactionQuality: `${result.metrics.redactionQuality}%`,
        serverLatency: `${result.metrics.serverLatency}ms`
      });
      
      if (result.action && result.action !== 'none') {
        addLog(`🎯 Action to execute: ${result.action}`);
      }
    } else {
      addLog(`✗ Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    addLog(`✗ Error: ${error.message}`);
  } finally {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '📸 Analyze Current Page';
  }
});

clearLogBtn.addEventListener('click', () => {
  logContainer.innerHTML = '<div class="log-entry">Log cleared</div>';
  metricsPanel.style.display = 'none';
});

// Initialize on load
init();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG') {
    addLog(message.text);
  } else if (message.type === 'STATUS_UPDATE') {
    updateStatus(message.ready);
  } else if (message.type === 'METRICS_UPDATE') {
    updateMetrics(message.metrics);
  }
});
