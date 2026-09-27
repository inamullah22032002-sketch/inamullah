import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Film,
  Search,
  Bookmark,
  Heart,
  User,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Compass,
  Tv,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  onSearchChange?: (query: string) => void;
  activeSearchQuery?: string;
  onNavigate?: (route: string) => void;
  currentRoute?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSearchChange,
  activeSearchQuery = '',
  onNavigate = () => {},
  currentRoute = '/browse',
}) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (route: string) => {
    onNavigate(route);
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#07080d]/85 border-b border-white/[0.06] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => handleNav('/browse')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
              <div className="w-full h-full bg-[#0a0d18] rounded-[11px] flex items-center justify-center">
                <Film className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight font-heading bg-gradient-to-r from-white via-cyan-200 to-indigo-300 bg-clip-text text-transparent">
                Funclub<span className="text-cyan-400">SI</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest text-cyan-400/80 -mt-1 font-semibold">
                Cinema Portal
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => handleNav('/browse')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentRoute === '/browse'
                  ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Compass className="w-4 h-4" />
              Discover
            </button>
            <button
              onClick={() => handleNav('/movies')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentRoute === '/movies'
                  ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Film className="w-4 h-4" />
              Movies
            </button>
            <button
              onClick={() => handleNav('/tv')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentRoute === '/tv'
                  ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className="w-4 h-4" />
              TV Series
            </button>
          </nav>
        </div>

        {/* Right Controls: Search, Watchlist, User Profile, Admin Console */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Input Bar */}
          <div className="relative flex items-center">
            {searchOpen ? (
              <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-200">
                <Search className="w-4 h-4 text-cyan-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search movies, actors, directors..."
                  value={activeSearchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  autoFocus
                  className="w-48 sm:w-72 pl-9 pr-8 py-1.5 bg-slate-900/90 border border-cyan-500/40 rounded-full text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-lg shadow-cyan-950/50"
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    onSearchChange?.('');
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-slate-400 hover:text-cyan-300 rounded-full hover:bg-white/5 transition-colors"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Authenticated User Controls */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('/profile')}
                className="p-2 text-slate-400 hover:text-cyan-300 rounded-full hover:bg-white/5 transition-colors hidden sm:flex"
                title="My Watchlist"
              >
                <Bookmark className="w-4 h-4" />
              </button>

              {/* Dynamic Admin Badge if User is Administrator */}
              {isAdmin && (
                <button
                  onClick={() => handleNav('/admin/dashboard')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 rounded-full hover:bg-cyan-900/60 transition-all shadow-sm shadow-cyan-500/20"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  Admin Console
                </button>
              )}

              {/* Profile Avatar & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-full border border-white/10 hover:border-cyan-500/50 transition-all focus:outline-none"
                >
                  <img
                    src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.name || 'User'}`}
                    alt={user?.name}
                    className="w-7 h-7 rounded-full object-cover bg-slate-800"
                  />
                  <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in duration-150">
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                      <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                        {user?.role}
                      </span>
                    </div>

                    <button
                      onClick={() => handleNav('/profile')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2"
                    >
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      Profile & Watch History
                    </button>

                    <button
                      onClick={() => handleNav('/profile?tab=watchlist')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                      Watchlist & Favorites
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleNav('/admin/dashboard')}
                        className="w-full text-left px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-950/60 rounded-lg flex items-center gap-2 border border-cyan-500/20 my-1 font-medium"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                        Admin Dashboard
                      </button>
                    )}

                    <div className="border-t border-white/10 my-1"></div>

                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                        handleNav('/login');
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('/login')}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => handleNav('/signup')}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 rounded-full shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Join FunclubSI
              </button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-6 bg-[#0a0d18] border-b border-white/10 space-y-2 animate-in slide-in-from-top-4 duration-200">
          <button
            onClick={() => handleNav('/browse')}
            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5 rounded-lg"
          >
            Discover Catalog
          </button>
          <button
            onClick={() => handleNav('/movies')}
            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5 rounded-lg"
          >
            Movies
          </button>
          <button
            onClick={() => handleNav('/tv')}
            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5 rounded-lg"
          >
            TV Series
          </button>
          {isAdmin && (
            <button
              onClick={() => handleNav('/admin/dashboard')}
              className="w-full text-left px-3 py-2 text-sm text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 rounded-lg flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Admin Dashboard
            </button>
          )}
          {!isAuthenticated && (
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => handleNav('/login')}
                className="w-full py-2 text-center text-sm font-medium text-slate-300 border border-white/10 rounded-lg"
              >
                Sign In
              </button>
              <button
                onClick={() => handleNav('/admin/login')}
                className="w-full py-2 text-center text-xs font-medium text-cyan-400/80 hover:text-cyan-300"
              >
                Admin Gateway
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
