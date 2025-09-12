import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

const firebaseConfig = {
    apiKey: "AIzaSyA7CWUhLBKG_Oabxxw_7RfBpSANUoDh42s",
    authDomain: "moodmirror-login.firebaseapp.com",
    projectId: "moodmirror-login",
    storageBucket: "moodmirror-login.firebasestorage.app",
    messagingSenderId: "1091670187554",
    appId: "1:1091670187554:web:ce919c1fca5b660995b47b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendButton = messageForm.querySelector('button');
const deleteButton = document.getElementById('delete-chat-btn');

let currentUser = null;
let chatId = null;
let chatDocRef = null;
let unsubscribe = null;
let keyPair = null;
let sharedKey = null;

const init = () => {
    const params = new URLSearchParams(window.location.search);
    chatId = params.get('id');
    if (!chatId) {
        messagesDiv.innerHTML = "<p>エラー: チャットIDが見つかりません。</p>";
        return;
    }
    chatDocRef = doc(db, "temporary_chats", chatId);
    onAuthStateChanged(auth, user => {
        if (user) currentUser = user;
        else signInAnonymously(auth).catch(e => console.error("Anon sign-in failed:", e));

        if(currentUser) joinChat();
    });
};

const joinChat = async () => {
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
};

const listenForKeysAndMessages = () => {
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
            console.log("Shared key derived!");
            listenForMessages(); // Start listening for messages now that we have the key
        }
    });
};

const listenForMessages = () => {
    const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
    onSnapshot(query(messagesColRef, orderBy("timestamp")), async (snapshot) => {
        messagesDiv.innerHTML = '';
        if (snapshot.empty) {
            messagesDiv.innerHTML = '<p style="text-align: center; color: #888;">メッセージはまだありません。</p>';
        } else {
            for (const doc of snapshot.docs) {
                const msg = doc.data();
                const div = document.createElement('div');
                div.classList.add('message');
                // Decrypt message
                const decryptedText = await decryptMessage(msg.text, sharedKey);
                div.textContent = decryptedText;

                if (msg.sender === currentUser.uid) {
                    div.classList.add('sent');
                } else {
                    div.classList.add('received');
                }
                messagesDiv.appendChild(div);
            }
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
};

const sendMessage = async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text && currentUser && chatDocRef && sharedKey) {
        // Encrypt message
        const encryptedText = await encryptMessage(text, sharedKey);

        const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
        await addDoc(messagesColRef, {
            text: encryptedText,
            sender: currentUser.uid,
            timestamp: serverTimestamp()
        });
        messageInput.value = '';
    } else if (!sharedKey) {
        alert("相手の参加を待っています。まだメッセージを送信できません。");
    }
};

const deleteChat = async () => {
    if (confirm("本当にこのチャットを削除しますか？")) {
        disableChat();
        if (unsubscribe) unsubscribe();

        const messagesColRef = collection(db, "temporary_chats", chatId, "messages");
        const messagesSnapshot = await getDocs(messagesColRef);
        const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        await deleteDoc(chatDocRef);

        messagesDiv.innerHTML = "<p>チャットを削除しました。</p>";
    }
};

const enableChat = () => {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageForm.addEventListener('submit', sendMessage);
    deleteButton.addEventListener('click', deleteChat);
};

const disableChat = () => {
    messageInput.disabled = true;
    sendButton.disabled = true;
    deleteButton.disabled = true;
};

init();
