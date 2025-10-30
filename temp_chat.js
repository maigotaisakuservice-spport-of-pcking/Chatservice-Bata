// temp_chat.js
import {
    app, auth, db_firestore,
    doc, getDoc, setDoc, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, updateDoc, deleteDoc, getDocs
} from './app.js';
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";


let currentUser, chatId, chatDocRef, keyPair, sharedKey;
let messagesUnsubscribe;
let otherUserId = null;

function setupDOM() {
    // DOM elements are assumed to exist as per the HTML
    document.getElementById('message-form').addEventListener('submit', sendMessage);
    document.getElementById('delete-chat-btn').addEventListener('click', deleteChat);
    window.addEventListener('beforeunload', handlePageClose);
}

export function init() {
    const params = new URLSearchParams(window.location.search);
    chatId = params.get('id');
    if (!chatId) {
        document.getElementById('messages').innerHTML = "<p>エラー: チャットIDが見つかりません。</p>";
        return;
    }
    chatDocRef = doc(db_firestore, "temporary_chats", chatId);

    onAuthStateChanged(auth, user => {
        currentUser = user ? user : signInAnonymously(auth);
        joinChat();
    });

    setupDOM();
}

async function joinChat() {
    const chatDoc = await getDoc(chatDocRef);
    if (!chatDoc.exists()) {
        document.getElementById('messages').innerHTML = "<p>エラー: チャットは存在しないか削除されました。</p>";
        disableChat();
        return;
    }

    // Generate and store our public key in the user's main profile
    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    await setDoc(doc(db_firestore, `users/${currentUser.uid}`), { publicKey }, { merge: true });

    // Update participants in the temporary chat document
    await setDoc(chatDocRef, { participants: { [currentUser.uid]: true } }, { merge: true });

    enableChat();
    listenForData();
}

function listenForData() {
    messagesUnsubscribe = onSnapshot(chatDocRef, async (doc) => {
        if (!doc.exists()) {
            document.getElementById('messages').innerHTML = "<p>チャットが削除されました。</p>";
            disableChat();
            return;
        }

        const data = doc.data();
        const participants = data.participants || {};
        otherUserId = Object.keys(participants).find(uid => uid !== currentUser.uid);

        if (otherUserId && !sharedKey) {
            const friendRef = doc(db_firestore, `users/${otherUserId}`);
            const friendSnap = await getDoc(friendRef);
            if (friendSnap.exists() && friendSnap.data().publicKey) {
                const theirPublicKey = await importPublicKey(friendSnap.data().publicKey);
                sharedKey = await deriveSharedSecret(keyPair.privateKey, theirPublicKey);
                listenForMessages(); // Start listening for messages only after key is derived
            }
        }
    });
}

function listenForMessages() {
    const messagesRef = collection(db_firestore, `temporary_chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy("timestamp"));
    onSnapshot(q, async (snapshot) => {
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = ''; // Clear messages on each update
        for (const doc of snapshot.docs) {
            const msg = doc.data();
            if (sharedKey) {
                try {
                    const div = document.createElement('div');
                    const decryptedText = await decryptMessage(msg.text, sharedKey);
                    div.textContent = decryptedText;
                    div.className = msg.sender === currentUser.uid ? 'sent' : 'received';
                    messagesDiv.appendChild(div);
                } catch (e) {
                    console.error("Could not decrypt message:", e);
                }
            }
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}


async function sendMessage(e) {
    e.preventDefault();
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    if (!text || !sharedKey) return;
    const encryptedText = await encryptMessage(text, sharedKey);
    const messagesColRef = collection(db_firestore, `temporary_chats/${chatId}/messages`);
    await addDoc(messagesColRef, {
        text: encryptedText,
        sender: currentUser.uid,
        timestamp: serverTimestamp()
    });
    messageInput.value = '';
}

async function deleteChat() {
    if (!confirm("本当にこのチャットを削除しますか？")) return;
    disableChat();

    // Delete all messages in the subcollection
    const messagesRef = collection(db_firestore, `temporary_chats/${chatId}/messages`);
    const messagesSnapshot = await getDocs(messagesRef);
    const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the main chat document
    await deleteDoc(chatDocRef);

    document.getElementById('messages').innerHTML = "<p>チャットを削除しました。</p>";
}

function handlePageClose() {
    // This is a best-effort attempt. Most modern browsers restrict this.
    // The primary deletion mechanism should be the manual "delete" button.
    deleteChat();
}

function enableChat() {
    document.getElementById('message-input').disabled = false;
    document.getElementById('message-form').querySelector('button').disabled = false;
}

function disableChat() {
    document.getElementById('message-input').disabled = true;
    const sendButton = document.getElementById('message-form').querySelector('button');
    if (sendButton) sendButton.disabled = true;

    if (messagesUnsubscribe) messagesUnsubscribe();

    // Remove listeners to prevent memory leaks
    document.getElementById('message-form').removeEventListener('submit', sendMessage);
    document.getElementById('delete-chat-btn').removeEventListener('click', deleteChat);
    window.removeEventListener('beforeunload', handlePageClose);
}

// Initialize the module
init();
