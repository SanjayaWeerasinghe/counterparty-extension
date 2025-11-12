/**
 * Background Service Worker (Manifest V3)
 * Handles wallet state, signing requests, and message routing
 */

// Import libraries
importScripts('../lib/encryption.js');

// Import noble crypto libraries for Bitcoin signing (service worker compatible wrapper)
try {
  importScripts('../lib/noble/secp256k1-wrapper.js');
  console.log('[Background] noble-secp256k1 loaded successfully via wrapper');
  console.log('[Background] Available:', typeof nobleSecp256k1 !== 'undefined' ? 'YES' : 'NO');
} catch (error) {
  console.error('[Background] Failed to load noble-secp256k1:', error);
}

// Import noble RIPEMD160 wrapper
try {
  importScripts('../lib/noble/ripemd160-wrapper.js');
  console.log('[Background] noble-ripemd160 loaded successfully');
} catch (error) {
  console.error('[Background] Failed to load noble-ripemd160:', error);
}

// Note: Using Web Crypto API for SHA256 and noble RIPEMD160
console.log('[Background] Using Web Crypto API for hashing');

// Import Bitcoin signing library (our custom implementation)
importScripts('../lib/bitcoin-simple.js');

// Wallet state (in-memory)
let walletState = {
  isUnlocked: false,
  currentAccountIndex: 0, // Currently selected account
  accounts: [], // Array of {name, address, encryptedPrivateKey}
  currentPrivateKey: null // Only in memory when unlocked
};

// Pending signing requests
const pendingSignRequests = new Map();

/**
 * Load wallet state from storage
 */
async function loadWalletFromStorage() {
  try {
    const result = await chrome.storage.local.get(['accounts', 'currentAccountIndex']);

    // Load accounts array
    if (result.accounts && result.accounts.length > 0) {
      walletState.accounts = result.accounts;
      walletState.currentAccountIndex = result.currentAccountIndex || 0;
      console.log(`Loaded ${walletState.accounts.length} account(s) from storage`);
    } else {
      // Migration: Check for old single-account format
      const oldResult = await chrome.storage.local.get(['encryptedPrivateKey', 'address']);
      if (oldResult.encryptedPrivateKey) {
        console.log('Migrating old wallet format to multi-account');
        walletState.accounts = [{
          name: 'Account 1',
          address: oldResult.address,
          encryptedPrivateKey: oldResult.encryptedPrivateKey
        }];
        walletState.currentAccountIndex = 0;
        // Save in new format
        await chrome.storage.local.set({
          accounts: walletState.accounts,
          currentAccountIndex: 0
        });
        // Remove old keys
        await chrome.storage.local.remove(['encryptedPrivateKey', 'address']);
        console.log('Migration complete');
      }
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

    case 'SWITCH_ACCOUNT':
      handleSwitchAccount(message.data, sendResponse);
      return true;

    case 'GET_ACCOUNTS':
      handleGetAccounts(sendResponse);
      return true;

    case 'RENAME_ACCOUNT':
      handleRenameAccount(message.data, sendResponse);
      return true;

    case 'DELETE_ACCOUNT':
      handleDeleteAccount(message.data, sendResponse);
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
  const hasWallet = walletState.accounts.length > 0;
  const currentAccount = walletState.accounts[walletState.currentAccountIndex];

  sendResponse({
    success: true,
    data: {
      hasWallet,
      isUnlocked: walletState.isUnlocked,
      address: currentAccount?.address || null,
      accountName: currentAccount?.name || null,
      currentAccountIndex: walletState.currentAccountIndex,
      totalAccounts: walletState.accounts.length
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

    // Create account name
    const accountName = `Account ${walletState.accounts.length + 1}`;

    // Add to accounts array
    walletState.accounts.push({
      name: accountName,
      address: address,
      encryptedPrivateKey: encryptedPrivateKey
    });

    // Set as current account
    walletState.currentAccountIndex = walletState.accounts.length - 1;
    walletState.currentPrivateKey = privateKeyHex;
    walletState.isUnlocked = true;

    // Store in chrome.storage
    try {
      await chrome.storage.local.set({
        accounts: walletState.accounts,
        currentAccountIndex: walletState.currentAccountIndex
      });
    } catch (storageError) {
      throw new Error('Failed to save wallet to storage: ' + storageError.message);
    }

    sendResponse({
      success: true,
      data: { address, accountName }
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

    // Check if address already exists
    const existingAccount = walletState.accounts.find(acc => acc.address === address);
    if (existingAccount) {
      throw new Error('This account already exists');
    }

    // Encrypt WIF private key with password
    const encryptedPrivateKey = await Encryption.encrypt(privateKey, password);

    // Create account name
    const accountName = `Account ${walletState.accounts.length + 1}`;

    // Add to accounts array
    walletState.accounts.push({
      name: accountName,
      address: address,
      encryptedPrivateKey: encryptedPrivateKey
    });

    // Set as current account
    walletState.currentAccountIndex = walletState.accounts.length - 1;
    walletState.currentPrivateKey = privateKey; // Store as WIF
    walletState.isUnlocked = true;

    // Store in chrome.storage
    try {
      await chrome.storage.local.set({
        accounts: walletState.accounts,
        currentAccountIndex: walletState.currentAccountIndex
      });
    } catch (storageError) {
      throw new Error('Failed to save wallet to storage: ' + storageError.message);
    }

    sendResponse({
      success: true,
      data: { address, accountName }
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

    if (walletState.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const currentAccount = walletState.accounts[walletState.currentAccountIndex];

    // Decrypt private key for current account
    const privateKey = await Encryption.decrypt(
      currentAccount.encryptedPrivateKey,
      password
    );

    // Update state
    walletState.currentPrivateKey = privateKey;
    walletState.isUnlocked = true;

    sendResponse({
      success: true,
      data: { address: currentAccount.address }
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
  walletState.currentPrivateKey = null;
  walletState.isUnlocked = false;

  sendResponse({ success: true });
}

/**
 * Switch to different account
 */
async function handleSwitchAccount(data, sendResponse) {
  try {
    const { accountIndex, password } = data;

    if (accountIndex < 0 || accountIndex >= walletState.accounts.length) {
      throw new Error('Invalid account index');
    }

    // If unlocked, decrypt the new account's private key
    if (password) {
      const account = walletState.accounts[accountIndex];
      const privateKey = await Encryption.decrypt(account.encryptedPrivateKey, password);
      walletState.currentPrivateKey = privateKey;
      walletState.isUnlocked = true;
    } else {
      // Just switch account, remain locked
      walletState.currentPrivateKey = null;
      walletState.isUnlocked = false;
    }

    walletState.currentAccountIndex = accountIndex;

    // Save current index
    await chrome.storage.local.set({ currentAccountIndex: accountIndex });

    const currentAccount = walletState.accounts[accountIndex];
    sendResponse({
      success: true,
      data: { address: currentAccount.address, accountName: currentAccount.name }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all accounts
 */
function handleGetAccounts(sendResponse) {
  const accounts = walletState.accounts.map((acc, index) => ({
    index,
    name: acc.name,
    address: acc.address,
    isCurrent: index === walletState.currentAccountIndex
  }));

  sendResponse({
    success: true,
    data: { accounts }
  });
}

/**
 * Rename account
 */
async function handleRenameAccount(data, sendResponse) {
  try {
    const { accountIndex, newName } = data;

    if (accountIndex < 0 || accountIndex >= walletState.accounts.length) {
      throw new Error('Invalid account index');
    }

    if (!newName || newName.trim().length === 0) {
      throw new Error('Account name cannot be empty');
    }

    walletState.accounts[accountIndex].name = newName.trim();

    // Save to storage
    await chrome.storage.local.set({ accounts: walletState.accounts });

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete account
 */
async function handleDeleteAccount(data, sendResponse) {
  try {
    const { accountIndex } = data;

    if (walletState.accounts.length === 1) {
      throw new Error('Cannot delete the only account');
    }

    if (accountIndex < 0 || accountIndex >= walletState.accounts.length) {
      throw new Error('Invalid account index');
    }

    // Remove account
    walletState.accounts.splice(accountIndex, 1);

    // Adjust current index if needed
    if (walletState.currentAccountIndex >= accountIndex) {
      walletState.currentAccountIndex = Math.max(0, walletState.currentAccountIndex - 1);
    }

    // Lock wallet after deletion
    walletState.currentPrivateKey = null;
    walletState.isUnlocked = false;

    // Save to storage
    await chrome.storage.local.set({
      accounts: walletState.accounts,
      currentAccountIndex: walletState.currentAccountIndex
    });

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
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
  if (!walletState.isUnlocked || !walletState.currentPrivateKey) {
    throw new Error('Wallet is locked. Please unlock first.');
  }

  const privateKeyWif = walletState.currentPrivateKey;
  const currentAccount = walletState.accounts[walletState.currentAccountIndex];
  const address = currentAccount.address;

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
