import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onChildAdded,
  get,
  update
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// Firebase初期設定
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

// --- UI要素 ---
const messagesDiv = document.getElementById("messages");
const friendListDiv = document.getElementById("friend-list");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const imageInput = document.getElementById("image-input");
const audioInput = document.getElementById("audio-input");
const notificationsDiv = document.getElementById("notifications");

let peerConnection = null;
const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- メニュー切替 ---
window.toggleMenu = () => {
  const menu = document.getElementById("menu");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
};

// --- フレンド追加 ---
window.addFriend = async () => {
  const email = document.getElementById("friend-email").value.trim();
  if (!email) return alert("メールアドレスを入力してください。");
  try {
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);
    let friendUid = null;
    snapshot.forEach(childSnapshot => {
      const userData = childSnapshot.val();
      if (userData.email === email) {
        friendUid = childSnapshot.key;
      }
    });
    if (!friendUid) {
      alert("ユーザーが見つかりません。");
      return;
    }
    const updates = {};
    updates[`users/${currentUser.uid}/friends/${friendUid}`] = true;
    updates[`users/${friendUid}/friends/${currentUser.uid}`] = true;
    await update(ref(db), updates);
    alert("フレンドを追加しました。");
    document.getElementById("friend-email").value = "";
    loadFriendList();
  } catch (e) {
    console.error(e);
  }
};

// --- フレンドリスト読み込み ---
async function loadFriendList() {
  friendListDiv.innerHTML = "";
  const userRef = ref(db, `users/${currentUser.uid}/friends`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const friends = snapshot.val();
    for (const friendUid in friends) {
      const friendDataSnapshot = await get(ref(db, `users/${friendUid}`));
      const friendData = friendDataSnapshot.val();
      const div = document.createElement("div");
      div.className = "friend-item";
      div.textContent = friendData.displayName || friendData.email || "名無し";
      div.onclick = () => startChatWith(friendUid);
      friendListDiv.appendChild(div);
    }
  }
}

// --- チャット開始 ---
async function startChatWith(friendUid) {
  const chatsRef = ref(db, "chats");
  const snapshot = await get(chatsRef);
  let chatId = null;

  snapshot.forEach(childSnapshot => {
    const chat = childSnapshot.val();
    if (
      chat.members &&
      chat.members[currentUser.uid] &&
      chat.members[friendUid]
    ) {
      chatId = childSnapshot.key;
    }
  });

  if (!chatId) {
    // 新チャット作成
    const newChatRef = push(chatsRef);
    chatId = newChatRef.key;
    await set(newChatRef, {
      members: {
        [currentUser.uid]: true,
        [friendUid]: true
      },
      messages: {}
    });
  }
  currentChatId = chatId;
  clearMessages();
  loadMessages();
  closePeerConnection();
  await setupWebRTC(friendUid);
}

// --- メッセージ表示クリア ---
function clearMessages() {
  messagesDiv.innerHTML = "";
}

// --- メッセージ読み込み ---
function loadMessages() {
  const messagesRef = ref(db, `chats/${currentChatId}/messages`);
  onChildAdded(messagesRef, snapshot => {
    const message = snapshot.val();
    displayMessage(message);
  });
}

// --- メッセージ表示 ---
function displayMessage(message) {
  const div = document.createElement("div");
  div.className = "message";
  if (message.sender === currentUser.uid) div.classList.add("self");

  let content = "";
  if (message.type === "text") {
    content = message.text;
  } else if (message.type === "image") {
    content = `[画像]`;
    const img = document.createElement("img");
    img.src = message.data;
    img.style.maxWidth = "150px";
    img.style.display = "block";
    content = "";
    div.appendChild(img);
  } else if (message.type === "audio") {
    content = `[音声]`;
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = message.data;
    div.appendChild(audio);
    content = "";
  } else if (message.type === "video-notify") {
    content = `[動画通話通知] ${message.text}`;
  }

  if (content) {
    div.textContent = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${content}`;
  } else {
    div.textContent = `${message.sender === currentUser.uid ? "あなた" : "相手"}: `;
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- メッセージ送信 ---
window.sendMessage = async function(event) {
  event.preventDefault();
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text || !currentChatId) return;
  const messagesRef = ref(db, `chats/${currentChatId}/messages`);
  await push(messagesRef, {
    sender: currentUser.uid,
    type: "text",
    text: text,
    timestamp: Date.now()
  });
  input.value = "";
};

// --- 画像添付処理 ---
imageInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  // JPEGに変換・圧縮 (canvas)
  const compressedDataUrl = await compressImageToJpeg(file, 40 * 1024);
  if (!compressedDataUrl) {
    alert("画像の圧縮に失敗しました。");
    return;
  }

  // メッセージとして送信
  await sendMediaMessage("image", compressedDataUrl);
  imageInput.value = "";
});

// 画像圧縮関数（JPEG変換、40KB以内目標）
async function compressImageToJpeg(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let [width, height] = [img.width, img.height];

        // 最大幅・高さを設定（画質保持のため縮小は必要最低限）
        const maxDim = 800;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 圧縮率を段階的に下げて40KB以下を目指す
        let quality = 0.92;
        function tryCompress() {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64Length = dataUrl.length - "data:image/jpeg;base64,".length;
          const sizeInBytes = 4 * Math.ceil(base64Length / 3) * 0.75; // base64 → バイト概算
          if (sizeInBytes <= maxSize || quality <= 0.4) {
            resolve(dataUrl);
          } else {
            quality -= 0.05;
            tryCompress();
          }
        }
        tryCompress();
      };
      img.onerror = () => reject("画像読み込みエラー");
      img.src = reader.result;
    };
    reader.onerror = () => reject("ファイル読み込みエラー");
    reader.readAsDataURL(file);
  });
}
