import { initializeApp } from '@react-native-firebase/app';
import { getFirestore, enableIndexedDbPersistence } from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",  // From Firebase Console > Project Settings > Web app
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"  // Optional
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence (caches data locally, reduces reads)
enableIndexedDbPersistence(db).catch((err) => {
  console.log('Offline persistence error:', err);
});

export { db };