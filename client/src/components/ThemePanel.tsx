import React, { useState, useRef } from 'react';
import { Palette, Upload, Wand2, AlertTriangle, Check, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

// WCAG relative luminance
function getLuminance(hex: string) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const [R, G, B] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrastRatio(hex1: string, hex2: string) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (lightest + 0.05) / (darkest + 0.05);
}

export const ThemePanel: React.FC = () => {
  const { project, updateTheme } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedColors, setExtractedColors] = useState<{ primary?: string; secondary?: string; background?: string; text?: string } | null>(null);
  const [contrastWarning, setContrastWarning] = useState<string | null>(null);

  const validateFile = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (file.size > 5 * 1024 * 1024) {
        useEditorStore.getState().setStatusMessage('File too large. Maximum 5MB.');
        return resolve(false);
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        useEditorStore.getState().setStatusMessage('Unsupported file type.');
        return resolve(false);
      }
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 100) {
          useEditorStore.getState().setStatusMessage('Image is too small.');
          resolve(false);
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        useEditorStore.getState().setStatusMessage('Corrupt or unreadable image.');
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isValid = await validateFile(file);
    if (!isValid) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsExtracting(true);
    setExtractedColors(null);
    setContrastWarning(null);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imgSrc = event.target?.result as string;
      try {
        const { extractPaletteFromImage } = await import('../utils/colorExtractor');
        const palette = await extractPaletteFromImage(imgSrc);
        
        const updates: any = {};
        if (palette.primary) updates.primary = palette.primary;
        if (palette.secondary) updates.secondary = palette.secondary;
        if (palette.background) updates.background = palette.background;
        if (palette.text) updates.text = palette.text;
        
        if (Object.keys(updates).length > 0) {
          setExtractedColors(updates);
          
          // Check contrast
          const testPrimary = updates.primary || project!.theme.colors.primary;
          const testBg = updates.background || project!.theme.colors.background;
          const contrast = getContrastRatio(testPrimary, testBg);
          if (contrast < 4.5) {
            setContrastWarning(`Low contrast between Primary and Background (${contrast.toFixed(1)}:1). Aim for at least 4.5:1.`);
          }
          
          useEditorStore.getState().setStatusMessage('Colors extracted. Review and apply.');
        } else {
          useEditorStore.getState().setStatusMessage('Could not extract colors from image.');
        }
      } catch {
        useEditorStore.getState().setStatusMessage('Error extracting colors.');
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyExtractedColors = () => {
    if (!extractedColors) return;
    updateTheme({ colors: { ...project!.theme.colors, ...extractedColors } });
    setExtractedColors(null);
    setContrastWarning(null);
    useEditorStore.getState().setStatusMessage('Extracted colors applied to theme.');
  };

  const discardExtractedColors = () => {
    setExtractedColors(null);
    setContrastWarning(null);
    useEditorStore.getState().setStatusMessage('Extracted colors discarded.');
  };

  const handleDeepAnalysis = () => {
    useEditorStore.getState().setStatusMessage('Vision provider not configured (Deep Analysis unavailable)');
  };

  return (
    <div className="p-4 flex-1 flex flex-col overflow-y-auto">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Palette size={16} /> Theme & Style
      </h2>
      
      <div className="space-y-6">
        <div>
          <label className="text-xs text-neutral-500 mb-2 block">Reference Image</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png, image/jpeg, image/webp"
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            className="w-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white p-3 rounded text-sm border border-dashed border-neutral-600 transition-colors flex justify-center items-center gap-2"
          >
            <Upload size={16} /> 
            {isExtracting ? 'Analyzing...' : 'Upload Reference for Colors'}
          </button>

          <button 
            onClick={handleDeepAnalysis}
            className="w-full mt-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 p-2 rounded text-xs transition-colors flex justify-center items-center gap-2"
          >
            <Wand2 size={12} /> Deep Analysis (AI)
          </button>
        </div>

        {extractedColors && (
          <div className="p-3 border border-neutral-700 rounded bg-neutral-800/50">
            <h3 className="text-xs text-white mb-2 font-medium">Extracted Palette</h3>
            <div className="flex gap-2 mb-3">
              {Object.entries(extractedColors).map(([role, color]) => (
                <div key={role} className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded shadow" style={{ backgroundColor: color as string }} />
                  <span className="text-[10px] text-neutral-400 capitalize">{role}</span>
                </div>
              ))}
            </div>
            
            {contrastWarning && (
              <div className="flex items-start gap-2 text-amber-400 bg-amber-400/10 p-2 rounded mb-3 text-xs">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>{contrastWarning}</p>
              </div>
            )}
            
            <div className="flex gap-2">
              <button 
                onClick={applyExtractedColors}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1"
              >
                <Check size={14} /> Apply
              </button>
              <button 
                onClick={discardExtractedColors}
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1"
              >
                <X size={14} /> Discard
              </button>
            </div>
          </div>
        )}

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-neutral-700"></div>
          <span className="flex-shrink-0 mx-2 text-xs text-neutral-500">MANUAL CONTROLS</span>
          <div className="flex-grow border-t border-neutral-700"></div>
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Primary Color</label>
          <input 
            type="color" 
            value={project?.theme.colors.primary || '#000000'} 
            onChange={(e) => updateTheme({ colors: { ...project!.theme.colors, primary: e.target.value } })}
            className="w-full h-8 cursor-pointer rounded"
          />
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Accent Color</label>
          <input 
            type="color" 
            value={project?.theme.colors.accent || '#cccccc'} 
            onChange={(e) => updateTheme({ colors: { ...project!.theme.colors, accent: e.target.value } })}
            className="w-full h-8 cursor-pointer rounded"
          />
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Typography Scale (Body)</label>
          <input 
            type="range"
            min="12"
            max="32"
            value={project?.theme.typography?.bodySize || 16}
            onChange={(e) => updateTheme({ typography: { ...project!.theme.typography, bodySize: parseInt(e.target.value) } })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Social Handle</label>
          <input 
            type="text" 
            placeholder="@yourhandle"
            value={project?.theme.brand?.handle || ''}
            onChange={(e) => updateTheme({ brand: { ...project!.theme.brand, handle: e.target.value } })}
            className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
