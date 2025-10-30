// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
// RTDB imports - aliasing them to avoid name conflicts
import { getDatabase, ref as rtdbRef, set as rtdbSet, push as rtdbPush, onValue as rtdbOnValue, update as rtdbUpdate } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
// Firestore imports
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyDKKV9dakvsP8BCjjYvsFO_haJ5D98-Mu4",
    authDomain: "chat-go-enterprise.firebaseapp.com",
    databaseURL: "https://chat-go-enterprise-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chat-go-enterprise",
    storageBucket: "chat-go-enterprise.firebasestorage.app",
    messagingSenderId: "947179164013",
    appId: "1:947179164013:web:aa0f1c45cfdbfe1eac4a64",
    measurementId: "G-47P31E2TDN"
  };

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth();
const db_rtdb = getDatabase(); // Realtime Database
const db_firestore = getFirestore(); // Firestore

export {
  app, analytics, auth,
  // RTDB
  db_rtdb, rtdbRef, rtdbSet, rtdbPush, rtdbOnValue, rtdbUpdate,
  // Firestore
  db_firestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, updateDoc, deleteDoc, getDocs,
  // Auth
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
};
