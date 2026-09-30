import React, { useState, useRef } from 'react';
import { Wand2, Upload, Link as LinkIcon, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useAuthStore } from '../store/authStore';
import { useCredentialStore } from '../store/credentialStore';
import { templates } from '../utils/templates';
import { apiRequest } from '../utils/api';

type ResearchMode = 'general' | 'source_only' | 'web_research';
type Step = 'input' | 'preview';

interface AIPanelProps {
  selectedFamily: keyof typeof templates;
}

export const AIPanel: React.FC<AIPanelProps> = ({ selectedFamily }) => {
  const [step, setStep] = useState<Step>('input');
  const [topic, setTopic] = useState('');
  const [url, setUrl] = useState('');
  const [researchMode, setResearchMode] = useState<ResearchMode>('general');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [extractedText, setExtractedText] = useState('');
  const [sourceName, setSourceName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((state) => state.token);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  // Web research is not implemented server-side (it returns 501); only expose
  // the option when a provider key is present so the UI never advertises a
  // mode the API cannot honour (D-11).
  const { openaiKey, anthropicKey } = useCredentialStore();
  const webResearchAvailable = Boolean(openaiKey || anthropicKey);

  const resetFlow = () => {
    setStep('input');
    setTopic('');
    setUrl('');
    setExtractedText('');
    setSourceName('');
    setResearchMode('general');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) {
      useEditorStore.getState().setStatusMessage('You must be signed in to extract documents.');
      return;
    }

    setIsExtracting(true);
    useEditorStore.getState().setStatusMessage('Extracting document...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest<{ text: string; filename: string }>('/api/extract/document', {
        method: 'POST',
        token,
        body: formData,
      });
      if (!res.ok) throw new Error(res.error.message || 'Failed to extract');

      setExtractedText(res.data.text);
      setSourceName(res.data.filename);
      setStep('preview');
      useEditorStore.getState().setStatusMessage('Document extracted successfully.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown extraction error';
      useEditorStore.getState().setStatusMessage(`Extraction failed: ${msg}`);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlExtract = async () => {
    if (!url.trim()) return;
    if (!token) {
      useEditorStore.getState().setStatusMessage('You must be signed in to extract URLs.');
      return;
    }

    setIsExtracting(true);
    useEditorStore.getState().setStatusMessage('Fetching and extracting URL...');

    try {
      const result = await apiRequest<{ text: string, url: string }>('/api/extract/url', {
        method: 'POST',
        token,
        body: { url }
      });

      if (!result.ok) {
        const err = (result as { ok: false; error: any }).error;
        throw new Error(err.message || 'Failed to extract URL');
      }
      
      setExtractedText(result.data.text);
      setSourceName(result.data.url);
      setStep('preview');
      useEditorStore.getState().setStatusMessage('URL extracted successfully.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown extraction error';
      useEditorStore.getState().setStatusMessage(`Extraction failed: ${msg}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!token) {
      useEditorStore.getState().setStatusMessage('You must be signed in to generate.');
      return;
    }

    setIsGenerating(true);
    useEditorStore.getState().setStatusMessage('Generating AI content...');

    try {
      const result = await apiRequest<{ slides: any[] }>('/api/generate/outline', {
        method: 'POST',
        token,
        body: { 
          topic: step === 'input' ? topic : '', 
          sourceText: extractedText,
          researchMode
        }
      });

      if (!result.ok) {
        const err = (result as { ok: false; error: any }).error;
        if (err.code === 'platform_funding_disabled' || err.status === 402) {
          throw new Error('Platform funding is disabled. Please configure your API key in Settings (BYOK).');
        }
        throw new Error(err.message || 'Failed to generate');
      }
      
      useEditorStore.getState().appendGeneratedOutline(result.data.slides, selectedFamily);
      useEditorStore.getState().setStatusMessage('Generated slides appended to your carousel.');
      void refreshUser();
      resetFlow();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown generation error';
      useEditorStore.getState().setStatusMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (step === 'preview') {
    return (
      <div className="p-4 flex-1 flex flex-col overflow-y-auto">
        <button 
          onClick={() => setStep('input')} 
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 mb-4"
        >
          <ChevronLeft size={14} /> Back to Input
        </button>

        <h2 className="text-sm font-semibold text-neutral-200 mb-2 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" /> Source Extracted
        </h2>
        <p className="text-xs text-neutral-400 mb-4 truncate" title={sourceName}>
          From: {sourceName}
        </p>

        <div className="bg-neutral-900 border border-neutral-700 rounded p-3 mb-4 flex-1 overflow-y-auto max-h-48 text-xs text-neutral-300 whitespace-pre-wrap">
          {extractedText}
        </div>

        <div className="mb-4">
          <label className="text-xs text-neutral-500 mb-1 block">Research Mode</label>
          <select 
            value={researchMode} 
            onChange={(e) => setResearchMode(e.target.value as ResearchMode)}
            className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none"
          >
            <option value="general">General Drafting</option>
            <option value="source_only">Source-Only (Strict)</option>
            <option value="web_research" disabled={!webResearchAvailable}>Web Research (Live Provider Required)</option>
          </select>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-3 rounded text-sm transition-colors shadow-lg font-medium flex justify-center items-center gap-2"
        >
          {isGenerating ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
          ) : (
            'Generate Slides from Source'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex-1 flex flex-col overflow-y-auto">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Wand2 size={16} /> AI Content
      </h2>
      
      <div className="space-y-6">
        {/* Topic Input */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Topic or Text</label>
          <textarea 
            placeholder="e.g. The future of architecture..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none h-24 resize-none mb-2"
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="w-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white p-2 rounded text-xs transition-colors flex justify-center items-center gap-2"
          >
            {isGenerating ? 'Generating...' : 'Generate from Text'}
          </button>
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-neutral-700"></div>
          <span className="flex-shrink-0 mx-2 text-xs text-neutral-500">OR EXTRACT</span>
          <div className="flex-grow border-t border-neutral-700"></div>
        </div>

        {/* URL Input */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Extract from URL</label>
          <div className="flex gap-2">
            <input 
              type="url" 
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none"
            />
            <button 
              onClick={handleUrlExtract}
              disabled={isExtracting || !url.trim()}
              className="bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 p-2 rounded text-white flex justify-center items-center"
              title="Extract URL"
            >
              {isExtracting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LinkIcon size={16} />}
            </button>
          </div>
        </div>

        {/* Document Upload */}
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Upload Document (TXT, PDF, DOCX)</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.pdf,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            className="w-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white p-3 rounded text-sm border border-dashed border-neutral-600 transition-colors flex justify-center items-center gap-2"
          >
            <Upload size={16} /> 
            {isExtracting ? 'Extracting...' : 'Browse Files'}
          </button>
        </div>
      </div>
    </div>
  );
};
