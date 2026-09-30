import type { SlideElement, TextElement } from '../types/schema';

export interface LayoutBounds {
  width: number;
  height: number;
}

export interface ValidationOptions {
  safeMarginPct?: number; // default 0.05 (5%)
  minFontSizePct?: number; // default 0.02 (2%)
}

export interface ValidationResult {
  ok: boolean;
  issues: string[];
  correctedElements?: SlideElement[];
}

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function measureTextHeight(el: TextElement, width: number): number {
  if (typeof document === 'undefined') {
    // fallback for environments without DOM (like some test runners)
    const charWidth = el.fontSize * 0.6;
    const charsPerLine = Math.max(1, Math.floor(width / charWidth));
    const lines = Math.ceil((el.text || '').length / charsPerLine);
    return lines * el.fontSize * (el.lineHeight || 1.2);
  }
  
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCtx = sharedCanvas.getContext('2d');
  }
  
  if (!sharedCtx || !el.text) return el.fontSize * (el.lineHeight || 1.2);
  
  sharedCtx.font = `${el.fontStyle || 'normal'} ${el.fontWeight || 'normal'} ${el.fontSize}px ${el.fontFamily || 'sans-serif'}`;
  const words = el.text.split(' ');
  let line = '';
  let linesCount = 1;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = sharedCtx.measureText(testLine);
    if (metrics.width > width && n > 0) {
      linesCount++;
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  
  return linesCount * el.fontSize * (el.lineHeight || 1.2);
}

export function validateLayout(
  elements: SlideElement[],
  bounds: LayoutBounds,
  options?: ValidationOptions
): ValidationResult {
  const issues: string[] = [];
  const correctedElements = JSON.parse(JSON.stringify(elements)) as SlideElement[];

  let needsCorrection = false;
  const marginPct = options?.safeMarginPct ?? 0.05;
  const minFontPct = options?.minFontSizePct ?? 0.02;
  
  const safeMargin = Math.max(0, Math.min(bounds.width, bounds.height) * marginPct); 
  const minFontSize = Math.max(8, bounds.height * minFontPct); 

  // 1. Bounds and Sizing
  for (const el of correctedElements) {
    const isBackground = el.role === 'background';

    // Locked elements are not corrected, but receive warnings
    if (el.locked) {
      if (!isBackground) {
        if (el.left < safeMargin || el.top < safeMargin || 
            el.left + el.width > bounds.width - safeMargin || 
            el.top + el.height > bounds.height - safeMargin) {
          issues.push(`Locked element "${el.role}" is outside safe margins.`);
        }
      }
      continue;
    }
    
    if (isBackground) continue; // Backgrounds can be full-bleed

    // Check bounds & auto-correct
    if (el.left < safeMargin) {
      el.left = safeMargin;
      issues.push(`Element moved to respect left margin.`);
      needsCorrection = true;
    }
    if (el.top < safeMargin) {
      el.top = safeMargin;
      issues.push(`Element moved to respect top margin.`);
      needsCorrection = true;
    }
    
    if (el.left + el.width > bounds.width - safeMargin) {
      const overlap = el.left + el.width - (bounds.width - safeMargin);
      if (el.left - overlap >= safeMargin) {
        el.left -= overlap;
      } else {
        const oldWidth = el.width;
        el.width = bounds.width - safeMargin * 2;
        el.left = safeMargin;
        if (el.type === 'image') {
          el.height = el.width * ((el as any).height / oldWidth);
        }
      }
      issues.push(`Element adjusted to respect right margin.`);
      needsCorrection = true;
    }

    if (el.top + el.height > bounds.height - safeMargin) {
      const overlap = el.top + el.height - (bounds.height - safeMargin);
      if (el.top - overlap >= safeMargin) {
        el.top -= overlap;
      } else {
        const oldHeight = el.height;
        el.height = bounds.height - safeMargin * 2;
        el.top = safeMargin;
        if (el.type === 'image') {
          el.width = el.height * ((el as any).width / oldHeight);
        }
      }
      issues.push(`Element adjusted to respect bottom margin.`);
      needsCorrection = true;
    }

    // Min readable font size & text overflow detection
    if (el.type === 'text') {
      const textEl = el as TextElement;
      if (textEl.fontSize < minFontSize) {
        textEl.fontSize = minFontSize;
        issues.push(`Text font size increased to minimum readable size (${Math.round(minFontSize)}).`);
        needsCorrection = true;
      }
      
      const requiredHeight = measureTextHeight(textEl, el.width);
      if (requiredHeight > el.height) {
        // Expand height to fit if possible
        if (el.top + requiredHeight <= bounds.height - safeMargin) {
          el.height = requiredHeight;
          issues.push(`Expanded text box height to prevent overflow.`);
          needsCorrection = true;
        } else {
          // Cannot expand fully without breaking bottom margin
          el.height = (bounds.height - safeMargin) - el.top;
          needsCorrection = true;
          issues.push(`Unresolved text overflow in "${textEl.role}" text. Content cannot fit within bounds.`);
        }
      }
    }
  }

  // 2. Overlap Intent
  // Overlaps are only treated as mistakes when a small sliver of the smaller
  // element is covered (<= 30% of its area) - that is the "kissing" case that
  // usually means the elements were dragged together by accident. Larger
  // overlaps (> 30%) are deliberate design (text over a hero image, layered
  // shapes) and are left alone.
  const OVERLAP_ALLOWED_RATIO = 0.3; // 30% of the smaller element
  for (let i = 0; i < correctedElements.length; i++) {
    for (let j = i + 1; j < correctedElements.length; j++) {
      const el1 = correctedElements[i];
      const el2 = correctedElements[j];

      // If either explicitly allows overlap, ignore
      if (el1.allowOverlap || el2.allowOverlap) continue;
      // Backgrounds implicitly allow overlap
      if (el1.role === 'background' || el2.role === 'background') continue;

      const overlapX = Math.max(0, Math.min(el1.left + el1.width, el2.left + el2.width) - Math.max(el1.left, el2.left));
      const overlapY = Math.max(0, Math.min(el1.top + el1.height, el2.top + el2.height) - Math.max(el1.top, el2.top));

      if (overlapX <= 0 || overlapY <= 0) continue;

      const overlapArea = overlapX * overlapY;
      const smallerArea = Math.min(el1.width * el1.height, el2.width * el2.height);
      const overlapRatio = smallerArea > 0 ? overlapArea / smallerArea : 1;

      // Intentional design overlap (e.g. > 30% of the smaller element covered).
      if (overlapRatio > OVERLAP_ALLOWED_RATIO) continue;

      issues.push(`Accidental overlap detected between elements (roles: ${el1.role}, ${el2.role}).`);

      // Auto-correct by pushing the later element out of the way along the
      // smallest separating axis, preferring the direction that stays inside
      // the safe margins.
      const mover = el2;
      const overlapHorizontal = overlapX <= overlapY;
      const fitsRight = mover.left + mover.width + overlapX <= bounds.width - safeMargin;
      const fitsLeft = mover.left - overlapX >= safeMargin;
      const fitsDown = mover.top + mover.height + overlapY <= bounds.height - safeMargin;
      const fitsUp = mover.top - overlapY >= safeMargin;

      if (overlapHorizontal) {
        if (fitsRight) mover.left += overlapX;
        else if (fitsLeft) mover.left -= overlapX;
        else if (fitsDown) mover.top += overlapY;
        else if (fitsUp) mover.top -= overlapY;
      } else {
        if (fitsDown) mover.top += overlapY;
        else if (fitsUp) mover.top -= overlapY;
        else if (fitsRight) mover.left += overlapX;
        else if (fitsLeft) mover.left -= overlapX;
      }

      needsCorrection = true;
    }
  }

  return {
    ok: !needsCorrection && issues.length === 0,
    issues,
    correctedElements: needsCorrection ? correctedElements : undefined,
  };
}
