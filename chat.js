// chat.js
import {
    app, auth, db_firestore,
    doc, getDoc, setDoc, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, updateDoc
} from './app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

let currentUser = null;
let currentChatId = null;
let currentFriendUid = null;
let keyPair = null;
const sharedKeyCache = {};
let messagesUnsubscribe = null;

// --- Auth State ---
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    initializeCrypto();
    loadFriendList();
    Notification.requestPermission();
  } else {
    window.location.href = "index.html";
  }
});

// --- Crypto Initialization ---
async function initializeCrypto() {
    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    const userRef = doc(db_firestore, `users/${currentUser.uid}`);
    await setDoc(userRef, { publicKey: publicKey }, { merge: true });
}

async function getSharedKey(friendUid) {
    if (sharedKeyCache[friendUid]) {
        return sharedKeyCache[friendUid];
    }
    const friendRef = doc(db_firestore, `users/${friendUid}`);
    const docSnap = await getDoc(friendRef);
    if (!docSnap.exists() || !docSnap.data().publicKey) {
        throw new Error("Friend's public key not found.");
    }
    const friendPublicKey = await importPublicKey(docSnap.data().publicKey);
    const sharedKey = await deriveSharedSecret(keyPair.privateKey, friendPublicKey);
    sharedKeyCache[friendUid] = sharedKey;
    return sharedKey;
}

// --- Core Message Functions ---
function loadMessages() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    const messagesRef = collection(db_firestore, `chats/${currentChatId}/messages`);
    const q = query(messagesRef, orderBy("timestamp"));

    messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const message = change.doc.data();
                const messageId = change.doc.id;

                // Update read status
                if (message.sender !== currentUser.uid && !message.isRead) {
                    await updateDoc(doc(db_firestore, `chats/${currentChatId}/messages/${messageId}`), { isRead: true });
                }

                displayMessage(message);
            }
        });
    });
}

async function displayMessage(message) {
    const messagesDiv = document.getElementById("messages");
    const div = document.createElement("div");
    const sentTime = message.timestamp ? message.timestamp.toDate().toLocaleString() : new Date().toLocaleString();
    const readStatus = message.isRead ? " (既読)" : "";

    let content = message.text;

    if (!content.startsWith('https://res.cloudinary.com')) {
         try {
            const sharedKey = await getSharedKey(currentFriendUid);
            content = await decryptMessage(content, sharedKey);
        } catch (error) {
            console.error("Decryption failed:", error);
            content = "メッセージを復号できませんでした。";
        }
    } else {
        if (content.includes('/image/upload')) {
            content = `<img src="${content}" alt="画像" style="max-width: 200px; border-radius: 8px;">`;
        } else if (content.includes('/video/upload')) {
            content = `<video src="${content}" controls style="max-width: 200px; border-radius: 8px;"></video>`;
        }
    }

    div.innerHTML = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${content}`;
    const metaSpan = document.createElement("span");
    metaSpan.style.fontSize = "0.8em";
    metaSpan.style.marginLeft = "10px";
    metaSpan.style.color = "#888";
    metaSpan.textContent = `[${sentTime}]${message.sender === currentUser.uid ? readStatus : ""}`;
    div.appendChild(metaSpan);
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

window.sendMessage = async function(event) {
    event.preventDefault();
    const input = document.getElementById("message-input");
    const text = input.value.trim();
    if (!text || !currentChatId || !currentFriendUid) return;

    const sharedKey = await getSharedKey(currentFriendUid);
    const encryptedText = await encryptMessage(text, sharedKey);

    const messagesRef = collection(db_firestore, `chats/${currentChatId}/messages`);
    await addDoc(messagesRef, {
        sender: currentUser.uid,
        text: encryptedText,
        timestamp: serverTimestamp(),
        isRead: false
    });  
    input.value = "";
};

// --- Media Uploads (remain unchanged) ---
// ...

// --- Friend & Chat Management ---
async function loadFriendList() {
    const usersRef = collection(db_firestore, 'users');
    onSnapshot(usersRef, (snapshot) => {
        const friendListDiv = document.getElementById('friend-list');
        friendListDiv.innerHTML = '';
        snapshot.forEach((doc) => {
            const user = doc.data();
            const uid = doc.id;
            if (uid === currentUser.uid) return;

            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.textContent = user.email; // or displayName
            friendItem.onclick = () => startChatWith(uid);
            friendListDiv.appendChild(friendItem);
        });
    });
}

async function startChatWith(friendUid) {
    const uids = [currentUser.uid, friendUid].sort();
    currentChatId = uids.join('_');
    currentFriendUid = friendUid;

    // Create chat document if it doesn't exist
    const chatRef = doc(db_firestore, 'chats', currentChatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
        await setDoc(chatRef, {
            participants: uids,
            createdAt: serverTimestamp()
        });
    }

    document.getElementById('chat-area').style.display = 'block';
    loadMessages();
}

window.toggleMenu = function() {
    document.getElementById('menu').classList.toggle('active');
};
