import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjqA1P-TcZ3wyyhY7P1qUNXR4fIrTUXfg",
  authDomain: "pk-transport.firebaseapp.com",
  projectId: "pk-transport",
  storageBucket: "pk-transport.firebasestorage.app",
  messagingSenderId: "836014175162",
  appId: "1:836014175162:web:edbc417c8c8c84af546383",
  measurementId: "G-676XFYP6ZL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);