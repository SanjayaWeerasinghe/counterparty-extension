/**
 * Content Script
 * Injects window.counterpartyWallet API into web pages
 * Acts as bridge between web pages and extension background
 */

// Generate unique request IDs
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Inject the API script file into the page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/content/inject.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

/**
 * Listen for messages from the page
 */
window.addEventListener('message', async (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;

  const message = event.data;

  // Handle GET_ADDRESS request
  if (message.type === 'COUNTERPARTY_WALLET_GET_ADDRESS') {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_WALLET_STATUS'
      });

      if (response.success && response.data.hasWallet) {
        window.postMessage({
          type: 'COUNTERPARTY_WALLET_RESPONSE',
          requestId: message.requestId,
          success: true,
          data: {
            address: response.data.address
          }
        }, '*');
      } else {
        window.postMessage({
          type: 'COUNTERPARTY_WALLET_RESPONSE',
          requestId: message.requestId,
          success: false,
          error: 'No wallet found. Please create or import a wallet first.'
        }, '*');
      }
    } catch (error) {
      window.postMessage({
        type: 'COUNTERPARTY_WALLET_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: error.message
      }, '*');
    }
  }

  // Handle SIGN_TRANSACTION request
  else if (message.type === 'COUNTERPARTY_WALLET_SIGN_TRANSACTION') {
    try {
      const signRequestId = generateRequestId();

      const response = await chrome.runtime.sendMessage({
        type: 'SIGN_TRANSACTION',
        data: {
          unsignedTx: message.data.unsignedTx,
          details: message.data.details,
          requestId: signRequestId
        }
      });

      window.postMessage({
        type: 'COUNTERPARTY_WALLET_RESPONSE',
        requestId: message.requestId,
        success: response.success,
        data: response.data,
        error: response.error
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'COUNTERPARTY_WALLET_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: error.message
      }, '*');
    }
  }

  // Handle GET_STATUS request
  else if (message.type === 'COUNTERPARTY_WALLET_GET_STATUS') {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_WALLET_STATUS'
      });

      window.postMessage({
        type: 'COUNTERPARTY_WALLET_RESPONSE',
        requestId: message.requestId,
        success: true,
        data: {
          isUnlocked: response.data.isUnlocked,
          hasWallet: response.data.hasWallet
        }
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'COUNTERPARTY_WALLET_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: error.message
      }, '*');
    }
  }
});

console.log('Counterparty Wallet content script loaded');
