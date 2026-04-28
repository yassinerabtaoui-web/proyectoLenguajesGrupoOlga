// ====================================================================
// auth.js — Gestió de l'autenticació i rols amb Firebase
// ====================================================================

(function () {
  'use strict';

  window.AUTH = {};

  // Initialize Firebase if not already initialized
  function initFirebase() {
    if (window.ONLINE_MODE && window.firebase && !firebase.apps.length) {
      firebase.initializeApp(window.firebaseConfig);
    }
  }

  // Comprova si Firebase està llest
  function isReady() {
    return window.ONLINE_MODE && window.firebase;
  }

  // Iniciar sessió amb correu i contrasenya
  window.AUTH.login = async function (email, password) {
    initFirebase();
    if (!isReady()) throw new Error("Firebase no està configurat o el mode ONLINE està desactivat.");

    try {
      // Configurar la persistència perquè només duri mentre la pestanya/navegador estigui obert
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Obtenir el rol des de Realtime Database
      const roleSnapshot = await firebase.database().ref(`users/${user.uid}/role`).once('value');
      const role = roleSnapshot.val() || 'client';

      // Actualitzar l'email a la base de dades per a la gestió d'usuaris
      await firebase.database().ref(`users/${user.uid}/email`).set(user.email);

      // Guardar el rol temporalment a sessionStorage per accessos ràpids
      sessionStorage.setItem('userRole', role);
      sessionStorage.setItem('userUid', user.uid);

      return { user, role };
    } catch (error) {
      console.error("Error en login:", error);
      throw error;
    }
  };

  // Registrar nou usuari amb correu i contrasenya
  window.AUTH.register = async function (email, password) {
    initFirebase();
    if (!isReady()) throw new Error("Firebase no està configurat o el mode ONLINE està desactivat.");

    try {
      // Configurar la persistència perquè només duri mentre la pestanya/navegador estigui obert
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);

      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Assignar el rol de 'client' per defecte i guardar el correu a la base de dades
      await firebase.database().ref(`users/${user.uid}`).set({
        role: 'client',
        email: user.email
      });

      sessionStorage.setItem('userRole', 'client');
      sessionStorage.setItem('userUid', user.uid);

      return { user, role: 'client' };
    } catch (error) {
      console.error("Error en el registre:", error);
      throw error;
    }
  };

  // Tancar sessió
  window.AUTH.logout = async function () {
    initFirebase();
    if (!isReady()) return;

    try {
      await firebase.auth().signOut();
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('userUid');
      window.location.href = 'index.html';
    } catch (error) {
      console.error("Error en logout:", error);
    }
  };

  // Obtenir l'usuari actual i el seu rol
  window.AUTH.getCurrentUser = function () {
    return new Promise((resolve) => {
      initFirebase();
      if (!isReady()) {
        resolve({ user: null, role: null });
        return;
      }

      const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
        unsubscribe(); // Només necessitem el primer valor
        if (user) {
          try {
            const roleSnapshot = await firebase.database().ref(`users/${user.uid}/role`).once('value');
            const role = roleSnapshot.val() || 'client';
            sessionStorage.setItem('userRole', role);
            sessionStorage.setItem('userUid', user.uid);
            resolve({ user, role });
          } catch (e) {
            resolve({ user, role: 'client' });
          }
        } else {
          sessionStorage.removeItem('userRole');
          sessionStorage.removeItem('userUid');
          resolve({ user: null, role: null });
        }
      });
    });
  };

  // Protegir una pàgina per un rol específic (p. ex. 'admin')
  window.AUTH.requireRole = async function (requiredRole, redirectUrl = 'index.html') {
    initFirebase();
    if (!isReady()) {
      // En mode local, podem fer un petit "bypass" si no fem servir Firebase
      // però actualment el dashboard necessita auth. Ens mantenim estrictes.
      window.location.href = redirectUrl;
      return false;
    }

    const { user, role } = await window.AUTH.getCurrentUser();
    if (!user || role !== requiredRole) {
      window.location.href = redirectUrl;
      return false;
    }
    return true; // Accés permès
  };

})();
