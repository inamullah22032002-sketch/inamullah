import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { UserLoginPage } from './pages/UserLoginPage';
import { UserSignupPage } from './pages/UserSignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardLayout } from './pages/admin/AdminDashboardLayout';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/browse';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (path !== currentPath) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-cyan-400">Loading FunclubSI...</span>
        </div>
      </div>
    );
  }

  // Parse path and route
  const isAdminDashboard = currentPath.startsWith('/admin') && currentPath !== '/admin/login';
  const isMovieDetail = currentPath.startsWith('/movie/');
  const movieSlugOrId = isMovieDetail ? currentPath.replace('/movie/', '') : '';

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Hide standard navbar on Admin control plane */}
      {!isAdminDashboard && (
        <Navbar
          onSearchChange={(q) => setSearchQuery(q)}
          activeSearchQuery={searchQuery}
          onNavigate={navigate}
          currentRoute={currentPath}
        />
      )}

      {/* Main Body */}
      <main className={`flex-1 ${isAdminDashboard ? 'p-0' : 'max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6'}`}>
        {/* Route: Home / Browse */}
        {(currentPath === '/' || currentPath === '/browse') && (
          <HomePage
            onNavigate={navigate}
            searchQuery={searchQuery}
            defaultType="all"
          />
        )}

        {/* Route: Movies Only */}
        {currentPath === '/movies' && (
          <HomePage
            onNavigate={navigate}
            searchQuery={searchQuery}
            defaultType="movie"
          />
        )}

        {/* Route: TV Series Only */}
        {currentPath === '/tv' && (
          <HomePage
            onNavigate={navigate}
            searchQuery={searchQuery}
            defaultType="tv"
          />
        )}

        {/* Route: Movie Detail */}
        {isMovieDetail && (
          <MovieDetailPage
            slugOrId={movieSlugOrId}
            onNavigate={navigate}
          />
        )}

        {/* Route: User Login */}
        {currentPath === '/login' && (
          <UserLoginPage onNavigate={navigate} />
        )}

        {/* Route: User Signup */}
        {currentPath === '/signup' && (
          <UserSignupPage onNavigate={navigate} />
        )}

        {/* Route: Forgot Password */}
        {currentPath === '/forgot-password' && (
          <ForgotPasswordPage onNavigate={navigate} />
        )}

        {/* Route: User Profile */}
        {currentPath === '/profile' && (
          <UserProfilePage onNavigate={navigate} />
        )}

        {/* Route: Separate Admin Login */}
        {currentPath === '/admin/login' && (
          <AdminLoginPage onNavigate={navigate} />
        )}

        {/* Route: Admin Dashboard */}
        {isAdminDashboard && (
          <AdminDashboardLayout
            onNavigate={navigate}
            initialTab={
              currentPath === '/admin/upload' ? 'upload' :
              currentPath === '/admin/movies' ? 'movies' :
              currentPath === '/admin/import' ? 'import' :
              currentPath === '/admin/storage' ? 'storage' :
              currentPath === '/admin/audit' ? 'audit' :
              currentPath === '/admin/analytics' ? 'analytics' :
              currentPath === '/admin/users' ? 'users' :
              currentPath === '/admin/settings' ? 'settings' :
              'dashboard'
            }
          />
        )}
      </main>

      {/* Hide public footer on Admin control plane */}
      {!isAdminDashboard && <Footer onNavigate={navigate} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
