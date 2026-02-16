
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB_rJo8HO1zvsr0_BE6ynAxaDu9CXcc_ps",
  authDomain: "ugcstudio-5c998.firebaseapp.com",
  projectId: "ugcstudio-5c998",
  storageBucket: "ugcstudio-5c998.firebasestorage.app",
  messagingSenderId: "268725442167",
  appId: "1:268725442167:web:8f1cfd5d5c2a3f57fd9872",
  measurementId: "G-W9FV2S5KKL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
