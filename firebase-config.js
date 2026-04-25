// ====================================================================
// CONFIGURACIÓ ONLINE — Firebase Realtime Database & Auth
// ====================================================================
//
// Per activar el mode ONLINE (Autenticació i Base de Dades):
//
//  1. Ves a https://console.firebase.google.com
//  2. Crea un projecte nou o obre l'existent
//  3. Afegeix una aplicació Web i copia l'objecte firebaseConfig
//  4. Enganxa els valors a sota
//  5. Activa Authentication (Email/Password)
//  6. Activa Realtime Database
//
// ====================================================================

window.firebaseConfig = {
  apiKey: "AIzaSyCmKdRLFUhTkTJTuTbPzC7yrIaLOJ2VfQI",
  authDomain: "proyectolenguajesgrupoolga.firebaseapp.com",
  databaseURL: "https://proyectolenguajesgrupoolga-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "proyectolenguajesgrupoolga",
  storageBucket: "proyectolenguajesgrupoolga.firebasestorage.app",
  messagingSenderId: "119186226643",
  appId: "1:119186226643:web:7218c392019c4708f84326",
  measurementId: "G-ZF2XML0M44"
};

// Mode Online si hi ha un apiKey configurat
window.ONLINE_MODE = window.firebaseConfig.apiKey && window.firebaseConfig.apiKey.length > 5;
window.FIREBASE_URL = window.firebaseConfig.databaseURL || '';
