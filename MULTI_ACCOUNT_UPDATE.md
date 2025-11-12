# Multi-Account Update - Counterparty Signer Extension

## ✅ Implementation Complete

### What Changed

The extension now supports **multiple accounts** (addresses) within a **single encrypted wallet** protected by **one master password**.

### Key Features

1. **Persistent Storage**
   - All accounts are saved in Chrome's local storage
   - Accounts persist across browser restarts
   - Only need to unlock with password after restart

2. **Multi-Account Management**
   - Create unlimited accounts (each gets a unique Bitcoin address)
   - Import existing accounts using WIF private keys
   - Switch between accounts easily
   - Rename accounts for better organization
   - Delete accounts (with safety checks)

3. **Security**
   - One master password protects all accounts
   - Each account's private key is encrypted individually with AES-256-GCM
   - Private keys only decrypted in memory when needed
   - Automatic migration from old single-account format

### User Workflow

#### First Time Setup
1. Open extension popup
2. Choose "Create" or "Import"
3. Set a master password (min 8 characters)
4. First account is created/imported
5. Wallet is now unlocked and ready to use

#### Adding More Accounts
1. Unlock wallet (if locked)
2. Click "+ Add" button in accounts section
3. Choose "Create" (new random address) or "Import" (existing WIF key)
4. Enter your master password
5. New account is added and activated

#### Switching Accounts
1. In the unlocked view, see all accounts listed
2. Click "Switch" on any account
3. Enter password to unlock that account
4. Extension now uses the selected account for signing

#### After Browser Restart
1. Open extension popup
2. All accounts are still there (locked)
3. Enter master password to unlock
4. Last active account is selected automatically

### Technical Implementation

#### Storage Structure
```javascript
{
  accounts: [
    {
      name: "Account 1",
      address: "1ABC...",
      encryptedPrivateKey: "base64..."
    },
    {
      name: "My Trading Account",
      address: "1XYZ...",
      encryptedPrivateKey: "base64..."
    }
  ],
  currentAccountIndex: 0
}
```

#### Message Types Added
- `GET_ACCOUNTS` - Get list of all accounts
- `SWITCH_ACCOUNT` - Switch to different account
- `RENAME_ACCOUNT` - Rename an account
- `DELETE_ACCOUNT` - Delete an account (must have 2+ accounts)

### Files Modified

1. **`src/background/background.js`**
   - Changed storage structure from single account to accounts array
   - Added multi-account management handlers
   - Added automatic migration from old format
   - Updated all wallet operations to work with account array

2. **`popup.html` (replaced)**
   - New UI showing all accounts
   - Account switcher with visual indicators
   - Add account modal
   - Better UX for multi-account workflow

3. **`popup.js` (replaced)**
   - Account list rendering
   - Switch/rename/delete operations
   - Add account modal management
   - Enhanced status display

### Testing Checklist

- [x] Create first account (wallet setup)
- [x] Import first account (wallet setup)
- [ ] Add second account (create new)
- [ ] Add third account (import existing)
- [ ] Switch between accounts
- [ ] Rename an account
- [ ] Delete an account
- [ ] Lock and unlock wallet
- [ ] Close browser and reopen - accounts should persist
- [ ] Sign transaction with each account

### Migration

The extension automatically migrates old single-account wallets to the new multi-account format:

```javascript
// Old format (auto-detected)
{
  encryptedPrivateKey: "...",
  address: "1ABC..."
}

// Migrated to:
{
  accounts: [
    {
      name: "Account 1",
      address: "1ABC...",
      encryptedPrivateKey: "..."
    }
  ],
  currentAccountIndex: 0
}
```

### Security Considerations

1. **Encryption**: Each private key encrypted separately (AES-GCM with PBKDF2)
2. **Memory Safety**: Private keys cleared from memory when locked
3. **Password Protection**: Same password for all accounts (simpler UX)
4. **Account Isolation**: Each account can be deleted without affecting others
5. **Delete Safety**: Cannot delete the only account

### Future Enhancements

- [ ] Export account backup (encrypted JSON)
- [ ] Bulk import from seed phrase
- [ ] Account groups/labels
- [ ] Hide/archive unused accounts
- [ ] Transaction history per account
- [ ] Account balance display (if API integration added)

---

## Installation & Testing

1. Load extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/counterparty-signer-extension/` directory

2. Test the extension:
   - Click extension icon
   - Create or import first account
   - Add more accounts
   - Test switching between accounts
   - Close and reopen Chrome - accounts should persist

3. Test with NFT minting:
   - Go to your NFT minting site (port 8081)
   - Connect wallet
   - Sign a transaction
   - Should use the currently selected account

---

**Status**: ✅ Ready for Testing
**Version**: 2.0 (Multi-Account Support)
**Date**: 2025-11-12
