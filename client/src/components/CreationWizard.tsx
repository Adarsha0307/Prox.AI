import React, { useState, useRef } from 'react';
import { useWizardStore } from '../store/wizardStore';
import { useEditorStore } from '../store/editorStore';
import { useAuthStore } from '../store/authStore';
import { apiRequest } from '../utils/api';
import { templates } from '../utils/templates';
import { Wand2, X, Upload, Link as LinkIcon, Plus, Trash2, GripVertical, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const CreationWizard: React.FC = () => {
  const wizard = useWizardStore();
  const token = useAuthStore((state) => state.token);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Drag and drop for outline
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  if (!wizard.isOpen) return null;

  const handleClose = () => {
    wizard.setOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) return setError('You must be signed in to extract documents.');

    setIsExtracting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest<{ text: string; filename: string }>('/api/extract/document', {
        method: 'POST',
        token,
        body: formData,
      });
      if (!res.ok) throw new Error(res.error.message || 'Failed to extract document');
      wizard.updateDraft({ sourceText: res.data.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction error');
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlExtract = async () => {
    if (!urlInput.trim()) return;
    if (!token) return setError('You must be signed in to extract URLs.');

    setIsExtracting(true);
    setError(null);

    try {
      const result = await apiRequest<{ text: string }>('/api/extract/url', {
        method: 'POST',
        token,
        body: { url: urlInput }
      });
      if (!result.ok) throw new Error((result as any).error.message || 'Failed to extract URL');
      wizard.updateDraft({ sourceText: result.data.text });
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction error');
    } finally {
      setIsExtracting(false);
    }
  };

  const generateOutline = async () => {
    if (!token) return setError('You must be signed in to generate content.');
    if (!wizard.topic && !wizard.sourceText) return setError('Provide a topic or source text.');

    wizard.updateDraft({ step: 'generating' });
    setError(null);

    try {
      const result = await apiRequest<{ slides: any[] }>('/api/generate/outline', {
        method: 'POST',
        token,
        body: {
          topic: wizard.topic,
          sourceText: wizard.sourceText,
          researchMode: 'general',
        }
      });

      if (!result.ok) throw new Error((result as any).error.message || 'Failed to generate outline');
      
      const slidesWithIds = result.data.slides.map(s => ({ ...s, id: uuidv4() }));
      wizard.updateDraft({ outline: slidesWithIds, step: 'outline' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation error');
      wizard.updateDraft({ step: 'config' });
    }
  };

  const approveOutline = () => {
    if (!wizard.outline) return;
    const editor = useEditorStore.getState();
    editor.initProject();
    editor.appendGeneratedOutline(wizard.outline, wizard.themeFamily);
    wizard.resetWizard();
  };

  const handleOutlineChange = (id: string, field: 'heading' | 'body', value: string) => {
    if (!wizard.outline) return;
    const next = wizard.outline.map(s => {
      if (s.id === id) {
        return { ...s, content: { ...s.content, [field]: value } };
      }
      return s;
    });
    wizard.updateDraft({ outline: next });
  };

  const addOutlineSlide = () => {
    if (!wizard.outline) return;
    wizard.updateDraft({
      outline: [...wizard.outline, { id: uuidv4(), layout: 'explanation', content: { heading: 'New Slide', body: '' } }]
    });
  };

  const deleteOutlineSlide = (id: string) => {
    if (!wizard.outline) return;
    wizard.updateDraft({
      outline: wizard.outline.filter(s => s.id !== id)
    });
  };

  const handleDrop = (dropIndex: number) => {
    if (!wizard.outline || dragIndex === null || dragIndex === dropIndex) return;
    const next = [...wizard.outline];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    wizard.updateDraft({ outline: next });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-900/90 flex items-center justify-center backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-neutral-800 w-full max-w-5xl h-full max-h-[85vh] rounded-xl shadow-2xl flex flex-col border border-neutral-700 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-neutral-700 bg-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Wand2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create Carousel with AI</h2>
              <p className="text-sm text-neutral-400">Step {wizard.step === 'config' ? '1: Configure' : wizard.step === 'generating' ? '2: Generating' : '3: Review & Edit Outline'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border-l-4 border-red-500 p-4 shrink-0">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {wizard.step === 'config' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Content */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Topic or Prompt</label>
                  <textarea
                    value={wizard.topic}
                    onChange={(e) => wizard.updateDraft({ topic: e.target.value })}
                    className="w-full h-24 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    placeholder="E.g., 5 ways to improve React performance..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Source Material (Optional)</label>
                  <div className="space-y-3">
                    <textarea
                      value={wizard.sourceText}
                      onChange={(e) => wizard.updateDraft({ sourceText: e.target.value })}
                      className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                      placeholder="Paste blog post, notes, or article text here..."
                    />
                    
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".txt,.pdf,.docx"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isExtracting}
                        className="flex-1 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-sm transition-colors"
                      >
                        <Upload size={16} /> Document (.pdf, .docx)
                      </button>
                      <div className="flex-1 flex bg-neutral-700 rounded overflow-hidden">
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-transparent border-none px-3 text-sm text-white focus:outline-none"
                        />
                        <button
                          onClick={handleUrlExtract}
                          disabled={isExtracting || !urlInput.trim()}
                          className="bg-neutral-600 hover:bg-neutral-500 disabled:opacity-50 text-white px-3 py-2 flex items-center justify-center transition-colors"
                        >
                          <LinkIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Settings */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Platform</label>
                    <select
                      value={wizard.platform}
                      onChange={(e) => wizard.updateDraft({ platform: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option>LinkedIn</option>
                      <option>Instagram</option>
                      <option>Twitter / X</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Number of Cards</label>
                    <select
                      value={wizard.numCards}
                      onChange={(e) => wizard.updateDraft({ numCards: Number(e.target.value) })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={3}>3 slides</option>
                      <option value={5}>5 slides</option>
                      <option value={7}>7 slides</option>
                      <option value={10}>10 slides</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Target Audience</label>
                    <select
                      value={wizard.audience}
                      onChange={(e) => wizard.updateDraft({ audience: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option>Professionals</option>
                      <option>Beginners</option>
                      <option>Founders</option>
                      <option>General Public</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Tone</label>
                    <select
                      value={wizard.tone}
                      onChange={(e) => wizard.updateDraft({ tone: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option>Professional</option>
                      <option>Casual</option>
                      <option>Inspirational</option>
                      <option>Analytical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Visual Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(templates).map((familyId) => (
                      <button
                        key={familyId}
                        onClick={() => wizard.updateDraft({ themeFamily: familyId })}
                        className={`p-3 text-left rounded-lg border transition-all ${
                          wizard.themeFamily === familyId 
                            ? 'bg-emerald-500/20 border-emerald-500 text-white' 
                            : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500'
                        }`}
                      >
                        <div className="font-medium capitalize">{familyId}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {wizard.step === 'generating' && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
              <Loader2 size={48} className="text-emerald-500 animate-spin" />
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Crafting your carousel...</h3>
                <p className="text-neutral-400 max-w-md mx-auto">
                  Prox.AI is analyzing your content, structuring the narrative, and generating the perfect outline.
                </p>
              </div>
            </div>
          )}

          {wizard.step === 'outline' && wizard.outline && (
            <div className="p-6 max-w-4xl mx-auto space-y-4">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Review Outline</h3>
                  <p className="text-sm text-neutral-400">Edit, reorder, or add slides before generating visuals.</p>
                </div>
                <button 
                  onClick={addOutlineSlide}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded flex items-center gap-2 text-sm border border-neutral-700 transition-colors"
                >
                  <Plus size={16} /> Add Slide
                </button>
              </div>

              {wizard.outline.map((slide, index) => {
                const isDragging = dragIndex === index;
                const isDropTarget = dragOverIndex === index;
                
                return (
                  <div 
                    key={slide.id}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(index);
                    }}
                    className={`bg-neutral-900 border rounded-lg p-4 flex gap-4 transition-all ${
                      isDragging ? 'opacity-50' : ''
                    } ${isDropTarget ? 'border-emerald-500 scale-[1.01]' : 'border-neutral-700'}`}
                  >
                    <div className="flex flex-col items-center justify-center cursor-grab text-neutral-500 hover:text-neutral-300 shrink-0">
                      <GripVertical size={20} />
                      <span className="text-xs font-medium mt-2">{index + 1}</span>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <select
                          value={slide.layout}
                          onChange={(e) => {
                            const next = [...wizard.outline!];
                            next[index].layout = e.target.value;
                            wizard.updateDraft({ outline: next });
                          }}
                          className="bg-neutral-800 text-xs text-neutral-300 rounded px-2 py-1 border border-neutral-700 focus:outline-none"
                        >
                          <option value="cover">Cover</option>
                          <option value="explanation">Explanation</option>
                          <option value="closing">Closing</option>
                        </select>
                        
                        <input
                          type="text"
                          value={slide.content.heading}
                          onChange={(e) => handleOutlineChange(slide.id, 'heading', e.target.value)}
                          className="flex-1 bg-transparent border-none text-white font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1"
                          placeholder="Slide Title"
                        />
                      </div>
                      
                      <textarea
                        value={slide.content.body}
                        onChange={(e) => handleOutlineChange(slide.id, 'body', e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-neutral-300 min-h-[60px] focus:outline-none focus:border-emerald-500"
                        placeholder="Key message for this slide..."
                      />
                    </div>
                    
                    <button 
                      onClick={() => deleteOutlineSlide(slide.id)}
                      className="text-neutral-500 hover:text-red-400 p-2 transition-colors shrink-0 self-start"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-neutral-700 bg-neutral-800 shrink-0 flex justify-between items-center">
          <div>
            {wizard.step === 'outline' && (
              <button
                onClick={() => wizard.updateDraft({ step: 'config' })}
                className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ChevronLeft size={16} /> Back to Settings
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-neutral-300 hover:text-white font-medium transition-colors"
            >
              Cancel
            </button>
            
            {wizard.step === 'config' ? (
              <button
                onClick={generateOutline}
                disabled={isExtracting}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Generate Outline <ChevronRight size={18} />
              </button>
            ) : wizard.step === 'outline' ? (
              <button
                onClick={approveOutline}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Approve & Build Carousel <Wand2 size={18} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
