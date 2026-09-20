import * as fabric from 'fabric';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import type { ProjectDocument, Slide } from '../types/schema';

// Helper to render a single slide to a data URL
const renderSlideToDataURL = async (slide: Slide, project: ProjectDocument, format: 'png' | 'jpeg' = 'png', quality = 1): Promise<string> => {
  return new Promise((resolve) => {
    const canvasElement = document.createElement('canvas');
    const fCanvas = new fabric.Canvas(canvasElement, {
      width: project.dimensions.width,
      height: project.dimensions.height,
    });

    // Set background
    fCanvas.backgroundColor = slide.background || '#ffffff';

    // Add elements
    slide.elements.forEach((el) => {
      let fabricObj;
      if (el.type === 'text') {
        fabricObj = new fabric.IText(el.text, {
          left: el.left,
          top: el.top,
          width: el.width,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle,
          textAlign: el.textAlign,
          fill: el.fill,
          lineHeight: el.lineHeight,
          charSpacing: el.charSpacing,
          angle: el.rotation,
          opacity: el.opacity,
        });
      } else if (el.type === 'rectangle') {
        fabricObj = new fabric.Rect({
          left: el.left,
          top: el.top,
          width: el.width,
          height: el.height,
          fill: el.fill,
          angle: el.rotation,
          opacity: el.opacity,
          rx: el.rx,
          ry: el.ry,
        });
      }
      
      if (fabricObj) {
        fCanvas.add(fabricObj);
      }
    });

    fCanvas.renderAll();
    
    // Slight delay to ensure fonts/rendering is complete
    setTimeout(() => {
      const dataUrl = fCanvas.toDataURL({ format, quality, multiplier: 1 });
      fCanvas.dispose();
      resolve(dataUrl);
    }, 100);
  });
};

export const exportAsImages = async (project: ProjectDocument, format: 'png' | 'jpeg' = 'png', asZip: boolean = false) => {
  if (asZip) {
    const zip = new JSZip();
    for (let i = 0; i < project.slides.length; i++) {
      const dataUrl = await renderSlideToDataURL(project.slides[i], project, format);
      const base64Data = dataUrl.split(',')[1];
      zip.file(`slide_${i + 1}.${format}`, base64Data, { base64: true });
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${project.title || 'carousel'}_images.zip`);
  } else {
    const dataUrl = await renderSlideToDataURL(project.slides[0], project, format);
    saveAs(dataUrl, `${project.title || 'carousel'}_slide_1.${format}`);
  }
};

export const exportAsPdf = async (project: ProjectDocument) => {
  const pdf = new jsPDF({
    orientation: project.dimensions.width > project.dimensions.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [project.dimensions.width, project.dimensions.height],
  });

  for (let i = 0; i < project.slides.length; i++) {
    const dataUrl = await renderSlideToDataURL(project.slides[i], project, 'jpeg', 0.95);
    
    if (i > 0) {
      pdf.addPage([project.dimensions.width, project.dimensions.height]);
    }
    
    pdf.addImage(dataUrl, 'JPEG', 0, 0, project.dimensions.width, project.dimensions.height);
  }

  pdf.save(`${project.title || 'carousel'}.pdf`);
};

export const exportAsPptx = async (project: ProjectDocument) => {
  const pres = new pptxgen();
  
  // Convert dimensions to inches for PPTX (assuming 96 DPI for web)
  const widthInches = project.dimensions.width / 96;
  const heightInches = project.dimensions.height / 96;
  
  pres.defineLayout({ name: 'CUSTOM', width: widthInches, height: heightInches });
  pres.layout = 'CUSTOM';

  for (const slide of project.slides) {
    const pptxSlide = pres.addSlide();
    pptxSlide.background = { color: (slide.background || '#ffffff').replace('#', '') };

    for (const el of slide.elements) {
      // Map coordinates to inches
      const x = el.left / 96;
      const y = el.top / 96;
      const w = el.width / 96;
      const h = el.height / 96;
      
      if (el.type === 'text') {
        pptxSlide.addText(el.text, {
          x, y, w, h,
          fontSize: el.fontSize * 0.75, // pt conversion
          fontFace: el.fontFamily,
          color: el.fill.replace('#', ''),
          bold: el.fontWeight === 'bold',
          italic: el.fontStyle === 'italic',
          align: el.textAlign as any,
          valign: 'top',
        });
      } else if (el.type === 'rectangle') {
        pptxSlide.addShape(pres.ShapeType.rect, {
          x, y, w, h,
          fill: { color: el.fill.replace('#', '') },
          line: el.stroke ? { color: el.stroke.replace('#', ''), width: el.strokeWidth || 1 } : undefined
        });
      }
    }
  }

  pres.writeFile({ fileName: `${project.title || 'carousel'}.pptx` });
};

export const exportAsBackup = async (project: ProjectDocument) => {
  const zip = new JSZip();
  
  zip.file('project.json', JSON.stringify(project, null, 2));
  
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${project.title || 'carousel'}_backup.prox`);
};
