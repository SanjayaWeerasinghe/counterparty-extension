/**
 * Content Script
 * Injects window.counterpartyWallet API into web pages
 * Acts as bridge between web pages and extension background
 */

// Generate unique request IDs
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Inject the API into the page context
const script = document.createElement('script');
script.textContent = `
  (function() {
    'use strict';

    // Create the Counterparty Wallet API
    window.counterpartyWallet = {
      isInstalled: true,
      version: '1.0.0',

      /**
       * Get wallet address
       */
      async getAddress() {
        return new Promise((resolve, reject) => {
          const requestId = 'addr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

          // Listen for response
          const handleResponse = (event) => {
            if (event.data.type === 'COUNTERPARTY_WALLET_RESPONSE' && event.data.requestId === requestId) {
              window.removeEventListener('message', handleResponse);

              if (event.data.success) {
                resolve(event.data.data.address);
              } else {
                reject(new Error(event.data.error || 'Failed to get address'));
              }
            }
          };

          window.addEventListener('message', handleResponse);

          // Send request to content script
          window.postMessage({
            type: 'COUNTERPARTY_WALLET_GET_ADDRESS',
            requestId
          }, '*');

          // Timeout after 30 seconds
          setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            reject(new Error('Request timed out'));
          }, 30000);
        });
      },

      /**
       * Sign transaction
       * @param {Object} params - Transaction parameters
       * @param {string} params.unsignedTx - Unsigned transaction hex
       * @param {Object} params.details - Transaction details for display
       * @returns {Promise<string>} - Signed transaction hex
       */
      async signTransaction(params) {
        if (!params.unsignedTx) {
          throw new Error('Missing unsignedTx parameter');
        }

        return new Promise((resolve, reject) => {
          const requestId = 'sign_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

          // Listen for response
          const handleResponse = (event) => {
            if (event.data.type === 'COUNTERPARTY_WALLET_RESPONSE' && event.data.requestId === requestId) {
              window.removeEventListener('message', handleResponse);

              if (event.data.success) {
                resolve(event.data.data.signedTx);
              } else {
                reject(new Error(event.data.error || 'Failed to sign transaction'));
              }
            }
          };

          window.addEventListener('message', handleResponse);

          // Send request to content script
          window.postMessage({
            type: 'COUNTERPARTY_WALLET_SIGN_TRANSACTION',
            requestId,
            data: params
          }, '*');

          // Timeout after 5 minutes (user might take time to approve)
          setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            reject(new Error('Request timed out'));
          }, 300000);
        });
      },

      /**
       * Check if wallet is unlocked
       */
      async isUnlocked() {
        return new Promise((resolve, reject) => {
          const requestId = 'status_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

          const handleResponse = (event) => {
            if (event.data.type === 'COUNTERPARTY_WALLET_RESPONSE' && event.data.requestId === requestId) {
              window.removeEventListener('message', handleResponse);

              if (event.data.success) {
                resolve(event.data.data.isUnlocked);
              } else {
                reject(new Error(event.data.error || 'Failed to check status'));
              }
            }
          };

          window.addEventListener('message', handleResponse);

          window.postMessage({
            type: 'COUNTERPARTY_WALLET_GET_STATUS',
            requestId
          }, '*');

          setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            reject(new Error('Request timed out'));
          }, 10000);
        });
      }
    };

    // Notify page that wallet is ready
    window.dispatchEvent(new Event('counterpartyWalletReady'));

    console.log('✅ Counterparty Wallet API injected');
  })();
`;

// Inject at document_start
(document.head || document.documentElement).appendChild(script);
script.remove();

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
