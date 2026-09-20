import React from 'react';
import { useEditorStore } from '../store/editorStore';
import { Plus, Copy, Trash2 } from 'lucide-react';

export const SlideStrip: React.FC = () => {
  const { project, activeSlideId, setActiveSlide, addSlide, duplicateSlide, deleteSlide, reorderSlides } = useEditorStore();

  if (!project) return null;

  return (
    <div className="h-32 border-t border-neutral-800 bg-neutral-900 flex items-center px-4 gap-4 overflow-x-auto shrink-0">
      {project.slides.map((slide, index) => (
        <div 
          key={slide.id}
          onClick={() => setActiveSlide(slide.id)}
          className={`relative group shrink-0 w-24 h-24 rounded border-2 transition-all cursor-pointer bg-white ${
            activeSlideId === slide.id ? 'border-emerald-500' : 'border-transparent hover:border-neutral-600'
          }`}
        >
          {/* Mini preview logic could go here later */}
          <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 rounded">
            {index + 1}
          </div>
          
          <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
              className="p-1 bg-neutral-800 text-white rounded hover:bg-neutral-700"
              title="Duplicate Slide"
            >
              <Copy size={12} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
              className="p-1 bg-red-900 text-white rounded hover:bg-red-800"
              disabled={project.slides.length <= 1}
              title="Delete Slide"
            >
              <Trash2 size={12} />
            </button>
            {index > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); reorderSlides(index, index - 1); }}
                className="p-1 bg-neutral-800 text-white rounded hover:bg-neutral-700 mt-1"
                title="Move Left"
              >
                &larr;
              </button>
            )}
            {index < project.slides.length - 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); reorderSlides(index, index + 1); }}
                className="p-1 bg-neutral-800 text-white rounded hover:bg-neutral-700 mt-1"
                title="Move Right"
              >
                &rarr;
              </button>
            )}
          </div>
        </div>
      ))}
      
      <button 
        onClick={addSlide}
        disabled={project.slides.length >= 10}
        className="shrink-0 w-24 h-24 rounded border-2 border-dashed border-neutral-700 hover:border-neutral-500 flex flex-col items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus size={24} />
        <span className="text-xs mt-1">Add Slide</span>
      </button>
    </div>
  );
};
