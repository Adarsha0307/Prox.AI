import React, { useState } from 'react';
import { Type, LayoutTemplate, Image, Square, Palette, Wand2 } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { templates } from '../utils/templates';
import { AIPanel } from './AIPanel';
import { ImagePanel } from './ImagePanel';
import { ThemePanel } from './ThemePanel';
import { useLayoutStore } from '../store/layoutStore';

export const LeftPanel: React.FC = () => {
  const { addElement, applyTemplateToSlide } = useEditorStore();
  const { customLayouts, deleteLayout } = useLayoutStore();
  const [activeTab, setActiveTab] = useState<'text' | 'templates' | 'assets' | 'shapes' | 'brand' | 'ai'>('templates');
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
        <button onClick={() => setActiveTab('ai')} className={`p-3 rounded-xl transition-colors ${activeTab === 'ai' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>
          <Wand2 size={20} />
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
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded text-sm transition-colors shadow-lg mb-2"
              >
                ✨ Suggest Alternative Layout
              </button>
              
              <button
                onClick={() => {
                  const state = useEditorStore.getState();
                  const activeSlide = state.project?.slides.find(s => s.id === state.activeSlideId);
                  if (activeSlide) {
                    const name = prompt('Enter a name for this custom layout:');
                    if (name) {
                      useLayoutStore.getState().saveLayout(name, activeSlide);
                    }
                  }
                }}
                className="w-full bg-neutral-700 hover:bg-neutral-600 text-white p-3 rounded text-sm transition-colors"
              >
                Save Current Slide as Layout
              </button>
            </div>
            
            {customLayouts.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-800">
                <label className="text-xs text-neutral-500 mb-2 block">My Custom Layouts</label>
                <div className="space-y-2">
                  {customLayouts.map(layout => (
                    <div key={layout.id} className="flex gap-2">
                      <button 
                        onClick={() => {
                          const layoutCopy = JSON.parse(JSON.stringify(layout.slide));
                          // Regenerate IDs to ensure element independence
                          layoutCopy.elements = layoutCopy.elements.map((el: any) => ({ ...el, id: crypto.randomUUID() }));
                          applyTemplateToSlide(layoutCopy);
                        }}
                        className="flex-1 text-left bg-neutral-800 p-3 rounded hover:bg-neutral-700 transition-colors text-sm border border-transparent hover:border-neutral-600 truncate"
                        title={layout.name}
                      >
                        {layout.name}
                      </button>
                      <button 
                        onClick={() => deleteLayout(layout.id)}
                        className="bg-neutral-800 p-3 rounded hover:bg-red-500/20 hover:text-red-400 text-neutral-500 transition-colors"
                        title="Delete Layout"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-xs text-neutral-500 mt-6 italic leading-relaxed">
              Warning: Applying a template will overwrite the current slide's content. Use Undo (Ctrl+Z) if you make a mistake.
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
          <ImagePanel />
        )}
        
        {activeTab === 'shapes' && (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Shapes</h2>
            <div className="space-y-2">
              <button
                onClick={() => addElement({
                  id: crypto.randomUUID(),
                  type: 'rectangle',
                  role: 'body',
                  left: 100,
                  top: 100,
                  width: 300,
                  height: 200,
                  rotation: 0,
                  opacity: 1,
                  locked: false,
                  fill: '#4ade80',
                  stroke: '#000000',
                  strokeWidth: 0,
                  rx: 0,
                  ry: 0,
                })}
                className="w-full flex items-center gap-3 bg-neutral-800 p-3 rounded hover:bg-neutral-700 transition-colors text-sm border border-transparent hover:border-neutral-600"
              >
                <span className="w-5 h-4 bg-emerald-500 rounded-sm shrink-0" />
                Rectangle
              </button>
              <button
                onClick={() => addElement({
                  id: crypto.randomUUID(),
                  type: 'circle',
                  role: 'body',
                  left: 100,
                  top: 100,
                  width: 200,
                  height: 200,
                  rotation: 0,
                  opacity: 1,
                  locked: false,
                  fill: '#60a5fa',
                  stroke: '#000000',
                  strokeWidth: 0,
                })}
                className="w-full flex items-center gap-3 bg-neutral-800 p-3 rounded hover:bg-neutral-700 transition-colors text-sm border border-transparent hover:border-neutral-600"
              >
                <span className="w-5 h-5 bg-blue-400 rounded-full shrink-0" />
                Circle
              </button>
              <button
                onClick={() => addElement({
                  id: crypto.randomUUID(),
                  type: 'line',
                  role: 'body',
                  left: 100,
                  top: 300,
                  width: 400,
                  height: 4,
                  rotation: 0,
                  opacity: 1,
                  locked: false,
                  fill: '#ffffff',
                  stroke: '#ffffff',
                  strokeWidth: 3,
                })}
                className="w-full flex items-center gap-3 bg-neutral-800 p-3 rounded hover:bg-neutral-700 transition-colors text-sm border border-transparent hover:border-neutral-600"
              >
                <span className="w-5 h-0.5 bg-white shrink-0" />
                Line
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-4 italic leading-relaxed">
              Click any shape to add it to the current slide. Use the right panel to change fill, stroke, and dimensions.
            </p>
          </div>
        )}
        
        {activeTab === 'brand' && (
          <ThemePanel />
        )}
        
        {activeTab === 'ai' && (
          <AIPanel selectedFamily={selectedFamily} />
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
