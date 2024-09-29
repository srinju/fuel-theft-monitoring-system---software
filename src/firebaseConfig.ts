// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, update, push , remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "your api key",
  authDomain: "your auth domain",
  databaseURL: "your db url",
  projectId: "your project id",
  storageBucket: "your storage bucket string",
  messagingSenderId: "your messaging sender id",
  appId: "your app id",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, onValue, update, push ,remove };
