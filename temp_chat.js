import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, query, orderBy, getDocs, limit, Timestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
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
            joinChat();
        } else {
            // Enforce login - no anonymous users
            alert("この機能を利用するにはログインが必要です。");
            window.location.href = "index.html";
        }
    });
}

async function joinChat() {
    const chatDoc = await getDoc(chatDocRef);
    if (!chatDoc.exists()) {
        messagesDiv.innerHTML = "<p>エラー: チャットは存在しないか、有効期限が切れて削除されました。</p>";
        disableChat();
        return;
    }

    // --- Automatic Deletion Logic ---
    // NOTE: This check is client-side and only runs when a user loads this page.
    // A robust, server-side implementation (e.g., using Cloud Functions) would be
    // required to reliably delete chats that have been abandoned for over an hour.
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const lastMessageQuery = query(messagesColRef, orderBy("timestamp", "desc"), limit(1));
    const lastMessageSnapshot = await getDocs(lastMessageQuery);

    let lastActivityTime;
    if (!lastMessageSnapshot.empty) {
        // Use the timestamp of the last message
        lastActivityTime = lastMessageSnapshot.docs[0].data().timestamp;
    } else {
        // If no messages, use the chat creation time
        lastActivityTime = chatDoc.data().createdAt;
    }

    if (lastActivityTime && lastActivityTime.toDate) {
        const oneHourAgo = Timestamp.now().toMillis() - (60 * 60 * 1000);
        if (lastActivityTime.toMillis() < oneHourAgo) {
            messagesDiv.innerHTML = "<p>最後の活動から1時間以上経過したため、このチャットは自動的に削除されました。</p>";
            await deleteChat(false); // Delete without confirmation
            return;
        }
    }
    // --- End of Automatic Deletion Logic ---

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
            if (!sharedKey) continue; // Don't try to decrypt if key is not ready
            const div = document.createElement('div');
            div.classList.add('message');
            try {
                const decryptedText = await decryptMessage(msg.text, sharedKey);
                div.textContent = decryptedText;
            } catch (e) {
                div.textContent = "[復号化エラー]";
                console.error("Decryption failed:", e);
            }
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

async function deleteChat(confirmFirst = true) {
    if (confirmFirst && !confirm("本当にこのチャットを削除して退出しますか？全てのメッセージが完全に消去されます。")) return;

    disableChat();
    if (unsubscribe) unsubscribe();

    // Delete all messages in the subcollection
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesColRef);
    const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the main chat document
    await deleteDoc(chatDocRef);

    if (confirmFirst) {
        messagesDiv.innerHTML = "<p>チャットを削除しました。</p>";
    }
}

function enableChat() {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageForm.addEventListener('submit', sendMessage);
    deleteButton.addEventListener('click', () => deleteChat(true));
}

function disableChat() {
    messageInput.disabled = true;
    sendButton.disabled = true;
    deleteButton.removeEventListener('click', () => deleteChat(true));
    if (messageForm) messageForm.removeEventListener('submit', sendMessage);
}