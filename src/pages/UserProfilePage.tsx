import React, { useState, useEffect } from 'react';
import {
  User,
  Bookmark,
  Heart,
  Clock,
  Settings,
  LogOut,
  Shield,
  Check,
  AlertCircle,
  Play,
  Film
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Movie, WatchProgress } from '../types';
import { api } from '../services/api';
import { MovieCard } from '../components/MovieCard';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

interface UserProfilePageProps {
  onNavigate: (route: string) => void;
  initialTab?: string;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ onNavigate, initialTab = 'watchlist' }) => {
  const { user, logout, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'watchlist' | 'favorites' | 'history' | 'settings'>(
    (initialTab as any) || 'watchlist'
  );

  const [watchlist, setWatchlist] = useState<Movie[]>([]);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Settings form states
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Video modal
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [playerStartTime, setPlayerStartTime] = useState(0);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab]);

  const loadData = async () => {
    setLoadingLists(true);
    try {
      if (activeTab === 'watchlist') {
        const res = await api.movies.getWatchlist();
        setWatchlist(res.watchlist);
      } else if (activeTab === 'favorites') {
        const res = await api.movies.getFavorites();
        setFavorites(res.favorites);
      } else if (activeTab === 'history') {
        const res = await api.movies.getProgress();
        setHistory(res.continueWatching);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const payload: any = { name };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const res = await api.auth.updateProfile(payload);
      updateUser(res.user);
      setSettingsSuccess('Profile settings successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-400 text-xs mb-4">Please log in to view your profile.</p>
        <button
          onClick={() => onNavigate('/login')}
          className="px-5 py-2 text-xs font-semibold bg-cyan-500 text-slate-950 rounded-full"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Profile Header Banner */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <img
          src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`}
          alt={user.name}
          className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/20"
        />

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white font-heading">{user.name}</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-slate-400">{user.email}</p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
              Watchlist
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              Favorites
            </span>
          </div>
        </div>

        <button
          onClick={async () => {
            await logout();
            onNavigate('/login');
          }}
          className="px-4 py-2 text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-950/40 border border-rose-500/20 rounded-xl transition-colors flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar text-xs">
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`px-4 py-2 rounded-xl transition-all font-semibold flex items-center gap-2 ${
            activeTab === 'watchlist'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          My Watchlist
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`px-4 py-2 rounded-xl transition-all font-semibold flex items-center gap-2 ${
            activeTab === 'favorites'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
          Favorites
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl transition-all font-semibold flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          Watch History & Resume
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl transition-all font-semibold flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-white/10 text-white border border-white/20 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          Account Settings
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'watchlist' && (
        <section>
          {loadingLists ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading Watchlist...</div>
          ) : watchlist.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Bookmark className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              Your watchlist is currently empty. Browse titles and click "+" to add them.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchlist.map((m) => (
                <MovieCard
                  key={m.id}
                  movie={m}
                  initialWatchlisted={true}
                  onSelect={(item) => onNavigate(`/movie/${item.slug || item.id}`)}
                  onPlay={(item) => {
                    setPlayerStartTime(0);
                    setPlayingMovie(item);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'favorites' && (
        <section>
          {loadingLists ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading Favorites...</div>
          ) : favorites.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Heart className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No favorites saved yet. Heart any title on its detail page to view it here.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {favorites.map((m) => (
                <MovieCard
                  key={m.id}
                  movie={m}
                  onSelect={(item) => onNavigate(`/movie/${item.slug || item.id}`)}
                  onPlay={(item) => {
                    setPlayerStartTime(0);
                    setPlayingMovie(item);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section>
          {loadingLists ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading Watch History...</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No playback history recorded yet. Start watching a title to track your progress!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => {
                if (!item.movie) return null;
                const percent = Math.min(100, Math.round((item.currentTime / item.duration) * 100));

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-white/10 flex gap-4 items-center group"
                  >
                    <div className="relative aspect-video w-28 shrink-0 rounded-xl overflow-hidden bg-slate-950">
                      <img
                        src={item.movie.backdropUrl || item.movie.posterUrl}
                        alt={item.movie.title}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          setPlayerStartTime(item.currentTime);
                          setPlayingMovie(item.movie!);
                        }}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="w-5 h-5 fill-cyan-400 text-cyan-400" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate font-heading">
                        {item.movie.title}
                      </h4>
                      <div className="w-full h-1.5 bg-white/10 rounded-full my-2 overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {percent}% finished ({Math.floor(item.currentTime / 60)}m / {Math.floor(item.duration / 60)}m)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="max-w-xl">
          <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900/50 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white font-heading">Edit Profile & Credentials</h3>

            {settingsSuccess && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {settingsError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white"
              />
            </div>

            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="text-xs font-semibold text-white mb-2">Change Password (optional)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </section>
      )}

      {/* Video Player Modal */}
      {playingMovie && (
        <VideoPlayerModal
          movie={playingMovie}
          initialTime={playerStartTime}
          onClose={() => setPlayingMovie(null)}
        />
      )}
    </div>
  );
};
