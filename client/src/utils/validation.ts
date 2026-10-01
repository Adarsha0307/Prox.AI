import type { ProjectDocument, Slide, SlideElement } from '../types/schema';

/** Document schema versions this build understands and can render. */
export const CURRENT_SCHEMA_VERSION = '1.0';
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0'];

/** The UI creates at most this many slides in a new project. */
export const MAX_SLIDES_CLIENT = 10;
/** Hard ceiling applied to loaded/imported documents (matches the API limit). */
export const MAX_SLIDES_HARD = 50;
export const MAX_ELEMENTS_PER_SLIDE = 500;
export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 10000;

export type ValidationResult =
  | { ok: true; project: ProjectDocument; warnings: string[] }
  | { ok: false; errors: string[] };

const ELEMENT_TYPES = new Set(['text', 'image', 'rectangle', 'circle', 'line']);
const ROLES = new Set(['heading', 'body', 'image', 'footer', 'background']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function isTransientUrl(url: string): boolean {
  return url.startsWith('blob:');
}

function validateElement(
  element: unknown,
  slideIndex: number,
  elementIndex: number,
  errors: string[],
  warnings: string[],
) {
  const where = `slide ${slideIndex + 1}, element ${elementIndex + 1}`;
  if (!isObject(element)) {
    errors.push(`${where}: element must be an object`);
    return;
  }
  if (!isNonEmptyString(element.id)) errors.push(`${where}: missing id`);
  if (typeof element.type !== 'string' || !ELEMENT_TYPES.has(element.type)) {
    errors.push(`${where}: unsupported element type "${String(element.type)}"`);
    return;
  }
  if (typeof element.role !== 'string' || !ROLES.has(element.role)) {
    errors.push(`${where}: unsupported element role "${String(element.role)}"`);
  }
  for (const key of ['left', 'top', 'width', 'height'] as const) {
    if (!isFiniteNumber(element[key])) errors.push(`${where}: ${key} must be a finite number`);
  }
  if (!isFiniteNumber(element.rotation)) errors.push(`${where}: rotation must be a finite number`);
  if (!isFiniteNumber(element.opacity)) errors.push(`${where}: opacity must be a finite number`);
  else if (element.opacity < 0 || element.opacity > 1) errors.push(`${where}: opacity must be between 0 and 1`);
  if (typeof element.locked !== 'boolean') errors.push(`${where}: locked must be a boolean`);

  if (element.type === 'text') {
    if (typeof element.text !== 'string') errors.push(`${where}: text must be a string`);
    if (!isNonEmptyString(element.fontFamily)) errors.push(`${where}: fontFamily is required`);
    if (!isFiniteNumber(element.fontSize) || element.fontSize <= 0) {
      errors.push(`${where}: fontSize must be a positive number`);
    }
    if (typeof element.fill !== 'string') errors.push(`${where}: fill is required`);
  }

  if (element.type === 'image') {
    const src = element.src;
    const assetId = element.assetId;
    if (!isNonEmptyString(src) && !isNonEmptyString(assetId)) {
      errors.push(`${where}: an image needs either a src or an assetId`);
    }
    if (isNonEmptyString(src) && isTransientUrl(src)) {
      // Object URLs die with the browser session, so they must never be persisted.
      warnings.push(`${where}: temporary object URL was dropped; re-upload the image`);
      delete element.src;
      if (!isNonEmptyString(assetId)) {
        errors.push(`${where}: image is missing a stored asset reference`);
      }
    }
  }

  if (element.type === 'rectangle' || element.type === 'circle' || element.type === 'line') {
    if (typeof element.fill !== 'string' && typeof element.stroke !== 'string') {
      errors.push(`${where}: a shape needs a fill or a stroke`);
    }
  }
}

export const ELEMENT_TYPE_LIST: SlideElement['type'][] = ['text', 'image', 'rectangle', 'circle', 'line'];

export type TemplateSlideResult = { ok: true; slide: Slide } | { ok: false; errors: string[] };

export function validateProjectDocument(value: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(value)) return { ok: false, errors: ['Project file is not an object'] };

  if (!isNonEmptyString(value.id)) errors.push('Project is missing an id');
  if (!isNonEmptyString(value.title)) errors.push('Project is missing a title');

  const schemaVersion = value.schemaVersion;
  if (!isNonEmptyString(schemaVersion)) {
    warnings.push(`Missing schemaVersion; assuming ${CURRENT_SCHEMA_VERSION}`);
    value.schemaVersion = CURRENT_SCHEMA_VERSION;
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    return {
      ok: false,
      errors: [
        `Unsupported schema version "${schemaVersion}". This build supports ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`,
      ],
    };
  }

  const dimensions = value.dimensions;
  if (!isObject(dimensions) || !isFiniteNumber(dimensions.width) || !isFiniteNumber(dimensions.height)) {
    errors.push('Project dimensions are missing');
  } else {
    const width = dimensions.width;
    const height = dimensions.height;
    if (width < MIN_DIMENSION || height < MIN_DIMENSION || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      errors.push(`Canvas size must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} px on each side`);
    }
  }

  if (!Array.isArray(value.slides) || value.slides.length === 0) {
    errors.push('Project has no slides');
  } else if (value.slides.length > MAX_SLIDES_HARD) {
    errors.push(`Project has more than ${MAX_SLIDES_HARD} slides`);
  } else {
    const slideIds = new Set<string>();
    value.slides.forEach((slide: unknown, index: number) => {
      if (!isObject(slide)) {
        errors.push(`slide ${index + 1}: must be an object`);
        return;
      }
      if (!isNonEmptyString(slide.id)) {
        errors.push(`slide ${index + 1}: missing id`);
      } else if (slideIds.has(slide.id)) {
        errors.push(`slide ${index + 1}: duplicate slide id "${slide.id}"`);
      } else {
        slideIds.add(slide.id);
      }
      if (typeof slide.background !== 'string') errors.push(`slide ${index + 1}: background must be a string`);
      const elements = slide.elements;
      if (!Array.isArray(elements)) {
        errors.push(`slide ${index + 1}: elements must be an array`);
        return;
      }
      if (elements.length > MAX_ELEMENTS_PER_SLIDE) {
        errors.push(`slide ${index + 1}: more than ${MAX_ELEMENTS_PER_SLIDE} elements`);
      }
      const elementIds = new Set<string>();
      elements.forEach((element: unknown, elementIndex: number) => {
        validateElement(element, index, elementIndex, errors, warnings);
        if (isObject(element) && isNonEmptyString(element.id)) {
          if (elementIds.has(element.id)) {
            errors.push(`slide ${index + 1}, element ${elementIndex + 1}: duplicate element id "${element.id}"`);
          }
          elementIds.add(element.id);
        }
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, project: value as unknown as ProjectDocument, warnings };
}

/** Validates a single element (used before adding programmatically created ones). */
export function validateSlideElement(element: unknown): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  validateElement(element, 0, 0, errors, warnings);
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/** Structural check for a slide produced by a template, without a full document. */
export function validateTemplateSlide(slide: unknown): TemplateSlideResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObject(slide) || !isNonEmptyString(slide.id)) {
    return { ok: false, errors: ['Template slide must be an object with an id'] };
  }
  if (typeof slide.background !== 'string') {
    return { ok: false, errors: ['Template slide needs a background colour'] };
  }
  if (!Array.isArray(slide.elements)) {
    return { ok: false, errors: ['Template slide needs an elements array'] };
  }
  slide.elements.forEach((element: unknown, index: number) => {
    validateElement(element, 0, index, errors, warnings);
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, slide: slide as unknown as Slide };
}

