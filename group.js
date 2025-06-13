import { auth, db } from "./app.js";
import { ref, get, push, set, onChildAdded, update, remove } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

let currentUser, currentGroupId;

onAuthStateChanged(auth, u => {
  if (u) { currentUser = u; loadGroups(); }
  else location.href = "index.html";
});

async function loadGroups() {
  const gdiv = document.getElementById("groups"); gdiv.innerHTML = "";
  const snap = await get(ref(db, "groups"));
  snap.forEach(c => {
    const g = c.val();
    if (g.members?.[currentUser.uid]) {
      const el = document.createElement("div");
      el.className = "group-item";
      el.textContent = g.name;
      el.onclick = () => enterGroup(c.key, g.name);
      gdiv.appendChild(el);
    }
  });
}

async function enterGroup(id,name) {
  currentGroupId = id;
  document.getElementById("current-group-name").textContent = name;
  document.getElementById("chat-area").style.display = "block";
  loadGroupMessages();
}

async function loadGroupMessages() {
  const mdiv = document.getElementById("messages"); mdiv.innerHTML = "";
  const snap = await get(ref(db, `groups/${currentGroupId}/messages`));
  snap.forEach(c => displayMessage(c.val()));
  onChildAdded(ref(db, `groups/${currentGroupId}/messages`), c => displayMessage(c.val()));
}

function displayMessage(m) {
  const el = document.createElement("div");
  el.className = "message-item";
  if (m.type === "image" && m.imageUrl) {
    const img = document.createElement("img"); img.src = m.imageUrl; img.style.maxWidth="150px";
    el.appendChild(img);
  } else {
    el.textContent = `${m.senderName}: ${m.text}`;
  }
  document.getElementById("messages").appendChild(el);
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}

document.getElementById("message-form").addEventListener("submit", async e => {
  e.preventDefault();
  const t = document.getElementById("message-input").value;
  if (!t) return;
  await push(ref(db, `groups/${currentGroupId}/messages`), {
    sender: currentUser.uid,
    senderName: currentUser.email,
    text: t, type: "text", timestamp: Date.now()
  });
  e.target.reset();
});

document.getElementById("image-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = document.getElementById("image-input").files[0];
  if (!f) return;
  const fd = new FormData();
  fd.append("file", f);
  fd.append("upload_preset", "YOUR_PRESET");
  const r = await fetch("https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload", {method:"POST",body:fd});
  const { secure_url } = await r.json();
  await push(ref(db, `groups/${currentGroupId}/messages`), {
    sender: currentUser.uid, senderName: currentUser.email, imageUrl: secure_url,
    type: "image", timestamp: Date.now()
  });
  e.target.reset();
});

window.createGroup = async () => {
  const name = prompt("グループ名"); if (!name) return;
  const g = push(ref(db, "groups"));
  await set(g, { name, members: { [currentUser.uid]: true } });
  loadGroups();
};

window.inviteMember = async () => {
  const email = document.getElementById("invite-email").value;
  if (!email) return alert("入力してください");
  const snap = await get(ref(db, "users"));
  let uid = null;
  snap.forEach(c => { if (c.val().email === email) uid = c.key });
  if (!uid) return alert("見つかりません");
  await update(ref(db), { [`groups/${currentGroupId}/members/${uid}`]: true });
  alert("招待完了");
};

window.leaveGroup = async () => {
  if (!confirm("退出しますか？")) return;
  await remove(ref(db, `groups/${currentGroupId}/members/${currentUser.uid}`));
  document.getElementById("chat-area").style.display = "none";
  loadGroups();
};

document.getElementById("startCallBtn").addEventListener("click", () => {
  if (!currentGroupId) return alert("グループ選択してください");
  window.location.href = `groupCall.html?groupId=${currentGroupId}`;
});
