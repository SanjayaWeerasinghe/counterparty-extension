/**
 * Signing Window Logic
 * Displays transaction details and handles approve/reject
 */

let requestId = null;
let transactionData = null;
let port = null;

/**
 * Initialize signing window
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get request ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  requestId = urlParams.get('requestId');

  if (!requestId) {
    showError('Invalid request - missing request ID');
    return;
  }

  // Connect to background script
  port = chrome.runtime.connect({ name: 'signing-window' });

  // Request transaction data
  port.postMessage({
    type: 'GET_SIGN_REQUEST',
    requestId
  });

  // Listen for response
  port.onMessage.addListener((message) => {
    if (message.type === 'SIGN_REQUEST_DATA') {
      transactionData = message.data;
      displayTransaction();
    }
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    if (!transactionData) {
      showError('Failed to load transaction data - request may have expired');
    }
  }, 10000);
});

/**
 * Display transaction details
 */
function displayTransaction() {
  if (!transactionData) return;

  const { unsignedTx, details } = transactionData;

  // Hide loading, show transaction
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('transactionState').classList.remove('hidden');

  // Display unsigned transaction hex
  document.getElementById('unsignedTxHex').textContent = unsignedTx;

  // Parse and display details
  if (details) {
    displayTransactionDetails(details);
  } else {
    // Fallback if no details provided
    document.getElementById('txDetailsSection').innerHTML = `
      <div class="section-title">Transaction Details</div>
      <div class="detail-row">
        <div class="detail-label">Raw Transaction</div>
        <div class="detail-value">Review the hex below</div>
      </div>
    `;
  }
}

/**
 * Display parsed transaction details
 */
function displayTransactionDetails(details) {
  const detailsContainer = document.getElementById('txDetailsSection');
  let detailsHTML = '<div class="section-title">Transaction Details</div>';

  // Transaction type
  const txType = details.type || details.transactionType || 'Unknown';
  document.getElementById('txType').textContent = txType.toUpperCase();
  document.getElementById('txType').className = `status-badge ${txType.toLowerCase()}`;

  // Common fields
  if (details.source) {
    detailsHTML += createDetailRow('From Address', details.source);
  }

  // Issuance-specific fields
  if (txType.toLowerCase() === 'issuance') {
    if (details.asset) {
      detailsHTML += createDetailRow('Asset Name', details.asset, true);
    }
    if (details.quantity !== undefined) {
      detailsHTML += createDetailRow('Quantity', details.quantity.toLocaleString());
    }
    if (details.divisible !== undefined) {
      detailsHTML += createDetailRow('Divisible', details.divisible ? 'Yes' : 'No');
    }
    if (details.description) {
      detailsHTML += createDetailRow('Description', details.description);
    }
    if (details.lock !== undefined) {
      detailsHTML += createDetailRow('Lock Asset', details.lock ? 'Yes' : 'No');
    }
    if (details.ipfsGatewayUrl) {
      detailsHTML += createDetailRow('IPFS Gateway', details.ipfsGatewayUrl);
    }
  }

  // Send-specific fields
  if (txType.toLowerCase() === 'send') {
    if (details.destination) {
      detailsHTML += createDetailRow('To Address', details.destination);
    }
    if (details.asset) {
      detailsHTML += createDetailRow('Asset', details.asset, true);
    }
    if (details.quantity !== undefined) {
      detailsHTML += createDetailRow('Amount', details.quantity.toLocaleString());
    }
    if (details.memo) {
      detailsHTML += createDetailRow('Memo', details.memo);
    }
  }

  // Fee and UTXO info
  if (details.fee) {
    detailsHTML += createDetailRow('Network Fee', `${details.fee} satoshis`);
  }

  if (details.utxoUsed) {
    detailsHTML += createDetailRow('UTXO Used', details.utxoUsed);
  }

  detailsContainer.innerHTML = detailsHTML;
}

/**
 * Create a detail row
 */
function createDetailRow(label, value, large = false) {
  const sizeClass = large ? 'large' : '';
  return `
    <div class="detail-row">
      <div class="detail-label">${label}</div>
      <div class="detail-value ${sizeClass}">${value}</div>
    </div>
  `;
}

/**
 * Approve transaction
 */
async function approveTransaction() {
  if (!requestId) return;

  // Disable buttons
  document.getElementById('approveBtn').disabled = true;
  document.getElementById('rejectBtn').disabled = true;
  document.getElementById('approveBtn').textContent = 'Signing...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'APPROVE_SIGNING',
      data: { requestId }
    });

    if (response.success) {
      // Show success briefly
      document.getElementById('approveBtn').textContent = '✓ Signed!';
      document.getElementById('approveBtn').style.background = 'rgba(34, 197, 94, 0.3)';

      // Close window after 1 second
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      showError(response.error || 'Failed to sign transaction');
      document.getElementById('approveBtn').disabled = false;
      document.getElementById('rejectBtn').disabled = false;
      document.getElementById('approveBtn').textContent = 'Approve & Sign';
    }
  } catch (error) {
    showError(error.message || 'Failed to sign transaction');
    document.getElementById('approveBtn').disabled = false;
    document.getElementById('rejectBtn').disabled = false;
    document.getElementById('approveBtn').textContent = 'Approve & Sign';
  }
}

/**
 * Reject transaction
 */
async function rejectTransaction() {
  if (!requestId) return;

  // Disable buttons
  document.getElementById('approveBtn').disabled = true;
  document.getElementById('rejectBtn').disabled = true;

  try {
    await chrome.runtime.sendMessage({
      type: 'REJECT_SIGNING',
      data: { requestId }
    });
  } catch (error) {
    console.error('Failed to reject:', error);
  }

  // Close window
  window.close();
}

/**
 * Show error message
 */
function showError(message) {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('transactionState').classList.add('hidden');
  document.getElementById('errorState').classList.remove('hidden');
  document.getElementById('errorMessage').textContent = message;
}

// Handle window close
window.addEventListener('beforeunload', () => {
  if (port) {
    port.disconnect();
  }
});
