import { auth, db } from "./app.js";
import { ref, onChildAdded, set, remove } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const params = new URLSearchParams(location.search);
const groupId = params.get("groupId");
if (!groupId) { alert("groupId missing"); location.href="group.html" }
let currentUser, localStream, peers={};
const config={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};

onAuthStateChanged(auth,u=> {
  if (u) currentUser=u;
  else location.href="index.html";
});

async function setupLocal() {
  localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
  document.getElementById("localVideo").srcObject = localStream;
}

const rtcRef = ref(db, `rtc/${groupId}`);
onChildAdded(rtcRef, async snap=> {
  const from = snap.key, d = snap.val();
  if (from===currentUser.uid) return;
  if (d.offer) await handleOffer(from,d.offer);
  if (d.answer) peers[from]?.setRemoteDescription(d.answer);
  if (d.candidate) peers[from]?.addIceCandidate(d.candidate);
});

function createPeer(peerId) {
  const pc = new RTCPeerConnection(config);
  peers[peerId] = pc;
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.onicecandidate = e => e.candidate && set(ref(db, `rtc/${groupId}/${currentUser.uid}/candidate`), e.candidate);
  pc.ontrack = e => {
    let v = document.getElementById(`v_${peerId}`);
    if (!v) {
      v = document.createElement("video");
      v.id = `v_${peerId}`;
      v.autoplay = true; v.playsInline = true;
      document.getElementById("videos").appendChild(v);
    }
    v.srcObject = e.streams[0];
  };
  return pc;
}

async function handleOffer(from, offer) {
  const pc = createPeer(from);
  await pc.setRemoteDescription(offer);
  const ans = await pc.createAnswer();
  await pc.setLocalDescription(ans);
  await set(ref(db, `rtc/${groupId}/${currentUser.uid}/answer`), ans);
}

async function startCall() {
  await setupLocal();
  const pc = createPeer(currentUser.uid);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await set(ref(db, `rtc/${groupId}/${currentUser.uid}/offer`), offer);
}

document.getElementById("muteBtn").onclick = () => {
  localStream.getAudioTracks().forEach(t=>t.enabled = !t.enabled);
};

document.getElementById("leaveCallBtn").onclick = () => {
  remove(ref(db, `rtc/${groupId}/${currentUser.uid}`));
  Object.values(peers).forEach(pc=>pc.close());
  location.href = "group.html";
};

startCall();
