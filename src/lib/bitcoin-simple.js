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
    console.log('[signInput] Public key:', this.bytesToHex(publicKey));

    // Create P2PKH scriptPubKey
    const publicKeyHash = await this.hash160(publicKey);
    console.log('[signInput] Public key hash:', this.bytesToHex(publicKeyHash));

    const scriptPubKey = this.createP2PKHScript(publicKeyHash);
    console.log('[signInput] scriptPubKey:', this.bytesToHex(scriptPubKey));

    // Create signature hash
    const sigHash = await this.createSignatureHash(tx, inputIndex, scriptPubKey);
    console.log('[signInput] Signature hash (sighash):', this.bytesToHex(sigHash));

    // Sign with ECDSA
    const signature = await this.signECDSA(privateKeyBytes, sigHash);
    console.log('[signInput] DER signature:', this.bytesToHex(signature));

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
   * Returns DER-encoded signature
   */
  static async signECDSA(privateKeyBytes, messageHash) {
    if (typeof nobleSecp256k1 === 'undefined') {
      throw new Error('noble-secp256k1 library not loaded');
    }

    // Sign and get signature (returns {r, s} or compact format depending on version)
    const sig = await nobleSecp256k1.sign(messageHash, privateKeyBytes, {
      canonical: true,  // Ensure low-S value
      der: false  // We'll do DER encoding ourselves
    });

    // Extract r and s values
    let r, s;
    if (sig.r !== undefined && sig.s !== undefined) {
      // Object format
      r = sig.r;
      s = sig.s;
    } else {
      // Compact format (64 bytes: r||s)
      const sigBytes = new Uint8Array(sig);
      r = BigInt('0x' + this.bytesToHex(sigBytes.slice(0, 32)));
      s = BigInt('0x' + this.bytesToHex(sigBytes.slice(32, 64)));
    }

    // Encode as DER
    return this.encodeDER(r, s);
  }

  /**
   * Encode ECDSA signature in DER format
   */
  static encodeDER(r, s) {
    const encodeInteger = (value) => {
      let hex = value.toString(16);
      if (hex.length % 2) hex = '0' + hex;

      const bytes = this.hexToBytes(hex);

      // Add 0x00 prefix if high bit is set (to indicate positive number)
      const needsPadding = bytes[0] & 0x80;
      const intBytes = needsPadding ? new Uint8Array([0x00, ...bytes]) : bytes;

      return new Uint8Array([0x02, intBytes.length, ...intBytes]);
    };

    const rEncoded = encodeInteger(r);
    const sEncoded = encodeInteger(s);
    const totalLength = rEncoded.length + sEncoded.length;

    return new Uint8Array([0x30, totalLength, ...rEncoded, ...sEncoded]);
  }

  /**
   * Create signature hash for signing
   */
  static async createSignatureHash(tx, inputIndex, scriptPubKey) {
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
    return await this.doubleSha256(bytes);
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
    const ripemd160Hash = this.ripemd160(new Uint8Array(sha256Hash));
    return ripemd160Hash;
  }

  /**
   * Double SHA256
   */
  static async doubleSha256(data) {
    // First SHA256
    const hash1 = await crypto.subtle.digest('SHA-256', data);
    // Second SHA256
    const hash2 = await crypto.subtle.digest('SHA-256', hash1);
    return new Uint8Array(hash2);
  }

  /**
   * RIPEMD160 implementation (pure JS)
   */
  static ripemd160(data) {
    // RIPEMD160 constants
    const zl = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
                3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
                1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
                4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
    const zr = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
                6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
                15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
                8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
                12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];
    const sl = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
                7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
                11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
                11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
                9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6];
    const sr = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
                9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
                9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
                15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
                8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11];

    const f = (x, y, z, s) => {
      let result;
      if (s === 0) result = x ^ y ^ z;
      else if (s === 1) result = (x & y) | (~x & z);
      else if (s === 2) result = (x | ~y) ^ z;
      else if (s === 3) result = (x & z) | (y & ~z);
      else result = x ^ (y | ~z);
      return result >>> 0;
    };

    const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

    // Initialize
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;

    // Pad message
    const msgLen = data.length;
    const bitLen = msgLen * 8;
    const padded = new Uint8Array(((msgLen + 8) >> 6) + 1 << 6);
    padded.set(data);
    padded[msgLen] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, bitLen, true);

    // Process blocks
    for (let i = 0; i < padded.length; i += 64) {
      const w = new Uint32Array(16);
      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(i + j * 4, true);
      }

      let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
      let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

      for (let j = 0; j < 80; j++) {
        let tl = (al + f(bl, cl, dl, j >> 4) + w[zl[j]] + [0, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E][j >> 4]) >>> 0;
        tl = (rotl(tl, sl[j]) + el) >>> 0;
        al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = tl;

        let tr = (ar + f(br, cr, dr, (15 - (j >> 4)) % 5 + (j >= 64 ? 1 : 0)) + w[zr[j]] + [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0][j >> 4]) >>> 0;
        tr = (rotl(tr, sr[j]) + er) >>> 0;
        ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = tr;
      }

      const t = (h1 + cl + dr) >>> 0;
      h1 = (h2 + dl + er) >>> 0;
      h2 = (h3 + el + ar) >>> 0;
      h3 = (h4 + al + br) >>> 0;
      h4 = (h0 + bl + cr) >>> 0;
      h0 = t;
    }

    // Output
    const result = new Uint8Array(20);
    const resultView = new DataView(result.buffer);
    resultView.setUint32(0, h0, true);
    resultView.setUint32(4, h1, true);
    resultView.setUint32(8, h2, true);
    resultView.setUint32(12, h3, true);
    resultView.setUint32(16, h4, true);
    return result;
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
