// chat.js  
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";  
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getDatabase, ref, set, push, onChildAdded, get, update } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// --- Firebase Config ---
const firebaseConfig = {  
    apiKey: "AIzaSyA7CWUhLBKG_Oabxxw_7RfBpSANUoDh42s",
    authDomain: "moodmirror-login.firebaseapp.com",
    databaseURL: "https://moodmirror-login-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "moodmirror-login",
    storageBucket: "moodmirror-login.firebasestorage.app",
    messagingSenderId: "1091670187554",
    appId: "1:1091670187554:web:ce919c1fca5b660995b47b",
    measurementId: "G-TPJXPMPSGZ"
};  

const app = initializeApp(firebaseConfig);  
const auth = getAuth(app);  
const db = getDatabase(app);  

let currentUser = null;  
let currentChatId = null;  

// --- Auth State ---
onAuthStateChanged(auth, user => {  
  if (user) {  
    currentUser = user;  
    loadFriendList();  
    Notification.requestPermission();
  } else {  
    window.location.href = "index.html";  
  }  
});  

// --- Core Message Functions ---
function loadMessages() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    const messagesRef = ref(db, `chats/${currentChatId}/messages`);
    onChildAdded(messagesRef, (snapshot) => {
        const messageId = snapshot.key;
        const message = snapshot.val();
        if (message.sender !== currentUser.uid && !message.isRead) {
            update(ref(db, `chats/${currentChatId}/messages/${messageId}`), { isRead: true });
        }
        if (message.sender !== currentUser.uid && document.hidden) {
            new Notification("新しいメッセージ", { body: message.text, icon: "./icon.png" });
        }
        displayMessage(message);
    });
}

function displayMessage(message) {
    const messagesDiv = document.getElementById("messages");
    const div = document.createElement("div");
    const sentTime = new Date(message.timestamp).toLocaleString();
    const readStatus = message.isRead ? " (既読)" : "";
    let content = message.text;

    // Check for image or video URLs
    if (content.startsWith('https://res.cloudinary.com')) {
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
    if (!text || !currentChatId) return;
    const messagesRef = ref(db, `chats/${currentChatId}/messages`);  
    await push(messagesRef, {  
        sender: currentUser.uid,
        text: text,
        timestamp: Date.now(),
        isRead: false
    });  
    input.value = "";
};

// --- Cloudinary Media Uploads ---
const cloudName = "dvip3spmr";
const imageUploadPreset = "ChatGoImage";
const videoUploadPreset = "ChatGoVideoPost";

async function uploadToCloudinary(file, uploadPreset, resourceType) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
    const response = await fetch(url, { method: "POST", body: formData });
    const data = await response.json();
    return data.secure_url;
}

document.getElementById("image-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("image-input").files[0];
    if (!file || !currentChatId) return alert("ファイルまたはチャットを選択してください。");
    try {
        const imageUrl = await uploadToCloudinary(file, imageUploadPreset, "image");
        const messagesRef = ref(db, `chats/${currentChatId}/messages`);
        await push(messagesRef, { text: imageUrl, sender: currentUser.uid, timestamp: Date.now(), isRead: false });
        document.getElementById("image-input").value = "";
    } catch (err) {
        console.error("画像アップロードエラー:", err);
        alert("画像アップロードに失敗しました。");
    }
});

document.getElementById("video-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("video-input").files[0];
    if (!file || !currentChatId) return alert("ファイルまたはチャットを選択してください。");
    try {
        const videoUrl = await uploadToCloudinary(file, videoUploadPreset, "video");
        const messagesRef = ref(db, `chats/${currentChatId}/messages`);
        await push(messagesRef, { text: videoUrl, sender: currentUser.uid, timestamp: Date.now(), isRead: false });
        document.getElementById("video-input").value = "";
    } catch (err) {
        console.error("動画アップロードエラー:", err);
        alert("動画アップロードに失敗しました。");
    }
});

// --- Friend & Chat Management (no changes needed) ---
window.addFriend = async function() { /* ... */ };
async function loadFriendList() { /* ... */ }
async function startChatWith(friendUid) { /* ... */ }
window.toggleMenu = function() { /* ... */ };
