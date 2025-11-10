/**
 * Encryption utilities for storing private keys
 * Uses Web Crypto API (AES-GCM)
 */

class Encryption {
  /**
   * Encrypt data with password
   */
  static async encrypt(data, password) {
    // Convert password to key
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const dataBuffer = encoder.encode(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );

    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Return as base64
    return this.arrayBufferToBase64(result);
  }

  /**
   * Decrypt data with password
   */
  static async decrypt(encryptedBase64, password) {
    // Decode base64
    const encrypted = this.base64ToArrayBuffer(encryptedBase64);

    // Extract salt, iv, and data
    const salt = encrypted.slice(0, 16);
    const iv = encrypted.slice(16, 28);
    const data = encrypted.slice(28);

    // Derive key from password
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Incorrect password or corrupted data');
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  static arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to Uint8Array
   */
  static base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Encryption;
}
