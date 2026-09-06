#!/usr/bin/env python3
"""
Server-side component for Privacy-Preserving Vision Agent
Processes sanitized visual context and returns actionable commands
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import time
from datetime import datetime
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for browser extension

# Store session data for demo purposes
sessions = {}

class VisionAgent:
    """
    Server-side vision agent that processes sanitized context
    and provides actionable recommendations
    """
    
    def __init__(self):
        self.model_loaded = False
        self.processing_stats = {
            'total_requests': 0,
            'avg_processing_time': 0,
            'actions_recommended': 0
        }
    
    def analyze_sanitized_context(self, sanitized_data):
        """
        Analyze sanitized page structure and recommend actions
        
        Args:
            sanitized_data: Dict containing redacted page structure
            
        Returns:
            Dict with analysis results and recommended actions
        """
        start_time = time.time()
        
        # Extract key information from sanitized data
        elements = sanitized_data.get('elements', [])
        url = sanitized_data.get('url', '')
        title = sanitized_data.get('title', '')
        redaction_metadata = sanitized_data.get('redactionMetadata', {})
        
        # Analyze page type and context
        page_analysis = self._analyze_page_type(elements, url, title)
        
        # Identify interactive elements
        interactive_elements = self._find_interactive_elements(elements)
        
        # Detect form fields and their states
        form_analysis = self._analyze_forms(elements)
        
        # Generate action recommendations based on context
        actions = self._generate_actions(
            page_analysis, 
            interactive_elements, 
            form_analysis,
            elements
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        # Update stats
        self.processing_stats['total_requests'] += 1
        self.processing_stats['avg_processing_time'] = (
            (self.processing_stats['avg_processing_time'] * (self.processing_stats['total_requests'] - 1) + processing_time)
            / self.processing_stats['total_requests']
        )
        if actions:
            self.processing_stats['actions_recommended'] += len(actions)
        
        return {
            'success': True,
            'analysis': {
                'pageType': page_analysis['type'],
                'pageTitle': title,
                'pageUrl': url,
                'elementCount': len(elements),
                'redactedElements': redaction_metadata.get('redactedCount', 0),
                'piiTypesDetected': redaction_metadata.get('piiTypes', []),
                'formFieldsFound': form_analysis['field_count'],
                'interactiveElements': len(interactive_elements)
            },
            'actions': actions,
            'confidence': 0.92,
            'processingTimeMs': round(processing_time, 2),
            'metadata': {
                'timestamp': datetime.now().isoformat(),
                'modelVersion': 'vision-agent-v1.0',
                'privacyPreserved': True
            }
        }
    
    def _analyze_page_type(self, elements, url, title):
        """Determine the type of page based on its structure"""
        keywords = {
            'login': ['login', 'sign in', 'signin', 'log in'],
            'signup': ['signup', 'sign up', 'register', 'create account'],
            'checkout': ['checkout', 'payment', 'order', 'purchase'],
            'form': ['form', 'submit', 'application', 'contact'],
            'search': ['search', 'query', 'find'],
            'dashboard': ['dashboard', 'overview', 'stats', 'analytics']
        }
        
        title_lower = title.lower()
        url_lower = url.lower()
        
        # Check for page type indicators
        for page_type, type_keywords in keywords.items():
            for keyword in type_keywords:
                if keyword in title_lower or keyword in url_lower:
                    return {'type': page_type, 'confidence': 0.9}
        
        # Default to generic page
        return {'type': 'generic', 'confidence': 0.5}
    
    def _find_interactive_elements(self, elements):
        """Find clickable and interactive elements"""
        interactive = []
        interactive_types = ['button', 'a', 'input', 'select', 'textarea']
        interactive_roles = ['button', 'link', 'menuitem', 'tab']
        
        for element in elements:
            tag = element.get('tagName', '').lower()
            role = element.get('role', '')
            element_type = element.get('elementType', '')
            
            if tag in interactive_types or role in interactive_roles:
                # Check if element is visible
                if element.get('visibilityScore', 0) > 0.3:
                    interactive.append({
                        'selector': element.get('selector'),
                        'type': tag,
                        'text': element.get('text', '')[:50],
                        'visible': element.get('isInViewport', False)
                    })
        
        return interactive
    
    def _analyze_forms(self, elements):
        """Analyze form fields and their states"""
        forms = []
        input_elements = []
        
        for element in elements:
            tag = element.get('tagName', '').lower()
            element_type = element.get('type', '')
            
            if tag == 'input' or tag == 'textarea' or tag == 'select':
                field_info = {
                    'type': element_type or tag,
                    'placeholder': element.get('placeholder'),
                    'isRequired': False,  # Would need to check DOM attributes
                    'isRedacted': element.get('isRedacted', False),
                    'piiType': element.get('piiType') if element.get('isRedacted') else None
                }
                input_elements.append(field_info)
        
        return {
            'field_count': len(input_elements),
            'fields': input_elements,
            'has_password': any(f['type'] == 'password' for f in input_elements),
            'has_email': any(f['type'] == 'email' or f['piiType'] == 'email' for f in input_elements)
        }
    
    def _generate_actions(self, page_analysis, interactive_elements, form_analysis, all_elements):
        """Generate recommended actions based on page analysis"""
        actions = []
        page_type = page_analysis['type']
        
        # Context-aware action recommendations
        if page_type == 'login':
            # Look for login button
            login_buttons = [e for e in interactive_elements 
                           if 'login' in e.get('text', '').lower() or 
                              'sign in' in e.get('text', '').lower()]
            if login_buttons:
                actions.append({
                    'type': 'click',
                    'selector': login_buttons[0]['selector'],
                    'description': 'Click login button',
                    'priority': 'high'
                })
        
        elif page_type == 'checkout':
            # Look for submit/payment button
            submit_buttons = [e for e in interactive_elements 
                            if 'submit' in e.get('text', '').lower() or 
                               'pay' in e.get('text', '').lower() or
                               'checkout' in e.get('text', '').lower()]
            if submit_buttons:
                actions.append({
                    'type': 'click',
                    'selector': submit_buttons[0]['selector'],
                    'description': 'Complete checkout',
                    'priority': 'high'
                })
        
        elif page_type == 'form':
            # Find unfilled required fields (non-PII ones can be suggested)
            text_inputs = [e for e in all_elements 
                          if e.get('tagName', '').lower() == 'input' 
                          and e.get('type') in ['text', 'search']
                          and not e.get('isRedacted')]
            if text_inputs and len(text_inputs) > 0:
                actions.append({
                    'type': 'fill',
                    'selector': text_inputs[0].get('selector'),
                    'value': '[USER_TO_FILL]',
                    'description': 'Fill in required field',
                    'priority': 'medium'
                })
        
        elif page_type == 'search':
            # Find search input and button
            search_inputs = [e for e in all_elements 
                           if e.get('placeholder', '').lower().find('search') >= 0 or
                              e.get('ariaLabel', '').lower().find('search') >= 0]
            if search_inputs:
                actions.append({
                    'type': 'fill',
                    'selector': search_inputs[0].get('selector'),
                    'value': '[USER_QUERY]',
                    'description': 'Enter search query',
                    'priority': 'medium'
                })
        
        # Generic fallback: suggest scrolling if page is long
        if not actions:
            actions.append({
                'type': 'scroll',
                'direction': 'down',
                'description': 'Scroll down to view more content',
                'priority': 'low'
            })
        
        return actions


# Initialize vision agent
vision_agent = VisionAgent()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })


@app.route('/analyze', methods=['POST'])
def analyze_context():
    """
    Main endpoint for analyzing sanitized visual context
    
    Expected input:
    {
        "sanitized_content": { ... redacted page structure ... },
        "timestamp": 1234567890,
        "version": "1.0"
    }
    
    Returns:
    {
        "success": true,
        "analysis": { ... page analysis ... },
        "actions": [ ... recommended actions ... ],
        "confidence": 0.92,
        "processingTimeMs": 45.2
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'sanitized_content' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing sanitized_content in request'
            }), 400
        
        sanitized_content = data['sanitized_content']
        
        # Validate the sanitized content structure
        if not isinstance(sanitized_content, dict):
            return jsonify({
                'success': False,
                'error': 'sanitized_content must be a dictionary'
            }), 400
        
        # Process with vision agent
        result = vision_agent.analyze_sanitized_context(sanitized_content)
        
        logger.info(f"Analysis complete: {result['analysis']['pageType']} page, "
                   f"{len(result['actions'])} actions recommended")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/stats', methods=['GET'])
def get_stats():
    """Get server processing statistics"""
    return jsonify({
        'processingStats': vision_agent.processing_stats,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/demo/sample-analysis', methods=['POST'])
def demo_analysis():
    """Demo endpoint showing how the agent processes sanitized data"""
    sample_data = {
        'url': 'https://example.com/login',
        'title': 'Login Page',
        'elements': [
            {
                'tagName': 'INPUT',
                'type': 'email',
                'placeholder': 'Enter your email',
                'isRedacted': True,
                'piiType': 'email',
                'text': 'j***n@example.com',
                'selector': '#email'
            },
            {
                'tagName': 'INPUT',
                'type': 'password',
                'placeholder': 'Password',
                'isRedacted': True,
                'piiType': 'password',
                'text': '[PASSWORD_REDACTED]',
                'selector': '#password'
            },
            {
                'tagName': 'BUTTON',
                'type': 'submit',
                'text': 'Sign In',
                'isRedacted': False,
                'selector': '#login-btn'
            }
        ],
        'redactionMetadata': {
            'redactedCount': 2,
            'piiTypes': ['email', 'password']
        }
    }
    
    result = vision_agent.analyze_sanitized_context(sample_data)
    result['demo'] = True
    result['sampleInput'] = sample_data
    
    return jsonify(result)


if __name__ == '__main__':
    print("=" * 60)
    print("Privacy-Preserving Vision Agent Server")
    print("=" * 60)
    print("\nStarting server...")
    print("Endpoints:")
    print("  - GET  /health           : Health check")
    print("  - POST /analyze          : Analyze sanitized context")
    print("  - GET  /stats            : Processing statistics")
    print("  - POST /demo/sample-analysis : Demo with sample data")
    print("\nServer running on http://localhost:5000")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
