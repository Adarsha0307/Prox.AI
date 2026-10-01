import { v4 as uuidv4 } from 'uuid';
import type { SlideElement, TextElement, ShapeElement, ThemeTokens, ThemeColorKey } from '../types/schema';

export type GeneratedSlide = {
  layout: string;
  content: Record<string, any>;
};

// Helpers for creating elements
const createText = (
  text: string,
  left: number,
  top: number,
  fontSize: number,
  fontWeight: 'normal' | 'bold',
  colorKey: ThemeColorKey,
  colorValue: string,
  role: 'heading' | 'body' | 'image' | 'footer' | 'background',
  width: number = 880,
  textAlign: 'left' | 'center' | 'right' | 'justify' = 'left',
  fontStyle: 'normal' | 'italic' = 'normal'
): TextElement => ({
  id: uuidv4(),
  type: 'text',
  role,
  text,
  left,
  top,
  width,
  height: fontSize * 1.5,
  rotation: 0,
  opacity: 1,
  locked: false,
  fontFamily: 'Inter',
  fontSize,
  fontWeight,
  fontStyle,
  textAlign,
  fill: colorValue,
  themeColorKey: colorKey,
  lineHeight: 1.2,
  charSpacing: 0
});

const createShape = (
  type: 'rectangle' | 'circle' | 'line',
  left: number,
  top: number,
  width: number,
  height: number,
  colorKey: ThemeColorKey,
  colorValue: string,
  rx: number = 0,
  role: 'background' | 'image' = 'background'
): ShapeElement => ({
  id: uuidv4(),
  type,
  role,
  left,
  top,
  width,
  height,
  rotation: 0,
  opacity: 1,
  locked: false,
  fill: colorValue,
  themeColorKey: colorKey,
  rx,
  ry: rx
});

export const convertLayoutToElements = (
  slideData: GeneratedSlide,
  theme: ThemeTokens
): SlideElement[] => {
  const elements: SlideElement[] = [];
  const { layout, content } = slideData;

  const headingText = content.heading || '';
  const bodyText = content.body || '';

  // Theme resolving
  const colors = theme.colors;

  switch (layout) {
    case 'cover':
      elements.push(createText(headingText, 100, 300, 96, 'bold', 'text', colors.text, 'heading', 880, 'left'));
      if (bodyText) {
        elements.push(createText(bodyText, 100, 750, 40, 'normal', 'secondary', colors.secondary, 'body', 880, 'left'));
      }
      break;

    case 'introduction':
    case 'explanation':
      elements.push(createText(headingText, 100, 140, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'left'));
      elements.push(createText(bodyText, 100, 260, 44, 'normal', 'text', colors.text, 'body', 880, 'left'));
      break;

    case 'list':
      elements.push(createText(headingText, 100, 100, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'left'));
      let currentTop = 220;
      if (content.items && Array.isArray(content.items) && content.items.length > 0) {
        content.items.forEach((item: string) => {
          elements.push(createText(`• ${item}`, 100, currentTop, 40, 'normal', 'text', colors.text, 'body', 880, 'left'));
          currentTop += 80;
        });
      } else if (bodyText) {
        elements.push(createText(bodyText, 100, 220, 40, 'normal', 'text', colors.text, 'body', 880, 'left'));
      }
      break;

    case 'text-and-image':
      elements.push(createText(headingText, 100, 100, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'left'));
      elements.push(createText(bodyText, 100, 200, 40, 'normal', 'text', colors.text, 'body', 880, 'left'));
      // Add a placeholder image shape
      elements.push(createShape('rectangle', 100, 400, 880, 500, 'secondary', colors.secondary, 20, 'image'));
      break;

    case 'comparison':
      elements.push(createText(headingText, 100, 100, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'center'));
      if (content.items && content.items.length >= 2) {
        elements.push(createText(content.items[0], 100, 300, 40, 'normal', 'text', colors.text, 'body', 400, 'center'));
        elements.push(createText('VS', 490, 300, 48, 'bold', 'secondary', colors.secondary, 'body', 100, 'center'));
        elements.push(createText(content.items[1], 580, 300, 40, 'normal', 'text', colors.text, 'body', 400, 'center'));
      } else {
        elements.push(createText(bodyText, 100, 300, 40, 'normal', 'text', colors.text, 'body', 880, 'center'));
      }
      break;

    case 'quote':
      elements.push(createShape('rectangle', 100, 200, 880, 680, 'primary', colors.primary, 40));
      elements.push(createText(`"${content.quote || bodyText}"`, 160, 360, 64, 'normal', 'background', colors.background, 'heading', 760, 'center', 'italic'));
      if (content.author) {
        elements.push(createText(`— ${content.author}`, 160, 700, 36, 'bold', 'background', colors.background, 'body', 760, 'center'));
      }
      break;

    case 'statistic':
      elements.push(createText(headingText, 100, 140, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'center'));
      elements.push(createText(content.metric || '100%', 100, 400, 180, 'bold', 'text', colors.text, 'heading', 880, 'center'));
      elements.push(createText(bodyText, 100, 700, 44, 'normal', 'secondary', colors.secondary, 'body', 880, 'center'));
      break;

    case 'process':
      elements.push(createText(headingText, 100, 100, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'left'));
      let pTop = 240;
      if (content.items && Array.isArray(content.items)) {
        content.items.forEach((item: string, idx: number) => {
          elements.push(createShape('circle', 100, pTop, 60, 60, 'primary', colors.primary, 30));
          elements.push(createText(`${idx + 1}`, 100, pTop + 6, 40, 'bold', 'background', colors.background, 'body', 60, 'center'));
          elements.push(createText(item, 180, pTop + 6, 40, 'normal', 'text', colors.text, 'body', 800, 'left'));
          pTop += 120;
        });
      } else {
        elements.push(createText(bodyText, 100, 240, 40, 'normal', 'text', colors.text, 'body', 880, 'left'));
      }
      break;

    case 'conclusion':
      elements.push(createText(headingText, 100, 300, 72, 'bold', 'primary', colors.primary, 'heading', 880, 'center'));
      elements.push(createText(bodyText, 100, 500, 44, 'normal', 'text', colors.text, 'body', 880, 'center'));
      break;

    case 'cta':
    case 'closing':
      elements.push(createShape('rectangle', 80, 200, 920, 680, 'primary', colors.primary, 40));
      elements.push(createText(headingText, 140, 360, 80, 'bold', 'background', colors.background, 'heading', 800, 'center'));
      elements.push(createText(content.cta_text || bodyText, 140, 700, 40, 'normal', 'background', colors.background, 'body', 800, 'center'));
      break;

    default:
      elements.push(createText(headingText, 100, 140, 56, 'bold', 'primary', colors.primary, 'heading', 880, 'left'));
      elements.push(createText(bodyText, 100, 260, 44, 'normal', 'text', colors.text, 'body', 880, 'left'));
      break;
  }

  return elements;
};
