import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getDatabase } from '@firebase/database';

// As credenciais do Firebase são obtidas de variáveis de ambiente.
// Se não estiverem definidas, a aplicação usará placeholders,
// resultando em um erro de autenticação ao tentar fazer login.
const firebaseConfig = {
  apiKey: (typeof process !== 'undefined' ? process.env.FIREBASE_API_KEY : undefined) || "AIzaSyDuW3SwuWqikRGdzyoidp8mK_Bdn-5OlOs",
  authDomain: (typeof process !== 'undefined' ? process.env.FIREBASE_AUTH_DOMAIN : undefined) || "autroproducao.firebaseapp.com",
  databaseURL: "https://autroproducao-default-rtdb.firebaseio.com",
  projectId: (typeof process !== 'undefined' ? process.env.FIREBASE_PROJECT_ID : undefined) || "autroproducao",
  storageBucket: (typeof process !== 'undefined' ? process.env.FIREBASE_STORAGE_BUCKET : undefined) || "autroproducao.appspot.com",
  messagingSenderId: (typeof process !== 'undefined' ? process.env.FIREBASE_MESSAGING_SENDER_ID : undefined) || "584335305711",
  appId: (typeof process !== 'undefined' ? process.env.FIREBASE_APP_ID : undefined) || "1:584335305711:web:XXXXXXXXXXXXXXXXXXXXXX"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firebase Authentication e obtém uma referência para o serviço
export const auth = getAuth(app);

// Inicializa o Firebase Realtime Database
export const db = getDatabase(app);