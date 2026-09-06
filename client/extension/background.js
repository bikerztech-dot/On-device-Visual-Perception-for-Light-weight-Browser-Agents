// Background service worker for Privacy-Preserving Vision Agent
// Handles coordination between content scripts, vision processing, and server communication

const SERVER_URL = 'http://localhost:5000';

// Initialize the extension
self.addEventListener('install', (event) => {
  console.log('Vision Agent extension installing...');
});

self.addEventListener('activate', (event) => {
  console.log('Vision Agent extension activated');
});

// Message handler for communication with popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'STATUS_CHECK':
        sendResponse({ ready: true });
        break;
        
      case 'ANALYZE_PAGE':
        await handleAnalyzePage(message.tabId, sendResponse);
        break;
        
      case 'PII_DETECTED':
        // Forward PII detection results from content script
        console.log('PII detected:', message.data);
        sendResponse({ received: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleAnalyzePage(tabId, sendResponse) {
  const startTime = performance.now();
  
  try {
    // Step 1: Execute content script to capture page state and detect PII
    const contentResult = await chrome.tabs.sendMessage(tabId, {
      type: 'CAPTURE_AND_SANITIZE'
    });
    
    if (!contentResult.success) {
      throw new Error(contentResult.error || 'Failed to capture page content');
    }
    
    const captureTime = performance.now() - startTime;
    
    // Step 2: Send sanitized data to server
    const serverStartTime = performance.now();
    const serverResponse = await sendToServer(contentResult.sanitizedData);
    const serverTime = performance.now() - serverStartTime;
    
    // Step 3: Execute server-recommended action if any
    let actionExecuted = 'none';
    if (serverResponse.action) {
      actionExecuted = await executeAction(tabId, serverResponse.action);
    }
    
    const totalTime = performance.now() - startTime;
    
    sendResponse({
      success: true,
      piiDetected: contentResult.piiCount,
      action: actionExecuted,
      metrics: {
        inferenceTime: Math.round(captureTime),
        redactionQuality: contentResult.redactionQuality,
        serverLatency: Math.round(serverTime),
        totalTime: Math.round(totalTime)
      }
    });
    
    // Log metrics
    console.log('Analysis complete:', {
      captureTime: `${Math.round(captureTime)}ms`,
      serverTime: `${Math.round(serverTime)}ms`,
      totalTime: `${Math.round(totalTime)}ms`,
      piiDetected: contentResult.piiCount
    });
    
  } catch (error) {
    console.error('Analysis failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function sendToServer(sanitizedData) {
  try {
    const response = await fetch(`${SERVER_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sanitized_content: sanitizedData,
        timestamp: Date.now(),
        version: '1.0'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Server communication failed:', error);
    // Return default action if server is unavailable
    return { action: 'none', message: 'Server unavailable, using local processing only' };
  }
}

async function executeAction(tabId, action) {
  try {
    switch (action.type) {
      case 'click':
        await chrome.tabs.scripting.executeScript({
          target: { tabId },
          func: (selector) => {
            const element = document.querySelector(selector);
            if (element) {
              element.click();
              return `Clicked: ${selector}`;
            }
            return `Element not found: ${selector}`;
          },
          args: [action.selector]
        });
        return `clicked ${action.selector}`;
        
      case 'scroll':
        await chrome.tabs.scripting.executeScript({
          target: { tabId },
          func: (direction) => {
            const scrollAmount = direction === 'down' ? 500 : -500;
            window.scrollBy(0, scrollAmount);
            return `Scrolled ${direction}`;
          },
          args: [action.direction]
        });
        return `scrolled ${action.direction}`;
        
      case 'fill':
        await chrome.tabs.scripting.executeScript({
          target: { tabId },
          func: (selector, value) => {
            const element = document.querySelector(selector);
            if (element) {
              element.value = value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              return `Filled: ${selector}`;
            }
            return `Element not found: ${selector}`;
          },
          args: [action.selector, action.value]
        });
        return `filled ${action.selector}`;
        
      case 'navigate':
        await chrome.tabs.update(tabId, { url: action.url });
        return `navigated to ${action.url}`;
        
      default:
        return 'unknown_action';
    }
  } catch (error) {
    console.error('Action execution failed:', error);
    return `failed: ${error.message}`;
  }
}

// Periodic health check
setInterval(async () => {
  try {
    const response = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      console.log('Server health check: OK');
    }
  } catch (error) {
    console.log('Server health check: Server unavailable');
  }
}, 60000); // Check every minute
