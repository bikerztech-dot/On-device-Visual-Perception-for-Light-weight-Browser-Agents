// Popup UI controller for the Privacy-Preserving Vision Agent extension

const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logContainer = document.getElementById('logContainer');
const metricsPanel = document.getElementById('metricsPanel');

let isAnalyzing = false;

// Initialize popup
async function init() {
  try {
    // Check if background service worker is ready
    const response = await chrome.runtime.sendMessage({ type: 'STATUS_CHECK' });
    updateStatus(response.ready);
    addLog('Extension initialized successfully');
  } catch (error) {
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
