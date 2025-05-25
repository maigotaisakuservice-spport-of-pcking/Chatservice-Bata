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


// 画像圧縮関数（40KB以内のJPEGに圧縮）
async function compressImageToJpeg(file, maxSize = 40 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
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

        let quality = 0.92;
        function tryCompress() {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64Length = dataUrl.length - "data:image/jpeg;base64,".length;
          const sizeInBytes = 4 * Math.ceil(base64Length / 3) * 0.75;
          if (sizeInBytes <= maxSize || quality <= 0.4) {
            resolve(dataUrl);
          } else {
            quality -= 0.05;
            tryCompress();
          }
        }
        tryCompress();
      };
      img.onerror = () => reject("画像の読み込みに失敗しました。");
      img.src = reader.result;
    };
    reader.onerror = () => reject("ファイルの読み込みに失敗しました。");
    reader.readAsDataURL(file);
  });
}

// 1ヶ月に送信可能な画像枚数の上限
const MAX_IMAGES_PER_MONTH = 8;

// 画像送信処理
async function sendImage(event) {
  event.preventDefault();
  if (!currentUser) {
    alert("ログインしてください。");
    return;
  }
  const fileInput = document.getElementById("image-input");
  if (!fileInput.files.length) {
    alert("画像を選択してください。");
    return;
  }

  const file = fileInput.files[0];

  try {
    // 送信上限チェック
    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const imagesRef = ref(db, `users/${currentUser.uid}/sentImages`);
    const snapshot = await get(imagesRef);
    let countThisMonth = 0;

    if (snapshot.exists()) {
      snapshot.forEach(childSnap => {
        const data = childSnap.val();
        if (data.timestamp > oneMonthAgo) {
          countThisMonth++;
        }
      });
    }
    if (countThisMonth >= MAX_IMAGES_PER_MONTH) {
      alert(`今月の画像送信上限(${MAX_IMAGES_PER_MONTH}枚)に達しました。`);
      return;
    }

    // 圧縮
    const compressedDataUrl = await compressImageToJpeg(file);

    // チャット内に画像メッセージを追加
    if (!currentChatId) {
      alert("チャット相手を選択してください。");
      return;
    }

    const messagesRef = ref(db, `chats/${currentChatId}/messages`);
    await push(messagesRef, {
      sender: currentUser.uid,
      type: "image",
      imageDataUrl: compressedDataUrl,
      timestamp: now
    });

    // ユーザーの送信画像履歴に保存（カウント管理用）
    await push(imagesRef, {
      timestamp: now
    });

    fileInput.value = "";
  } catch (error) {
    console.error("画像送信エラー:", error);
    alert("画像送信に失敗しました。");
  }
}

// 画像メッセージの表示追加（既存loadMessagesの中などに追加して使う例）
function appendImageMessage(message) {
  const messagesDiv = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "image-message";
  div.innerHTML = `
    <strong>${message.sender === currentUser.uid ? "あなた" : "相手"}</strong><br>
    <img src="${message.imageDataUrl}" style="max-width:200px;max-height:200px;" />
  `;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// loadMessages関数内で画像メッセージ判定を追加例
function loadMessages() {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";

  const messagesRef = ref(db, `chats/${currentChatId}/messages`);
  onChildAdded(messagesRef, snapshot => {
    const message = snapshot.val();
    if (message.type === "image") {
      appendImageMessage(message);
    } else {
      // テキストメッセージ等既存処理
      const div = document.createElement("div");
      div.textContent = `${message.sender === currentUser.uid ? "あなた" : "相手"}: ${message.text}`;
      messagesDiv.appendChild(div);
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}
