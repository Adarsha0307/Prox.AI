import React, { useState, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Plus, Copy, Trash2, GripVertical } from 'lucide-react';

export const SlideStrip: React.FC = () => {
  const { project, activeSlideId, setActiveSlide, addSlide, duplicateSlide, deleteSlide, reorderSlides } = useEditorStore();

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  if (!project) return null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent image as the drag ghost — the visual indicator
    // comes from the dragOverIndex highlight instead.
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setDragOverIndex(null);
      dragCounter.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== dropIndex) {
      reorderSlides(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  return (
    <div className="h-32 border-t border-neutral-800 bg-neutral-900 flex items-center px-4 gap-4 overflow-x-auto shrink-0">
      {project.slides.map((slide, index) => {
        const isDragging = dragIndex === index;
        const isDropTarget = dragOverIndex === index;

        return (
          <div
            key={slide.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => setActiveSlide(slide.id)}
            className={`relative group shrink-0 w-24 h-24 rounded border-2 transition-all cursor-pointer bg-white ${
              activeSlideId === slide.id
                ? 'border-emerald-500'
                : isDropTarget
                  ? 'border-blue-400 scale-105'
                  : 'border-transparent hover:border-neutral-600'
            } ${isDragging ? 'opacity-40 scale-95' : ''}`}
            style={{ transition: 'all 0.2s ease' }}
          >
            {/* Drop indicator line */}
            {isDropTarget && dragIndex !== null && (
              <div
                className={`absolute top-0 bottom-0 w-1 bg-blue-400 rounded-full z-10 ${
                  dragIndex < index ? '-right-3' : '-left-3'
                }`}
              />
            )}

            {/* Drag handle + slide number */}
            <div className="absolute top-1 left-1 flex items-center gap-0.5">
              <GripVertical
                size={12}
                className="text-white/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              />
              <span className="bg-black/50 text-white text-xs px-1.5 rounded">
                {index + 1}
              </span>
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
            </div>
          </div>
        );
      })}

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
