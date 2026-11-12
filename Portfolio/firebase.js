import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDH1uk_oVqqWCtVH-DUvJJ1UrCj6yJ-AzA',
  authDomain: 'myportfolioassessment.firebaseapp.com',
  databaseURL: 'https://myportfolioassessment-default-rtdb.firebaseio.com',
  projectId: 'myportfolioassessment',
  storageBucket: 'myportfolioassessment.firebasestorage.app',
  messagingSenderId: '998044600222',
  appId: '1:998044600222:web:42dce1debac15309ec388f',
  measurementId: 'G-GM4L6N6D5M',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

auth.languageCode = 'en';

export { app, auth, db };