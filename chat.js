// chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, addDoc, collection, onSnapshot, query, where, getDocs, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js"; // For public key only
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

// --- Firebase Config ---
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
const db = getFirestore(app); // Firestore instance
const rtdb = getDatabase(app); // Realtime DB for public key

let currentUser = null;
let currentChatId = null;
let currentFriendUid = null;
let keyPair = null;
const sharedKeyCache = {};
let messagesUnsubscribe = null;

// --- Auth State & Crypto Init ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        initializeCrypto();
        loadFriendList();
    } else {
        window.location.href = "index.html";
    }
});

async function initializeCrypto() {
    keyPair = await generateKeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    // Public keys are kept in RTDB for speed and simplicity
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

// --- Message Functions with Firestore ---
function loadMessages() {
    if (messagesUnsubscribe) messagesUnsubscribe();

    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";

    const messagesRef = collection(db, "chats", currentChatId, "messages");
    const q = query(messagesRef, orderBy("timestamp"));

    messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const message = change.doc.data();
                const messageId = change.doc.id;

                if (message.sender !== currentUser.uid && !message.isRead) {
                    await updateDoc(doc(db, "chats", currentChatId, "messages", messageId), { isRead: true });
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
            content = "メッセージを復号できませんでした。";
        }
    } else {
        // Media URL handling...
    }

    div.innerHTML = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${content}`;
    // ... styling and appending logic ...
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

    const messagesRef = collection(db, "chats", currentChatId, "messages");
    await addDoc(messagesRef, {
        sender: currentUser.uid,
        text: encryptedText,
        timestamp: serverTimestamp(),
        isRead: false
    });
    input.value = "";
};

// --- Friend & Chat Management ---
async function loadFriendList() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "!=", currentUser.email));
    const querySnapshot = await getDocs(q);

    const friendListDiv = document.getElementById('friend-list');
    friendListDiv.innerHTML = '';
    querySnapshot.forEach((doc) => {
        const user = doc.data();
        const uid = doc.id;
        const friendItem = document.createElement('div');
        friendItem.textContent = user.email;
        friendItem.onclick = () => startChatWith(uid);
        friendListDiv.appendChild(friendItem);
    });
}

function startChatWith(friendUid) {
    const uids = [currentUser.uid, friendUid].sort();
    currentChatId = uids.join('_');
    currentFriendUid = friendUid;
    document.getElementById('chat-area').style.display = 'block';
    loadMessages();
}

// ... other functions like toggleMenu, addFriend ...
window.toggleMenu = function() {
    document.getElementById('menu').classList.toggle('active');
};
window.addFriend = function() {
    // This would now involve querying Firestore for a user by email
};
