const KEYS = {
  token: 'facultyAuthToken',
  name: 'facultyName',
  email: 'facultyEmail',
};

export const facultySession = {
  get token() {
    try {
      return localStorage.getItem(KEYS.token);
    } catch {
      return null;
    }
  },
  get name() {
    try {
      return localStorage.getItem(KEYS.name) || 'Faculty';
    } catch {
      return 'Faculty';
    }
  },
  get email() {
    try {
      return localStorage.getItem(KEYS.email) || '';
    } catch {
      return '';
    }
  },
  save(token, faculty) {
    try {
      localStorage.setItem(KEYS.token, token);
      localStorage.setItem(KEYS.name, faculty.name);
      localStorage.setItem(KEYS.email, faculty.email);
    } catch {
      this.clear();
      throw new Error('Could not save the faculty session in this browser.');
    }
  },
  clear() {
    try {
      Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    } catch {
      // The in-memory session is still cleared by the provider.
    }
  },
};
