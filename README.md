# Counterparty Signer Extension

A Chrome/Chromium extension for securely signing Counterparty transactions without exposing private keys to web applications.

## Overview

This extension provides a secure wallet for Bitcoin/Counterparty that:
- Generates and stores private keys locally (encrypted)
- Injects `window.counterpartyWallet` API into web pages
- Shows confirmation dialogs before signing transactions
- Never sends private keys to any backend or website

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Web Page   │────▶│   Content Script │────▶│  Background  │
│             │◀────│  (API Injection) │◀────│   Service    │
└─────────────┘     └──────────────────┘     │   Worker     │
                                              └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │   Signing    │
                                              │   Window     │
                                              └──────────────┘
```

## Installation

### Step 1: Load Extension in Chromium

1. Open Chromium/Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `/counterparty-signer-extension` folder
6. The extension should now appear in your extensions list

### Step 2: Create Icons (Optional)

The extension uses placeholder icons. To create proper icons:

1. Open `/counterparty-signer-extension/assets/generate-icons.html` in a browser
2. Right-click each canvas and "Save image as..."
3. Save as:
   - `icon-16.png` (16x16)
   - `icon-48.png` (48x48)
   - `icon-128.png` (128x128)
4. Place all PNG files in `/counterparty-signer-extension/assets/`
5. Reload the extension in `chrome://extensions/`

Alternatively, you can use the SVG icon at `assets/icon.svg` and convert it to PNG using any tool.

### Step 3: Setup Wallet

1. Click the extension icon in your browser toolbar
2. Choose **Create Wallet** or **Import Wallet**

**Create Wallet:**
- Enter a secure password (min 8 characters)
- Confirm password
- Click "Create Wallet"
- Your new Bitcoin address will be displayed

**Import Wallet:**
- Enter your existing private key (64 hex characters)
- Enter a secure password
- Confirm password
- Click "Import Wallet"
- Your Bitcoin address will be derived and displayed

## Usage

### Unlock Wallet

1. Click the extension icon
2. Enter your password
3. Click "Unlock"

The wallet will remain unlocked until you lock it manually or close the browser.

### Using with Web Applications

Once the extension is installed, web applications can interact with your wallet using the injected API:

```javascript
// Check if wallet is installed
if (window.counterpartyWallet && window.counterpartyWallet.isInstalled) {
  console.log('Counterparty Wallet detected!');
}

// Get user's address
const address = await window.counterpartyWallet.getAddress();
console.log('User address:', address);

// Sign a transaction
const signedTx = await window.counterpartyWallet.signTransaction({
  unsignedTx: "0200000001...",  // Unsigned transaction hex
  details: {                     // Optional: details for display
    type: "issuance",
    asset: "MYART",
    quantity: 1,
    description: "ipfs://...",
    lock: true
  }
});

console.log('Signed transaction:', signedTx);
```

### Transaction Signing Flow

1. Web application requests signature via `window.counterpartyWallet.signTransaction()`
2. Extension opens a popup window showing transaction details
3. User reviews the transaction carefully
4. User clicks "Approve & Sign" or "Reject"
5. If approved, transaction is signed locally
6. Signed transaction hex is returned to the web application

## Integration with V1 Frontend

This extension works with the V1 frontend at `http://localhost:5173/create-v1`:

1. Start the backend:
   ```bash
   cd /nft-api-gateway
   npm start
   ```

2. Start the frontend:
   ```bash
   cd /opt/counterparty/bitnu-mint-space
   npm run dev
   ```

3. Ensure the extension is installed and wallet is unlocked

4. Navigate to `http://localhost:5173/create-v1`

5. Upload a file to IPFS

6. Click "Create NFT & Sign"

7. The extension will pop up asking for approval

8. Review and approve the transaction

## API Reference

### window.counterpartyWallet.getAddress()

Returns the user's Bitcoin address.

**Returns:** `Promise<string>`

**Example:**
```javascript
const address = await window.counterpartyWallet.getAddress();
// "bc1q..."
```

### window.counterpartyWallet.signTransaction(params)

Signs a Counterparty transaction.

**Parameters:**
- `params.unsignedTx` (string): Unsigned transaction hex
- `params.details` (object, optional): Transaction details for display
  - `type` (string): Transaction type ("issuance", "send", etc.)
  - `source` (string): Source address
  - `asset` (string): Asset name
  - `quantity` (number): Quantity
  - Other fields depending on transaction type

**Returns:** `Promise<string>` - Signed transaction hex

**Throws:** Error if user rejects or wallet is locked

**Example:**
```javascript
try {
  const signedTx = await window.counterpartyWallet.signTransaction({
    unsignedTx: "0200000001abc...",
    details: {
      type: "issuance",
      source: "bc1q...",
      asset: "MYART",
      quantity: 1,
      description: "ipfs://Qm...",
      lock: true,
      fee: 10000
    }
  });

  console.log('Transaction signed:', signedTx);
} catch (error) {
  console.error('Signing failed:', error.message);
}
```

### window.counterpartyWallet.isUnlocked()

Checks if the wallet is currently unlocked.

**Returns:** `Promise<boolean>`

**Example:**
```javascript
const unlocked = await window.counterpartyWallet.isUnlocked();
if (!unlocked) {
  alert('Please unlock your wallet first');
}
```

## File Structure

```
/counterparty-signer-extension/
├── manifest.json                    # Extension manifest (Manifest V3)
├── popup.html                       # Popup UI (wallet management)
├── popup.js                         # Popup logic
├── signing.html                     # Signing window UI
├── signing.js                       # Signing window logic
├── src/
│   ├── background/
│   │   └── background.js           # Service worker (wallet state)
│   ├── content/
│   │   └── content.js              # Content script (API injection)
│   └── lib/
│       ├── encryption.js           # AES-GCM encryption
│       └── bitcoin-simple.js       # Bitcoin crypto utilities
├── assets/
│   ├── icon-16.png                 # 16x16 icon
│   ├── icon-48.png                 # 48x48 icon
│   ├── icon-128.png                # 128x128 icon
│   ├── icon.svg                    # SVG icon template
│   └── generate-icons.html         # Icon generator
├── EXTENSION_SPECIFICATION.md      # Detailed specification
└── README.md                       # This file
```

## Security Features

### Encryption
- Private keys are encrypted using AES-GCM (256-bit)
- Password-based key derivation with PBKDF2 (100,000 iterations)
- Random salt and IV for each encryption
- Keys only decrypted in memory when wallet is unlocked

### Storage
- Encrypted private keys stored in `chrome.storage.local`
- Decrypted private keys never stored on disk
- Private keys cleared from memory when wallet is locked

### Permissions
- Extension only requests `storage` and `activeTab` permissions
- Content script runs on all URLs but only injects read-only API
- No access to browsing history or other sensitive data

### User Confirmation
- Every transaction requires explicit user approval
- Transaction details shown in dedicated window
- No automatic signing without user interaction

## MVP Limitations

This is an MVP (Minimum Viable Product) with the following limitations:

### 1. Backend Signing (Temporary)
Currently, the extension calls `/api/nft/sign-raw-tx` on the backend to sign transactions. This is **ONLY FOR TESTING**.

**In production:**
- Extension would sign locally using `bitcoinjs-lib`
- Backend would never see private keys
- Backend signing endpoint would be removed

### 2. Mock Address Derivation
The `BitcoinSigner.deriveAddress()` function uses a simplified mock implementation.

**In production:**
- Use proper BIP32/BIP44 HD wallet derivation
- Support multiple address types (P2PKH, P2WPKH, P2SH-P2WPKH)
- Generate proper Bitcoin addresses

### 3. No Hardware Wallet Support
Currently only supports software-based key storage.

**Future:**
- Add Ledger/Trezor integration
- Support external signing devices

### 4. Limited Error Handling
Basic error handling for MVP.

**Future:**
- Better error messages
- Network error recovery
- Transaction simulation/validation

## Development

### Testing

1. Load extension in Chrome
2. Open Developer Tools (`F12`)
3. Check Console for messages:
   - "Counterparty Wallet API injected" (content script)
   - "Counterparty Wallet content script loaded" (content script)
   - "Counterparty Signer background service worker loaded" (background)

### Debugging

**Background Script:**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"
- Console will show background script logs

**Content Script:**
- Open any web page
- Press `F12` to open Developer Tools
- Console will show content script logs

**Popup:**
- Click extension icon
- Right-click popup → "Inspect"
- Console will show popup logs

### Reload Extension

After making changes:
1. Go to `chrome://extensions/`
2. Click reload icon on the Counterparty Signer extension
3. Refresh any open web pages to reload content scripts

## Troubleshooting

### Extension doesn't appear
- Make sure Developer mode is enabled
- Check that manifest.json is valid
- Look for errors in `chrome://extensions/`

### API not injected
- Check browser console for "Counterparty Wallet API injected"
- Refresh the page after loading extension
- Check that content script permissions are correct

### Signing fails
- Make sure wallet is unlocked
- Check that backend is running (`http://localhost:3000`)
- Look for errors in background script console

### Can't unlock wallet
- Verify password is correct
- Check browser console for errors
- Try locking and unlocking again

## Next Steps

### Phase 1: Remove Backend Signing
- Integrate `bitcoinjs-lib` for local signing
- Remove `/api/nft/sign-raw-tx` endpoint
- Test with real Bitcoin testnet

### Phase 2: Proper Bitcoin Support
- Implement BIP32/BIP44 HD wallets
- Support multiple address types
- Add address derivation path selection

### Phase 3: Enhanced Security
- Add hardware wallet support (Ledger, Trezor)
- Implement transaction simulation
- Add spending limits and approval rules

### Phase 4: Better UX
- Show transaction history
- Display asset balances
- Add address book
- Multiple account support

### Phase 5: Publishing
- Replace placeholder icons with professional design
- Comprehensive testing on testnet
- Security audit
- Publish to Chrome Web Store

## Contributing

This is an MVP for the Counterparty Signer wallet extension. Contributions welcome!

## License

[Specify license]

## Support

For issues and questions:
- Check `EXTENSION_SPECIFICATION.md` for detailed technical info
- Review `/opt/counterparty/bitnu-mint-space/V1_FRONTEND_COMPLETE.md` for frontend integration
- Check `/nft-api-gateway/V1_API_DOCUMENTATION.md` for API reference

---

**Version:** 1.0.0 (MVP)
**Status:** Development/Testing
**Date:** November 10, 2025
