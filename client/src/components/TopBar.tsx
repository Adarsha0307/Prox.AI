import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useAuthStore, type AuthUser } from '../store/authStore';
import { apiRequest } from '../utils/api';
import { Undo, Redo, User, LogOut, Cloud } from 'lucide-react';
import { ExportDialog } from './ExportDialog';
import { AuthModal } from './AuthModal';
import { CloudProjectsModal } from './CloudProjectsModal';

export const TopBar: React.FC = () => {
  const { project, undo, redo, historyIndex, history, cloudState, cloudSyncedAt } = useEditorStore();
  const { user, token, logout, setUser } = useAuthStore();
  const [showExport, setShowExport] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showCloudProjects, setShowCloudProjects] = useState(false);

  // Auto-login if a stored token is still valid
  useEffect(() => {
    if (token && !user) {
      void apiRequest<{ user: AuthUser }>('/auth/me', { token }).then((result) => {
        if (result.ok) setUser(result.data.user);
        else logout();
      });
    }
  }, [token, user, setUser, logout]);

  if (!project) return null;

  return (
    <div className="h-14 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-white font-bold text-lg">Prox.</h1>
        <div className="w-px h-6 bg-neutral-800" />
        <span className="text-neutral-300 font-medium">{project.title}</span>
        
        {/* Sync Status */}
        {user && (
          <div className="ml-4 flex items-center gap-2 text-xs text-neutral-400">
            <Cloud size={14} className={cloudState === 'syncing' ? "text-emerald-500 animate-pulse" : "text-neutral-500"} />
            {cloudState === 'syncing'
              ? 'Syncing...'
              : cloudState === 'synced' && cloudSyncedAt
                ? 'Saved to cloud'
                : cloudState === 'conflict'
                  ? 'Conflict detected'
                  : 'Offline'}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-neutral-800 rounded p-1">
          <button 
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-50 disabled:hover:text-neutral-400 rounded transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>
          <button 
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-50 disabled:hover:text-neutral-400 rounded transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-neutral-800 mx-1" />

        <button 
          onClick={() => setShowExport(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
        >
          Export...
        </button>

        {user ? (
          <div className="relative group ml-2">
            <button className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded text-sm font-medium border border-neutral-700 transition-colors">
              <User size={16} />
              {user.name.split(' ')[0]}
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-neutral-700 bg-neutral-800">
                <div className="text-sm font-medium text-white">{user.name}</div>
                <div className="text-xs text-neutral-400 truncate">{user.email}</div>
              </div>
              <button 
                onClick={() => setShowCloudProjects(true)}
                className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 flex items-center gap-2 transition-colors border-b border-neutral-700"
              >
                <Cloud size={14} />
                Cloud Projects
              </button>
              <button 
                onClick={logout}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 flex items-center gap-2 transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowAuth(true)}
            className="ml-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-1.5 rounded text-sm font-medium border border-neutral-700 transition-colors"
          >
            Sign In
          </button>
        )}
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showCloudProjects && <CloudProjectsModal onClose={() => setShowCloudProjects(false)} />}
    </div>
  );
};
