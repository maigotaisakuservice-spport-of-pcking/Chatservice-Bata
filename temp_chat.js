import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

let app, auth, db;
let messagesDiv, messageForm, messageInput, sendButton, deleteButton;
let currentUser, chatId, chatDocRef, unsubscribe, keyPair, sharedKey;

function setupDOM() {
    messagesDiv = document.getElementById('messages');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    sendButton = messageForm.querySelector('button');
    deleteButton = document.getElementById('delete-chat-btn');
}

function initFirebase() {
    const firebaseConfig = {
        apiKey: "AIzaSyA7CWUhLBKG_Oabxxw_7RfBpSANUoDh42s",
        authDomain: "moodmirror-login.firebaseapp.com",
        projectId: "moodmirror-login",
        storageBucket: "moodmirror-login.firebasestorage.app",
        messagingSenderId: "1091670187554",
        appId: "1:1091670187554:web:ce919c1fca5b660995b47b",
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

export function init() {
    setupDOM();
    initFirebase();

    const params = new URLSearchParams(window.location.search);
    chatId = params.get('id');
    if (!chatId) {
        messagesDiv.innerHTML = "<p>エラー: チャットIDが見つかりません。</p>";
        return;
    }
    chatDocRef = doc(db, "temporary_chats", chatId);
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
        } else {
            signInAnonymously(auth).catch(e => console.error("Anon sign-in failed:", e));
        }
        if(currentUser) joinChat();
    });
}

async function joinChat() {
    const chatDoc = await getDoc(chatDocRef);
    if (!chatDoc.exists()) {
        messagesDiv.innerHTML = "<p>エラー: チャットは存在しないか削除されました。</p>";
        disableChat();
        return;
    }

    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);

    const participants = chatDoc.data().participants || [];
    const publicKeys = chatDoc.data().publicKeys || {};

    if (participants.length >= 2 && !participants.includes(currentUser.uid)) {
        messagesDiv.innerHTML = "<p>エラー: このチャットは満員です。</p>";
        disableChat();
        return;
    }

    const updates = {};
    if (!participants.includes(currentUser.uid)) {
        updates.participants = [...participants, currentUser.uid];
    }
    if (!publicKeys[currentUser.uid]) {
        publicKeys[currentUser.uid] = publicKey;
        updates.publicKeys = publicKeys;
    }

    if (Object.keys(updates).length > 0) {
        await updateDoc(chatDocRef, updates);
    }

    enableChat();
    listenForKeysAndMessages();
}

function listenForKeysAndMessages() {
    unsubscribe = onSnapshot(chatDocRef, async (doc) => {
        if (!doc.exists()) {
            messagesDiv.innerHTML = "<p>チャットが削除されました。</p>";
            disableChat();
            if (unsubscribe) unsubscribe();
            return;
        }

        const data = doc.data();
        const keys = data.publicKeys || {};
        const otherUserId = Object.keys(keys).find(uid => uid !== currentUser.uid);

        if (keys[currentUser.uid] && otherUserId && keys[otherUserId] && !sharedKey) {
            const theirPublicKey = await importPublicKey(keys[otherUserId]);
            sharedKey = await deriveSharedSecret(keyPair.privateKey, theirPublicKey);
            listenForMessages();
        }
    });
}

function listenForMessages() {
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const q = query(messagesColRef, orderBy("timestamp"));
    onSnapshot(q, async (snapshot) => {
        messagesDiv.innerHTML = '';
        for (const doc of snapshot.docs) {
            const msg = doc.data();
            const div = document.createElement('div');
            div.classList.add('message');
            const decryptedText = await decryptMessage(msg.text, sharedKey);
            div.textContent = decryptedText;
            div.classList.add(msg.sender === currentUser.uid ? 'sent' : 'received');
            messagesDiv.appendChild(div);
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

async function sendMessage(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !sharedKey) return;
    const encryptedText = await encryptMessage(text, sharedKey);
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
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
    if (unsubscribe) unsubscribe();
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesColRef);
    const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    await deleteDoc(chatDocRef);
    messagesDiv.innerHTML = "<p>チャットを削除しました。</p>";
}

function enableChat() {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageForm.addEventListener('submit', sendMessage);
    deleteButton.addEventListener('click', deleteChat);
}

function disableChat() {
    messageInput.disabled = true;
    sendButton.disabled = true;
    deleteButton.removeEventListener('click', deleteChat);
}
