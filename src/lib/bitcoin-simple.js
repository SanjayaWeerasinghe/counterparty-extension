/**
 * Bitcoin transaction signing library
 * Uses noble-secp256k1 for ECDSA signing (pure JS, no external dependencies needed)
 */

// Import noble-secp256k1 (will be loaded via importScripts)
// This is a minimal, audited secp256k1 implementation

class BitcoinSigner {
  /**
   * Decode WIF private key to raw bytes
   */
  static decodeWIF(wif) {
    // Base58 alphabet
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    // Decode base58
    let decoded = 0n;
    for (let i = 0; i < wif.length; i++) {
      const char = wif[i];
      const value = ALPHABET.indexOf(char);
      if (value === -1) throw new Error('Invalid WIF character');
      decoded = decoded * 58n + BigInt(value);
    }

    // Convert to hex and then bytes
    let hex = decoded.toString(16);
    if (hex.length % 2) hex = '0' + hex;

    const bytes = this.hexToBytes(hex);

    // WIF format: [version(1)][private_key(32)][compressed_flag(1)][checksum(4)]
    // Remove version (first byte) and checksum (last 4 bytes)
    const privateKeyBytes = bytes.slice(1, -4);

    // Remove compressed flag if present (33 bytes total means compressed)
    if (privateKeyBytes.length === 33) {
      return privateKeyBytes.slice(0, 32);
    }

    return privateKeyBytes;
  }

  /**
   * Sign a Bitcoin transaction
   * @param {string} privateKeyWif - WIF format private key
   * @param {string} unsignedTxHex - Unsigned transaction hex
   * @returns {string} Signed transaction hex
   */
  static async signTransaction(privateKeyWif, unsignedTxHex) {
    console.log('[BitcoinSigner] Signing transaction locally');

    // Decode WIF to get raw private key
    const privateKeyBytes = this.decodeWIF(privateKeyWif);
    const privateKeyHex = this.bytesToHex(privateKeyBytes);

    console.log('[BitcoinSigner] Private key decoded from WIF');

    // Parse transaction
    const tx = this.parseTransaction(unsignedTxHex);
    console.log('[BitcoinSigner] Transaction parsed:', tx.inputs.length, 'inputs');

    // Sign each input
    for (let i = 0; i < tx.inputs.length; i++) {
      await this.signInput(tx, i, privateKeyHex, privateKeyBytes);
    }

    // Serialize signed transaction
    const signedTxHex = this.serializeTransaction(tx);
    console.log('[BitcoinSigner] Transaction signed successfully');

    return signedTxHex;
  }

  /**
   * Parse raw transaction hex
   */
  static parseTransaction(txHex) {
    const bytes = this.hexToBytes(txHex);
    let offset = 0;

    // Version (4 bytes)
    const version = this.readUInt32LE(bytes, offset);
    offset += 4;

    // Input count (varint)
    const inputCount = bytes[offset];
    offset += 1;

    // Inputs
    const inputs = [];
    for (let i = 0; i < inputCount; i++) {
      const input = {};

      // Previous tx hash (32 bytes)
      input.hash = bytes.slice(offset, offset + 32);
      offset += 32;

      // Previous tx output index (4 bytes)
      input.index = this.readUInt32LE(bytes, offset);
      offset += 4;

      // Script length
      const scriptLen = bytes[offset];
      offset += 1;

      // Script (empty for unsigned)
      input.script = bytes.slice(offset, offset + scriptLen);
      offset += scriptLen;

      // Sequence (4 bytes)
      input.sequence = this.readUInt32LE(bytes, offset);
      offset += 4;

      inputs.push(input);
    }

    // Output count
    const outputCount = bytes[offset];
    offset += 1;

    // Outputs
    const outputs = [];
    for (let i = 0; i < outputCount; i++) {
      const output = {};

      // Value (8 bytes)
      output.value = bytes.slice(offset, offset + 8);
      offset += 8;

      // Script length
      const scriptLen = bytes[offset];
      offset += 1;

      // Script
      output.script = bytes.slice(offset, offset + scriptLen);
      offset += scriptLen;

      outputs.push(output);
    }

    // Locktime (4 bytes)
    const locktime = this.readUInt32LE(bytes, offset);
    offset += 4;

    return { version, inputs, outputs, locktime };
  }

  /**
   * Sign a single input
   */
  static async signInput(tx, inputIndex, privateKeyHex, privateKeyBytes) {
    // Get public key from private key
    const publicKey = await this.getPublicKey(privateKeyBytes);

    // Create P2PKH scriptPubKey
    const publicKeyHash = await this.hash160(publicKey);
    const scriptPubKey = this.createP2PKHScript(publicKeyHash);

    // Create signature hash
    const sigHash = this.createSignatureHash(tx, inputIndex, scriptPubKey);

    // Sign with ECDSA
    const signature = await this.signECDSA(privateKeyBytes, sigHash);

    // Add SIGHASH_ALL flag (0x01)
    const signatureWithHashType = new Uint8Array([...signature, 0x01]);

    // Create scriptSig: <signature> <pubkey>
    const scriptSig = this.createScriptSig(signatureWithHashType, publicKey);

    // Update input with scriptSig
    tx.inputs[inputIndex].script = scriptSig;
  }

  /**
   * Get public key from private key using secp256k1
   */
  static async getPublicKey(privateKeyBytes) {
    // Use noble-secp256k1 if available
    if (typeof nobleSecp256k1 !== 'undefined') {
      const pubKey = nobleSecp256k1.getPublicKey(privateKeyBytes, true); // compressed
      return new Uint8Array(pubKey);
    }

    // Fallback: Use Web Crypto API (note: may not support secp256k1 in all browsers)
    // For now, throw error - we'll need noble-secp256k1
    throw new Error('noble-secp256k1 library not loaded. Please reload extension.');
  }

  /**
   * Sign data with ECDSA using secp256k1
   */
  static async signECDSA(privateKeyBytes, messageHash) {
    if (typeof nobleSecp256k1 !== 'undefined') {
      const signature = await nobleSecp256k1.sign(messageHash, privateKeyBytes);
      return new Uint8Array(signature);
    }

    throw new Error('noble-secp256k1 library not loaded');
  }

  /**
   * Create signature hash for signing
   */
  static createSignatureHash(tx, inputIndex, scriptPubKey) {
    // Serialize transaction for signing
    let data = [];

    // Version
    data.push(...this.uint32ToBytes(tx.version));

    // Input count
    data.push(tx.inputs.length);

    // Inputs
    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i];

      // Previous tx hash
      data.push(...input.hash);

      // Previous tx index
      data.push(...this.uint32ToBytes(input.index));

      // Script (use scriptPubKey for current input, empty for others)
      if (i === inputIndex) {
        data.push(scriptPubKey.length);
        data.push(...scriptPubKey);
      } else {
        data.push(0); // Empty script
      }

      // Sequence
      data.push(...this.uint32ToBytes(input.sequence));
    }

    // Output count
    data.push(tx.outputs.length);

    // Outputs
    for (const output of tx.outputs) {
      data.push(...output.value);
      data.push(output.script.length);
      data.push(...output.script);
    }

    // Locktime
    data.push(...this.uint32ToBytes(tx.locktime));

    // Hash type (SIGHASH_ALL = 1)
    data.push(...this.uint32ToBytes(1));

    // Double SHA256
    const bytes = new Uint8Array(data);
    return this.doubleSha256(bytes);
  }

  /**
   * Create P2PKH scriptPubKey
   */
  static createP2PKHScript(publicKeyHash) {
    return new Uint8Array([
      0x76, // OP_DUP
      0xa9, // OP_HASH160
      0x14, // Push 20 bytes
      ...publicKeyHash,
      0x88, // OP_EQUALVERIFY
      0xac  // OP_CHECKSIG
    ]);
  }

  /**
   * Create scriptSig
   */
  static createScriptSig(signature, publicKey) {
    return new Uint8Array([
      signature.length,
      ...signature,
      publicKey.length,
      ...publicKey
    ]);
  }

  /**
   * Serialize signed transaction
   */
  static serializeTransaction(tx) {
    let data = [];

    // Version
    data.push(...this.uint32ToBytes(tx.version));

    // Input count
    data.push(tx.inputs.length);

    // Inputs
    for (const input of tx.inputs) {
      data.push(...input.hash);
      data.push(...this.uint32ToBytes(input.index));
      data.push(input.script.length);
      data.push(...input.script);
      data.push(...this.uint32ToBytes(input.sequence));
    }

    // Output count
    data.push(tx.outputs.length);

    // Outputs
    for (const output of tx.outputs) {
      data.push(...output.value);
      data.push(output.script.length);
      data.push(...output.script);
    }

    // Locktime
    data.push(...this.uint32ToBytes(tx.locktime));

    return this.bytesToHex(new Uint8Array(data));
  }

  /**
   * Hash160: SHA256 then RIPEMD160
   */
  static async hash160(data) {
    const sha256Hash = await crypto.subtle.digest('SHA-256', data);
    // RIPEMD160 not available in Web Crypto, we'll need noble-hashes
    if (typeof nobleHashes !== 'undefined' && nobleHashes.ripemd160) {
      return new Uint8Array(nobleHashes.ripemd160(new Uint8Array(sha256Hash)));
    }
    throw new Error('RIPEMD160 not available');
  }

  /**
   * Double SHA256
   */
  static doubleSha256(data) {
    // First SHA256
    const hash1 = this.sha256Sync(data);
    // Second SHA256
    return this.sha256Sync(hash1);
  }

  /**
   * Synchronous SHA256 (we'll use a sync library)
   */
  static sha256Sync(data) {
    if (typeof nobleHashes !== 'undefined' && nobleHashes.sha256) {
      return new Uint8Array(nobleHashes.sha256(data));
    }
    throw new Error('SHA256 library not available');
  }

  /**
   * Utility: Read UInt32 Little Endian
   */
  static readUInt32LE(bytes, offset) {
    return bytes[offset] |
           (bytes[offset + 1] << 8) |
           (bytes[offset + 2] << 16) |
           (bytes[offset + 3] << 24);
  }

  /**
   * Utility: Convert UInt32 to bytes (Little Endian)
   */
  static uint32ToBytes(num) {
    return [
      num & 0xff,
      (num >> 8) & 0xff,
      (num >> 16) & 0xff,
      (num >> 24) & 0xff
    ];
  }

  /**
   * Convert hex string to Uint8Array
   */
  static hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to hex string
   */
  static bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitcoinSigner;
}
