let Tone;
try {
    Tone = (await import("https://unpkg.com/tone@14.7.58/build/Tone.js")).default;
} catch (e) {
    console.warn("Could not load Tone.js. Intro video will have no sound.", e);
}

export function playIntroVideo(containerElement, onComplete) {
    containerElement.innerHTML = `
        <div id="intro-video-container" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1000; background-color: #000;">
            <canvas id="intro-video-canvas" style="width: 100%; height: 100%;"></canvas>
        </div>`;
    containerElement.style.display = 'block';

    const canvas = document.getElementById('intro-video-canvas');
    const ctx = canvas.getContext('2d');
    let isPlaying = false;
    let startTime = 0;

    const sceneTimes = [0, 6, 11, 18, 24, 30, 35, 42, 47, 54, 60];

    function resizeCanvas() { /* ... */ }
    function setupMusic() { /* ... */ }

    async function startPlayback() {
        if (isPlaying) return;
        if (Tone) {
            try { await Tone.start(); setupMusic(); Tone.Transport.start(); }
            catch (e) { console.warn("Audio failed", e); }
        }
        isPlaying = true;
        startTime = performance.now();
        animate();
    }

    function animate() {
        if (!isPlaying) return;
        const elapsedTime = (performance.now() - startTime) / 1000;

        if (elapsedTime >= sceneTimes[10] + 1) { // Add 1s buffer
            isPlaying = false;
            if (Tone) Tone.Transport.stop();
            setTimeout(() => {
                containerElement.innerHTML = '';
                onComplete();
            }, 5000);
            return;
        }

        const sceneIndex = sceneTimes.findIndex(t => t > elapsedTime) - 1;
        drawScene(elapsedTime, sceneIndex >= 0 ? sceneIndex : 0);
        requestAnimationFrame(animate);
    }

    function drawScene(elapsedTime, sceneIndex) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        switch(sceneIndex) {
            case 0:
                ctx.fillStyle = '#00FFFF';
                ctx.font = 'bold 3rem Roboto';
                ctx.fillText('PDG Group presents', cx, cy - 80);
                ctx.fillStyle = '#FF00FF';
                ctx.font = 'bold 5rem Roboto';
                ctx.fillText('Chat Go Premium', cx, cy + 20);
                break;
            case 1: case 2: {
                const sceneTime = elapsedTime - sceneTimes[1];
                ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 3rem Roboto';
                ctx.fillText('安全で簡単なメッセージ', cx, cy - 150);
                const messageX = cx - 200 + Math.sin(sceneTime * 2) * 50;
                const messageY = cy - 50 + Math.cos(sceneTime * 3) * 50;
                ctx.fillStyle = `rgba(0, 255, 255, ${1 - Math.sin(sceneTime) * 0.5})`;
                ctx.beginPath(); ctx.arc(messageX, messageY, 30, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 3: case 4: {
                const sceneTime = elapsedTime - sceneTimes[3];
                ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 3rem Roboto';
                ctx.fillText('最優先のフルアクセス', cx, cy - 150);
                for (let i = 0; i < 80; i++) {
                    ctx.fillStyle = `rgba(100, 100, 100, ${0.3 + Math.sin(sceneTime * 5 + i) * 0.4})`;
                    ctx.beginPath();
                    ctx.arc(cx + Math.sin(i * 0.2 + sceneTime) * 200, cy + Math.cos(i * 0.5 + sceneTime) * 150, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 5: case 6: {
                ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 3rem Roboto';
                ctx.fillText('洗練されたPremium専用のUI', cx, cy - 150);
                break;
            }
            case 7: case 8: {
                 ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 3rem Roboto';
                 ctx.fillText('アカウントの削除', cx, cy - 150);
                break;
            }
            case 9:
                ctx.fillStyle = '#FF00FF'; ctx.font = 'bold 5rem Roboto';
                ctx.fillText('Chat Go Premium', cx, cy - 50);
                break;
            case 10:
                ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 3rem Roboto';
                ctx.fillText('ご視聴ありがとうございました', cx, cy);
                break;
        }
    }
    startPlayback();
}
