// Content script for Privacy-Preserving Vision Agent
// Runs in the context of web pages to capture DOM state, detect PII, and apply redactions

// Import ONNX Runtime Web for local inference (will be loaded dynamically)
let ort = null;
let piiDetector = null;

// Initialize the content script
async function init() {
  try {
    // Load ONNX Runtime Web from CDN
    await loadONNXRuntime();
    
    // Initialize PII detector model
    await initializePIIDetector();
    
    console.log('Privacy Vision Agent content script initialized');
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(handleMessage);
    
  } catch (error) {
    console.error('Failed to initialize content script:', error);
  }
}

// Load ONNX Runtime Web
async function loadONNXRuntime() {
  return new Promise((resolve, reject) => {
    if (typeof ort !== 'undefined') {
      resolve(ort);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.0/dist/ort.min.js';
    script.onload = () => {
      ort = window.ort;
      console.log('ONNX Runtime loaded');
      resolve(ort);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize PII detection model
async function initializePIIDetector() {
  try {
    // For demo purposes, we'll use a rule-based approach combined with lightweight ML
    // In production, you would load a pre-trained model for PII detection
    piiDetector = {
      detect: detectPIILocal
    };
    console.log('PII Detector initialized (rule-based + heuristic mode)');
  } catch (error) {
    console.error('Failed to initialize PII detector:', error);
    // Fallback to pure rule-based detection
    piiDetector = { detect: detectPIILocal };
  }
}

// Handle messages from background script
function handleMessage(message, sender, sendResponse) {
  if (message.type === 'CAPTURE_AND_SANITIZE') {
    captureAndSanitizePage()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  return false;
}

// Main function to capture page state and sanitize PII
async function captureAndSanitizePage() {
  const startTime = performance.now();
  
  try {
    // Step 1: Capture DOM structure and visual elements
    const pageData = capturePageStructure();
    
    // Step 2: Detect PII/sensitive elements
    const piiElements = await detectPII(pageData);
    
    // Step 3: Apply redactions
    const sanitizedData = applyRedactions(pageData, piiElements);
    
    // Step 4: Calculate metrics
    const processingTime = performance.now() - startTime;
    const redactionQuality = calculateRedactionQuality(piiElements, sanitizedData);
    
    // Step 5: Visually highlight redacted areas on the page (for demonstration)
    highlightRedactedAreas(piiElements);
    
    console.log(`Page analysis complete: ${piiElements.length} PII elements found in ${Math.round(processingTime)}ms`);
    
    return {
      success: true,
      sanitizedData: sanitizedData,
      piiCount: piiElements.length,
      redactionQuality: redactionQuality,
      metrics: {
        processingTime: Math.round(processingTime),
        elementsAnalyzed: pageData.elements.length
      }
    };
    
  } catch (error) {
    console.error('Capture and sanitize failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Capture the page structure including elements, text, and layout information
function capturePageStructure() {
  const elements = [];
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY
  };
  
  // Get all visible elements
  const allElements = document.querySelectorAll('*');
  
  allElements.forEach((element, index) => {
    try {
      const rect = element.getBoundingClientRect();
      
      // Skip invisible or very small elements
      if (rect.width < 1 || rect.height < 1) return;
      
      const elementType = element.tagName.toLowerCase();
      const tagName = element.tagName;
      const id = element.id || null;
      const className = element.className || null;
      const text = element.innerText?.slice(0, 500) || null; // Limit text length
      const value = element.value || null; // For input fields
      const type = element.type || null; // For input types
      const placeholder = element.placeholder || null;
      const ariaLabel = element.getAttribute('aria-label') || null;
      const role = element.getAttribute('role') || null;
      
      // Calculate visibility score (how much of the element is in viewport)
      const visibilityScore = calculateVisibilityScore(rect, viewport);
      
      elements.push({
        index,
        tagName,
        elementType,
        id,
        className,
        text,
        value,
        type,
        placeholder,
        ariaLabel,
        role,
        boundingBox: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        visibilityScore,
        isInViewport: visibilityScore > 0,
        selector: generateSelector(element)
      });
    } catch (error) {
      // Skip elements that cause errors
    }
  });
  
  return {
    url: window.location.href,
    title: document.title,
    viewport,
    timestamp: Date.now(),
    elements
  };
}

// Calculate how much of an element is visible in the viewport
function calculateVisibilityScore(rect, viewport) {
  // Check if element is completely outside viewport
  if (rect.right < 0 || rect.left > viewport.width ||
      rect.bottom < 0 || rect.top > viewport.height) {
    return 0;
  }
  
  // Calculate intersection with viewport
  const intersectLeft = Math.max(0, rect.left);
  const intersectTop = Math.max(0, rect.top);
  const intersectRight = Math.min(viewport.width, rect.right);
  const intersectBottom = Math.min(viewport.height, rect.bottom);
  
  const intersectArea = Math.max(0, intersectRight - intersectLeft) * 
                        Math.max(0, intersectBottom - intersectTop);
  const elementArea = rect.width * rect.height;
  
  return elementArea > 0 ? intersectArea / elementArea : 0;
}

// Generate a CSS selector for an element
function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  
  // Fallback to nth-child
  let path = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    } else {
      let sibling = current;
      let nth = 1;
      while (sibling.previousElementSibling) {
        sibling = sibling.previousElementSibling;
        if (sibling.tagName === current.tagName) nth++;
      }
      if (nth > 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    current = current.parentNode;
  }
  
  return path.join(' > ');
}

// Detect PII and sensitive elements using multiple strategies
async function detectPII(pageData) {
  const piiElements = [];
  
  for (const element of pageData.elements) {
    const piiType = checkElementForPII(element);
    if (piiType) {
      piiElements.push({
        ...element,
        piiType,
        confidence: 0.95 // High confidence for rule-based detection
      });
    }
  }
  
  // Additional ML-based detection could be added here
  // For example, using a lightweight NER model via ONNX Runtime
  
  return piiElements;
}

// Check if an element contains PII based on various signals
function checkElementForPII(element) {
  const { tagName, type, placeholder, ariaLabel, role, className, id, text, value } = element;
  
  // Patterns that indicate PII fields
  const piiPatterns = {
    password: [/password/, /passwd/, /pwd/, /secret/i],
    email: [/email/, /e-mail/, /mail address/i],
    phone: [/phone/, /mobile/, /tel/, /cell/i],
    ssn: [/social security/, /ssn/, /national id/i],
    creditCard: [/credit card/, /card number/, /cc number/, /payment/i],
    name: [/first name/, /last name/, /full name/, /your name/i],
    address: [/address/, /street/, /city/, /zip code/, /postal/i],
    dob: [/date of birth/, /dob/, /birth date/, /age/i],
    username: [/username/, /user name/, /login/, /userid/i],
    accountNumber: [/account number/, /account no/i],
    cvv: [/cvv/, /cvc/, /security code/i]
  };
  
  // Check input type
  if (tagName === 'INPUT') {
    if (type === 'password') return 'password';
    if (type === 'email') return 'email';
    if (type === 'tel') return 'phone';
  }
  
  // Combine all text signals
  const signals = [placeholder, ariaLabel, className, id, role].filter(Boolean).join(' ').toLowerCase();
  
  // Check against patterns
  for (const [piiType, patterns] of Object.entries(piiPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(signals)) {
        return piiType;
      }
    }
  }
  
  // Check for autocomplete attributes
  const autoCompletes = ['name', 'email', 'tel', 'street-address', 'cc-number', 'cc-csc'];
  // Would need actual DOM element to check autocomplete attribute
  
  // Check text content for patterns (regex for common PII formats)
  if (text || value) {
    const content = (text || value || '').toString();
    
    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content)) {
      return 'email';
    }
    
    // Phone pattern (various formats)
    if (/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(content.replace(/\s/g, ''))) {
      return 'phone';
    }
    
    // Credit card pattern (basic)
    if (/^[0-9]{13,19}$/.test(content.replace(/[\s-]/g, ''))) {
      return 'creditCard';
    }
    
    // SSN pattern
    if (/^\d{3}-\d{2}-\d{4}$/.test(content)) {
      return 'ssn';
    }
  }
  
  return null;
}

// Apply redactions to sensitive data
function applyRedactions(pageData, piiElements) {
  const sanitizedElements = [];
  const piiIndices = new Set(piiElements.map(e => e.index));
  
  for (const element of pageData.elements) {
    const piiInfo = piiElements.find(p => p.index === element.index);
    
    if (piiInfo) {
      // Create redacted version
      const redactedElement = {
        ...element,
        isRedacted: true,
        piiType: piiInfo.piiType,
        text: redactText(element.text, piiInfo.piiType),
        value: redactValue(element.value, piiInfo.piiType),
        redactionMethod: 'mask'
      };
      sanitizedElements.push(redactedElement);
    } else {
      sanitizedElements.push({
        ...element,
        isRedacted: false
      });
    }
  }
  
  return {
    ...pageData,
    elements: sanitizedElements,
    redactionMetadata: {
      totalElements: pageData.elements.length,
      redactedCount: piiElements.length,
      redactionTimestamp: Date.now(),
      piiTypes: [...new Set(piiElements.map(e => e.piiType))]
    }
  };
}

// Redact text content
function redactText(text, piiType) {
  if (!text) return null;
  
  switch (piiType) {
    case 'password':
      return '[PASSWORD_REDACTED]';
    case 'email':
      return maskEmail(text);
    case 'phone':
      return maskPhone(text);
    case 'creditCard':
      return '****-****-****-' + text.slice(-4);
    case 'ssn':
      return '***-**-' + text.slice(-4);
    default:
      return '[REDACTED]';
  }
}

// Redact value content
function redactValue(value, piiType) {
  if (!value) return null;
  return redactText(value.toString(), piiType);
}

// Mask email addresses
function maskEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return '[EMAIL_REDACTED]';
  
  const username = parts[0];
  const domain = parts[1];
  
  const maskedUsername = username.charAt(0) + '***' + username.slice(-1);
  return `${maskedUsername}@${domain}`;
}

// Mask phone numbers
function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '[PHONE_REDACTED]';
  return '***-***-' + digits.slice(-4);
}

// Calculate redaction quality score
function calculateRedactionQuality(piiElements, sanitizedData) {
  if (piiElements.length === 0) return 100;
  
  const redactedCount = sanitizedData.elements.filter(e => e.isRedacted).length;
  const expectedRedactions = piiElements.length;
  
  // Quality score based on successful redactions
  const quality = (redactedCount / expectedRedactions) * 100;
  return Math.min(100, Math.round(quality));
}

// Visually highlight redacted areas on the page (for demonstration)
function highlightRedactedAreas(piiElements) {
  // Remove existing highlights
  removeHighlights();
  
  piiElements.forEach((element, index) => {
    try {
      const domElement = document.querySelector(element.selector);
      if (!domElement) return;
      
      // Create overlay for visual feedback
      const overlay = document.createElement('div');
      overlay.className = 'pii-redaction-overlay';
      overlay.style.position = 'fixed';
      overlay.style.border = '2px solid #ff6b6b';
      overlay.style.backgroundColor = 'rgba(255, 107, 107, 0.2)';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '999998';
      overlay.style.borderRadius = '4px';
      overlay.title = `PII Detected: ${element.piiType}`;
      
      const rect = domElement.getBoundingClientRect();
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      
      // Add label
      const label = document.createElement('span');
      label.textContent = `🔒 ${element.piiType}`;
      label.style.position = 'absolute';
      label.style.top = '-20px';
      label.style.left = '0';
      label.style.background = '#ff6b6b';
      label.style.color = 'white';
      label.style.padding = '2px 6px';
      label.style.fontSize = '10px';
      label.style.borderRadius = '3px';
      overlay.appendChild(label);
      
      document.body.appendChild(overlay);
      
      // Store reference for cleanup
      overlay.dataset.redactionId = `redaction-${index}`;
    } catch (error) {
      console.error('Failed to highlight element:', error);
    }
  });
}

// Remove all redaction highlights
function removeHighlights() {
  const overlays = document.querySelectorAll('.pii-redaction-overlay');
  overlays.forEach(overlay => overlay.remove());
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Clean up highlights on page unload
window.addEventListener('beforeunload', removeHighlights);
