// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, update, push , remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBK0m6em6fxGbtyVi6DZZV899T1nAMgk_0",
  authDomain: "tanksafe-a61ae.firebaseapp.com",
  databaseURL: "https://tanksafe-a61ae-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tanksafe-a61ae",
  storageBucket: "tanksafe-a61ae.appspot.com",
  messagingSenderId: "193691636253",
  appId: "1:193691636253:web:3c3e6fbb3443e2937f6cf4",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, onValue, update, push ,remove };
