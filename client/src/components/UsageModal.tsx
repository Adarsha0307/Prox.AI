import React, { useEffect, useState } from 'react';
import { X, Activity, Coins } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuthStore } from '../store/authStore';

interface UsageLog {
  id: string;
  operation: string;
  provider: string;
  model: string;
  fundingSource: string;
  status: string;
  platformCreditsCharged: number;
  createdAt: string;
}

export const UsageModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuthStore();

  useEffect(() => {
    async function fetchUsage() {
      if (!token) return;
      const res = await apiRequest<{ usage: UsageLog[] }>('/api/usage', { token });
      if (res.ok) {
        setLogs(res.data.usage);
      }
      setLoading(false);
    }
    void fetchUsage();
  }, [token]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={18} /> Usage & Billing
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-neutral-800 bg-neutral-800/30 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-indigo-500/20 rounded-full text-indigo-400">
            <Coins size={24} />
          </div>
          <div>
            <div className="text-sm text-neutral-400">Current Balance</div>
            <div className="text-2xl font-bold text-white">{user?.credits ?? 0} Credits</div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center text-neutral-500 py-8">Loading usage history...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">No usage history found.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-800/50">
                <tr>
                  <th className="px-4 py-2 rounded-tl">Date</th>
                  <th className="px-4 py-2">Operation</th>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2 text-right rounded-tr">Cost</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                    <td className="px-4 py-3 text-neutral-300">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 text-white capitalize">{log.operation}</td>
                    <td className="px-4 py-3 text-neutral-400">{log.model}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        log.fundingSource === 'byok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {log.fundingSource.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {log.fundingSource === 'byok' ? (
                        <span className="text-neutral-500">-</span>
                      ) : (
                        <span className="text-amber-400">-{log.platformCreditsCharged}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};
