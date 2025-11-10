/**
 * Background Service Worker (Manifest V3)
 * Handles wallet state, signing requests, and message routing
 */

// Import libraries
importScripts('../lib/encryption.js');

// Import noble crypto libraries for Bitcoin signing (bundled locally)
try {
  importScripts('../lib/noble/secp256k1.js');
  console.log('[Background] noble-secp256k1 loaded successfully');
} catch (error) {
  console.error('[Background] Failed to load noble-secp256k1:', error);
}

try {
  importScripts('../lib/noble/hashes.js');
  console.log('[Background] noble-hashes loaded successfully');
} catch (error) {
  console.error('[Background] Failed to load noble-hashes:', error);
}

// Import Bitcoin signing library (our custom implementation)
importScripts('../lib/bitcoin-simple.js');

// Wallet state (in-memory)
let walletState = {
  isUnlocked: false,
  address: null,
  encryptedPrivateKey: null, // Stored in chrome.storage.local
  privateKey: null // Only in memory when unlocked
};

// Pending signing requests
const pendingSignRequests = new Map();

/**
 * Load wallet state from storage
 */
async function loadWalletFromStorage() {
  try {
    const result = await chrome.storage.local.get(['encryptedPrivateKey', 'address']);
    if (result.encryptedPrivateKey) {
      walletState.encryptedPrivateKey = result.encryptedPrivateKey;
      walletState.address = result.address;
      console.log('Wallet loaded from storage');
    }
  } catch (error) {
    console.error('Failed to load wallet from storage:', error);
  }
}

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Counterparty Signer installed');
  await loadWalletFromStorage();
});

/**
 * Load wallet on browser startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Counterparty Signer starting up');
  await loadWalletFromStorage();
});

/**
 * Listen for messages from content script or popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  switch (message.type) {
    case 'GET_WALLET_STATUS':
      handleGetWalletStatus(sendResponse);
      return true; // Keep channel open for async response

    case 'CREATE_WALLET':
      handleCreateWallet(message.data, sendResponse);
      return true;

    case 'IMPORT_WALLET':
      handleImportWallet(message.data, sendResponse);
      return true;

    case 'UNLOCK_WALLET':
      handleUnlockWallet(message.data, sendResponse);
      return true;

    case 'LOCK_WALLET':
      handleLockWallet(sendResponse);
      return true;

    case 'SIGN_TRANSACTION':
      handleSignTransactionRequest(message.data, sender, sendResponse);
      return true;

    case 'APPROVE_SIGNING':
      handleApproveSign(message.data, sendResponse);
      return true;

    case 'REJECT_SIGNING':
      handleRejectSign(message.data, sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return false;
});

/**
 * Get wallet status
 */
async function handleGetWalletStatus(sendResponse) {
  const hasWallet = !!walletState.encryptedPrivateKey;

  sendResponse({
    success: true,
    data: {
      hasWallet,
      isUnlocked: walletState.isUnlocked,
      address: walletState.address
    }
  });
}

/**
 * Create new wallet
 */
async function handleCreateWallet(data, sendResponse) {
  try {
    const { password } = data;

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Generate new private key
    const privateKeyHex = BitcoinSigner.generatePrivateKey();

    // Derive address
    const address = await BitcoinSigner.deriveAddress(privateKeyHex);

    // Encrypt private key with password
    const encryptedPrivateKey = await Encryption.encrypt(privateKeyHex, password);

    // Store encrypted key and address
    try {
      await chrome.storage.local.set({
        encryptedPrivateKey,
        address
      });
    } catch (storageError) {
      throw new Error('Failed to save wallet to storage: ' + storageError.message);
    }

    // Update wallet state
    walletState.encryptedPrivateKey = encryptedPrivateKey;
    walletState.address = address;
    walletState.privateKey = privateKeyHex;
    walletState.isUnlocked = true;

    sendResponse({
      success: true,
      data: { address }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Import existing wallet
 */
async function handleImportWallet(data, sendResponse) {
  try {
    const { address, privateKey, password } = data;

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (!address) {
      throw new Error('Bitcoin address is required');
    }

    // Validate WIF format (privateKey is now WIF, not hex)
    if (!privateKey || (privateKey.length !== 51 && privateKey.length !== 52)) {
      throw new Error('Invalid WIF private key format');
    }

    // Use the provided address (no derivation needed for MVP)
    // In production, verify that the private key matches the address

    // Encrypt WIF private key with password
    const encryptedPrivateKey = await Encryption.encrypt(privateKey, password);

    // Store encrypted WIF key and address
    try {
      await chrome.storage.local.set({
        encryptedPrivateKey,
        address
      });
    } catch (storageError) {
      throw new Error('Failed to save wallet to storage: ' + storageError.message);
    }

    // Update wallet state (privateKey is now WIF)
    walletState.encryptedPrivateKey = encryptedPrivateKey;
    walletState.address = address;
    walletState.privateKeyWif = privateKey;  // Store as WIF
    walletState.isUnlocked = true;

    sendResponse({
      success: true,
      data: { address }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Unlock wallet with password
 */
async function handleUnlockWallet(data, sendResponse) {
  try {
    const { password } = data;

    if (!walletState.encryptedPrivateKey) {
      throw new Error('No wallet found');
    }

    // Decrypt private key
    const privateKey = await Encryption.decrypt(
      walletState.encryptedPrivateKey,
      password
    );

    // Update state
    walletState.privateKey = privateKey;
    walletState.isUnlocked = true;

    sendResponse({
      success: true,
      data: { address: walletState.address }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: 'Incorrect password or corrupted data'
    });
  }
}

/**
 * Lock wallet (clear private key from memory)
 */
function handleLockWallet(sendResponse) {
  walletState.privateKey = null;
  walletState.isUnlocked = false;

  sendResponse({ success: true });
}

/**
 * Handle signing request from web page
 */
async function handleSignTransactionRequest(data, sender, sendResponse) {
  try {
    const { unsignedTx, details, requestId } = data;

    if (!walletState.isUnlocked) {
      throw new Error('Wallet is locked. Please unlock it first.');
    }

    // Store request
    pendingSignRequests.set(requestId, {
      unsignedTx,
      details,
      sender,
      resolve: null,
      reject: null
    });

    // Create promise to wait for user approval
    const signaturePromise = new Promise((resolve, reject) => {
      const request = pendingSignRequests.get(requestId);
      request.resolve = resolve;
      request.reject = reject;
      pendingSignRequests.set(requestId, request);
    });

    // Open signing window
    const windowUrl = chrome.runtime.getURL('signing.html') + `?requestId=${requestId}`;

    chrome.windows.create({
      url: windowUrl,
      type: 'popup',
      width: 400,
      height: 600,
      focused: true
    });

    // Wait for user approval
    const signedTx = await signaturePromise;

    sendResponse({
      success: true,
      data: { signedTx }
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * User approved signing
 */
async function handleApproveSign(data, sendResponse) {
  try {
    const { requestId } = data;
    const request = pendingSignRequests.get(requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    // Sign transaction using backend API (MVP approach)
    // In production, this would use bitcoinjs-lib locally
    const signedTx = await signTransactionLocally(request.unsignedTx);

    // Resolve the promise
    request.resolve(signedTx);

    // Clean up
    pendingSignRequests.delete(requestId);

    sendResponse({ success: true });
  } catch (error) {
    const request = pendingSignRequests.get(data.requestId);
    if (request) {
      request.reject(error);
      pendingSignRequests.delete(data.requestId);
    }

    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * User rejected signing
 */
function handleRejectSign(data, sendResponse) {
  const { requestId } = data;
  const request = pendingSignRequests.get(requestId);

  if (request) {
    request.reject(new Error('User rejected transaction'));
    pendingSignRequests.delete(requestId);
  }

  sendResponse({ success: true });
}

/**
 * Sign transaction locally in the extension (TRUE EXTERNAL SIGNING)
 * Uses BitcoinSigner with noble-secp256k1 and noble-hashes
 * Private key NEVER leaves the extension!
 */
async function signTransactionLocally(unsignedTx) {
  console.log('[Signing] Using LOCAL signing in extension (no backend key exposure)');

  // Check if wallet is unlocked in memory
  if (!walletState.isUnlocked || !walletState.privateKeyWif) {
    throw new Error('Wallet is locked. Please unlock first.');
  }

  const privateKeyWif = walletState.privateKeyWif;
  const address = walletState.address;

  console.log('[Signing] Wallet address:', address);
  console.log('[Signing] Unsigned TX length:', unsignedTx.length);

  try {
    // Sign transaction using our custom BitcoinSigner
    const signedTx = await BitcoinSigner.signTransaction(privateKeyWif, unsignedTx);

    console.log('[Signing] Transaction signed successfully (LOCAL)');
    console.log('[Signing] Signed TX length:', signedTx.length);
    console.log('[Signing] ✅ Private key NEVER left the extension!');

    return signedTx;
  } catch (error) {
    console.error('[Signing] Local signing error:', error);
    throw new Error(`Failed to sign transaction locally: ${error.message}`);
  }
}

/**
 * Get pending sign request by ID
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'signing-window') {
    port.onMessage.addListener((message) => {
      if (message.type === 'GET_SIGN_REQUEST') {
        const request = pendingSignRequests.get(message.requestId);
        if (request) {
          port.postMessage({
            type: 'SIGN_REQUEST_DATA',
            data: {
              unsignedTx: request.unsignedTx,
              details: request.details
            }
          });
        }
      }
    });
  }
});

console.log('Counterparty Signer background service worker loaded');
