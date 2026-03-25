import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCb5j2XmT1A6XVbfDh0Pu23uxHhB9kOmNg",
  authDomain: "nirvan-5adc8.firebaseapp.com",
  projectId: "nirvan-5adc8",
  storageBucket: "nirvan-5adc8.firebasestorage.app",
  messagingSenderId: "961991712310",
  appId: "1:961991712310:web:0b3559a879802562f54297",
  measurementId: "G-7ECHGE5E35"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithEmail  = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const createAccount    = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signOut          = () => fbSignOut(auth);

