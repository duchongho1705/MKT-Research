npm install firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAI_oXIVEyKkmvBNWIAok8J8nAtSBtRl1A",
  authDomain: "e-hsnl.firebaseapp.com",
  databaseURL: "https://e-hsnl-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-hsnl",
  storageBucket: "e-hsnl.firebasestorage.app",
  messagingSenderId: "854735568018",
  appId: "1:854735568018:web:7f68ef361a4211d7c97a4b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);