// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth();
const db = getDatabase();

export {
  app, analytics, auth, db,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  ref, set, push, onValue
};
