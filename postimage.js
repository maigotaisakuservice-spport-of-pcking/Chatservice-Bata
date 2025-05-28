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
    formDatas.append("file", file);
    formDatas.append("upload_preset", "ChatGoImage"); // ←あなたのCloudinary設定に置き換え

    const response = await fetch("https://api.cloudinary.com/v1_1/dvip3spmr/image/upload", {
      method: "POST",
      body: formDatas
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
