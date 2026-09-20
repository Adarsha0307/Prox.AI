export type ElementType = 'text' | 'image' | 'rectangle' | 'circle' | 'line';
export type SemanticRole = 'heading' | 'body' | 'image' | 'footer' | 'background';

/** Theme colours an element can inherit instead of hard-coding a fill. */
export type ThemeColorKey = 'primary' | 'secondary' | 'background' | 'text';

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
  /**
   * When set, the element follows the project theme colour. Editing the colour
   * directly clears this flag so the change survives later theme updates.
   */
  themeColorKey?: ThemeColorKey;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  /**
   * External URL (http/https/data) for images that live outside the project.
   * Uploaded images are referenced through `assetId` instead so the document
   * never stores a temporary object URL.
   */
  src?: string;
  assetId?: string;
  cropX?: number;
  cropY?: number;
  /** 'cover' crops to fill the box, 'contain' letterboxes the image. */
  fit?: 'cover' | 'contain';
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'circle' | 'line';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number; // border radius for rect
  ry?: number;
  themeColorKey?: ThemeColorKey;
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
