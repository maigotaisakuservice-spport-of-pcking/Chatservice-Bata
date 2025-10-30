// temp_chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

// --- Firebase Config & Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyDKKV9dakvsP8BCjjYvsFO_haJ5D98-Mu4",
    authDomain: "chat-go-enterprise.firebaseapp.com",
    databaseURL: "https://chat-go-enterprise-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chat-go-enterprise",
    storageBucket: "chat-go-enterprise.firebasestorage.app",
    messagingSenderId: "947179164013",
    appId: "1:947179164013:web:aa0f1c45cfdbfe1eac4a64",
    measurementId: "G-47P31E2TDN"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

let currentUser, chatId, chatDocRef, keyPair, sharedKey;
let messagesUnsubscribe, chatUnsubscribe;
let otherUserId = null;
let messagesDiv, messageForm, messageInput, sendButton, deleteButton;

// --- Main Initialization ---
export function init() {
    setupDOM();
    const params = new URLSearchParams(window.location.search);
    chatId = params.get('id');
    if (!chatId) {
        messagesDiv.innerHTML = "<p>エラー: チャットIDが見つかりません。</p>";
        return;
    }

    chatDocRef = doc(db, "temporary_chats", chatId);

    onAuthStateChanged(auth, user => {
        currentUser = user;
        if (!currentUser) {
            signInAnonymously(auth).then(cred => {
                currentUser = cred.user;
                joinChat();
            });
        } else {
            joinChat();
        }
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
    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    await set(ref(rtdb, `users/${currentUser.uid}/publicKey`), publicKey);

    const chatDoc = await getDoc(chatDocRef);
    const updates = { [`participants.${currentUser.uid}`]: true };
    if (!chatDoc.exists()) {
        await setDoc(chatDocRef, { participants: { [currentUser.uid]: true } });
    } else {
        await updateDoc(chatDocRef, updates);
    }

    enableChat();
    listenForData();
}

function listenForData() {
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

    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    messagesUnsubscribe = onSnapshot(query(messagesColRef, orderBy("timestamp")), (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(async (doc) => {
            const msg = doc.data();
            if (sharedKey) {
                const div = document.createElement('div');
                div.textContent = await decryptMessage(msg.text, sharedKey);
                messagesDiv.appendChild(div);
            }
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

async function sendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !sharedKey) return;

    const encryptedText = await encryptMessage(text, sharedKey);
    await addDoc(collection(db, "temporary_chats", chatId, "messages"), {
        text: encryptedText,
        sender: currentUser.uid,
        timestamp: new Date()
    });
    messageInput.value = '';
}

async function deleteChat() {
    disableChat();
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesColRef);
    await Promise.all(messagesSnapshot.docs.map(d => deleteDoc(d.ref)));
    if (chatDocRef) {
      await deleteDoc(chatDocRef);
    }
}

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
