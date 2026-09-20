import React, { useState } from 'react';
import { Download, FileImage, FileText, FileArchive, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { exportAsImages, exportAsPdf, exportAsPptx, exportAsBackup } from '../utils/export';

export const ExportDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const project = useEditorStore(state => state.project);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  if (!project) return null;

  const handleExport = async (type: 'png' | 'jpg' | 'zip' | 'pdf' | 'pptx' | 'backup') => {
    try {
      setIsExporting(true);
      setError('');
      
      switch (type) {
        case 'png':
          await exportAsImages(project, 'png', false);
          break;
        case 'jpg':
          await exportAsImages(project, 'jpeg', false);
          break;
        case 'zip':
          await exportAsImages(project, 'png', true);
          break;
        case 'pdf':
          await exportAsPdf(project);
          break;
        case 'pptx':
          await exportAsPptx(project);
          break;
        case 'backup':
          await exportAsBackup(project);
          break;
      }
      
      // Close on success
      setTimeout(() => onClose(), 500);
    } catch (err: any) {
      setError(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-[400px] overflow-hidden shadow-2xl relative">
        <button 
          onClick={onClose}
          disabled={isExporting}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-xl font-semibold text-white mb-2">Export Project</h2>
          <p className="text-sm text-neutral-400 mb-6">Choose an export format below.</p>

          {error && (
            <div className="bg-red-900/50 text-red-200 text-sm p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button 
              onClick={() => handleExport('png')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors border border-transparent hover:border-neutral-600 disabled:opacity-50"
            >
              <FileImage className="text-blue-400" size={24} />
              <div>
                <div className="text-sm font-medium text-white">PNG Image (Current Slide)</div>
                <div className="text-xs text-neutral-400">High quality image for social media.</div>
              </div>
            </button>

            <button 
              onClick={() => handleExport('zip')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors border border-transparent hover:border-neutral-600 disabled:opacity-50"
            >
              <FileArchive className="text-purple-400" size={24} />
              <div>
                <div className="text-sm font-medium text-white">PNG ZIP Archive</div>
                <div className="text-xs text-neutral-400">All slides exported as a sequential ZIP.</div>
              </div>
            </button>

            <button 
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors border border-transparent hover:border-neutral-600 disabled:opacity-50"
            >
              <FileText className="text-red-400" size={24} />
              <div>
                <div className="text-sm font-medium text-white">PDF Document</div>
                <div className="text-xs text-neutral-400">Rasterized PDF suitable for sharing.</div>
              </div>
            </button>

            <button 
              onClick={() => handleExport('pptx')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors border border-transparent hover:border-neutral-600 disabled:opacity-50"
            >
              <FileText className="text-orange-400" size={24} />
              <div>
                <div className="text-sm font-medium text-white">PowerPoint (.pptx)</div>
                <div className="text-xs text-neutral-400">Editable slides (text & shapes).</div>
              </div>
            </button>

            <button 
              onClick={() => handleExport('backup')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors border border-transparent hover:border-neutral-600 disabled:opacity-50"
            >
              <Download className="text-emerald-400" size={24} />
              <div>
                <div className="text-sm font-medium text-white">Prox Complete Backup</div>
                <div className="text-xs text-neutral-400">A full JSON backup file (.prox) to restore later.</div>
              </div>
            </button>
          </div>
        </div>

        {isExporting && (
          <div className="absolute inset-0 bg-neutral-900/80 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-4"></div>
            <div className="text-emerald-500 font-medium text-sm animate-pulse">Generating Export...</div>
          </div>
        )}
      </div>
    </div>
  );
};
