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
      type: "video",
      videoUrl: videoUrl,
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
