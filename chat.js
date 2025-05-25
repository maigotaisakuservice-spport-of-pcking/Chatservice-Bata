// chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onChildAdded,
  get,
  child,
  update
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

// Firebase の設定
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

// Firebase の初期化
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



// image-formのsubmitイベントで画像送信
document.getElementById("image-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = document.getElementById("image-input").files[0];
  if (!file || !currentChatId || !currentUser) {
    alert("画像かチャット対象が見つかりません");
    return;
  }

  try {
    const base64 = await compressImageToTargetSize(file, 30 * 1024); // 30KB以下
    const messagesRef = ref(db, `chats/${currentChatId}/messages`);
    await push(messagesRef, {
      type: "image",
      imageDataUrl: base64,
      sender: currentUser.uid,
      timestamp: Date.now()
    });

    alert("画像を送信しました！");
    document.getElementById("image-input").value = "";
  } catch (err) {
    console.error("送信失敗:", err);
    alert("画像送信に失敗しました。");
  }
});
//サイズ調整
async function compressImageToTargetSize(file, maxBase64Size = 30 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // サイズ調整（最大800px）
        let width = img.width;
        let height = img.height;
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

        // 品質を調整しながらbase64サイズが30KB以下になるよう試行
        let quality = 0.92;
        function tryCompress() {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64Length = dataUrl.length - "data:image/jpeg;base64,".length;
          const sizeInBytes = 4 * Math.ceil(base64Length / 3) * 0.75;

          if (sizeInBytes <= maxBase64Size || quality <= 0.4) {
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

//chat画面に画像表示スクリプト
function displayMessage(message) {
  const messagesDiv = document.getElementById("messages");
  const div = document.createElement("div");

  if (message.type === "image" && message.imageDataUrl) {
    const img = document.createElement("img");
    img.src = message.imageDataUrl;
    img.loading = "lazy";
    img.alt = "画像メッセージ";
    img.style.maxWidth = "150px";
    img.style.maxHeight = "150px";
    img.style.cursor = "pointer";
    img.onclick = () => openImageModal(message.imageDataUrl); // 拡大表示

    div.appendChild(img);
  } else {
    div.textContent = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${message.text || ""}`;
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
//クリックで画像拡大表示スクリプト
function openImageModal(dataUrl) {
  const modal = document.getElementById("image-modal");
  const img = document.getElementById("modal-image");
  img.src = dataUrl;
  modal.style.display = "flex";
}

// モーダルクリックで閉じる
document.getElementById("image-modal").addEventListener("click", () => {
  document.getElementById("image-modal").style.display = "none";
});
