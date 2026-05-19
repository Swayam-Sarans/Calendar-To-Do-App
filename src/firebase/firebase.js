// firebase/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPAx6SydCvE9qwpSvoE1Z2HCIKQBteBzA",
  authDomain: "calendar-to-do-app-3c0f3.firebaseapp.com",
  projectId: "calendar-to-do-app-3c0f3",
  storageBucket: "calendar-to-do-app-3c0f3.firebasestorage.app",
  messagingSenderId: "942335718939",
  appId: "1:942335718939:web:913df1d76cc0da2733eabe",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
