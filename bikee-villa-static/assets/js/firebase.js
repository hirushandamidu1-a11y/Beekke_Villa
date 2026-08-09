import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbUyZCitEVeKr2Y_TQd2-jIAwEx5D72rU",
  authDomain: "beekke-villa-galle-4620d.firebaseapp.com",
  databaseURL: "https://beekke-villa-galle-4620d-default-rtdb.firebaseio.com",
  projectId: "beekke-villa-galle-4620d",
  storageBucket: "beekke-villa-galle-4620d.firebasestorage.app",
  messagingSenderId: "665335733503",
  appId: "1:665335733503:web:6e8fccd098b11a636540ca",
  measurementId: "G-1H21EQPX9X"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage, analytics };
