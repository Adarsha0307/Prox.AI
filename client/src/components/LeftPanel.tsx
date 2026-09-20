import React, { useState } from 'react';
import { Type, LayoutTemplate, Image, Square, Palette } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { templates } from '../utils/templates';

export const LeftPanel: React.FC = () => {
  const { project, addElement, applyTemplateToSlide } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'text' | 'templates' | 'assets' | 'shapes' | 'brand'>('templates');
  const [selectedFamily, setSelectedFamily] = useState<keyof typeof templates>('minimal');

  const handleAddText = () => {
    addElement({
      id: crypto.randomUUID(),
      type: 'text',
      role: 'body',
      text: 'Double click to edit',
      left: 100,
      top: 100,
      width: 400,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      fontFamily: 'Inter',
      fontSize: 60,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      fill: '#000000',
      lineHeight: 1.2,
      charSpacing: 0
    });
  };

  const handleApplyTemplate = (layoutKey: keyof typeof templates['minimal']) => {
    if (layoutKey === 'name') return;
    const templateFn = templates[selectedFamily][layoutKey] as () => any;
    if (templateFn) {
      applyTemplateToSlide(templateFn());
    }
  };

  return (
    <div className="w-16 lg:w-64 border-r border-neutral-800 bg-neutral-900 flex shrink-0 transition-all duration-300 relative z-20">
      <div className="w-16 border-r border-neutral-800 flex flex-col items-center py-4 gap-4 bg-neutral-950">
        <button onClick={() => setActiveTab('templates')} className={`p-3 rounded-xl transition-colors ${activeTab === 'templates' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
          <LayoutTemplate size={20} />
        </button>
        <button onClick={() => setActiveTab('text')} className={`p-3 rounded-xl transition-colors ${activeTab === 'text' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
          <Type size={20} />
        </button>
        <button onClick={() => setActiveTab('assets')} className={`p-3 rounded-xl transition-colors ${activeTab === 'assets' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
          <Image size={20} />
        </button>
        <button onClick={() => setActiveTab('shapes')} className={`p-3 rounded-xl transition-colors ${activeTab === 'shapes' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
          <Square size={20} />
        </button>
        <button onClick={() => setActiveTab('brand')} className={`p-3 rounded-xl transition-colors ${activeTab === 'brand' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
          <Palette size={20} />
        </button>
      </div>

      <div className="flex-1 hidden lg:flex flex-col overflow-y-auto">
        {activeTab === 'templates' && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Templates</h2>
            
            <div className="mb-4">
              <label className="text-xs text-neutral-500 mb-1 block">Family</label>
              <select 
                value={selectedFamily} 
                onChange={(e) => setSelectedFamily(e.target.value as keyof typeof templates)}
                className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none"
              >
                {Object.entries(templates).map(([key, family]) => (
                  <option key={key} value={key}>{family.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-500 mb-1 block">Layouts</label>
              {(['cover', 'explanation', 'list', 'quote', 'closing'] as const).map(layout => (
                <button 
                  key={layout}
                  onClick={() => handleApplyTemplate(layout)}
                  className="w-full text-left bg-neutral-800 p-3 rounded hover:bg-neutral-700 transition-colors text-sm border border-transparent hover:border-neutral-600 capitalize"
                >
                  {layout} Slide
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-800">
              <button 
                onClick={() => {
                  const families = Object.keys(templates) as Array<keyof typeof templates>;
                  const randomFamily = families[Math.floor(Math.random() * families.length)];
                  const layouts = ['cover', 'explanation', 'list', 'quote', 'closing'] as const;
                  const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
                  const templateFn = templates[randomFamily][randomLayout] as () => any;
                  applyTemplateToSlide(templateFn());
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded text-sm transition-colors shadow-lg"
              >
                ✨ Suggest Alternative Layout
              </button>
            </div>
            
            <p className="text-xs text-neutral-500 mt-4 italic">
              Warning: Applying a template will overwrite the current slide's content.
            </p>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Text</h2>
            <button onClick={handleAddText} className="w-full bg-neutral-800 p-3 rounded hover:bg-neutral-700 transition-colors text-left text-sm border border-transparent hover:border-neutral-600">
              Add a text box
            </button>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="p-4 text-sm text-neutral-500">Asset library coming soon.</div>
        )}
        
        {activeTab === 'shapes' && (
          <div className="p-4 text-sm text-neutral-500">Shapes coming soon.</div>
        )}
        
        {activeTab === 'brand' && (
          <div className="p-4 flex-1">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Brand Kit</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Primary Color</label>
                <input 
                  type="color" 
                  value={project?.theme.colors.primary || '#000000'} 
                  onChange={(e) => useEditorStore.getState().updateTheme({ colors: { ...project!.theme.colors, primary: e.target.value } })}
                  className="w-full h-8 cursor-pointer rounded"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Social Handle</label>
                <input 
                  type="text" 
                  placeholder="@yourhandle"
                  value={project?.theme.brand?.handle || ''}
                  onChange={(e) => useEditorStore.getState().updateTheme({ brand: { ...project!.theme.brand, handle: e.target.value } })}
                  className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Brand Voice (AI System Prompt)</label>
                <textarea 
                  placeholder="e.g. Professional but witty..."
                  value={project?.theme.brand?.voice || ''}
                  onChange={(e) => useEditorStore.getState().updateTheme({ brand: { ...project!.theme.brand, voice: e.target.value } })}
                  className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none h-24 resize-none"
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-auto p-4 border-t border-neutral-800 text-center">
          <p className="text-[10px] text-neutral-600">
            Copyright &copy; 2026 Adarsha B U.<br />All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};
