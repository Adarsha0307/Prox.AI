import React from 'react';
import { useEditorStore } from '../store/editorStore';

export const MobilePropertySheet: React.FC = () => {
  const { project, activeSlideId, activeElementIds, updateElement } = useEditorStore();
  
  const hasSelection = activeElementIds.length > 0;
  if (!hasSelection) return null;

  const activeSlide = project?.slides.find(s => s.id === activeSlideId);
  const selectedElements = activeSlide?.elements.filter(el => activeElementIds.includes(el.id)) || [];
  const primaryElement = selectedElements[0];

  const handleUpdate = (updates: any) => {
    activeElementIds.forEach(id => {
      updateElement(id, updates);
    });
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 z-50 flex flex-col gap-2 max-h-64 overflow-y-auto">
      <div className="text-xs font-semibold text-neutral-400 mb-2">Properties ({activeElementIds.length} selected)</div>
      
      {primaryElement?.type === 'text' && (
        <div className="flex gap-2 mb-2">
          <button onClick={() => handleUpdate({ textAlign: 'left' })} className="bg-neutral-800 p-2 rounded hover:bg-neutral-700 text-sm flex-1">L</button>
          <button onClick={() => handleUpdate({ textAlign: 'center' })} className="bg-neutral-800 p-2 rounded hover:bg-neutral-700 text-sm flex-1">C</button>
          <button onClick={() => handleUpdate({ textAlign: 'right' })} className="bg-neutral-800 p-2 rounded hover:bg-neutral-700 text-sm flex-1">R</button>
        </div>
      )}
      
      <div className="flex gap-2">
        <div onClick={() => handleUpdate({ fill: '#ffffff' })} className="w-8 h-8 rounded-full bg-white border border-neutral-600 cursor-pointer"></div>
        <div onClick={() => handleUpdate({ fill: '#000000' })} className="w-8 h-8 rounded-full bg-black border border-neutral-600 cursor-pointer"></div>
        <div onClick={() => handleUpdate({ fill: '#10b981' })} className="w-8 h-8 rounded-full bg-emerald-500 border border-neutral-600 cursor-pointer"></div>
      </div>
      
      <button onClick={() => handleUpdate({ locked: !primaryElement.locked })} className="mt-2 w-full bg-neutral-800 p-2 rounded hover:bg-neutral-700 text-sm">
        {primaryElement.locked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  );
};
