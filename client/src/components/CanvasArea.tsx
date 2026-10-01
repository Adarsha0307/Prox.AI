import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../store/editorStore';
import { getElementId, measureTextElementHeights, syncSlideToCanvas } from '../utils/renderer';
import type { SlideElement } from '../types/schema';

type FabricWithId = fabric.Object & { id?: string; elementType?: SlideElement['type'] };

export const CanvasArea: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const syncTokenRef = useRef(0);

  // Subscribed only to what must trigger React updates; handlers read the store
  // through getState() so they never capture stale state.
  const project = useEditorStore((state) => state.project);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const activeElementIds = useEditorStore((state) => state.activeElementIds);

  const [zoom, setZoom] = useState(0.5);
  const [fitMode, setFitMode] = useState(true);

  const activeSlide = project?.slides.find((slide) => slide.id === activeSlideId);
  const dimensions = project?.dimensions ?? { width: 1080, height: 1080 };

  // --- Canvas lifecycle (created once, disposed on unmount) ------------------
  useEffect(() => {
    const element = canvasElRef.current;
    if (!element) return;

    const canvas = new fabric.Canvas(element, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      enableRetinaScaling: false,
    });
    fabricRef.current = canvas;

    const onSelectionChange = () => {
      const ids = canvas
        .getActiveObjects()
        .map((object) => getElementId(object))
        .filter((id): id is string => typeof id === 'string');
      useEditorStore.getState().setActiveElements(ids);
    };

    const onModified = (event: fabric.ModifiedEvent) => {
      const target = event.target as FabricWithId | undefined;
      const id = target ? getElementId(target) : undefined;
      if (!target || !id) return;

      const store = useEditorStore.getState();
      const slide = store.project?.slides.find((candidate) => candidate.id === store.activeSlideId);
      const element = slide?.elements.find((candidate) => candidate.id === id);
      if (!element) return;

      const scaleX = target.scaleX ?? 1;
      const scaleY = target.scaleY ?? 1;

      if (element.type === 'text') {
        // Converting horizontal scale into a wrap width keeps glyphs from being
        // stretched; the height is derived from the rendered text.
        const width = Math.max(16, (target.width || element.width) * scaleX);
        store.updateElement(
          id,
          { left: target.left ?? element.left, top: target.top ?? element.top, width, rotation: target.angle ?? 0 },
          { commit: 'immediate' },
        );
      } else {
        store.updateElement(
          id,
          {
            left: target.left ?? element.left,
            top: target.top ?? element.top,
            width: Math.max(1, (target.width || element.width) * scaleX),
            height: Math.max(1, (target.height || element.height) * scaleY),
            rotation: target.angle ?? 0,
          },
          { commit: 'immediate' },
        );
        // Reset the Fabric-side scale so consecutive drags cannot compound it.
        target.set({ scaleX: 1, scaleY: 1 });
      }
      canvas.requestRenderAll();
    };

    const onTextEditingExited = (event: { target?: fabric.Object }) => {
      const target = event.target as FabricWithId | undefined;
      const id = target ? getElementId(target) : undefined;
      if (!id || !target) return;
      const textbox = target as fabric.Textbox;
      useEditorStore.getState().updateElement(id, { text: textbox.text ?? '' }, { commit: 'immediate' });
    };

    canvas.on('selection:created', onSelectionChange);
    canvas.on('selection:updated', onSelectionChange);
    canvas.on('selection:cleared', onSelectionChange);
    canvas.on('object:modified', onModified);
    canvas.on('text:editing:exited', onTextEditingExited);

    return () => {
      canvas.off('selection:created', onSelectionChange);
      canvas.off('selection:updated', onSelectionChange);
      canvas.off('selection:cleared', onSelectionChange);
      canvas.off('object:modified', onModified);
      canvas.off('text:editing:exited', onTextEditingExited);
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, [dimensions.width, dimensions.height]);

  // --- Document -> canvas reconciliation ------------------------------------
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !activeSlide) return;

    const token = ++syncTokenRef.current;
    const selectedIds = activeElementIds;

    void syncSlideToCanvas(canvas, activeSlide, { selectedIds })
      .then(() => {
        if (token !== syncTokenRef.current) return;
        // Keep document heights in sync with the rendered text so the overflow
        // warning matches what the user actually sees.
        const store = useEditorStore.getState();
        for (const measured of measureTextElementHeights(canvas)) {
          const element = store.project?.slides
            .find((slide) => slide.id === store.activeSlideId)
            ?.elements.find((candidate) => candidate.id === measured.id);
          if (!element || element.type !== 'text') continue;
          if (Math.abs(element.height - measured.height) > 1) {
            store.updateElement(measured.id, { height: measured.height }, { commit: 'none' });
          }
        }
      })
      .catch((error: unknown) => {
        console.error('[canvas] failed to render the active slide', error);
      });
  }, [activeSlide, activeElementIds]);

  // --- Responsive fit-to-viewport --------------------------------------------
  const updateZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container || !fitMode) return;
    const scaleX = (container.clientWidth - 40) / dimensions.width;
    const scaleY = (container.clientHeight - 40) / dimensions.height;
    setZoom(Math.max(0.1, Math.min(scaleX, scaleY, 1)));
  }, [dimensions.width, dimensions.height, fitMode]);

  useEffect(() => {
    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, [updateZoom]);

  const hasOverflow = useMemo(() => {
    if (!activeSlide || !project) return false;
    return activeSlide.elements.some((element) => {
      if (element.type === 'line') return false; // lines are diagonal by design
      return (
        element.left < 0 ||
        element.top < 0 ||
        element.left + element.width > project.dimensions.width ||
        element.top + element.height > project.dimensions.height
      );
    });
  }, [activeSlide, project]);

  if (!project) return null;

  return (
    <div ref={containerRef} className="flex-1 bg-neutral-950 flex flex-col items-center justify-center overflow-hidden relative">
      {hasOverflow && (
        <div
          role="status"
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-100 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 z-10 shadow-lg"
        >
          ⚠️ Element exceeds slide boundaries
        </div>
      )}

      {activeElementIds.length > 0 && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3 text-xs text-neutral-300 bg-neutral-800/90 border border-neutral-700 rounded px-2 py-1">
          <span>{activeElementIds.length} selected</span>
          <button
            type="button"
            className="underline hover:text-white"
            onClick={() => {
              const [first] = useEditorStore.getState().activeElementIds;
              if (first) useEditorStore.getState().deleteElement(first);
            }}
          >
            Delete
          </button>
        </div>
      )}

      <div
        className="bg-white shadow-2xl relative"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.1s ease-out',
        }}
      >
        <canvas ref={canvasElRef} aria-label="Carousel slide editing canvas" />
      </div>

      <div className="absolute bottom-4 right-4 bg-neutral-800 rounded-lg shadow-lg flex text-sm overflow-hidden border border-neutral-700">
        <button
          type="button"
          aria-label="Zoom out"
          className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700"
          onClick={() => {
            setFitMode(false);
            setZoom((current) => Math.max(0.1, current - 0.1));
          }}
        >
          −
        </button>
        <div className="px-3 py-1.5 text-neutral-300 flex items-center bg-neutral-900 border-x border-neutral-700">
          {Math.round(zoom * 100)}%
        </div>
        <button
          type="button"
          aria-label="Zoom in"
          className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700"
          onClick={() => {
            setFitMode(false);
            setZoom((current) => Math.min(2, current + 0.1));
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Fit slide to screen"
          className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700 border-l border-neutral-700"
          onClick={() => {
            setFitMode(true);
            updateZoom();
          }}
        >
          Fit
        </button>
      </div>
    </div>
  );
};

