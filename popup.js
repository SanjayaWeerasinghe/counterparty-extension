/**
 * Popup UI Logic
 * Handles wallet creation, import, unlock, and management
 */

// UI state
let walletStatus = null;

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadWalletStatus();

  // Add enter key handlers
  document.getElementById('createPasswordConfirm')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createWallet();
  });

  document.getElementById('importPasswordConfirm')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') importWallet();
  });

  document.getElementById('unlockPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') unlockWallet();
  });
});

/**
 * Load wallet status and show appropriate view
 */
async function loadWalletStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_WALLET_STATUS'
    });

    walletStatus = response.data;

    // Show appropriate view
    if (!walletStatus.hasWallet) {
      showView('setupView');
    } else if (!walletStatus.isUnlocked) {
      showView('lockedView');
    } else {
      showView('unlockedView');
      document.getElementById('walletAddress').textContent = walletStatus.address;
    }
  } catch (error) {
    console.error('Failed to load wallet status:', error);
    showError('setupView', 'Failed to connect to wallet service');
  }
}

/**
 * Show specific view
 */
function showView(viewId) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(viewId)?.classList.add('active');
}

/**
 * Show setup tab (create or import)
 */
function showSetupTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  // Find and activate the correct tab button
  const tabs = document.querySelectorAll('.tab');
  if (tab === 'create') {
    tabs[0]?.classList.add('active');
  } else {
    tabs[1]?.classList.add('active');
  }

  // Show/hide tabs
  if (tab === 'create') {
    document.getElementById('createTab').classList.remove('hidden');
    document.getElementById('importTab').classList.add('hidden');
  } else {
    document.getElementById('createTab').classList.add('hidden');
    document.getElementById('importTab').classList.remove('hidden');
  }
}

/**
 * Create new wallet
 */
async function createWallet() {
  hideMessages('create');

  const password = document.getElementById('createPassword').value;
  const passwordConfirm = document.getElementById('createPasswordConfirm').value;

  // Validation
  if (!password || password.length < 8) {
    showError('create', 'Password must be at least 8 characters');
    return;
  }

  if (password !== passwordConfirm) {
    showError('create', 'Passwords do not match');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_WALLET',
      data: { password }
    });

    if (response.success) {
      showSuccess('create', `Wallet created! Address: ${response.data.address}`);

      // Reload after 2 seconds
      setTimeout(loadWalletStatus, 2000);
    } else {
      showError('create', response.error || 'Failed to create wallet');
    }
  } catch (error) {
    showError('create', error.message || 'Failed to create wallet');
  }
}

/**
 * Import existing wallet
 */
async function importWallet() {
  hideMessages('import');

  const privateKey = document.getElementById('importPrivateKey').value.trim();
  const password = document.getElementById('importPassword').value;
  const passwordConfirm = document.getElementById('importPasswordConfirm').value;

  // Validation
  if (!privateKey || privateKey.length !== 64) {
    showError('import', 'Private key must be 64 hex characters');
    return;
  }

  if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    showError('import', 'Invalid private key format (must be hex)');
    return;
  }

  if (!password || password.length < 8) {
    showError('import', 'Password must be at least 8 characters');
    return;
  }

  if (password !== passwordConfirm) {
    showError('import', 'Passwords do not match');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_WALLET',
      data: { privateKey, password }
    });

    if (response.success) {
      showSuccess('import', `Wallet imported! Address: ${response.data.address}`);

      // Reload after 2 seconds
      setTimeout(loadWalletStatus, 2000);
    } else {
      showError('import', response.error || 'Failed to import wallet');
    }
  } catch (error) {
    showError('import', error.message || 'Failed to import wallet');
  }
}

/**
 * Unlock wallet
 */
async function unlockWallet() {
  hideMessages('unlock');

  const password = document.getElementById('unlockPassword').value;

  if (!password) {
    showError('unlock', 'Please enter password');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'UNLOCK_WALLET',
      data: { password }
    });

    if (response.success) {
      await loadWalletStatus();
    } else {
      showError('unlock', response.error || 'Incorrect password');
    }
  } catch (error) {
    showError('unlock', error.message || 'Failed to unlock wallet');
  }
}

/**
 * Lock wallet
 */
async function lockWallet() {
  try {
    await chrome.runtime.sendMessage({ type: 'LOCK_WALLET' });
    await loadWalletStatus();
  } catch (error) {
    console.error('Failed to lock wallet:', error);
  }
}

/**
 * Copy address to clipboard
 */
async function copyAddress() {
  if (walletStatus?.address) {
    try {
      await navigator.clipboard.writeText(walletStatus.address);

      // Show feedback
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      btn.style.background = 'rgba(34, 197, 94, 0.3)';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    } catch (error) {
      alert('Failed to copy address');
    }
  }
}

/**
 * View private key (prompt for password)
 */
function viewPrivateKey() {
  const password = prompt('Enter password to view private key:');

  if (!password) return;

  // In production, this would decrypt and show the private key
  // For MVP, we show a warning
  alert('Private key viewing will be implemented in next version.\n\nFor security, private keys are encrypted and only used for signing.');
}

/**
 * Show error message
 */
function showError(context, message) {
  const errorEl = document.getElementById(`${context}Error`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

/**
 * Show success message
 */
function showSuccess(context, message) {
  const successEl = document.getElementById(`${context}Success`);
  if (successEl) {
    successEl.textContent = message;
    successEl.classList.remove('hidden');
  }
}

/**
 * Hide messages
 */
function hideMessages(context) {
  const errorEl = document.getElementById(`${context}Error`);
  const successEl = document.getElementById(`${context}Success`);

  if (errorEl) errorEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');
}
