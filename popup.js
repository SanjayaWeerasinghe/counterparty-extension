/**
 * Enhanced Popup UI with Multi-Account Support
 * Handles wallet creation, import, unlock, and account management
 */

// UI state
let walletStatus = null;
let accounts = [];

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing multi-account popup...');
  await loadWalletStatus();

  // Setup event listeners
  setupEventListeners();

  console.log('[Popup] Multi-account popup initialized');
});

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Tab switching (setup view)
  document.getElementById('createTabBtn')?.addEventListener('click', () => showSetupTab('create'));
  document.getElementById('importTabBtn')?.addEventListener('click', () => showSetupTab('import'));

  // Wallet actions
  document.getElementById('createWalletBtn')?.addEventListener('click', createWallet);
  document.getElementById('importWalletBtn')?.addEventListener('click', importWallet);
  document.getElementById('unlockWalletBtn')?.addEventListener('click', unlockWallet);
  document.getElementById('lockWalletBtn')?.addEventListener('click', lockWallet);
  document.getElementById('copyAddressBtn')?.addEventListener('click', copyAddress);

  // Add account
  document.getElementById('addAccountBtnStrip')?.addEventListener('click', showAddAccountModal);
  document.getElementById('addCreateTabBtn')?.addEventListener('click', () => showAddTab('create'));
  document.getElementById('addImportTabBtn')?.addEventListener('click', () => showAddTab('import'));
  document.getElementById('addCreateAccountBtn')?.addEventListener('click', addCreateAccount);
  document.getElementById('addImportAccountBtn')?.addEventListener('click', addImportAccount);
  document.getElementById('cancelAddBtn')?.addEventListener('click', hideAddAccountModal);
  document.getElementById('cancelAddImportBtn')?.addEventListener('click', hideAddAccountModal);

  // Enter key handlers
  document.getElementById('createPasswordConfirm')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createWallet();
  });

  document.getElementById('importPasswordConfirm')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') importWallet();
  });

  document.getElementById('unlockPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') unlockWallet();
  });

  document.getElementById('addCreatePassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addCreateAccount();
  });

  document.getElementById('addImportPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addImportAccount();
  });
}

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
      document.getElementById('lockedAccountCount').textContent =
        `${walletStatus.totalAccounts} account${walletStatus.totalAccounts !== 1 ? 's' : ''}`;
    } else {
      showView('unlockedView');
      document.getElementById('currentAccountName').textContent = walletStatus.accountName || 'Account';
      document.getElementById('currentWalletAddress').textContent = walletStatus.address;

      // Load accounts list
      await loadAccounts();
    }
  } catch (error) {
    console.error('Failed to load wallet status:', error);
    showError('setup', 'Failed to connect to wallet service');
  }
}

/**
 * Load accounts list
 */
async function loadAccounts() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ACCOUNTS'
    });

    if (response.success) {
      accounts = response.data.accounts;
      renderAccountStrip();
    }
  } catch (error) {
    console.error('Failed to load accounts:', error);
  }
}

/**
 * Render account strip (horizontal account selector)
 */
function renderAccountStrip() {
  const container = document.getElementById('accountStrip');
  if (!container) return;

  container.innerHTML = '';

  const icons = ['🔑', '💎', '⭐', '🎯', '🚀', '💰', '🎨', '🌟', '⚡', '🔥'];

  accounts.forEach(account => {
    const stripItem = document.createElement('div');
    stripItem.className = `account-strip-item ${account.isCurrent ? 'active' : ''}`;
    stripItem.onclick = () => {
      if (!account.isCurrent) {
        switchToAccount(account.index);
      }
    };

    stripItem.innerHTML = `
      <div class="account-strip-icon">${icons[account.index % icons.length]}</div>
      <div class="account-strip-name">${account.name}</div>
    `;

    container.appendChild(stripItem);
  });
}

/**
 * Switch to different account
 */
window.switchToAccount = async function(accountIndex) {
  const password = prompt('Enter password to unlock account:');
  if (!password) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SWITCH_ACCOUNT',
      data: { accountIndex, password }
    });

    if (response.success) {
      await loadWalletStatus();
    } else {
      showError('accounts', response.error || 'Failed to switch account');
    }
  } catch (error) {
    showError('accounts', error.message);
  }
};

/**
 * Rename account
 */
window.renameAccount = async function(accountIndex) {
  const newName = prompt('Enter new account name:', accounts[accountIndex].name);
  if (!newName || newName.trim() === '') return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'RENAME_ACCOUNT',
      data: { accountIndex, newName }
    });

    if (response.success) {
      await loadAccounts();
    } else {
      showError('accounts', response.error || 'Failed to rename account');
    }
  } catch (error) {
    showError('accounts', error.message);
  }
};

/**
 * Delete account
 */
window.deleteAccount = async function(accountIndex) {
  const confirmDelete = confirm(`Delete ${accounts[accountIndex].name}?\n\nThis cannot be undone. Make sure you have backed up the private key!`);
  if (!confirmDelete) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_ACCOUNT',
      data: { accountIndex }
    });

    if (response.success) {
      await loadWalletStatus();
    } else {
      showError('accounts', response.error || 'Failed to delete account');
    }
  } catch (error) {
    showError('accounts', error.message);
  }
};

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
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const tabs = document.querySelectorAll('#setupView .tab');
  if (tab === 'create') {
    tabs[0]?.classList.add('active');
    document.getElementById('createTab')?.classList.remove('hidden');
    document.getElementById('importTab')?.classList.add('hidden');
  } else {
    tabs[1]?.classList.add('active');
    document.getElementById('createTab')?.classList.add('hidden');
    document.getElementById('importTab')?.classList.remove('hidden');
  }
}

/**
 * Show add account tab
 */
function showAddTab(tab) {
  const tabs = document.querySelectorAll('#addAccountModal .tab');
  tabs.forEach(t => t.classList.remove('active'));

  if (tab === 'create') {
    tabs[0]?.classList.add('active');
    document.getElementById('addCreateTab')?.classList.remove('hidden');
    document.getElementById('addImportTab')?.classList.add('hidden');
  } else {
    tabs[1]?.classList.add('active');
    document.getElementById('addCreateTab')?.classList.add('hidden');
    document.getElementById('addImportTab')?.classList.remove('hidden');
  }
}

/**
 * Show add account modal
 */
function showAddAccountModal() {
  document.getElementById('unlockedView').style.display = 'none';
  document.getElementById('addAccountModal').classList.add('active');
  showAddTab('create');
}

/**
 * Hide add account modal
 */
function hideAddAccountModal() {
  document.getElementById('addAccountModal').classList.remove('active');
  document.getElementById('unlockedView').style.display = 'block';

  // Clear inputs
  document.getElementById('addCreatePassword').value = '';
  document.getElementById('addImportAddress').value = '';
  document.getElementById('addImportPrivateKey').value = '';
  document.getElementById('addImportPassword').value = '';

  hideMessages('add');
}

/**
 * Create new wallet (first account)
 */
async function createWallet() {
  hideMessages('create');

  const password = document.getElementById('createPassword')?.value;
  const passwordConfirm = document.getElementById('createPasswordConfirm')?.value;

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
      showSuccess('create', `Account created! Address: ${response.data.address}`);
      setTimeout(loadWalletStatus, 2000);
    } else {
      showError('create', response.error || 'Failed to create account');
    }
  } catch (error) {
    showError('create', error.message || 'Failed to create account');
  }
}

/**
 * Import existing wallet (first account)
 */
async function importWallet() {
  hideMessages('import');

  const address = document.getElementById('importAddress')?.value.trim();
  const privateKey = document.getElementById('importPrivateKey')?.value.trim();
  const password = document.getElementById('importPassword')?.value;
  const passwordConfirm = document.getElementById('importPasswordConfirm')?.value;

  if (!address) {
    showError('import', 'Bitcoin address is required');
    return;
  }

  if (!privateKey || (privateKey.length !== 51 && privateKey.length !== 52)) {
    showError('import', 'Invalid private key length (WIF should be 51-52 characters)');
    return;
  }

  if (!/^[KL]/.test(privateKey)) {
    showError('import', 'Private key should start with K or L (compressed WIF format)');
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
      data: { address, privateKey, password }
    });

    if (response.success) {
      showSuccess('import', `Account imported! Address: ${response.data.address}`);
      setTimeout(loadWalletStatus, 2000);
    } else {
      showError('import', response.error || 'Failed to import account');
    }
  } catch (error) {
    showError('import', error.message || 'Failed to import account');
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
 * Add create account
 */
async function addCreateAccount() {
  hideMessages('add');

  const password = document.getElementById('addCreatePassword').value;

  if (!password) {
    showError('add', 'Please enter password');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_WALLET',
      data: { password }
    });

    if (response.success) {
      showSuccess('add', `Account created: ${response.data.accountName}`);
      setTimeout(() => {
        hideAddAccountModal();
        loadWalletStatus();
      }, 1500);
    } else {
      showError('add', response.error || 'Failed to create account');
    }
  } catch (error) {
    showError('add', error.message);
  }
}

/**
 * Add import account
 */
async function addImportAccount() {
  hideMessages('add');

  const address = document.getElementById('addImportAddress').value.trim();
  const privateKey = document.getElementById('addImportPrivateKey').value.trim();
  const password = document.getElementById('addImportPassword').value;

  if (!address) {
    showError('add', 'Bitcoin address is required');
    return;
  }

  if (!privateKey || (privateKey.length !== 51 && privateKey.length !== 52)) {
    showError('add', 'Invalid private key format');
    return;
  }

  if (!password) {
    showError('add', 'Please enter password');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_WALLET',
      data: { address, privateKey, password }
    });

    if (response.success) {
      showSuccess('add', `Account imported: ${response.data.accountName}`);
      setTimeout(() => {
        hideAddAccountModal();
        loadWalletStatus();
      }, 1500);
    } else {
      showError('add', response.error || 'Failed to import account');
    }
  } catch (error) {
    showError('add', error.message);
  }
}

/**
 * Copy address to clipboard
 */
async function copyAddress() {
  if (walletStatus?.address) {
    try {
      await navigator.clipboard.writeText(walletStatus.address);

      const btn = document.getElementById('copyAddressBtn');
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
