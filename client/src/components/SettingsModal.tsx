import React from 'react';
import { X, Key, Info } from 'lucide-react';
import { useCredentialStore } from '../store/credentialStore';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { openaiKey, anthropicKey, setOpenAiKey, setAnthropicKey } = useCredentialStore();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={18} /> API Settings (BYOK)
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex gap-3 mb-6">
            <Info className="text-blue-400 shrink-0 mt-0.5" size={16} />
            <div className="text-xs text-blue-200/80 space-y-1">
              <p><strong>Security Notice:</strong> Your keys are stored <em>only in memory</em> and will be cleared when you refresh the page or log out.</p>
              <p>Keys are passed transiently to our server to proxy your requests to the provider and are never saved to our database or your project files.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">OpenAI API Key</label>
              <input
                type="password"
                value={openaiKey || ''}
                onChange={(e) => setOpenAiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded p-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={anthropicKey || ''}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded p-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
