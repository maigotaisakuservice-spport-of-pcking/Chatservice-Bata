import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";  
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getDatabase, ref, set, push, onChildAdded, get, update, increment } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment as firestoreIncrement } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from "./crypto.js";

// --- INITIALIZATION ---
const firebaseConfig = { /* ... same as before ... */ };
const app = initializeApp(firebaseConfig);  
const auth = getAuth(app);  
const rtdb = getDatabase(app); // Realtime Database
const db = getFirestore(app); // Firestore
  
let currentUser = null, currentChatId = null, isPremium = false, keyPair = null;
const chatKeys = {};

const GENERAL_USER_LIMIT = 50;
const PREMIUM_USER_LIMIT = 500;

// --- AUTH STATE & KEY GENERATION ---
onAuthStateChanged(auth, async (user) => {
  if (user) {  
    currentUser = user;
    const userDocRef = doc(db, "users", user.uid); // Check Firestore for premium status
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists() && userDoc.data().premium) {
        isPremium = true;
        document.getElementById('gif-ui').style.display = 'block';
        keyPair = await generateKeyPair();
        const publicKey = await exportPublicKey(keyPair.publicKey);
        // Also write public key to firestore doc for consistency
        await updateDoc(userDocRef, { publicKey });
    }
    loadFriendList();
  } else { window.location.href = "index.html"; }
});

// --- MESSAGE LIMITS ---
async function checkAndIncrementMessageCount() {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (isPremium) {
        const limitRef = doc(db, "message_limits", currentUser.uid);
        const limitDoc = await getDoc(limitRef);

        let currentCount = 0;
        if (limitDoc.exists() && limitDoc.data()[today]) {
            currentCount = limitDoc.data()[today];
        }

        if (currentCount >= PREMIUM_USER_LIMIT) {
            alert("プレミアムプランの1日のメッセージ上限に達しました。");
            return false;
        }

        await setDoc(limitRef, { [today]: firestoreIncrement(1) }, { merge: true });
        return true;

    } else {
        const limitRef = ref(rtdb, `message_limits/${currentUser.uid}/${today}`);
        const snapshot = await get(limitRef);
        const currentCount = snapshot.val() || 0;

        if (currentCount >= GENERAL_USER_LIMIT) {
            alert("1日のメッセージ上限に達しました。プレミアムプランにアップグレードすると、上限が大幅に増加します。");
            return false;
        }

        await set(limitRef, increment(1));
        return true;
    }
}


// --- FRIEND & CHAT MANAGEMENT ---
async function startChatWith(friendUid) {
    // ... existing code ...
    // Make sure to fetch friend's public key from Firestore now
    if (isPremium) {
        const friendDoc = await getDoc(doc(db, "users", friendUid));
        const friendData = friendDoc.data();
        if (friendData && friendData.publicKey) {
            const theirPublicKey = await importPublicKey(friendData.publicKey);
            chatKeys[currentChatId] = await deriveSharedSecret(keyPair.privateKey, theirPublicKey);
            console.log("Shared key for chat established!");
        } else {
            console.log("Friend is not premium, messages will not be encrypted.");
        }
    }
    loadMessages();
}
// ... other functions like loadFriendList remain the same ...

// --- MESSAGE HANDLING ---
window.sendMessage = async function(event) {
    event.preventDefault();
    const canSend = await checkAndIncrementMessageCount();
    if (!canSend) return;

    const input = document.getElementById("message-input");
    let text = input.value.trim();
    if (!text || !currentChatId) return;

    let encrypted = false;
    if (isPremium && chatKeys[currentChatId]) {
        text = await encryptMessage(text, chatKeys[currentChatId]);
        encrypted = true;
    }
  
    const messagesRef = ref(rtdb, `chats/${currentChatId}/messages`);
    await push(messagesRef, {  
        sender: currentUser.uid,
        text: text,
        encrypted: encrypted,
        timestamp: new Date().toLocaleString(),
        isRead: false
    });  
  
    input.value = "";
};

// The rest of the file (loadMessages, etc.) remains largely the same,
// but now relies on the Firestore-based premium check.
// ...
