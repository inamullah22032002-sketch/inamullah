import React, { useState } from 'react';
import {
  LayoutDashboard,
  Film,
  Tv,
  Upload,
  Globe,
  HardDrive,
  Users,
  Activity,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Lock,
  Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminOverviewView } from './AdminOverviewView';
import { AdminMoviesView } from './AdminMoviesView';
import { AdminUploadView } from './AdminUploadView';
import { AdminImportView } from './AdminImportView';
import { AdminStorageView } from './AdminStorageView';
import { AdminAuditView } from './AdminAuditView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminSettingsView } from './AdminSettingsView';
import { Movie } from '../../types';

interface AdminDashboardLayoutProps {
  onNavigate: (route: string) => void;
  initialTab?: string;
  onPreviewMovie?: (movie: Movie) => void;
}

export const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({
  onNavigate,
  initialTab = 'dashboard',
  onPreviewMovie,
}) => {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Strict role check guard
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-rose-500/40 text-center space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white font-heading">Access Denied</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            You do not possess administrative clearance to access the FunclubSI administrative control plane.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => onNavigate('/admin/login')}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
            >
              Sign In as Administrator
            </button>
            <button
              onClick={() => onNavigate('/browse')}
              className="w-full py-2 text-xs text-slate-400 hover:text-white"
            >
              Return to Public Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'movies', label: 'Movies & TV', icon: Film },
    { id: 'upload', label: 'Video Upload (R2)', icon: Upload, highlight: true },
    { id: 'import', label: 'Import From URL', icon: Globe },
    { id: 'storage', label: 'Storage Manager', icon: HardDrive },
    { id: 'audit', label: 'Security & Audit Logs', icon: ShieldAlert },
    { id: 'analytics', label: 'Real-Time Health', icon: Activity },
    { id: 'users', label: 'User Governance', icon: Users },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#07080d] -mx-4 sm:-mx-6 lg:-mx-8 -my-6 sm:-my-8">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
        ></div>
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0a0d18] border-r border-white/10 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-cyan-500/30">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-white font-heading block">
                Funclub<span className="text-cyan-400">SI</span>
              </span>
              <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-mono -mt-1 block">
                Control Plane
              </span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;

            return (
              <button
                key={link.id}
                onClick={() => {
                  setActiveTab(link.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : link.highlight
                    ? 'text-cyan-400 hover:bg-cyan-950/40 hover:text-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer with Return & Logout */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            onClick={() => onNavigate('/browse')}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Discovery
          </button>
          <button
            onClick={async () => {
              await logout();
              onNavigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Admin View Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-4 sm:px-8 border-b border-white/10 bg-[#07080d]/80 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400 uppercase font-mono tracking-wider">
              Admin / {activeTab}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Admin: <strong className="text-white">{user.name}</strong>
            </span>
          </div>
        </header>

        {/* Render Active View */}
        <main className="p-4 sm:p-8 flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <AdminOverviewView onNavigateTab={(t) => setActiveTab(t)} />
          )}
          {activeTab === 'movies' && (
            <AdminMoviesView
              onNavigateTab={(t) => setActiveTab(t)}
              onPreviewMovie={(m) => onPreviewMovie ? onPreviewMovie(m) : onNavigate(`/movie/${m.slug || m.id}`)}
            />
          )}
          {activeTab === 'upload' && (
            <AdminUploadView onSuccess={() => setActiveTab('movies')} />
          )}
          {activeTab === 'import' && (
            <AdminImportView onSuccess={() => setActiveTab('movies')} />
          )}
          {activeTab === 'storage' && <AdminStorageView />}
          {activeTab === 'audit' && <AdminAuditView />}
          {activeTab === 'analytics' && <AdminAnalyticsView />}
          {activeTab === 'users' && <AdminUsersView />}
          {activeTab === 'settings' && <AdminSettingsView />}
        </main>
      </div>
    </div>
  );
};
