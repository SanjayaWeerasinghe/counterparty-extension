/**
 * RIPEMD160 wrapper for service worker (importScripts compatibility)
 * Wraps @noble/hashes/ripemd160 for use in Chrome extension background scripts
 */

// Inline minimal RIPEMD160 implementation
// Based on noble-hashes but modified to work without ES6 modules
const nobleRipemd160 = (() => {
  'use strict';

  // Rotate left
  const rotl = (word, shift) => (word << shift) | (word >>> (32 - shift));

  // RIPEMD160 constants
  const Kl = new Uint32Array([0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e]);
  const Kr = new Uint32Array([0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000]);

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

  function f(s, x, y, z) {
    if (s === 0) return x ^ y ^ z;
    if (s === 1) return (x & y) | (~x & z);
    if (s === 2) return (x | ~y) ^ z;
    if (s === 3) return (x & z) | (y & ~z);
    return x ^ (y | ~z);
  }

  /**
   * RIPEMD160 hash function
   * @param {Uint8Array} data - Input data to hash
   * @returns {Uint8Array} - 20-byte hash
   */
  function ripemd160(data) {
    // Initialize hash values
    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    // Pad message
    const msgLen = data.length;
    const bitLen = msgLen * 8;
    const padLen = ((msgLen + 8) >> 6) + 1 << 6;
    const padded = new Uint8Array(padLen);
    padded.set(data);
    padded[msgLen] = 0x80;

    // Append length
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, bitLen, true);

    // Process 512-bit blocks
    for (let i = 0; i < padded.length; i += 64) {
      const w = new Uint32Array(16);
      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(i + j * 4, true);
      }

      let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
      let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

      // 80 rounds
      for (let j = 0; j < 80; j++) {
        const group = (j / 16) | 0;

        let tl = (al + f(group, bl, cl, dl) + w[zl[j]] + Kl[group]) | 0;
        tl = (rotl(tl, sl[j]) + el) | 0;
        al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = tl;

        let tr = (ar + f(4 - group, br, cr, dr) + w[zr[j]] + Kr[group]) | 0;
        tr = (rotl(tr, sr[j]) + er) | 0;
        ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = tr;
      }

      const t = (h1 + cl + dr) | 0;
      h1 = (h2 + dl + er) | 0;
      h2 = (h3 + el + ar) | 0;
      h3 = (h4 + al + br) | 0;
      h4 = (h0 + bl + cr) | 0;
      h0 = t;
    }

    // Output hash
    const result = new Uint8Array(20);
    const resultView = new DataView(result.buffer);
    resultView.setUint32(0, h0, true);
    resultView.setUint32(4, h1, true);
    resultView.setUint32(8, h2, true);
    resultView.setUint32(12, h3, true);
    resultView.setUint32(16, h4, true);

    return result;
  }

  return { ripemd160 };
})();

console.log('[noble-ripemd160-wrapper] Library loaded and exposed as global nobleRipemd160');
