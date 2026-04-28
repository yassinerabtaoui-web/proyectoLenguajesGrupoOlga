// ============================================================
// db.js — Capa d'abstracció de base de dades
// Usa Firebase Realtime Database SDK si està disponible
// o localStorage com a fallback offline.
// ============================================================

const DB = (() => {
  function ensureFirebase() {
    if (window.ONLINE_MODE && window.firebase && window.firebaseConfig && !firebase.apps.length) {
      firebase.initializeApp(window.firebaseConfig);
    }
  }

  const isOnline = () => {
    if (window.ONLINE_MODE && window.firebase && window.firebase.database) {
      ensureFirebase();
      return true;
    }
    return false;
  };

  const LOCAL_MATCHES = 'porraMatches';
  const LOCAL_PLAYED  = 'porraPlayedTeams';
  const LOCAL_TOURNAMENT = 'porraTournamentGroups';

  // Sanitize team names for Firebase keys
  function toKey(name) {
    return name.replace(/[.#$/\[\]\s]/g, '_');
  }

  // ── LocalStorage helpers ──────────────────────────────────
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  return {
    online: isOnline,

    // ── MATCHES ──────────────────────────────────────────────
    async getMatches() {
      if (isOnline()) {
        try {
          const snapshot = await firebase.database().ref('matches').once('value');
          const data = snapshot.val();
          if (!data) return [];
          return Object.entries(data)
            .map(([key, val]) => ({ ...val, _key: key }))
            .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
        } catch (e) {
          console.warn('Firebase getMatches error:', e);
        }
      }
      return lsGet(LOCAL_MATCHES) || [];
    },

    async addMatch(match) {
      if (isOnline()) {
        try {
          const ref = firebase.database().ref('matches').push();
          await ref.set(match);
          // Cache locally too
          const ms = lsGet(LOCAL_MATCHES) || [];
          ms.push({ ...match, _key: ref.key });
          lsSet(LOCAL_MATCHES, ms);
          return;
        } catch (e) {
          console.warn('Firebase addMatch error:', e);
          throw new Error('Firebase ha denegat guardar el partit. Has canviat les regles a true? Error original: ' + e.message);
        }
      }
      // Fallback
      const ms = lsGet(LOCAL_MATCHES) || [];
      ms.push(match);
      lsSet(LOCAL_MATCHES, ms);
    },

    async updateMatch(key, data) {
      if (isOnline()) {
        try {
          await firebase.database().ref('matches/' + key).update(data);
        } catch (e) {
          console.warn('Firebase updateMatch error:', e);
        }
      }
      const ms = lsGet(LOCAL_MATCHES) || [];
      const idx = ms.findIndex(m => m._key === key || m.id == key);
      if (idx !== -1) { ms[idx] = { ...ms[idx], ...data }; lsSet(LOCAL_MATCHES, ms); }
    },

    async deleteMatch(key) {
      if (isOnline()) {
        try {
          await firebase.database().ref('matches/' + key).remove();
        } catch (e) {
          console.warn('Firebase deleteMatch error:', e);
        }
      }
      const ms = (lsGet(LOCAL_MATCHES) || []).filter(m => m._key !== key && m.id != key);
      lsSet(LOCAL_MATCHES, ms);
      
      // Recalculate played teams from remaining matches
      const names = new Set();
      ms.forEach(m => { names.add(m.team1.name); names.add(m.team2.name); });
      lsSet(LOCAL_PLAYED, Array.from(names));
      
      if (isOnline()) {
        try {
          const obj = {};
          names.forEach(n => { obj[toKey(n)] = n; });
          await firebase.database().ref('playedTeams').set(names.size ? obj : null);
        } catch (e) {}
      }
    },

    // ── PLAYED TEAMS ─────────────────────────────────────────
    async getPlayedTeams() {
      if (isOnline()) {
        try {
          const snapshot = await firebase.database().ref('playedTeams').once('value');
          const data = snapshot.val();
          if (!data) return [];
          return Object.values(data).filter(Boolean);
        } catch (e) {
          console.warn('Firebase getPlayedTeams error:', e);
        }
      }
      return lsGet(LOCAL_PLAYED) || [];
    },

    async markTeamsPlayed(teamNames) {
      // Update local cache immediately
      const current = lsGet(LOCAL_PLAYED) || [];
      teamNames.forEach(n => { if (!current.includes(n)) current.push(n); });
      lsSet(LOCAL_PLAYED, current);
      
      // Push to Firebase
      if (isOnline()) {
        try {
          const patch = {};
          teamNames.forEach(n => { patch[toKey(n)] = n; });
          await firebase.database().ref('playedTeams').update(patch);
        } catch (e) {
          console.warn('Firebase markTeamsPlayed error:', e);
        }
      }
    },

    async resetTeam(teamName) {
      const current = (lsGet(LOCAL_PLAYED) || []).filter(n => n !== teamName);
      lsSet(LOCAL_PLAYED, current);
      if (isOnline()) {
        try {
          await firebase.database().ref('playedTeams/' + toKey(teamName)).remove();
        } catch (e) {}
      }
    },

    async resetAllTeams() {
      lsSet(LOCAL_PLAYED, []);
      if (isOnline()) {
        try {
          await firebase.database().ref('playedTeams').remove();
        } catch (e) {}
      }
    },

    async clearAllMatches() {
      lsSet(LOCAL_MATCHES, []);
      if (isOnline()) {
        try {
          await firebase.database().ref('matches').remove();
        } catch (e) {}
      }
    },

    async resetAll() {
      lsSet(LOCAL_MATCHES, []); lsSet(LOCAL_PLAYED, []); lsSet(LOCAL_TOURNAMENT, null);
      if (isOnline()) {
        try {
          await firebase.database().ref('matches').remove();
          await firebase.database().ref('playedTeams').remove();
          await firebase.database().ref('tournamentGroups').remove();
        } catch (e) {}
      }
    },

    // ── TOURNAMENT GROUPS ────────────────────────────────────
    async getTournamentGroups() {
      if (isOnline()) {
        try {
          const snapshot = await firebase.database().ref('tournamentGroups').once('value');
          return snapshot.val() || null;
        } catch (e) {
          console.warn('Firebase getTournamentGroups error:', e);
        }
      }
      return lsGet(LOCAL_TOURNAMENT);
    },

    async saveTournamentGroups(groups) {
      lsSet(LOCAL_TOURNAMENT, groups);
      if (isOnline()) {
        try {
          await firebase.database().ref('tournamentGroups').set(groups);
        } catch (e) {
          console.warn('Firebase saveTournamentGroups error:', e);
        }
      }
    },

    // ── APUESTAS (PORRA) ─────────────────────────────────────
    async saveUserBet(uid, betId, data) {
      if (!isOnline()) {
        const bets = lsGet('porraBets_' + uid) || {};
        bets[betId] = data;
        lsSet('porraBets_' + uid, bets);
        return;
      }
      try {
        await firebase.database().ref(`users/${uid}/bets/${betId}`).set(data);
      } catch (e) {
        console.warn('Firebase saveUserBet error:', e);
      }
    },

    async getUserBets(uid) {
      if (!isOnline()) return lsGet('porraBets_' + uid) || {};
      try {
        const snapshot = await firebase.database().ref(`users/${uid}/bets`).once('value');
        return snapshot.val() || {};
      } catch (e) {
        console.warn('Firebase getUserBets error:', e);
        return {};
      }
    },

    async getAllUsersBets() {
      if (!isOnline()) {
        // Fallback local: cercar a localStorage
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('porraBets_')) {
            const uid = key.replace('porraBets_', '');
            result[uid] = { bets: lsGet(key), email: 'Local User ' + uid.substring(0,4) };
          }
        }
        return result;
      }
      try {
        const snapshot = await firebase.database().ref('users').once('value');
        return snapshot.val() || {};
      } catch (e) {
        console.warn('Firebase getAllUsersBets error:', e);
        return {};
      }
    },

    // Sync Firebase → localStorage (called on game load)
    async syncToLocal() {
      if (!isOnline()) return null;
      try {
        const [matches, played] = await Promise.all([this.getMatches(), this.getPlayedTeams()]);
        lsSet(LOCAL_MATCHES, matches);
        lsSet(LOCAL_PLAYED, played);
        return { matches, played };
      } catch (e) {
        console.warn('[DB] Sync failed:', e.message);
        return null;
      }
    },
  };
})();

console.log('[DB] Mode:', (window.ONLINE_MODE && window.firebase) ? '🌐 Firebase Online (SDK)' : '💾 localStorage Offline');
