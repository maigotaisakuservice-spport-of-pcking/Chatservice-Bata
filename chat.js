// chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getDatabase, ref, set, push, onChildAdded, get, update, onChildChanged, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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
const rtdb = getDatabase(app); // Realtime Database for chat messages
const db = getFirestore(app); // Firestore for user data

let currentUser = null;
let currentChatId = null;
let isPremiumUser = false;

// --- Emojis ---
const EMOJIS = {
    '::smile::': '/emoji/smile.png',
    '::laugh::': '/emoji/laugh.png',
    '::sad::': '/emoji/sad.png',
    '::angry::': '/emoji/angry.png',
    '::thumbup::': '/emoji/thumbup.png',
    '::heart::': '/emoji/heart.png',
};

// --- Auth State & Premium Check ---
onAuthStateChanged(auth, async user => {
    if (user) {
        currentUser = user;
        await checkPremiumStatus(user);
        initializeChatUI();
        loadFriendList();
        Notification.requestPermission();
    } else {
        window.location.href = "index.html";
    }
});

async function checkPremiumStatus(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists() && userDoc.data().premium) {
        const premiumInfo = userDoc.data().premium;
        // Check if plan is active
        if (premiumInfo.expiresAt === null || premiumInfo.expiresAt.toDate() > new Date()) {
            isPremiumUser = true;
            document.getElementById("gif-ui").style.display = "block";
            document.getElementById("emoji-button").style.display = "block";
            loadGifLibrary();
            loadCustomGifs();
            populateEmojiPicker();

            // Check for temporary chat permissions
            if (premiumInfo.plan === 'unlimited' || premiumInfo.plan === 'enterprise') {
                document.getElementById("create-temp-chat-btn").style.display = "block";
            }
        }
    }
}

function initializeChatUI() {
    document.getElementById('message-form').addEventListener('submit', sendMessage);
    document.getElementById('image-form').addEventListener('submit', sendImage);
    document.getElementById('video-form').addEventListener('submit', sendVideo);
    document.getElementById('custom-gif-upload').addEventListener('change', uploadCustomGif);
    document.getElementById('create-temp-chat-btn').addEventListener('click', createTemporaryChat);

    const emojiButton = document.getElementById('emoji-button');
    const emojiPicker = document.getElementById('emoji-picker');
    emojiButton.addEventListener('click', () => {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });
}

// --- Message Functions ---
function loadMessages() {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    const messagesRef = ref(rtdb, `chats/${currentChatId}/messages`);

    // Listener for new messages
    onChildAdded(messagesRef, (snapshot) => {
        const messageId = snapshot.key;
        const message = snapshot.val();
        if (message.sender !== currentUser.uid && !message.isRead) {
            update(ref(rtdb, `chats/${currentChatId}/messages/${messageId}`), { isRead: true });
        }
        if (message.sender !== currentUser.uid && document.hidden) {
            new Notification("新しいメッセージ", { body: message.text.substring(0, 50), icon: "./icon.png" });
        }
        displayMessage(messageId, message);
    });

    // Listener for read status updates
    onChildChanged(messagesRef, (snapshot) => {
        const messageId = snapshot.key;
        const message = snapshot.val();
        if (message.isRead && message.sender === currentUser.uid) {
            const messageElement = document.getElementById(`message-${messageId}`);
            if (messageElement) {
                const metaSpan = messageElement.querySelector('.meta-data');
                if (metaSpan && !metaSpan.textContent.includes('既読')) {
                    metaSpan.textContent += ' (既読)';
                }
            }
        }
    });
}

function displayMessage(messageId, message) {
    const messagesDiv = document.getElementById("messages");
    const div = document.createElement("div");
    div.id = `message-${messageId}`; // Assign a unique ID

    const sentTime = new Date(message.timestamp).toLocaleString();
    const readStatus = message.isRead ? " (既読)" : "";

    let content = message.text;

    // Replace emoji codes with images
    Object.keys(EMOJIS).forEach(code => {
        const imgTag = `<img src="${EMOJIS[code]}" alt="${code}" style="width: 20px; height: 20px; vertical-align: middle;">`;
        content = content.split(code).join(imgTag);
    });

    // Handle media URLs
    if (content.startsWith('https://res.cloudinary.com')) {
        if (content.includes('/image/upload')) {
            content = `<img src="${content}" alt="画像" style="max-width: 200px; border-radius: 8px;">`;
        } else if (content.includes('/video/upload')) {
            content = `<video src="${content}" controls style="max-width: 200px; border-radius: 8px;"></video>`;
        }
    } else if (message.type === 'gif') {
        content = `<img src="${message.gifUrl}" alt="GIF" style="max-width: 150px; border-radius: 8px;">`;
    }

    div.innerHTML = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${content}`;
    const metaSpan = document.createElement("span");
    metaSpan.className = 'meta-data'; // Add a class for easy selection
    metaSpan.style.fontSize = "0.8em";
    metaSpan.style.marginLeft = "10px";
    metaSpan.style.color = "#888";
    metaSpan.textContent = `[${sentTime}]${message.sender === currentUser.uid ? readStatus : ""}`;
    div.appendChild(metaSpan);
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage(event) {
    event.preventDefault();
    const input = document.getElementById("message-input");
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    const messagesRef = ref(rtdb, `chats/${currentChatId}/messages`);
    await push(messagesRef, {
        sender: currentUser.uid,
        text: text,
        timestamp: Date.now(),
        isRead: false
    });
    input.value = "";
    document.getElementById('emoji-picker').style.display = 'none';
}

// --- Emoji Picker ---
function populateEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.innerHTML = '';
    for (const code in EMOJIS) {
        const img = document.createElement('img');
        img.src = EMOJIS[code];
        img.alt = code;
        img.style.width = '30px';
        img.style.cursor = 'pointer';
        img.style.margin = '5px';
        img.addEventListener('click', () => {
            document.getElementById('message-input').value += ` ${code} `;
        });
        picker.appendChild(img);
    }
}

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
    if (!response.ok) throw new Error('Upload failed');
    return (await response.json()).secure_url;
}

async function sendImage(e) {
    e.preventDefault();
    const file = document.getElementById("image-input").files[0];
    if (!file || !currentChatId) return alert("ファイルまたはチャットを選択してください。");
    try {
        const imageUrl = await uploadToCloudinary(file, imageUploadPreset, "image");
        const messagesRef = ref(rtdb, `chats/${currentChatId}/messages`);
        await push(messagesRef, { text: imageUrl, sender: currentUser.uid, timestamp: Date.now(), isRead: false });
        document.getElementById("image-input").value = "";
    } catch (err) {
        console.error("画像アップロードエラー:", err);
        alert("画像アップロードに失敗しました。");
    }
}

async function sendVideo(e) {
    e.preventDefault();
    const file = document.getElementById("video-input").files[0];
    if (!file || !currentChatId) return alert("ファイルまたはチャットを選択してください。");
    try {
        const videoUrl = await uploadToCloudinary(file, videoUploadPreset, "video");
        const messagesRef = ref(rtdb, `chats/${currentChatId}/messages`);
        await push(messagesRef, { text: videoUrl, sender: currentUser.uid, timestamp: Date.now(), isRead: false });
        document.getElementById("video-input").value = "";
    } catch (err) {
        console.error("動画アップロードエラー:", err);
        alert("動画アップロードに失敗しました。");
    }
}

// --- GIF Feature Logic ---
const GIF_LIMIT_PER_MONTH = 5;
const CUSTOM_GIF_LIMIT = 3;
const GIF_STORAGE_KEY = "customGifs";

function loadGifLibrary() {
  const gifUrls = [
    "https://chatmaga.f5.si/gif/1.gif", "https://chatmaga.f5.si/gif/2.gif", "https://chatmaga.f5.si/gif/3.gif"
  ];
  const gifContainer = document.getElementById("gif-library");
  gifContainer.innerHTML = "";
  gifUrls.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.style.width = "80px";
    img.style.cursor = "pointer";
    img.onclick = () => sendGif(url);
    gifContainer.appendChild(img);
  });
}

async function sendGif(url) {
  if (!isPremiumUser || !currentUser || !currentChatId) return;
  const month = new Date().toISOString().slice(0, 7);
  const limitRef = ref(rtdb, `gifLimits/${currentUser.uid}/${month}`);
  const snap = await get(limitRef);
  const count = snap.exists() ? snap.val() : 0;
  if (count >= GIF_LIMIT_PER_MONTH) {
    return alert("今月のGIF送信上限に達しました（5個まで）");
  }
  const messagesRef = ref(rtdb, `chats/${currentChatId}/messages`);
  await push(messagesRef, { type: "gif", gifUrl: url, sender: currentUser.uid, timestamp: Date.now() });
  set(limitRef, count + 1);
}

function uploadCustomGif() {
  const file = this.files[0];
  if (!file || file.type !== "image/gif") return alert("GIF画像のみアップロード可能です");
  const reader = new FileReader();
  reader.onload = function () {
    let gifs = JSON.parse(localStorage.getItem(GIF_STORAGE_KEY) || "[]");
    if (gifs.length >= CUSTOM_GIF_LIMIT) return alert("カスタムGIFは3つまでです");
    gifs.push(reader.result);
    localStorage.setItem(GIF_STORAGE_KEY, JSON.stringify(gifs));
    loadCustomGifs();
  };
  reader.readAsDataURL(file);
}

function loadCustomGifs() {
  const gifs = JSON.parse(localStorage.getItem(GIF_STORAGE_KEY) || "[]");
  const container = document.getElementById("custom-gif-list");
  container.innerHTML = "";
  gifs.forEach(base64 => {
    const img = document.createElement("img");
    img.src = base64;
    img.style.width = "80px";
    img.style.cursor = "pointer";
    img.onclick = () => sendGif(base64);
    container.appendChild(img);
  });
}

// --- Temporary Chat Creation ---
async function createTemporaryChat() {
    if (!currentUser) return;
    try {
        const tempChatCol = collection(db, "temporary_chats");
        const newChatDoc = await addDoc(tempChatCol, {
            createdAt: serverTimestamp(),
            creator: currentUser.uid,
            participants: [currentUser.uid]
        });
        const chatLink = `${window.location.origin}/temp_chat.html?id=${newChatDoc.id}`;
        prompt("一時チャットが作成されました。このリンクを共有してください:", chatLink);
    } catch (error) {
        console.error("Failed to create temporary chat:", error);
        alert("一時チャットの作成に失敗しました。");
    }
}

// --- Friend & Chat Management ---
window.toggleMenu = function() {
    const menu = document.getElementById('menu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
};

window.addFriend = async function() {
    const emailToAdd = document.getElementById('friend-email').value.trim();
    if (!emailToAdd || !currentUser) return;

    const usersRef = ref(rtdb, 'users');
    const userQuery = query(usersRef, orderByChild('email'), equalTo(emailToAdd));
    const snapshot = await get(userQuery);

    if (!snapshot.exists()) {
        alert("指定されたメールアドレスのユーザーは見つかりませんでした。");
        return;
    }

    const friendData = snapshot.val();
    const friendId = Object.keys(friendData)[0];
    const friend = friendData[friendId];

    if (friendId === currentUser.uid) {
        alert("自分自身をフレンドとして追加することはできません。");
        return;
    }

    // Add friend to current user's list and vice-versa
    const currentUserFriendsRef = ref(rtdb, `users/${currentUser.uid}/friends/${friendId}`);
    await set(currentUserFriendsRef, true);
    const friendUserFriendsRef = ref(rtdb, `users/${friendId}/friends/${currentUser.uid}`);
    await set(friendUserFriendsRef, true);

    alert(`${friend.email} をフレンドに追加しました。`);
    loadFriendList();
    document.getElementById('friend-email').value = '';
};

async function loadFriendList() {
    const friendListDiv = document.getElementById('friend-list');
    friendListDiv.innerHTML = '';
    const friendsRef = ref(rtdb, `users/${currentUser.uid}/friends`);
    const snapshot = await get(friendsRef);

    if (snapshot.exists()) {
        const friendIds = Object.keys(snapshot.val());
        friendIds.forEach(async (friendId) => {
            const userRef = ref(rtdb, `users/${friendId}`);
            const userSnap = await get(userRef);
            if (userSnap.exists()) {
                const friend = userSnap.val();
                const friendItem = document.createElement('div');
                friendItem.className = 'friend-item';
                friendItem.textContent = friend.email;
                friendItem.onclick = () => startChatWith(friendId);
                friendListDiv.appendChild(friendItem);
            }
        });
    }
}

async function startChatWith(friendUid) {
    const uids = [currentUser.uid, friendUid].sort();
    currentChatId = uids.join('_');

    document.getElementById('messages').innerHTML = '...'; // Clear previous messages
    loadMessages();
    toggleMenu(); // Close menu after selecting a friend
}