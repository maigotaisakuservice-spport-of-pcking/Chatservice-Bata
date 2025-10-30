// temp_chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js"; // For public key
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

// --- Firebase Config & Initialization ---
const firebaseConfig = { /* ... same as chat.js ... */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

let currentUser, chatId, chatDocRef, keyPair, sharedKey;
let messagesUnsubscribe, chatUnsubscribe;
let otherUserId = null;
// DOM Elements
let messagesDiv, messageForm, messageInput, sendButton, deleteButton;

// --- Main Initialization ---
export function init() {
    setupDOM();
    const params = new URLSearchParams(window.location.search);
    chatId = params.get('id');
    if (!chatId) return messagesDiv.innerHTML = "<p>エラー: チャットIDが見つかりません。</p>";

    chatDocRef = doc(db, "temporary_chats", chatId);

    onAuthStateChanged(auth, user => {
        currentUser = user || (signInAnonymously(auth), auth.currentUser);
        if (currentUser) joinChat();
    });

    window.addEventListener('beforeunload', deleteChat);
    deleteButton.addEventListener('click', deleteChat);
}

function setupDOM() {
    messagesDiv = document.getElementById('messages');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    sendButton = messageForm.querySelector('button');
    deleteButton = document.getElementById('delete-chat-btn');
}

async function joinChat() {
    // Generate and store public key in RTDB
    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    await set(ref(rtdb, `users/${currentUser.uid}/publicKey`), publicKey);

    // Set presence in the temporary chat document (Firestore)
    const chatDoc = await getDoc(chatDocRef);
    if (!chatDoc.exists()) {
        await setDoc(chatDocRef, { participants: { [currentUser.uid]: true } });
    } else {
        await updateDoc(chatDocRef, { [`participants.${currentUser.uid}`]: true });
    }

    enableChat();
    listenForData();
}

// --- Real-time Data Handling ---
function listenForData() {
    // Listen for participants changes to derive key
    chatUnsubscribe = onSnapshot(chatDocRef, async (doc) => {
        if (!doc.exists()) {
            disableChat();
            messagesDiv.innerHTML = "<p>チャットは削除されました。</p>";
            return;
        }
        const participants = doc.data().participants || {};
        otherUserId = Object.keys(participants).find(uid => uid !== currentUser.uid);

        if (otherUserId && !sharedKey) {
            const friendKeySnapshot = await get(ref(rtdb, `users/${otherUserId}/publicKey`));
            if (friendKeySnapshot.exists()) {
                const theirPublicKey = await importPublicKey(friendKeySnapshot.val());
                sharedKey = await deriveSharedSecret(keyPair.privateKey, theirPublicKey);
            }
        }
    });

    // Listen for new messages
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const q = query(messagesColRef, orderBy("timestamp"));
    messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
        messagesDiv.innerHTML = '';
        for (const doc of snapshot.docs) {
            const msg = doc.data();
            if (sharedKey) {
                const div = document.createElement('div');
                div.textContent = await decryptMessage(msg.text, sharedKey);
                messagesDiv.appendChild(div);
            }
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// --- Actions ---
async function sendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !sharedKey) return;

    const encryptedText = await encryptMessage(text, sharedKey);
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    await addDoc(messagesColRef, {
        text: encryptedText,
        sender: currentUser.uid,
        timestamp: new Date()
    });
    messageInput.value = '';
}

async function deleteChat() {
    // 1. Unsubscribe from listeners
    disableChat();

    // 2. Delete all messages in the subcollection
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesColRef);
    const deletePromises = messagesSnapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // 3. Delete the main chat document
    if (chatDocRef) await deleteDoc(chatDocRef);
}

// --- UI Control ---
function enableChat() {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageForm.addEventListener('submit', sendMessage);
}

function disableChat() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (chatUnsubscribe) chatUnsubscribe();
    window.removeEventListener('beforeunload', deleteChat);
    messageForm.removeEventListener('submit', sendMessage);
    messageInput.disabled = true;
    sendButton.disabled = true;
}
