import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getDatabase } from '@firebase/database';

// As credenciais do Firebase são obtidas de variáveis de ambiente.
// Se não estiverem definidas, a aplicação usará placeholders,
// resultando em um erro de autenticação ao tentar fazer login.
const firebaseConfig = {
  apiKey: (typeof process !== 'undefined' ? process.env.FIREBASE_API_KEY : undefined) || "AIzaSyAU6mNTRs8I7sdOZaPMbbwBA3rxyJGQC2U",
  authDomain: (typeof process !== 'undefined' ? process.env.FIREBASE_AUTH_DOMAIN : undefined) || "crm-saas-e2c84.firebaseapp.com",
  databaseURL: "https://crm-saas-e2c84-default-rtdb.firebaseio.com",
  projectId: (typeof process !== 'undefined' ? process.env.FIREBASE_PROJECT_ID : undefined) || "crm-saas-e2c84",
  storageBucket: (typeof process !== 'undefined' ? process.env.FIREBASE_STORAGE_BUCKET : undefined) || "crm-saas-e2c84.firebasestorage.app",
  messagingSenderId: (typeof process !== 'undefined' ? process.env.FIREBASE_MESSAGING_SENDER_ID : undefined) || "872422320662",
  appId: (typeof process !== 'undefined' ? process.env.FIREBASE_APP_ID : undefined) || "1:872422320662:web:e70db4dc5a8c62d2682337",
  measurementId: "G-CMP61M7KYJ"
};

const oldFirebaseConfig = {
  apiKey: "AIzaSyDuW3SwuWqikRGdzyoidp8mK_Bdn-5OlOs",
  authDomain: "autroproducao.firebaseapp.com",
  databaseURL: "https://autroproducao-default-rtdb.firebaseio.com",
  projectId: "autroproducao",
  storageBucket: "autroproducao.appspot.com",
  messagingSenderId: "584335305711",
  appId: "1:584335305711:web:XXXXXXXXXXXXXXXXXXXXXX"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const oldApp = initializeApp(oldFirebaseConfig, "oldApp");

// Inicializa o Firebase Authentication e obtém uma referência para o serviço
export const auth = getAuth(app);

// Inicializa o Firebase Realtime Database
export const db = getDatabase(app);
export const oldDb = getDatabase(oldApp);