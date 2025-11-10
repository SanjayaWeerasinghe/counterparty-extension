# Counterparty Signer Extension - Complete Specification

## Overview

A Chrome extension that enables secure signing of Counterparty transactions without exposing private keys to web applications or backend servers. Functions similarly to MetaMask but specifically designed for Counterparty on Bitcoin.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Features](#core-features)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [Security Model](#security-model)
6. [API Specification](#api-specification)
7. [File Structure](#file-structure)
8. [Development Roadmap](#development-roadmap)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Web Application (DApp)                 │
│  ┌──────────────────────────────────────────────┐  │
│  │  • Create issuance form                      │  │
│  │  • Send asset form                           │  │
│  │  • Calls: window.counterpartyWallet.xxx()    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↕ Message passing
┌─────────────────────────────────────────────────────┐
│         Chrome Extension (3 Components)             │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. Content Script (Injected into web page)  │  │
│  │     • Injects window.counterpartyWallet      │  │
│  │     • Proxies requests to background         │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  2. Background Script (Service Worker)       │  │
│  │     • Manages wallet state                   │  │
│  │     • Handles signing requests               │  │
│  │     • Communicates with popup                │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  3. Popup UI (Extension icon click)          │  │
│  │     • Wallet management                      │  │
│  │     • View balances                          │  │
│  │     • Settings                               │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  4. Signing Window (Transaction approval)    │  │
│  │     • Shows transaction details              │  │
│  │     • User enters password                   │  │
│  │     • Signs transaction locally              │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────────┐
│        Chrome Storage (Encrypted)                   │
│  • Encrypted private keys                           │
│  • User settings                                    │
│  • Transaction history                              │
└─────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Wallet Management

#### Create New Wallet
- Generate new Bitcoin private key (256-bit random)
- Derive public key and Bitcoin address
- Display seed phrase (12 or 24 words BIP39)
- Encrypt and store private key

#### Import Existing Wallet
- **From seed phrase**: BIP39 mnemonic (12/24 words)
- **From private key**: WIF format
- **From JSON file**: Backup file format

#### Multiple Accounts
- Support multiple addresses within one wallet
- Switch between accounts
- Label/name each account

### 2. Transaction Signing

#### Supported Transaction Types
- ✅ Counterparty Issuance (create NFT/token)
- ✅ Counterparty Send (transfer assets)
- ✅ Bitcoin standard transactions
- ✅ Multi-signature transactions (future)

#### Signing Process
1. DApp requests signature via API
2. Extension opens signing window
3. Display transaction details (decoded)
4. User reviews and enters password
5. Extension decrypts private key
6. Signs transaction locally
7. Returns signed transaction to DApp
8. Private key cleared from memory

### 3. Balance & Asset Viewer

- View Bitcoin (BTCNU) balance
- View all Counterparty assets
- Display NFT metadata (IPFS)
- Show asset descriptions
- Transaction history

### 4. Security Features

- Password-protected encryption
- Auto-lock after inactivity
- Per-transaction password confirmation
- Optional biometric unlock (future)
- Phishing detection
- Domain whitelisting

---

## User Flows

### Flow 1: First-Time Setup

```
User installs extension
    ↓
[Welcome Screen]
    ↓
Choose:
  → Create New Wallet
       ↓
       Generate seed phrase
       ↓
       [Display 12 words]
       "Write these down!"
       ↓
       User confirms seed phrase
       ↓
       Set password (min 8 chars)
       ↓
       Encrypt & store private key
       ↓
       [Wallet Created! 🎉]
       Display address

  → Import Existing Wallet
       ↓
       Choose import method:
         • Seed phrase
         • Private key (WIF)
         • JSON backup
       ↓
       Enter seed/key
       ↓
       Set password
       ↓
       Encrypt & store
       ↓
       [Wallet Imported! 🎉]
```

### Flow 2: Signing a Transaction (Main Use Case)

```
User on DApp website
    ↓
User fills form (e.g., "Create NFT")
    ↓
User clicks "Create NFT"
    ↓
DApp creates unsigned transaction (via backend API)
    ↓
DApp calls: window.counterpartyWallet.signTransaction(...)
    ↓
Extension detects signing request
    ↓
Extension opens signing window (popup)
    ↓
┌────────────────────────────────────────────┐
│  🔐 Counterparty Signer                    │
│                                            │
│  Sign Transaction?                         │
│                                            │
│  Website: https://your-dapp.com            │
│  ✅ Verified                                │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  Transaction Type: NFT Issuance            │
│  Asset: MYART                              │
│  Quantity: 1                               │
│  Divisible: No                             │
│  Locked: Yes (permanent)                   │
│                                            │
│  Description (IPFS):                       │
│  QmYwAPJzv5CZsnA625s3Xf2nemtYgPpH...      │
│  [View on IPFS] →                          │
│                                            │
│  ┌─────────────────────────────┐          │
│  │   [Image Preview]           │          │
│  │   art.png                   │          │
│  └─────────────────────────────┘          │
│                                            │
│  From: bc1q9f8a2...xk7e                   │
│  Network Fee: ~1000 sats                   │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  Password: [________________]              │
│                                            │
│  [Reject]            [Sign & Approve]      │
└────────────────────────────────────────────┘
    ↓
User enters password
    ↓
User clicks "Sign & Approve"
    ↓
Extension validates password
    ↓
Extension decrypts private key
    ↓
Extension signs transaction (bitcoinjs-lib)
    ↓
Extension clears private key from memory
    ↓
Extension returns signed TX to DApp
    ↓
DApp broadcasts transaction
    ↓
[Success! Transaction sent]
```

### Flow 3: Daily Usage

```
User clicks extension icon
    ↓
[Popup Opens]
    ↓
┌────────────────────────────────────────────┐
│  Counterparty Signer                       │
│                                            │
│  Account 1                          [⚙️]   │
│  bc1q9f8a2...xk7e                   [🔒]   │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  💰 Balances                                │
│                                            │
│  BTCNU          0.05 BTCNU                 │
│  XCP            10.5 XCP                   │
│  MYART          1 NFT        [View]        │
│  PEPECASH       1000 PEPECASH              │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  📜 Recent Activity                         │
│                                            │
│  ✅ Sent 1 MYART to bc1q...                │
│     2 hours ago                            │
│                                            │
│  ✅ Created MYART (NFT)                     │
│     1 day ago                              │
│                                            │
│  ────────────────────────────────────────  │
│                                            │
│  [Add Account] [Settings] [Lock Wallet]    │
└────────────────────────────────────────────┘
```

---

## Technical Implementation

### Technology Stack

```javascript
// Core
- Manifest V3 (Chrome Extension)
- TypeScript (type safety)
- React (UI components)
- Tailwind CSS (styling)

// Crypto Libraries
- bitcoinjs-lib (Bitcoin signing)
- bip39 (seed phrase generation/validation)
- crypto-js (AES encryption for storage)

// Build Tools
- Vite (bundler)
- crx (Chrome extension packager)
```

### File Structure

```
counterparty-signer-extension/
├── manifest.json                 # Extension manifest (Manifest V3)
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── src/
│   ├── background/
│   │   ├── background.ts         # Service worker (main logic)
│   │   ├── wallet-manager.ts     # Wallet operations
│   │   ├── crypto.ts             # Encryption/decryption
│   │   └── bitcoin-signer.ts     # Bitcoin transaction signing
│   │
│   ├── content/
│   │   └── content.ts            # Injected into web pages
│   │                             # Injects window.counterpartyWallet
│   │
│   ├── popup/
│   │   ├── Popup.tsx             # Main popup UI
│   │   ├── components/
│   │   │   ├── Balance.tsx       # Balance display
│   │   │   ├── AccountSwitcher.tsx
│   │   │   ├── TransactionHistory.tsx
│   │   │   └── Settings.tsx
│   │   └── pages/
│   │       ├── Welcome.tsx       # First-time setup
│   │       ├── CreateWallet.tsx
│   │       ├── ImportWallet.tsx
│   │       └── Unlock.tsx        # Unlock wallet
│   │
│   ├── signing/
│   │   ├── SigningWindow.tsx     # Transaction approval UI
│   │   ├── components/
│   │   │   ├── TransactionDetails.tsx
│   │   │   ├── IpfsPreview.tsx
│   │   │   └── PasswordInput.tsx
│   │   └── transaction-decoder.ts
│   │
│   ├── lib/
│   │   ├── api.ts                # Backend API client (V1)
│   │   ├── storage.ts            # Chrome storage wrapper
│   │   ├── types.ts              # TypeScript types
│   │   └── constants.ts
│   │
│   └── utils/
│       ├── bitcoin.ts            # Bitcoin utils
│       ├── validation.ts         # Input validation
│       └── format.ts             # Display formatting
│
├── public/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── _locales/                 # Internationalization
│
└── dist/                         # Built extension (output)
```

### manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "Counterparty Signer",
  "version": "1.0.0",
  "description": "Secure wallet for signing Counterparty transactions",

  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "http://localhost:3000/*",
    "https://*.yourdomain.com/*"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Security Model

### Encryption Strategy

#### Storage Encryption (AES-256-GCM)

```typescript
// Encrypt private key before storage
const encryptPrivateKey = (privateKey: string, password: string): string => {
  // 1. Derive key from password using PBKDF2
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 2. Encrypt private key with derived key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    derivedKey,
    new TextEncoder().encode(privateKey)
  );

  // 3. Store: salt + iv + encrypted data
  return base64Encode({ salt, iv, data: encrypted });
};
```

#### What's Stored Where

```typescript
// Chrome Storage (chrome.storage.local)
{
  // Encrypted wallet data
  "wallet": {
    "version": 1,
    "accounts": [
      {
        "id": "account-1",
        "label": "Main Account",
        "address": "bc1q9f8a2...xk7e",
        "publicKey": "03a1b2c3...",
        "encryptedPrivateKey": "base64...",  // ← AES-256-GCM encrypted
        "salt": "base64...",
        "derivationPath": "m/84'/0'/0'/0/0"  // Optional: for HD wallets
      }
    ],
    "currentAccountId": "account-1"
  },

  // Settings
  "settings": {
    "autoLockMinutes": 5,
    "network": "mainnet",  // or "testnet"
    "apiEndpoint": "http://localhost:3000/api/v1",
    "theme": "dark"
  },

  // Session state (cleared on lock)
  "session": {
    "isUnlocked": false,
    "lastActivity": null,
    "pendingSignatures": []
  },

  // Transaction history (non-sensitive)
  "transactions": [
    {
      "txid": "abc123...",
      "type": "issuance",
      "asset": "MYART",
      "timestamp": 1699999999,
      "status": "confirmed"
    }
  ]
}
```

### Security Rules

1. **Private Key Handling**
   - ✅ NEVER store unencrypted private keys
   - ✅ NEVER log private keys
   - ✅ NEVER send private keys over network
   - ✅ Clear from memory immediately after use
   - ✅ Use secure random for generation

2. **Password Requirements**
   - Minimum 8 characters
   - Require: uppercase, lowercase, number
   - Optional: special characters
   - Strength meter shown to user

3. **Auto-Lock**
   - Lock wallet after N minutes of inactivity
   - Require password to unlock
   - Clear decrypted keys from memory on lock

4. **Transaction Approval**
   - ALWAYS show transaction details
   - ALWAYS require password
   - Show domain requesting signature
   - Warn on suspicious transactions

5. **Phishing Protection**
   - Display requesting domain
   - Warn if domain not HTTPS
   - Optional: whitelist trusted domains
   - Show warning for new domains

---

## API Specification

### window.counterpartyWallet API

This API is injected into all web pages by the content script.

```typescript
interface CounterpartyWallet {
  // Metadata
  readonly version: string;
  readonly isInstalled: true;

  // Wallet Information
  getAddress(): Promise<string>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<'mainnet' | 'testnet'>;

  // Balance Queries
  getBalance(asset?: string): Promise<{
    asset: string;
    quantity: number;
    divisible: boolean;
  }>;

  getAllBalances(): Promise<Array<{
    asset: string;
    quantity: number;
    divisible: boolean;
    description?: string;
    ipfsGatewayUrl?: string;
  }>>;

  // Transaction Signing (Main Feature)
  signTransaction(params: {
    unsignedTx: string;           // Hex-encoded unsigned transaction
    details: {                     // Human-readable details
      type: 'issuance' | 'send' | 'bitcoin';
      asset?: string;
      quantity?: number;
      destination?: string;
      description?: string;
      ipfsPreview?: string;      // URL for preview
      [key: string]: any;
    };
    metadata?: {                   // Optional metadata
      domain?: string;
      timestamp?: number;
    };
  }): Promise<string>;            // Returns signed transaction hex

  // Message Signing (for authentication)
  signMessage(message: string): Promise<{
    address: string;
    signature: string;
    publicKey: string;
  }>;

  // Events
  on(event: 'accountChanged', callback: (address: string) => void): void;
  on(event: 'lock', callback: () => void): void;
  on(event: 'unlock', callback: () => void): void;

  // Connection Status
  isConnected(): Promise<boolean>;
  isLocked(): Promise<boolean>;

  // Request Connection (optional permission model)
  requestConnection(domain: string): Promise<boolean>;
}
```

### Usage Examples

#### Example 1: Get User Address

```typescript
// DApp code
try {
  const address = await window.counterpartyWallet.getAddress();
  console.log('User address:', address);
  // Display: bc1q9f8a2...xk7e
} catch (error) {
  console.error('User rejected or extension locked');
}
```

#### Example 2: Sign Issuance Transaction

```typescript
// DApp code (CreateNFTV1 page)

// Step 1: Get unsigned transaction from backend
const response = await fetch('/api/v1/nft/compose/issuance', {
  method: 'POST',
  body: JSON.stringify({
    source: await window.counterpartyWallet.getAddress(),
    asset: 'MYART',
    description: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    quantity: 1,
    divisible: false,
    lock: true
  })
});

const { unsignedTx, details, ipfsGatewayUrl } = await response.json();

// Step 2: Request signature from extension
const signedTx = await window.counterpartyWallet.signTransaction({
  unsignedTx: unsignedTx,
  details: {
    type: 'issuance',
    asset: details.asset,
    quantity: details.quantity,
    divisible: details.divisible,
    lock: details.lock,
    description: details.description,
    ipfsPreview: ipfsGatewayUrl
  }
});

// Step 3: Broadcast signed transaction
const broadcastResponse = await fetch('/api/v1/nft/broadcast', {
  method: 'POST',
  body: JSON.stringify({ signedTx })
});

console.log('Transaction broadcast!', await broadcastResponse.json());
```

#### Example 3: Listen for Account Changes

```typescript
// DApp code
window.counterpartyWallet.on('accountChanged', (newAddress) => {
  console.log('User switched to:', newAddress);
  // Reload balances, update UI, etc.
  updateUI(newAddress);
});

window.counterpartyWallet.on('lock', () => {
  console.log('Wallet locked');
  // Show "Please unlock wallet" message
});
```

---

## Message Passing Architecture

### Content Script ↔ Background Script ↔ Signing Window

```typescript
// content.ts - Injected into web page
window.counterpartyWallet = {
  async signTransaction(params) {
    // Send message to background script
    const response = await chrome.runtime.sendMessage({
      type: 'SIGN_TRANSACTION',
      payload: params
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.signedTx;
  }
};

// background.ts - Service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SIGN_TRANSACTION') {
    // Open signing window
    chrome.windows.create({
      url: 'signing.html',
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      // Store pending signature request
      pendingSignatures.set(window.id, {
        params: message.payload,
        resolve: sendResponse
      });
    });

    return true; // Keep channel open for async response
  }
});

// signing.tsx - Signing window
const handleApprove = async () => {
  const password = passwordInput.value;

  // Send to background script to perform signing
  const response = await chrome.runtime.sendMessage({
    type: 'APPROVE_SIGNATURE',
    payload: { password }
  });

  // Close window
  window.close();
};
```

---

## Development Roadmap

### Phase 1: MVP (Minimum Viable Product)
**Goal**: Basic wallet functionality with signing

- [ ] Extension manifest setup (Manifest V3)
- [ ] Wallet generation (private key, seed phrase)
- [ ] Password encryption (AES-256-GCM)
- [ ] Chrome storage integration
- [ ] Basic popup UI (view address, balances)
- [ ] Content script injection
- [ ] `window.counterpartyWallet` API
- [ ] Signing window UI
- [ ] Transaction signing (bitcoinjs-lib)
- [ ] Integration with V1 API backend

**Deliverable**: Working extension that can sign transactions

---

### Phase 2: Enhanced Security
**Goal**: Improve security and user experience

- [ ] Auto-lock functionality
- [ ] Session management
- [ ] Phishing detection
- [ ] Domain whitelisting
- [ ] Transaction history
- [ ] Multiple accounts support
- [ ] Account labels/names
- [ ] Export wallet (encrypted JSON)

---

### Phase 3: Advanced Features
**Goal**: Feature parity with MetaMask

- [ ] HD wallet support (BIP44)
- [ ] Hardware wallet integration (Ledger, Trezor via HID)
- [ ] Multi-signature support
- [ ] WalletConnect integration
- [ ] QR code scanning (for mobile pairing)
- [ ] Address book
- [ ] Custom RPC endpoints
- [ ] Network switching (mainnet/testnet)
- [ ] Gas estimation
- [ ] Transaction notes

---

### Phase 4: Polish & Distribution
**Goal**: Production-ready release

- [ ] Comprehensive testing
- [ ] Security audit
- [ ] User documentation
- [ ] Video tutorials
- [ ] Chrome Web Store submission
- [ ] Website with docs
- [ ] Support channels
- [ ] Bug bounty program

---

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Package extension
npm run package

# Load unpacked extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select dist/ folder
```

---

## Testing Strategy

### Unit Tests
- Encryption/decryption functions
- Bitcoin key generation
- Signature validation
- Storage operations

### Integration Tests
- Popup UI flows
- Message passing (content ↔ background)
- Signing window approval
- API integration

### End-to-End Tests
- Full wallet creation flow
- Import existing wallet
- Sign transaction from DApp
- Lock/unlock wallet
- Account switching

### Security Tests
- Password strength validation
- Encryption key derivation
- Private key clearing from memory
- Phishing detection
- XSS prevention

---

## Security Considerations

### What Could Go Wrong?

1. **Private Key Exposure**
   - ❌ Logging private keys
   - ❌ Storing unencrypted
   - ❌ Sending over network
   - ✅ Mitigation: Code review, linting rules

2. **Weak Password**
   - ❌ User chooses "password123"
   - ✅ Mitigation: Password strength meter, requirements

3. **Phishing Attack**
   - ❌ Malicious site tricks user
   - ✅ Mitigation: Show domain, HTTPS check, warnings

4. **XSS Attack**
   - ❌ Malicious script reads extension data
   - ✅ Mitigation: CSP headers, isolated execution

5. **Man-in-the-Middle**
   - ❌ Unsigned transaction modified
   - ✅ Mitigation: Show decoded TX details, user reviews

---

## Comparison to Existing Wallets

| Feature | MetaMask (Ethereum) | Our Extension (Counterparty) |
|---------|---------------------|------------------------------|
| **Network** | Ethereum | Bitcoin (Counterparty) |
| **Key Storage** | Encrypted local | Encrypted local |
| **Signing** | EIP-712 | Bitcoin ECDSA |
| **DApp API** | window.ethereum | window.counterpartyWallet |
| **HD Wallets** | ✅ BIP44 | ✅ BIP44 (Phase 3) |
| **Hardware Wallet** | ✅ Ledger, Trezor | 🔜 Phase 3 |
| **Multi-sig** | Limited | 🔜 Phase 3 |
| **Asset Support** | ERC-20, ERC-721 | XCP, Counterparty Assets |
| **IPFS** | Limited | ✅ Native support |

---

## Success Criteria

The extension is considered successful when:

✅ User can create/import wallet
✅ Private keys never leave extension
✅ User can sign transactions from DApps
✅ Signing window shows clear transaction details
✅ IPFS previews work
✅ Auto-lock protects wallet
✅ Works with existing V1 API backend
✅ No security vulnerabilities
✅ Passes Chrome Web Store review
✅ User feedback is positive

---

## Resources & References

### Documentation
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [bitcoinjs-lib Documentation](https://github.com/bitcoinjs/bitcoinjs-lib)
- [BIP39 Mnemonic Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP44 HD Wallet Specification](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)

### Security
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

### Inspiration
- [MetaMask Source Code](https://github.com/MetaMask/metamask-extension)
- [Keplr Wallet](https://github.com/chainapsis/keplr-wallet)

---

## License

MIT License - Open source, community-driven development

---

## Contact & Support

- **GitHub**: [Repository URL]
- **Discord**: [Community Server]
- **Email**: support@yourdomain.com

---

**Document Version**: 1.0
**Last Updated**: November 10, 2025
**Status**: ✅ Specification Complete - Ready for Implementation
