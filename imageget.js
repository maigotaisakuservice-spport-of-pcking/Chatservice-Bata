//imagepost for Firebase
import { sendCompressedImage } from "./imagepost.js";

// image-formのsubmitイベントで画像送信
document.getElementById("image-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("image-input").files[0];
  if (!file) return alert("画像を選択してください");
  const success = await sendCompressedImage(file, currentChatId, currentUser, db);
  if (success) {
    document.getElementById("image-input").value = "";
  }
});


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
