import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';

export const CanvasArea: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  
  const { project, activeSlideId, setActiveElements, updateElement } = useEditorStore();
  const [zoom, setZoom] = useState(0.5);

  const activeSlide = project?.slides.find(s => s.id === activeSlideId);

  useEffect(() => {
    if (!canvasElRef.current || !project) return;
    
    // Setup Fabric canvas
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: project.dimensions.width,
      height: project.dimensions.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });
    
    fabricRef.current = canvas;

    const onSelection = () => {
      const activeObjects = canvas.getActiveObjects();
      setActiveElements(activeObjects.map(obj => (obj as any).id));
    };

    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onSelection);

    // Sync object modifications to store
    const onModify = (e: any) => {
      if (!e.target || !e.target.id) return;
      updateElement(e.target.id, {
        left: e.target.left,
        top: e.target.top,
        width: e.target.width * e.target.scaleX,
        height: e.target.height * e.target.scaleY,
        rotation: e.target.angle,
      });
    };

    canvas.on('object:modified', onModify);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []); // Only run once on mount

  // Sync from store to fabric when active slide changes or elements change
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !activeSlide) return;

    // For simplicity in this milestone, we clear and re-render
    // A robust version would diff elements and update properties
    canvas.clear();
    canvas.backgroundColor = activeSlide.background;

    activeSlide.elements.forEach(el => {
      if (el.type === 'text') {
        const textEl = new fabric.IText((el as any).text || 'Text', {
          id: el.id,
          left: el.left,
          top: el.top,
          angle: el.rotation,
          fontFamily: (el as any).fontFamily || 'Inter',
          fontSize: (el as any).fontSize || 60,
          fill: (el as any).fill || '#000000',
        } as any);
        canvas.add(textEl);
      }
      // Image and Shape logic to be added
    });

    canvas.requestRenderAll();
  }, [activeSlide]);

  // Compute text overflow
  const hasOverflow = useMemo(() => {
    if (!activeSlide || !project) return false;
    const { width, height } = project.dimensions;
    return activeSlide.elements.some(el => {
      // Simple bounding box check (ignoring rotation for milestone C)
      return el.left < 0 || el.top < 0 || (el.left + el.width) > width || (el.top + el.height) > height;
    });
  }, [activeSlide, project]);

  // Auto-zoom to fit container (responsive)
  useEffect(() => {
    const updateZoom = () => {
      if (!containerRef.current || !project) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const scaleX = (clientWidth - 40) / project.dimensions.width;
      const scaleY = (clientHeight - 40) / project.dimensions.height;
      setZoom(Math.min(scaleX, scaleY, 1));
    };

    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, [project]);

  if (!project) return null;

  return (
    <div ref={containerRef} className="flex-1 bg-neutral-950 flex flex-col items-center justify-center overflow-hidden relative">
      {hasOverflow && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-900/90 text-red-100 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 z-10 shadow-lg">
          ⚠️ Element exceeds slide boundaries
        </div>
      )}
      <div 
        className="bg-white shadow-2xl relative"
        style={{
          width: project.dimensions.width,
          height: project.dimensions.height,
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.1s ease-out'
        }}
      >
        <canvas ref={canvasElRef} />
      </div>
      
      {/* Zoom controls floating */}
      <div className="absolute bottom-4 right-4 bg-neutral-800 rounded-lg shadow-lg flex text-sm overflow-hidden border border-neutral-700">
        <button className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>-</button>
        <div className="px-3 py-1.5 text-neutral-300 flex items-center bg-neutral-900 border-x border-neutral-700">
          {Math.round(zoom * 100)}%
        </div>
        <button className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
      </div>
    </div>
  );
};
