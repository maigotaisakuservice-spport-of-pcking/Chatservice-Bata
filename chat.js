// chat.js
import { app, auth, db, rtdb } from "./app.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { doc, setDoc, addDoc, collection, onSnapshot, query, where, getDocs, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

let currentUser = null;
let currentChatId = null;
let currentFriendUid = null;
let keyPair = null;
const sharedKeyCache = {};
let messagesUnsubscribe = null;

// DOM Elements
const menuButton = document.getElementById('menu-button');
const menu = document.getElementById('menu');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const friendListDiv = document.getElementById('friend-list');
const messagesDiv = document.getElementById("messages");

// --- Initialization on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            initializeCrypto();
            loadFriendList();
            setupEventListeners();
        } else {
            window.location.href = "index.html";
        }
    });
});

function setupEventListeners() {
    menuButton.addEventListener('click', () => menu.classList.toggle('active'));
    messageForm.addEventListener('submit', sendMessage);
    // Add other listeners like image/video forms if they exist
}

// --- Crypto ---
async function initializeCrypto() {
    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    await set(ref(rtdb, `users/${currentUser.uid}/publicKey`), publicKey);
}

async function getSharedKey(friendUid) {
    if (sharedKeyCache[friendUid]) return sharedKeyCache[friendUid];
    const friendKeySnapshot = await get(ref(rtdb, `users/${friendUid}/publicKey`));
    if (!friendKeySnapshot.exists()) throw new Error("Friend's public key not found.");
    const friendPublicKey = await importPublicKey(friendKeySnapshot.val());
    const sharedKey = await deriveSharedSecret(keyPair.privateKey, friendPublicKey);
    sharedKeyCache[friendUid] = sharedKey;
    return sharedKey;
}

// --- Chat Logic ---
async function loadFriendList() {
    onSnapshot(query(collection(db, 'users')), (snapshot) => {
        friendListDiv.innerHTML = '';
        snapshot.forEach((doc) => {
            if (doc.id === currentUser.uid) return;
            const user = doc.data();
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item'; // Add a class for styling
            friendItem.textContent = user.displayName || user.email;
            friendItem.onclick = () => startChatWith(doc.id);
            friendListDiv.appendChild(friendItem);
        });
    });
}

function startChatWith(friendUid) {
    const uids = [currentUser.uid, friendUid].sort();
    currentChatId = uids.join('_');
    currentFriendUid = friendUid;
    messagesDiv.innerHTML = '';
    loadMessages();
}

function loadMessages() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    const messagesRef = collection(db, "chats", currentChatId, "messages");
    const q = query(messagesRef, orderBy("timestamp"));
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const message = change.doc.data();
                displayMessage(message);
            }
        });
    });
}

async function displayMessage(message) {
    const div = document.createElement("div");
    const sentTime = message.timestamp ? message.timestamp.toDate().toLocaleString() : new Date().toLocaleString();

    let content = message.text;
    if (content) {
        try {
            const sharedKey = await getSharedKey(message.sender === currentUser.uid ? currentFriendUid : message.sender);
            content = await decryptMessage(content, sharedKey);
        } catch (error) {
            content = "メッセージを復号できませんでした。";
        }
    }

    div.innerHTML = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${content} <span>${sentTime}</span>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage(event) {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !currentChatId || !currentFriendUid) return;

    const sharedKey = await getSharedKey(currentFriendUid);
    const encryptedText = await encryptMessage(text, sharedKey);

    await addDoc(collection(db, "chats", currentChatId, "messages"), {
        sender: currentUser.uid,
        text: encryptedText,
        timestamp: serverTimestamp(),
        isRead: false
    });
    messageInput.value = "";
}
