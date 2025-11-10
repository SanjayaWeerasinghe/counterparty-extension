/**
 * Injected Script - Runs in page context
 * Creates window.counterpartyWallet API
 */
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

        // Timeout after 5 minutes
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
