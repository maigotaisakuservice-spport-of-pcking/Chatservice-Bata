// chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getDatabase, ref, push, get, update } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// Firebaseの設定
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

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let currentChatId = null;

// メニューの表示/非表示を切り替える関数
window.toggleMenu = function() {
  const menu = document.getElementById("menu");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
};

// フレンドを追加する関数
window.addFriend = async function() {
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

    // フレンドリストに追加
    const updates = {};
    updates[`users/${currentUser.uid}/friends/${friendUid}`] = true;
    updates[`users/${friendUid}/friends/${currentUser.uid}`] = true;
    await update(ref(db), updates);

    alert("フレンドを追加しました。");
    document.getElementById("friend-email").value = "";
    loadFriendList();
  } catch (error) {
    console.error("フレンド追加エラー:", error);
  }
};

// フレンドリストを読み込む関数
async function loadFriendList() {
  const friendListDiv = document.getElementById("friend-list");
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
      div.textContent = friendData.displayName || friendData.email;
      div.onclick = () => {
        startChatWith(friendUid);
      };
      friendListDiv.appendChild(div);
    }
  }
}

// チャットを開始する関数
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
    // 新しいチャットを作成
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
  loadMessages();
}

// メッセージを読み込む関数
function loadMessages() {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  const messagesRef = ref(db, `chats/${currentChatId}/messages`);
  onChildAdded(messagesRef, snapshot => {
    const message = snapshot.val();
    const div = document.createElement("div");
    div.textContent = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${message.text}`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// メッセージを送信する関数
window.sendMessage = async function(event) {
  event.preventDefault();
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text || !currentChatId) return;

  const messagesRef = ref(db, `chats/${currentChatId}/messages`);
  await push(messagesRef, {
    sender: currentUser.uid,
    text: text,
    timestamp: Date.now()
  });

  input.value = "";
};

// 認証状態の監視
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    loadFriendList();
  } else {
    // 未ログインの場合、ログインページにリダイレクト
    window.location.href = "index.html";
  }
});

// Cloudinaryの設定（あなたのCloud name と preset を必ず置き換えてください）
const cloudName = "dvip3spmr"; // 例: "chatgo123"
const uploadPreset = "ChatGoVideoPost"; // unsigned upload preset

// video-form の submit イベント処理
document.getElementById("video-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = document.getElementById("video-input").files[0];
  if (!file || !currentChatId || !currentUser) {
    alert("動画またはチャット対象が見つかりません");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    // Cloudinary にアップロード
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    const videoUrl = data.secure_url;

    // Firebase Realtime Database に動画URLを送信
    const messagesRef = ref(db, `chats/${currentChatId}/messages`);
    await push(messagesRef, {
      text: videoUrl,
      sender: currentUser.uid,
      timestamp: Date.now()
    });

    alert("動画を送信しました！");
    document.getElementById("video-input").value = "";
  } catch (error) {
    console.error("動画送信エラー:", error);
    alert("動画のアップロードに失敗しました");
  }
});

//画像送信スクリプト Cloudinary処理
document.getElementById("image-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = document.getElementById("image-input").files[0];
  if (!file || !currentChatId || !currentUser) {
    alert("画像またはチャット情報がありません");
    return;
  }

  try {
    // Cloudinary へのアップロード
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ChatGoImage"); // ←あなたのCloudinary設定に置き換え

    const response = await fetch("https://api.cloudinary.com/v1_1/dvip3spmr/image/upload", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    const imageUrl = data.secure_url;

    // Firebase RealtimeDB に画像URLを保存
    const messagesRef = ref(db, `chats/${currentChatId}/messages`);
    await push(messagesRef, {
      text: imageUrl,
      sender: currentUser.uid,
      timestamp: Date.now()
    });

    alert("画像を送信しました！");
    document.getElementById("image-input").value = "";

  } catch (err) {
    console.error("送信エラー:", err);
    alert("画像送信に失敗しました");
  }
});