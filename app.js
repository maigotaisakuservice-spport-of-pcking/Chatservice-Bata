// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app); // Firestore as the primary DB
const rtdb = getDatabase(app); // Realtime Database for specific use cases (like public keys)

export {
  app,
  auth,
  db,    // Export Firestore as 'db'
  rtdb   // Export Realtime Database as 'rtdb'
};
