import React from 'react';
import { useEditorStore } from '../store/editorStore';

export const RightPanel: React.FC = () => {
  const { project, activeSlideId, activeElementIds, updateElement } = useEditorStore();
  
  const hasSelection = activeElementIds.length > 0;
  
  const activeSlide = project?.slides.find(s => s.id === activeSlideId);
  const selectedElements = activeSlide?.elements.filter(el => activeElementIds.includes(el.id)) || [];
  const primaryElement = selectedElements[0];

  const handleUpdate = (updates: any) => {
    activeElementIds.forEach(id => {
      updateElement(id, updates);
    });
  };

  return (
    <div className="w-64 border-l border-neutral-800 bg-neutral-900 flex flex-col shrink-0 hidden lg:flex">
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Properties</h2>
      </div>
      
      <div className="p-4 overflow-y-auto">
        {!hasSelection || !primaryElement ? (
          <div className="text-sm text-neutral-500">
            Select an element to edit its properties.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-neutral-500 mb-4 pb-2 border-b border-neutral-800">
              {activeElementIds.length} element(s) selected
            </div>
            
            {primaryElement.type === 'text' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Font Size (Min: 24)</label>
                  <input 
                    type="number" 
                    min="24" 
                    max="200" 
                    value={(primaryElement as any).fontSize || 60} 
                    onChange={(e) => handleUpdate({ fontSize: Math.max(24, parseInt(e.target.value) || 24) })} 
                    className="w-full bg-neutral-800 text-white p-1.5 rounded text-sm outline-none border border-neutral-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Typography</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleUpdate({ textAlign: 'left' })} className="bg-neutral-800 p-1.5 rounded hover:bg-neutral-700 text-sm">Left</button>
                    <button onClick={() => handleUpdate({ textAlign: 'center' })} className="bg-neutral-800 p-1.5 rounded hover:bg-neutral-700 text-sm">Center</button>
                    <button onClick={() => handleUpdate({ textAlign: 'right' })} className="bg-neutral-800 p-1.5 rounded hover:bg-neutral-700 text-sm">Right</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Line Height</label>
                  <input type="range" min="0.5" max="2.5" step="0.1" value={(primaryElement as any).lineHeight || 1.2} onChange={(e) => handleUpdate({ lineHeight: parseFloat(e.target.value) })} className="w-full" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Letter Spacing</label>
                  <input type="range" min="-100" max="500" step="10" value={(primaryElement as any).charSpacing || 0} onChange={(e) => handleUpdate({ charSpacing: parseFloat(e.target.value) })} className="w-full" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Color</label>
              <div className="flex gap-2">
                <div onClick={() => handleUpdate({ fill: '#ffffff' })} className="w-8 h-8 rounded-full bg-white border border-neutral-600 cursor-pointer"></div>
                <div onClick={() => handleUpdate({ fill: '#000000' })} className="w-8 h-8 rounded-full bg-black border border-neutral-600 cursor-pointer"></div>
                <div onClick={() => handleUpdate({ fill: '#10b981' })} className="w-8 h-8 rounded-full bg-emerald-500 border border-neutral-600 cursor-pointer"></div>
              </div>
            </div>

            <div className="space-y-2 border-t border-neutral-800 pt-4 mt-4">
              <button onClick={() => handleUpdate({ locked: !primaryElement.locked })} className="w-full bg-neutral-800 p-1.5 rounded hover:bg-neutral-700 text-sm flex items-center justify-center gap-2">
                {primaryElement.locked ? 'Unlock Element' : 'Lock Element'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
