import { useContext } from 'react';
import { FacultyAuthContext } from './FacultyAuthContext';

export function useFacultyAuth() {
  const context = useContext(FacultyAuthContext);
  if (!context) {
    throw new Error('useFacultyAuth must be used within a FacultyAuthProvider.');
  }
  return context;
}
