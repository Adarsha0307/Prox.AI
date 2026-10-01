import { describe, it, expect } from 'vitest';
import { validateLayout } from '../layoutValidator';
import type { SlideElement } from '../../types/schema';

describe('layoutValidator', () => {
  const bounds = { width: 1080, height: 1080 };
  const expectedMargin = 54; // 1080 * 0.05
  const expectedMinFont = 21.6; // 1080 * 0.02

  it('corrects elements outside left and top margins', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'rectangle',
        role: 'image', // changed from background
        left: 10,
        top: 20,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        fill: '#000',
      },
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(false);
    expect(result.correctedElements![0].left).toBe(expectedMargin);
    expect(result.correctedElements![0].top).toBe(expectedMargin);
  });

  it('corrects elements outside right and bottom margins', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'rectangle',
        role: 'image', // changed from background
        left: 1000, 
        top: 1000,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        fill: '#000',
      },
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(false);
    // overlapX = 1100 - (1080 - 54) = 74. left = 1000 - 74 = 926
    expect(result.correctedElements![0].left).toBe(926); 
    expect(result.correctedElements![0].top).toBe(926);
  });

  it('preserves aspect ratio for images when resizing', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'image',
        role: 'image',
        left: 10,
        top: 10,
        width: 2000, // huge width
        height: 1000, // 2:1 aspect ratio
        rotation: 0,
        opacity: 1,
        locked: false,
      },
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(false);
    // Width should be bounds.width - 2 * expectedMargin = 1080 - 108 = 972
    expect(result.correctedElements![0].width).toBe(972); 
    expect(result.correctedElements![0].height).toBe(486); // 2:1 aspect ratio
  });

  it('enforces minimum font size', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'text',
        role: 'body',
        left: 100,
        top: 100,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        text: 'hello',
        fontFamily: 'Inter',
        fontSize: 10, // below 21.6
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        fill: '#000',
        lineHeight: 1.2,
        charSpacing: 0,
      },
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(false);
    expect((result.correctedElements![0] as any).fontSize).toBe(expectedMinFont);
  });

  it('preserves locked elements', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'rectangle',
        role: 'background',
        left: 10, // out of bounds
        top: 10, // out of bounds
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: true, // should not be changed
        fill: '#000',
      },
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(true); // No corrections needed for locked elements
  });

  it('allows intentional overlaps (e.g. overlap > 30% area of smaller element)', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'image',
        role: 'image',
        left: 100,
        top: 100,
        width: 400,
        height: 400,
        rotation: 0,
        opacity: 1,
        locked: false,
      },
      {
        id: '2',
        type: 'text',
        role: 'body',
        left: 150,
        top: 150, // overlapping image with large area (100% of text)
        width: 200,
        height: 50,
        rotation: 0,
        opacity: 1,
        locked: false,
        text: 'overlap',
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        fill: '#000',
        lineHeight: 1.2,
        charSpacing: 0,
      }
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(true); // No correction
  });

  it('prevents accidental overlaps (e.g. <= 30% area of smaller element)', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'image',
        role: 'image',
        left: 100,
        top: 100,
        width: 400,
        height: 400,
        rotation: 0,
        opacity: 1,
        locked: false,
      },
      {
        id: '2',
        type: 'image',
        role: 'image',
        left: 450, // Barely overlapping
        top: 450,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
      }
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(false); 
    // It should have pushed one of them out of the way
    expect(result.correctedElements![1].left !== 450 || result.correctedElements![1].top !== 450).toBe(true);
  });

  it('detects text overflow and increases height', () => {
    const elements: SlideElement[] = [
      {
        id: '1',
        type: 'text',
        role: 'body',
        left: 100,
        top: 100,
        width: 100,
        height: 50, // Too short for a lot of text
        rotation: 0,
        opacity: 1,
        locked: false,
        text: 'This is a very long text that will definitely overflow the box given its small width and height constraints.',
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        fill: '#000',
        lineHeight: 1.2,
        charSpacing: 0,
      }
    ];

    const result = validateLayout(elements, bounds);
    expect(result.ok).toBe(false); 
    expect(result.correctedElements![0].height).toBeGreaterThan(50);
  });
});
