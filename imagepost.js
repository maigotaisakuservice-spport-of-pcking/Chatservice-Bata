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
