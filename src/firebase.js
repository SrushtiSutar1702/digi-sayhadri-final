import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGpfvq85E9dpFsMfZFgybdZyhOYkkqPgw",
  authDomain: "sayhadrid.firebaseapp.com",
  databaseURL: "https://sayhadrid-default-rtdb.firebaseio.com",
  projectId: "sayhadrid",
  storageBucket: "sayhadrid.firebasestorage.app",
  messagingSenderId: "82837325439",
  appId: "1:82837325439:web:2fea375519ab462a7aa14a",
  measurementId: "G-8G4K1P131P"
};

console.log('🔥 Starting Firebase initialization...');

// Initialize Firebase
let app, database, auth, secondaryApp, secondaryAuth;

try {
  // Primary app for main authentication
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  auth = getAuth(app);

  // Secondary app for creating new users without logging out current user
  secondaryApp = initializeApp(firebaseConfig, 'Secondary');
  secondaryAuth = getAuth(secondaryApp);

  // Set persistence to LOCAL so session persists across browser refreshes and tabs
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('✅ Firebase Auth persistence set to LOCAL');
    })
    .catch((error) => {
      console.error('❌ Error setting persistence:', error);
    });

  console.log('✅ Firebase initialized successfully');
  console.log('✅ Database:', database ? 'Connected' : 'Not connected');
  console.log('✅ Auth:', auth ? 'Ready' : 'Not ready');
  console.log('✅ Secondary Auth:', secondaryAuth ? 'Ready' : 'Not ready');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  throw error;
}

export { database, auth, secondaryAuth };
