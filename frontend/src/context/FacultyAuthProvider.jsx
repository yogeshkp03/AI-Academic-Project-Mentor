import { useCallback, useEffect, useMemo, useState } from 'react';
import { facultyApi } from '../lib/api/faculty';
import { facultySession } from '../lib/session/facultySession';
import { FacultyAuthContext } from './FacultyAuthContext';

export function FacultyAuthProvider({ children }) {
  const [token, setToken] = useState(() => facultySession.token);
  const [faculty, setFaculty] = useState(null);
  const [checking, setChecking] = useState(Boolean(facultySession.token));

  useEffect(() => {
    let active = true;
    if (!token) {
      return () => { active = false; };
    }
    facultyApi.me(token)
      .then((profile) => {
        if (active) setFaculty(profile);
      })
      .catch(() => {
        if (active) {
          facultySession.clear();
          setToken(null);
          setFaculty(null);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const response = await facultyApi.login({ email, password });
    if (!response?.token || !response?.faculty?.id) {
      throw new Error('The faculty login response did not include a session. Please try again.');
    }
    facultySession.save(response.token, response.faculty);
    setToken(response.token);
    setFaculty(response.faculty);
    return response.faculty;
  }, []);

  const logout = useCallback(async () => {
    const activeToken = token;
    facultySession.clear();
    setToken(null);
    setFaculty(null);
    if (activeToken) {
      try {
        await facultyApi.logout(activeToken);
      } catch {
        // Local logout already succeeded.
      }
    }
  }, [token]);

  const updateFaculty = useCallback((profile) => {
    if (!token || !profile?.id) return;
    facultySession.save(token, profile);
    setFaculty(profile);
  }, [token]);

  const value = useMemo(
    () => ({ faculty, token, checking, login, logout, updateFaculty }),
    [faculty, token, checking, login, logout, updateFaculty],
  );

  return (
    <FacultyAuthContext.Provider value={value}>
      {children}
    </FacultyAuthContext.Provider>
  );
}
