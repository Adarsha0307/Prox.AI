import React, { useState, useEffect } from 'react';
import { X, Cloud, Clock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useEditorStore } from '../store/editorStore';

const API_URL = 'http://localhost:3001';

export const CloudProjectsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { token } = useAuthStore();
  const { loadProject } = useEditorStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        setProjects(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      }
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  }, [token]);

  const handleLoad = (projectData: any) => {
    loadProject(projectData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Cloud className="text-emerald-500" />
            Cloud Projects
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
          
          {loading ? (
            <div className="text-center py-8 text-neutral-400">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">No cloud projects found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLoad(p.data)}
                  className="bg-neutral-800 hover:bg-neutral-700 p-4 rounded-lg text-left transition-colors border border-transparent hover:border-neutral-600 flex flex-col"
                >
                  <div className="font-medium text-white mb-1 truncate">{p.data.title || 'Untitled Project'}</div>
                  <div className="text-xs text-neutral-400 flex items-center gap-1 mt-auto pt-4">
                    <Clock size={12} />
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
