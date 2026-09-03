// Inicialização do Firebase do AVIZ.
//
// Estes valores são PÚBLICOS por natureza — o firebaseConfig de app web é
// desenhado para ficar no navegador do usuário. Ele NÃO é um segredo. O que a
// gente nunca coloca aqui (nem no repositório) é a chave de conta de serviço
// (admin), que fica só nas Cloud Functions. A segurança de verdade vem das
// regras do Realtime Database + Auth, não de esconder esta config.

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBBJDhIgrar4PlhkqBfrJxttsjJgyQnO6E',
  authDomain: 'aviz-cb3c8.firebaseapp.com',
  databaseURL: 'https://aviz-cb3c8-default-rtdb.firebaseio.com',
  projectId: 'aviz-cb3c8',
  storageBucket: 'aviz-cb3c8.firebasestorage.app',
  messagingSenderId: '929286013459',
  appId: '1:929286013459:web:efb596fea0c9eb72a9b5e6',
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
