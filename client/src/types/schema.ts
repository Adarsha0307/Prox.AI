export type ElementType = 'text' | 'image' | 'rectangle' | 'circle' | 'line';
export type SemanticRole = 'heading' | 'body' | 'image' | 'footer' | 'background';

export interface BaseElement {
  id: string;
  type: ElementType;
  role: SemanticRole;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fill: string;
  lineHeight: number;
  charSpacing: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string; // URL or object URL for local development
  assetId?: string;
  cropX?: number;
  cropY?: number;
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'circle' | 'line';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number; // border radius for rect
  ry?: number;
}

export type SlideElement = TextElement | ImageElement | ShapeElement;

export interface Slide {
  id: string;
  elements: SlideElement[];
  background: string;
  accessibilityDescription?: string;
}

export interface ThemeTokens {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  brand?: {
    logoUrl?: string;
    handle?: string;
    voice?: string;
  };
}

export interface ProjectDocument {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  dimensions: {
    width: number;
    height: number;
  };
  revision: number;
  schemaVersion: string;
  theme: ThemeTokens;
  slides: Slide[];
  postCaption?: string;
}
