import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXRkr_njKIJZxo7d2bRRDBJvLA-oaaK5U",
  authDomain: "bieu-do-bcbe2.firebaseapp.com",
  projectId: "bieu-do-bcbe2",
  storageBucket: "bieu-do-bcbe2.firebasestorage.app",
  messagingSenderId: "564400278532",
  appId: "1:564400278532:web:8c89f9fdcf4f463d5f7951",
  measurementId: "G-RR1NBLLW81"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
