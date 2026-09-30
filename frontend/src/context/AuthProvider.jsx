import { useCallback, useMemo, useState } from 'react';
import { authApi } from '../lib/api/auth';
import { session } from '../lib/session';
import { AuthContext } from './authContext';

function readAuthFromSession() {
  return {
    isLoggedIn: Boolean(session.read('token')),
    studentId: session.studentId,
    studentName: session.studentName,
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuthFromSession);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    if (!data?.token || !data?.student?.id) {
      // Storing an undefined token would put the string "undefined" in
      // localStorage, which is truthy and authenticates as "Bearer undefined".
      throw new Error('Login response was missing a session token. Please try again.');
    }
    session.write('token', data.token);
    session.write('studentId', String(data.student.id));
    session.write('studentName', data.student.name);
    session.write('studentEmail', data.student.email);
    session.writeJson('studentProfile', {
      name: data.student.name,
      email: data.student.email,
      department: data.student.department || '',
      semester: data.student.semester ?? '',
    });
    setAuth({ isLoggedIn: true, studentId: data.student.id, studentName: data.student.name });
    return data.student;
  }, []);

  const logout = useCallback(async () => {
    // Drop the local session first. Clearing after the request leaves a window
    // where a re-login completes and is then revoked by the late response.
    session.clearAuth();
    setAuth({ isLoggedIn: false, studentId: 0, studentName: 'Student' });
    try {
      // Invalidate the server-side session so the token can never be replayed.
      await authApi.logout();
    } catch {
      // Local logout already succeeded even if the backend is unreachable.
    }
  }, []);

  const value = useMemo(
    () => ({ ...auth, login, logout }),
    [auth, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}