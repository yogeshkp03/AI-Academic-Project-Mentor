import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import { AuthProvider } from './context/AuthProvider';
import { FacultyAuthProvider } from './context/FacultyAuthProvider';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { FacultyProtectedRoute } from './components/layout/FacultyProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import AIPlanner from './pages/AIPlanner';
import AIMentor from './pages/AIMentor';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import FacultyLogin from './pages/faculty/FacultyLogin';
import FacultyRegister from './pages/faculty/FacultyRegister';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import SkillAssessment from './pages/SkillAssessment';
import Mentorship from './pages/Mentorship';

function App() {
  return (
    <AuthProvider>
      <FacultyAuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <ToastProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/faculty/login" element={<FacultyLogin />} />
                <Route path="/faculty/register" element={<FacultyRegister />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/skill-assessment" element={<SkillAssessment />} />
                  <Route path="/mentorship" element={<Mentorship />} />
                  <Route path="/ai-planner" element={<AIPlanner />} />
                  <Route path="/ai-mentor" element={<AIMentor />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                <Route element={<FacultyProtectedRoute />}>
                  <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ToastProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </FacultyAuthProvider>
    </AuthProvider>
  );
}

export default App;