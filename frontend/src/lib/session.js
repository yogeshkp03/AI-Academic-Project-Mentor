const KEYS = {
  token: 'authToken',
  studentId: 'studentId',
  studentName: 'studentName',
  studentEmail: 'studentEmail',
  studentProfile: 'studentProfile',
  studentSkills: 'studentSkills',
};

// Cleared when a session ends. studentSkills is deliberately excluded: it is
// only ever stored here and is never sent to the backend, so removing it would
// permanently destroy the user's data on logout or on any token expiry.
const SESSION_KEYS = [
  KEYS.token,
  KEYS.studentId,
  KEYS.studentName,
  KEYS.studentEmail,
  KEYS.studentProfile,
];

export const session = {
  read(key) {
    try {
      const value = localStorage.getItem(KEYS[key] || key);
      return value ?? null;
    } catch {
      return null;
    }
  },
  readJson(key, fallback = null) {
    const value = this.read(key);
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(KEYS[key] || key, value);
    } catch {
      // Storage can be unavailable (private mode, disabled by policy, quota).
      // Dropping the write is safer than throwing from a token assignment, which
      // would leave a live server session that the UI believes failed.
    }
  },
  writeJson(key, value) {
    try {
      localStorage.setItem(KEYS[key] || key, JSON.stringify(value));
    } catch {
      // See write().
    }
  },
  clearAuth() {
    try {
      SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // See write().
    }
  },
  clearAll() {
    try {
      Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    } catch {
      // See write().
    }
  },
  get token() {
    return this.read('token');
  },
  get studentId() {
    return Number(this.read('studentId') || '0');
  },
  get studentName() {
    return this.read('studentName') || 'Student';
  },
  get profile() {
    return this.readJson('studentProfile', {});
  },
  get skills() {
    return this.readJson('studentSkills', []);
  },
};