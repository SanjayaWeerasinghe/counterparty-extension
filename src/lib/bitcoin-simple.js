/**
 * Simple Bitcoin crypto library (no external dependencies)
 * Uses Web Crypto API for signing
 */

// Minimal Bitcoin implementation for signing
class BitcoinSigner {
  /**
   * Generate a random private key
   */
  static generatePrivateKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.bytesToHex(array);
  }

  /**
   * Derive address from private key (simplified)
   * In production, use bitcoinjs-lib
   */
  static async deriveAddress(privateKeyHex) {
    // For MVP, we'll use a mock address
    // In production, properly derive P2PKH or P2WPKH address
    const hash = await crypto.subtle.digest(
      'SHA-256',
      this.hexToBytes(privateKeyHex)
    );
    const hashHex = this.bytesToHex(new Uint8Array(hash));

    // Mock address format (for testing)
    return 'bc1q' + hashHex.substring(0, 39);
  }

  /**
   * Sign transaction using btcnu-cli (via backend for MVP)
   * In production extension, this would use bitcoinjs-lib locally
   */
  static async signTransaction(privateKeyWIF, unsignedTx) {
    // For MVP, we return the unsigned TX and let backend sign
    // Real implementation would use bitcoinjs-lib here
    return {
      needsBackendSigning: true,
      unsignedTx: unsignedTx
    };
  }

  /**
   * Convert hex string to Uint8Array
   */
  static hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
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

  /**
   * Generate WIF private key (mock for MVP)
   */
  static toWIF(privateKeyHex) {
    // Simplified WIF generation
    // Real implementation would follow Bitcoin WIF spec
    return 'K' + privateKeyHex.substring(0, 51);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitcoinSigner;
}
