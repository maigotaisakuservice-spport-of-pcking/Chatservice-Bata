// crypto.js - Web Crypto API Utilities

// Generate an ECDH key pair for key agreement
async function generateKeyPair() {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true, // exportable
        ["deriveKey"]
    );
}

// Export a public key in a raw format to be shared
async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    // Convert ArrayBuffer to a Base64 string for easy storage in Firestore
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import a peer's public key from a Base64 string
async function importPublicKey(base64PublicKey) {
    // Convert Base64 string back to ArrayBuffer
    const binaryString = atob(base64PublicKey);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
        "raw",
        bytes.buffer,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );
}

// Derive a shared secret from our private key and their public key
async function deriveSharedSecret(privateKey, publicKey) {
    return await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// Encrypt a message using the shared AES-GCM key
async function encryptMessage(text, key) {
    const encodedText = new TextEncoder().encode(text);
    // The IV must be unique for every encryption with the same key
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedText
    );

    // Combine IV and ciphertext for storage/transmission
    const ivString = btoa(String.fromCharCode(...iv));
    const cipherString = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

    return `${ivString}:${cipherString}`;
}

// Decrypt a message using the shared AES-GCM key
async function decryptMessage(encryptedString, key) {
    try {
        const [ivString, cipherString] = encryptedString.split(':');

        const ivBinaryString = atob(ivString);
        const iv = new Uint8Array(ivBinaryString.length);
        for (let i = 0; i < ivBinaryString.length; i++) {
            iv[i] = ivBinaryString.charCodeAt(i);
        }

        const cipherBinaryString = atob(cipherString);
        const ciphertext = new Uint8Array(cipherBinaryString.length);
        for (let i = 0; i < cipherBinaryString.length; i++) {
            ciphertext[i] = cipherBinaryString.charCodeAt(i);
        }

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error("Decryption failed:", e);
        return "デコードできませんでした。";
    }
}

export {
    generateKeyPair,
    exportPublicKey,
    importPublicKey,
    deriveSharedSecret,
    encryptMessage,
    decryptMessage
};
