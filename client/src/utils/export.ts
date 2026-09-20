import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import * as fabric from 'fabric';
import type { ProjectDocument, Slide } from '../types/schema';
import { createFabricObject, ensureFontsReady, renderSlideToDataUrl } from './renderer';
import { loadAsset } from './db';
import { collectAssetIds } from './assets';
import { CURRENT_SCHEMA_VERSION } from './validation';

export const BACKUP_FORMAT_VERSION = 1;
const PX_PER_INCH = 96;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'carousel';
}

function dataUrlPayload(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('Rendering produced an invalid data URL');
  return dataUrl.slice(commaIndex + 1);
}

/** Exact pixel dimensions of a rendered data URL (used by tests and QA). */
export async function measureDataUrlSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('The exported image could not be decoded'));
    image.src = dataUrl;
  });
}

export interface ImageExportOptions {
  format?: 'png' | 'jpeg';
  asZip?: boolean;
  /** Export only this slide (used by the single-image option). */
  slideId?: string | null;
  quality?: number;
}

/**
 * Exports one slide, or every slide as a sequential ZIP. Rendering always uses
 * the document snapshot that was passed in.
 */
export async function exportAsImages(project: ProjectDocument, options: ImageExportOptions = {}): Promise<string[]> {
  const format = options.format ?? 'png';
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  const base = sanitizeFilename(project.title || 'carousel');

  const filtered = options.slideId ? project.slides.filter((slide) => slide.id === options.slideId) : project.slides;
  const selected: Slide[] = filtered.length > 0 ? filtered : project.slides;

  const rendered: { filename: string; dataUrl: string }[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    const slide = selected[index] as Slide;
    const dataUrl = await renderSlideToDataUrl(slide, project, {
      format,
      quality: options.quality ?? (format === 'jpeg' ? 0.92 : undefined),
    });
    const position = project.slides.findIndex((candidate) => candidate.id === slide.id);
    const number = position >= 0 ? position + 1 : index + 1;
    rendered.push({ filename: `slide_${number}.${extension}`, dataUrl });
  }

  if (rendered.length === 0) throw new Error('There are no slides to export');

  if (options.asZip) {
    const zip = new JSZip();
    for (const item of rendered) {
      zip.file(item.filename, dataUrlPayload(item.dataUrl), { base64: true });
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${base}_images.zip`);
  } else {
    const first = rendered[0] as { filename: string; dataUrl: string };
    saveAs(first.dataUrl, `${base}_${first.filename}`);
  }

  return rendered.map((item) => item.filename);
}

/**
 * Rasterized PDF: one page per slide at the exact canvas size, in document
 * order. Text is *not* selectable in this format.
 */
export async function exportAsPdf(project: ProjectDocument): Promise<number> {
  await ensureFontsReady();

  const { width, height } = project.dimensions;
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
    compress: true,
  });

  let pages = 0;
  for (const slide of project.slides) {
    const dataUrl = await renderSlideToDataUrl(slide, project, { format: 'jpeg', quality: 0.95 });
    if (pages > 0) pdf.addPage([width, height]);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    pages += 1;
  }

  if (pages === 0) throw new Error('There are no slides to export');
  pdf.save(`${sanitizeFilename(project.title || 'carousel')}.pdf`);
  return pages;
}

interface ObjectPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

function placementOf(object: fabric.Object): ObjectPlacement {
  const width = Math.abs((object.width || 0) * (object.scaleX ?? 1));
  const height = Math.abs((object.height || 0) * (object.scaleY ?? 1));
  return {
    left: object.left ?? 0,
    top: object.top ?? 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

/**
 * PowerPoint export.
 * - Text stays editable text, shapes stay editable shapes.
 * - Images are embedded as PNG pictures with the crop already applied.
 * Known limits: rotation, per-element opacity, letter spacing and exact line
 * height are not representable in this mapping (documented in docs/qa/handoff.md).
 */
export async function exportAsPptx(project: ProjectDocument): Promise<void> {
  await ensureFontsReady();

  const pres = new pptxgen();
  const widthInches = project.dimensions.width / PX_PER_INCH;
  const heightInches = project.dimensions.height / PX_PER_INCH;
  pres.defineLayout({ name: 'PROX_CUSTOM', width: widthInches, height: heightInches });
  pres.layout = 'PROX_CUSTOM';

  for (const slide of project.slides) {
    const pptxSlide = pres.addSlide();
    pptxSlide.background = { color: (slide.background || '#ffffff').replace('#', '') };

    for (const element of slide.elements) {
      const x = element.left / PX_PER_INCH;
      const y = element.top / PX_PER_INCH;
      const w = Math.max(0.05, element.width / PX_PER_INCH);
      const h = Math.max(0.05, element.height / PX_PER_INCH);

      if (element.type === 'text') {
        pptxSlide.addText(element.text, {
          x,
          y,
          w,
          h,
          fontSize: Math.max(4, element.fontSize * 0.75), // px -> pt
          fontFace: element.fontFamily,
          color: (element.fill || '#000000').replace('#', ''),
          bold: element.fontWeight === 'bold',
          italic: element.fontStyle === 'italic',
          align: element.textAlign,
          valign: 'top',
        });
        continue;
      }

      const object = await createFabricObject(element);
      if (!object) continue;

      if (element.type === 'image') {
        const placement = placementOf(object);
        const dataUrl = object.toDataURL({ format: 'png', multiplier: 1 });
        pptxSlide.addImage({
          data: dataUrl,
          x: placement.left / PX_PER_INCH,
          y: placement.top / PX_PER_INCH,
          w: Math.max(0.05, placement.width / PX_PER_INCH),
          h: Math.max(0.05, placement.height / PX_PER_INCH),
        });
        continue;
      }

      const fillColor = (element.fill || '#ffffff').replace('#', '');
      if (element.type === 'rectangle' || element.type === 'circle') {
        pptxSlide.addShape(element.type === 'circle' ? pres.ShapeType.ellipse : pres.ShapeType.rect, {
          x,
          y,
          w,
          h,
          fill: { color: fillColor },
          line: element.stroke
            ? { color: element.stroke.replace('#', ''), width: element.strokeWidth ?? 1 }
            : { color: fillColor, width: 0 },
        });
        continue;
      }

      if (element.type === 'line') {
        pptxSlide.addShape(pres.ShapeType.line, {
          x,
          y,
          w,
          h,
          line: {
            color: (element.stroke ?? element.fill ?? '#000000').replace('#', ''),
            width: element.strokeWidth ?? 2,
          },
        });
      }
    }
  }

  await pres.writeFile({ fileName: `${sanitizeFilename(project.title || 'carousel')}.pptx` });
}

/** Plain JSON export. Images are *not* included - use the .prox backup for that. */
export function exportAsJson(project: ProjectDocument): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  saveAs(blob, `${sanitizeFilename(project.title || 'carousel')}.json`);
}

/**
 * Complete backup: the document plus every uploaded image, in one archive.
 * A JSON file with dangling image references is not a complete backup, which is
 * why assets are embedded here.
 */
export async function exportAsBackup(project: ProjectDocument, assetIds?: string[]): Promise<number> {
  const zip = new JSZip();
  const ids = assetIds ?? collectAssetIds(project);

  zip.file('project.json', JSON.stringify(project, null, 2));

  const embedded: { assetId: string; path: string; type: string; name: string }[] = [];
  for (const assetId of ids) {
    const asset = await loadAsset(assetId);
    if (!asset) continue;
    const path = `assets/${assetId}`;
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    zip.file(path, bytes);
    embedded.push({ assetId, path, type: asset.type, name: asset.name });
  }

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        format: 'prox-backup',
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: project.schemaVersion ?? CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        projectId: project.id,
        slideCount: project.slides.length,
        assets: embedded,
      },
      null,
      2,
    ),
  );

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${sanitizeFilename(project.title || 'carousel')}_backup.prox`);
  return embedded.length;
}

