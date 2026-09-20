import * as fabric from 'fabric';
import type { ImageElement, ProjectDocument, Slide, SlideElement, ShapeElement, TextElement } from '../types/schema';
import { resolveElementImageSrc } from './assets';

/**
 * Shared Fabric.js rendering used by both the editor canvas and the export
 * adapters. Keeping one implementation is what makes exports match the editor.
 */

/** Waits for webfonts so an export cannot silently fall back to a system font. */
export async function ensureFontsReady(): Promise<void> {
  const fontSet = (globalThis as { document?: Document }).document?.fonts;
  if (fontSet && typeof fontSet.ready?.then === 'function') {
    try {
      await fontSet.ready;
    } catch {
      // Font loading failures must not block an export.
    }
  }
}

interface ElementMarkers {
  id: string;
  elementType: SlideElement['type'];
  assetSrc?: string;
}

export function getElementId(object: fabric.Object): string | undefined {
  return (object as unknown as Partial<ElementMarkers>).id;
}

function markObject(object: fabric.Object, element: SlideElement, assetSrc?: string): fabric.Object {
  const markers = object as unknown as ElementMarkers;
  markers.id = element.id;
  markers.elementType = element.type;
  if (assetSrc) markers.assetSrc = assetSrc;
  return object;
}

function applyLockState(object: fabric.Object, element: SlideElement): void {
  // Locked elements can still be selected (so they can be unlocked) but cannot
  // be moved, scaled, or rotated by accident.
  object.set({
    lockMovementX: element.locked,
    lockMovementY: element.locked,
    lockRotation: element.locked,
    lockScalingX: element.locked,
    lockScalingY: element.locked,
    hasControls: !element.locked,
  });
}

function createTextObject(element: TextElement): fabric.Textbox {
  // Textbox wraps instead of stretching, so resizing a text box re-flows the
  // text rather than distorting the glyphs.
  const textbox = new fabric.Textbox(element.text ?? '', {
    left: element.left,
    top: element.top,
    width: Math.max(8, element.width),
    angle: element.rotation,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    textAlign: element.textAlign,
    fill: element.fill,
    lineHeight: element.lineHeight,
    charSpacing: element.charSpacing,
    opacity: element.opacity,
    editable: true,
    splitByGrapheme: false,
    objectCaching: false,
  });
  applyLockState(textbox, element);
  return textbox;
}

function createShapeObject(element: ShapeElement): fabric.Object {
  const shared = {
    left: element.left,
    top: element.top,
    angle: element.rotation,
    opacity: element.opacity,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth ?? (element.stroke ? 1 : 0),
    objectCaching: false,
  };

  let shape: fabric.Object;
  if (element.type === 'rectangle') {
    shape = new fabric.Rect({
      ...shared,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
      rx: element.rx,
      ry: element.ry,
    });
  } else if (element.type === 'circle') {
    const radius = Math.max(1, Math.min(element.width, element.height) / 2);
    const circle = new fabric.Circle({ ...shared, radius });
    circle.set({
      scaleX: Math.max(0.01, element.width / (radius * 2)),
      scaleY: Math.max(0.01, element.height / (radius * 2)),
    });
    shape = circle;
  } else {
    shape = new fabric.Line([element.left, element.top, element.left + element.width, element.top + element.height], {
      ...shared,
      fill: '',
      stroke: element.stroke ?? element.fill,
      strokeWidth: element.strokeWidth ?? 2,
    });
  }

  applyLockState(shape, element);
  return shape;
}

/**
 * Computes the source rectangle and placement for `cover`/`contain` so images
 * are cropped rather than stretched.
 */
function computeImagePlacement(element: ImageElement, naturalWidth: number, naturalHeight: number) {
  const boxWidth = Math.max(1, element.width);
  const boxHeight = Math.max(1, element.height);
  const fit = element.fit ?? 'cover';
  const scale = fit === 'cover'
    ? Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight)
    : Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);

  const sourceWidth = Math.min(naturalWidth, boxWidth / scale);
  const sourceHeight = Math.min(naturalHeight, boxHeight / scale);

  const maxOffsetX = Math.max(0, naturalWidth - sourceWidth);
  const maxOffsetY = Math.max(0, naturalHeight - sourceHeight);
  const offsetX = Math.min(maxOffsetX, Math.max(0, element.cropX ?? (maxOffsetX / 2)));
  const offsetY = Math.min(maxOffsetY, Math.max(0, element.cropY ?? (maxOffsetY / 2)));

  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;

  return {
    scale,
    cropX: offsetX,
    cropY: offsetY,
    width: sourceWidth,
    height: sourceHeight,
    left: element.left + (boxWidth - renderedWidth) / 2,
    top: element.top + (boxHeight - renderedHeight) / 2,
  };
}

async function createImageObject(element: ImageElement): Promise<fabric.FabricImage | null> {
  const src = await resolveElementImageSrc(element);
  if (!src) return null;

  const image = await fabric.FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
  const naturalWidth = image.width || 1;
  const naturalHeight = image.height || 1;
  const placement = computeImagePlacement(element, naturalWidth, naturalHeight);

  image.set({
    left: element.left,
    top: element.top,
    angle: element.rotation,
    opacity: element.opacity,
    originX: 'left',
    originY: 'top',
    scaleX: placement.scale,
    scaleY: placement.scale,
    cropX: placement.cropX,
    cropY: placement.cropY,
    width: placement.width,
    height: placement.height,
    objectCaching: false,
  });
  image.setCoords();
  applyLockState(image, element);
  markObject(image, element, src);
  return image;
}

/** Creates the Fabric object for an element, or null when it cannot be drawn. */
export async function createFabricObject(element: SlideElement): Promise<fabric.Object | null> {
  if (element.type === 'text') return markObject(createTextObject(element), element);
  if (element.type === 'image') return createImageObject(element);
  return markObject(createShapeObject(element), element);
}

/**
 * Applies document values to an existing object *in place* so dragging does not
 * re-create objects (and does not lose the current selection).
 */
export function applyElementToObject(object: fabric.Object, element: SlideElement): void {
  const common = {
    left: element.left,
    top: element.top,
    angle: element.rotation,
    opacity: element.opacity,
  };

  if (element.type === 'text') {
    const textbox = object as fabric.Textbox;
    if (textbox.text !== element.text) textbox.set({ text: element.text });
    object.set({
      ...common,
      width: Math.max(8, element.width),
      scaleX: 1,
      scaleY: 1,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textAlign: element.textAlign,
      fill: element.fill,
      lineHeight: element.lineHeight,
      charSpacing: element.charSpacing,
    });
  } else if (element.type === 'image') {
    const naturalWidth = Math.max(1, object.width || 1);
    const naturalHeight = Math.max(1, object.height || 1);
    const placement = computeImagePlacement(element, naturalWidth, naturalHeight);
    object.set({
      ...common,
      scaleX: placement.scale,
      scaleY: placement.scale,
      cropX: placement.cropX,
      cropY: placement.cropY,
      width: placement.width,
      height: placement.height,
    });
  } else if (element.type === 'circle') {
    const radius = Math.max(1, Math.min(element.width, element.height) / 2);
    object.set({
      ...common,
      radius,
      scaleX: Math.max(0.01, element.width / (radius * 2)),
      scaleY: Math.max(0.01, element.height / (radius * 2)),
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth ?? (element.stroke ? 1 : 0),
    });
  } else if (element.type === 'rectangle') {
    object.set({
      ...common,
      scaleX: 1,
      scaleY: 1,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
      rx: element.rx,
      ry: element.ry,
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth ?? (element.stroke ? 1 : 0),
    });
  } else {
    object.set({
      ...common,
      fill: '',
      stroke: element.stroke ?? element.fill,
      strokeWidth: element.strokeWidth ?? 2,
    });
    const line = object as fabric.Line;
    line.set({
      x1: element.left,
      y1: element.top,
      x2: element.left + element.width,
      y2: element.top + element.height,
    });
  }

  applyLockState(object, element);
  object.setCoords();
}



function createMissingImagePlaceholder(element: ImageElement): fabric.Object {
  const box = new fabric.Rect({
    left: element.left,
    top: element.top,
    width: Math.max(1, element.width),
    height: Math.max(1, element.height),
    fill: '#f3f4f6',
    stroke: '#9ca3af',
    strokeWidth: 2,
    strokeDashArray: [8, 6],
    angle: element.rotation,
    opacity: element.opacity,
    objectCaching: false,
  });
  const label = new fabric.Textbox('Image missing', {
    left: element.left + 12,
    top: element.top + Math.max(0, element.height / 2 - 14),
    width: Math.max(40, element.width - 24),
    fontFamily: 'Inter',
    fontSize: 20,
    fill: '#6b7280',
    textAlign: 'center',
    objectCaching: false,
  });
  const group = new fabric.Group([box, label], { objectCaching: false });
  applyLockState(group, element);
  return markObject(group, element, 'missing');
}

interface SyncOptions {
  selectedIds?: string[];
}

/**
 * Reconciles the canvas with the document: existing objects are updated in
 * place (no per-interaction re-creation), stale objects are removed, and the
 * stacking order always matches the document order.
 */
export async function syncSlideToCanvas(
  canvas: fabric.Canvas,
  slide: Slide,
  options: SyncOptions = {},
): Promise<void> {
  const existing = canvas.getObjects();
  const byId = new Map<string, fabric.Object>();
  for (const object of existing) {
    const id = getElementId(object);
    if (id && !byId.has(id)) byId.set(id, object);
  }

  const ordered: fabric.Object[] = [];
  const keepIds = new Set<string>();

  for (const element of slide.elements) {
    keepIds.add(element.id);
    const current = byId.get(element.id);
    const currentType = current ? (current as unknown as ElementMarkers).elementType : undefined;
    const typeMatches = current !== undefined && currentType === element.type;

    if (element.type === 'image') {
      const resolved = await resolveElementImageSrc(element);
      const currentSrc = current ? (current as unknown as ElementMarkers).assetSrc : undefined;
      const expected = resolved ?? 'missing';
      if (!typeMatches || currentSrc !== expected) {
        if (current) canvas.remove(current);
        const replacement = resolved ? await createImageObject(element) : createMissingImagePlaceholder(element);
        if (replacement) {
          canvas.add(replacement);
          ordered.push(replacement);
        }
        continue;
      }
    }

    if (typeMatches && current) {
      applyElementToObject(current, element);
      ordered.push(current);
      continue;
    }

    if (current) canvas.remove(current);
    const created = await createFabricObject(element);
    if (created) {
      canvas.add(created);
      ordered.push(created);
    }
  }

  for (const object of existing) {
    const id = getElementId(object);
    if (!id || !keepIds.has(id)) canvas.remove(object);
  }

  // Document order == stacking order (index 0 is the bottom layer).
  ordered.forEach((object, index) => {
    canvas.moveObjectTo(object, index);
  });

  canvas.backgroundColor = slide.background || '#ffffff';

  const active = canvas.getActiveObject();
  if (!active && options.selectedIds && options.selectedIds.length > 0) {
    const target = ordered.find((object) => options.selectedIds?.includes(getElementId(object) ?? ''));
    if (target) canvas.setActiveObject(target);
  }

  canvas.requestRenderAll();
}

/** Rendered text heights, so document bounds match what the user sees. */
export function measureTextElementHeights(canvas: fabric.Canvas): { id: string; height: number }[] {
  const result: { id: string; height: number }[] = [];
  for (const object of canvas.getObjects()) {
    const markers = object as unknown as ElementMarkers;
    if (markers.elementType === 'text' && markers.id) {
      result.push({ id: markers.id, height: Math.max(1, object.height * object.scaleY) });
    }
  }
  return result;
}

export interface RenderSlideOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  multiplier?: number;
}

/**
 * Renders one slide to a data URL at the project's exact pixel dimensions,
 * without any editor chrome (handles, guides, or selection state).
 */
export async function renderSlideToDataUrl(
  slide: Slide,
  project: ProjectDocument,
  options: RenderSlideOptions = {},
): Promise<string> {
  await ensureFontsReady();

  const element = document.createElement('canvas');
  const canvas = new fabric.StaticCanvas(element, {
    width: project.dimensions.width,
    height: project.dimensions.height,
    backgroundColor: slide.background || '#ffffff',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });

  try {
    const objects = await buildSlideObjects(slide);
    for (const object of objects) canvas.add(object);
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({
      format: options.format ?? 'png',
      quality: options.quality ?? 0.92,
      multiplier: options.multiplier ?? 1,
    });

    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      throw new Error('Slide rendering produced no image data');
    }
    return dataUrl;
  } finally {
    await canvas.dispose();
  }
}

/** Builds the Fabric objects for a slide, including placeholders for missing images. */
export async function buildSlideObjects(slide: Slide): Promise<fabric.Object[]> {
  const objects: fabric.Object[] = [];
  const resolvedIds = new Set<string>();

  for (const element of slide.elements) {
    const object = await createFabricObject(element);
    if (object) {
      objects.push(object);
      resolvedIds.add(element.id);
    }
  }

  for (const element of slide.elements) {
    if (element.type === 'image' && !resolvedIds.has(element.id)) {
      objects.push(createMissingImagePlaceholder(element));
    }
  }

  return objects;
}
